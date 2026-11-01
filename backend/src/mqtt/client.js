import mqtt from 'mqtt';
import { db } from '../db/index.js';
import { processIncomingTelemetry } from '../algorithms/index.js';

let client = null;
let broadcastCallback = null;

// Lưu trữ các command đang chờ ACK { cmd_id: { resolve, reject, timer } }
export const pendingCommands = new Map();

// Trạng thái node mới nhất
const nodeHeartbeats = {
  node_top: { lastSeen: 0, status: 'offline', rssi: null },
  node_bottom: { lastSeen: 0, status: 'offline', rssi: null }
};

export function initMqttClient(broadcastFn) {
  broadcastCallback = broadcastFn;

  const host = process.env.MQTT_HOST || '127.0.0.1';
  const port = process.env.MQTT_PORT || 1883;
  const username = process.env.MQTT_USER || 'iot_user';
  const password = process.env.MQTT_PASSWORD || 'iot_secure_pass2026';
  const clientId = process.env.MQTT_CLIENT_ID || 'landslide_server_' + Math.random().toString(16).substring(2, 8);

  console.log(`[MQTT] Connecting to broker at mqtt://${host}:${port} as ${clientId}...`);

  client = mqtt.connect(`mqtt://${host}:${port}`, {
    clientId,
    username,
    password,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 5000
  });

  client.on('connect', () => {
    console.log('✔ [MQTT] Connected successfully to Mosquitto Broker.');

    // Subscribe to all relevant topics
    client.subscribe([
      'landslide/node_top/telemetry',
      'landslide/node_bottom/telemetry',
      'landslide/node_top/status',
      'landslide/node_bottom/status',
      'landslide/node_bottom/cmd_ack'
    ], { qos: 1 }, (err) => {
      if (err) console.error('Subscription error:', err);
      else console.log('✔ [MQTT] Subscribed to telemetry, status, and cmd_ack topics.');
    });
  });

  client.on('message', (topic, payload) => {
    handleIncomingMessage(topic, payload);
  });

  client.on('error', (err) => {
    console.error('[MQTT Client Error]:', err.message);
  });

  client.on('offline', () => {
    console.warn('⚠ [MQTT] Broker connection went offline.');
  });

  // Watchdog kiểm tra node offline (mỗi 3 giây kiểm tra xem quá 6 giây ~ 3 chu kỳ có tin không)
  setInterval(checkNodesOffline, 3000);

  return client;
}

export function getMqttClient() {
  return client;
}

function handleIncomingMessage(topic, payload) {
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Status Topic (Last Will / Online)
  if (topic === 'landslide/node_top/status') {
    const status = payload.toString().trim();
    nodeHeartbeats.node_top.status = status;
    nodeHeartbeats.node_top.lastSeen = nowSec;
    db.prepare('UPDATE runtime_state SET node_top_status = ?, node_top_last_seen = ? WHERE id = 1').run(status, nowSec);
    broadcastStatusUpdate();
    return;
  }

  if (topic === 'landslide/node_bottom/status') {
    const status = payload.toString().trim();
    nodeHeartbeats.node_bottom.status = status;
    nodeHeartbeats.node_bottom.lastSeen = nowSec;
    db.prepare('UPDATE runtime_state SET node_bottom_status = ?, node_bottom_last_seen = ? WHERE id = 1').run(status, nowSec);
    broadcastStatusUpdate();
    return;
  }

  // 2. Command ACK Topic
  if (topic === 'landslide/node_bottom/cmd_ack') {
    try {
      const ack = JSON.parse(payload.toString());
      console.log(`[MQTT] Received CMD_ACK for cmd_id=${ack.cmd_id}:`, ack);

      // Cập nhật Database
      db.prepare(`
        UPDATE control_commands
        SET status = 'acked', ack_msg = ?, acked_at = CURRENT_TIMESTAMP
        WHERE cmd_id = ?
      `).run(ack.msg || 'OK', ack.cmd_id);

      // Cập nhật trạng thái phần cứng nếu có gửi kèm trong ACK
      if (ack.state) {
        if (ack.state.barrier) {
          db.prepare('UPDATE runtime_state SET barrier_state = ? WHERE id = 1').run(ack.state.barrier);
        }
        if (ack.state.buzzer !== undefined) {
          db.prepare('UPDATE runtime_state SET buzzer_state = ? WHERE id = 1').run(ack.state.buzzer ? 1 : 0);
        }
      }

      // Xóa timer và resolve promise
      if (pendingCommands.has(ack.cmd_id)) {
        const { resolve, timer } = pendingCommands.get(ack.cmd_id);
        clearTimeout(timer);
        pendingCommands.delete(ack.cmd_id);
        resolve({ ok: true, ack });
      }

      // Broadcast thông báo cập nhật lệnh
      if (broadcastCallback) {
        broadcastCallback({
          type: 'CMD_ACK',
          data: ack
        });
      }
    } catch (e) {
      console.error('Error parsing cmd_ack:', e.message);
    }
    return;
  }

  // 3. Telemetry Topics
  try {
    const data = JSON.parse(payload.toString());

    if (topic === 'landslide/node_top/telemetry') {
      nodeHeartbeats.node_top.lastSeen = nowSec;
      nodeHeartbeats.node_top.status = 'online';
      nodeHeartbeats.node_top.rssi = data.rssi ?? null;

      db.prepare(`
        INSERT INTO telemetry (ts, node_id, rain_mm_step, soil_top, rssi)
        VALUES (?, 'node_top', ?, ?, ?)
      `).run(data.ts || nowSec, data.rain_mm_step ?? 0, data.soil_top ?? null, data.rssi ?? null);

      db.prepare('UPDATE runtime_state SET node_top_status = "online", node_top_last_seen = ? WHERE id = 1').run(nowSec);

      // Gửi vào engine thuật toán
      processIncomingTelemetry({
        ts: data.ts || nowSec,
        rain_mm_step: data.rain_mm_step,
        soil_top: data.soil_top
      });

      if (broadcastCallback) {
        broadcastCallback({
          type: 'TELEMETRY_TOP',
          data: { ...data, status: 'online' }
        });
      }
    }

    if (topic === 'landslide/node_bottom/telemetry') {
      nodeHeartbeats.node_bottom.lastSeen = nowSec;
      nodeHeartbeats.node_bottom.status = 'online';
      nodeHeartbeats.node_bottom.rssi = data.rssi ?? null;

      db.prepare(`
        INSERT INTO telemetry (ts, node_id, soil_bottom, tilt_x, tilt_y, tilt_delta, state_local, barrier, buzzer, rssi)
        VALUES (?, 'node_bottom', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.ts || nowSec,
        data.soil_bottom ?? null,
        data.tilt_x ?? null,
        data.tilt_y ?? null,
        data.tilt_delta ?? null,
        data.state_local || 'NORMAL',
        data.barrier || 'OPEN',
        data.buzzer ? 1 : 0,
        data.rssi ?? null
      );

      db.prepare(`
        UPDATE runtime_state SET
          node_bottom_status = "online",
          node_bottom_last_seen = ?,
          barrier_state = ?,
          buzzer_state = ?
        WHERE id = 1
      `).run(nowSec, data.barrier || 'OPEN', data.buzzer ? 1 : 0);

      // Gửi vào engine thuật toán
      processIncomingTelemetry({
        ts: data.ts || nowSec,
        soil_bottom: data.soil_bottom,
        tilt_x: data.tilt_x,
        tilt_y: data.tilt_y,
        tilt_delta: data.tilt_delta,
        state_local: data.state_local
      });

      if (broadcastCallback) {
        broadcastCallback({
          type: 'TELEMETRY_BOTTOM',
          data: { ...data, status: 'online' }
        });
      }
    }
  } catch (err) {
    console.error('Error processing telemetry payload:', err.message);
  }
}

// Watchdog: kiểm tra node không gửi dữ liệu quá 6s (~3 chu kỳ 2s)
function checkNodesOffline() {
  const now = Math.floor(Date.now() / 1000);
  let changed = false;

  if (nodeHeartbeats.node_top.status === 'online' && (now - nodeHeartbeats.node_top.lastSeen > 6)) {
    nodeHeartbeats.node_top.status = 'offline';
    db.prepare('UPDATE runtime_state SET node_top_status = "offline" WHERE id = 1').run();
    console.warn('⚠ [Watchdog] Node Top offline (no telemetry for > 6s).');
    changed = true;
  }

  if (nodeHeartbeats.node_bottom.status === 'online' && (now - nodeHeartbeats.node_bottom.lastSeen > 6)) {
    nodeHeartbeats.node_bottom.status = 'offline';
    db.prepare('UPDATE runtime_state SET node_bottom_status = "offline" WHERE id = 1').run();
    console.warn('⚠ [Watchdog] Node Bottom offline (no telemetry for > 6s).');
    changed = true;
  }

  if (changed) {
    broadcastStatusUpdate();
  }
}

function broadcastStatusUpdate() {
  if (broadcastCallback) {
    broadcastCallback({
      type: 'NODE_STATUS',
      data: {
        node_top: nodeHeartbeats.node_top,
        node_bottom: nodeHeartbeats.node_bottom
      }
    });
  }
}
