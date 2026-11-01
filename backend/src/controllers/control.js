import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { getMqttClient, pendingCommands } from '../mqtt/client.js';
import { getClientIp, recordAuditLog } from '../middleware/auth.js';
import { getAlgorithmInstances } from '../algorithms/index.js';

export async function sendControlCommand(req, res) {
  const clientIp = getClientIp(req);
  const user = req.user;
  const { action, value, force } = req.body;

  const validActions = [
    'barrier_close',
    'barrier_open',
    'buzzer_mute',
    'reset_alarm',
    'set_led_test',
    'set_mode'
  ];

  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ ok: false, error: `Hành động không hợp lệ. Cho phép: ${validActions.join(', ')}` });
  }

  // 1. Kiểm tra trạng thái kết nối của node_bottom
  const runtime = db.prepare('SELECT node_bottom_status, is_latched, control_mode FROM runtime_state WHERE id = 1').get() || {};
  if (runtime.node_bottom_status !== 'online') {
    recordAuditLog({
      userId: user.id,
      username: user.username,
      action: `CMD_${action.toUpperCase()}_REJECTED`,
      details: 'Node chấp hành (node_bottom) đang Offline. Lệnh bị hủy để bảo đảm an toàn.',
      ip: clientIp,
      status: 'FAILED'
    });

    return res.status(503).json({
      ok: false,
      error: 'ESP8266 chấp hành (node_bottom) đang OFFLINE! Không thể gửi lệnh điều khiển. Vui lòng kiểm tra nguồn và kết nối Wi-Fi của thiết bị tại mô hình.'
    });
  }

  // 2. Xử lý logic an toàn đối với lệnh Reset / Mở Barie
  if (action === 'reset_alarm' || action === 'barrier_open') {
    const { proposedAlgo } = getAlgorithmInstances();
    if (proposedAlgo && proposedAlgo.isLatched) {
      const resetCheck = proposedAlgo.resetLatch(Boolean(force));
      if (!resetCheck.ok) {
        return res.status(400).json({
          ok: false,
          requiresConfirm: true,
          error: resetCheck.msg
        });
      }
    }
  }

  // 3. Xử lý đổi chế độ AUTO / MANUAL
  if (action === 'set_mode') {
    const newMode = value === 'MANUAL' ? 'MANUAL' : 'AUTO';
    db.prepare('UPDATE runtime_state SET control_mode = ? WHERE id = 1').run(newMode);
    recordAuditLog({
      userId: user.id,
      username: user.username,
      action: 'SET_CONTROL_MODE',
      details: `Chuyển chế độ điều khiển thành ${newMode}`,
      ip: clientIp,
      status: 'SUCCESS'
    });
  }

  // 4. Phát lệnh MQTT với retry logic (tối đa 2 lần retry, timeout 5s mỗi lần)
  const mqttClient = getMqttClient();
  if (!mqttClient || !mqttClient.connected) {
    return res.status(503).json({ ok: false, error: 'Server mất kết nối tới MQTT Broker.' });
  }

  const cmdId = uuidv4();
  const cmdPayload = {
    cmd_id: cmdId,
    action,
    value: value !== undefined ? value : null,
    requested_by: user.username,
    ts: Math.floor(Date.now() / 1000)
  };

  // Lưu bản ghi lệnh vào Database
  db.prepare(`
    INSERT INTO control_commands (cmd_id, action, value, user_id, username, client_ip, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(cmdId, action, JSON.stringify(value ?? null), user.id, user.username, clientIp);

  try {
    const ackResult = await executeCommandWithRetry(mqttClient, cmdId, cmdPayload, 2, 5000);

    recordAuditLog({
      userId: user.id,
      username: user.username,
      action: `CMD_${action.toUpperCase()}`,
      details: `Lệnh đã được vi điều khiển thực thi thành công. Phản hồi: ${ackResult.ack?.msg || 'OK'}`,
      ip: clientIp,
      status: 'SUCCESS'
    });

    return res.json({
      ok: true,
      cmd_id: cmdId,
      message: ackResult.ack?.msg || 'Lệnh đã được thiết bị thực thi thành công!',
      state: ackResult.ack?.state
    });
  } catch (err) {
    db.prepare(`
      UPDATE control_commands
      SET status = 'timeout', ack_msg = ?
      WHERE cmd_id = ?
    `).run(err.message, cmdId);

    recordAuditLog({
      userId: user.id,
      username: user.username,
      action: `CMD_${action.toUpperCase()}_TIMEOUT`,
      details: `Quá thời gian chờ phản hồi ACK từ thiết bị: ${err.message}`,
      ip: clientIp,
      status: 'TIMEOUT'
    });

    return res.status(504).json({
      ok: false,
      cmd_id: cmdId,
      error: `Thiết bị không phản hồi xác nhận (ACK Timeout sau 2 lần thử lại). Vui lòng kiểm tra tín hiệu thực tế của ESP8266.`
    });
  }
}

// Hàm gửi lệnh có retry và timeout
function executeCommandWithRetry(client, cmdId, payload, maxRetries = 2, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const trySend = () => {
      attempts++;
      console.log(`[Control] Publishing cmd_id=${cmdId} (Attempt ${attempts}/${maxRetries + 1})...`);

      client.publish('landslide/node_bottom/cmd', JSON.stringify(payload), { qos: 1 });

      const timer = setTimeout(() => {
        if (attempts <= maxRetries) {
          console.warn(`[Control] Attempt ${attempts} timed out. Retrying cmd_id=${cmdId}...`);
          db.prepare('UPDATE control_commands SET retries = ? WHERE cmd_id = ?').run(attempts, cmdId);
          trySend();
        } else {
          pendingCommands.delete(cmdId);
          reject(new Error(`Timeout after ${maxRetries + 1} attempts (${(maxRetries + 1) * (timeoutMs / 1000)}s)`));
        }
      }, timeoutMs);

      pendingCommands.set(cmdId, { resolve, reject, timer });
    };

    trySend();
  });
}

// Lấy lịch sử lệnh điều khiển
export function getCommandHistory(req, res) {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const rows = db.prepare(`
    SELECT id, cmd_id, action, value, username, client_ip, status, retries, ack_msg, created_at, acked_at
    FROM control_commands
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);

  return res.json({ ok: true, commands: rows });
}
