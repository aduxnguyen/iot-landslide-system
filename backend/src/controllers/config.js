import { db, getAllConfig, updateConfigKey } from '../db/index.js';
import { reloadAlgorithmConfig } from '../algorithms/index.js';
import { getClientIp, recordAuditLog } from '../middleware/auth.js';

export function getConfig(req, res) {
  const configs = db.prepare('SELECT key, value, category, description, updated_at FROM system_config ORDER BY category, key').all();
  const runtime = db.prepare('SELECT active_scenario_tag, control_mode FROM runtime_state WHERE id = 1').get() || {};
  return res.json({ ok: true, configs, runtime });
}

export function updateConfig(req, res) {
  const clientIp = getClientIp(req);
  const user = req.user;
  const updates = req.body; // { key: value, ... }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ ok: false, error: 'Dữ liệu cấu hình không hợp lệ.' });
  }

  const updateStmt = db.prepare('UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?');

  let updatedCount = 0;
  for (const [key, val] of Object.entries(updates)) {
    // Validate bounds
    const num = parseFloat(val);
    if (isNaN(num) && typeof val !== 'string') continue;

    updateStmt.run(String(val), key);
    updatedCount++;
  }

  // Reload parameters into memory
  reloadAlgorithmConfig();

  recordAuditLog({
    userId: user.id,
    username: user.username,
    action: 'UPDATE_SYSTEM_CONFIG',
    details: `Đã cập nhật ${updatedCount} tham số cấu hình thuật toán/hệ thống`,
    ip: clientIp,
    status: 'SUCCESS'
  });

  return res.json({ ok: true, message: `Đã cập nhật thành công ${updatedCount} tham số.`, configs: getAllConfig() });
}

export function resetConfigDefaults(req, res) {
  const clientIp = getClientIp(req);
  const user = req.user;

  db.exec('DELETE FROM system_config;');

  // Seed lại defaults
  const defaults = [
    ['rain_window_short_min', '10', 'algorithm', 'Cửa sổ trượt mưa ngắn hạn (phút)'],
    ['rain_window_long_min', '60', 'algorithm', 'Cửa sổ trượt mưa dài hạn (phút)'],
    ['rain_short_threshold_mm', '3.0', 'algorithm', 'Ngưỡng mưa ngắn hạn kích hoạt cảnh báo (mm)'],
    ['rain_long_threshold_mm', '10.0', 'algorithm', 'Ngưỡng mưa dài hạn kích hoạt cảnh báo (mm)'],
    ['soil_derivative_threshold', '1.5', 'algorithm', 'Tốc độ tăng độ ẩm dốc (%/phút)'],
    ['soil_high_threshold', '65.0', 'algorithm', 'Ngưỡng độ ẩm đất cao (%)'],
    ['tilt_delta_threshold', '2.0', 'algorithm', 'Ngưỡng biến thiên góc nghiêng (độ)'],
    ['tilt_persistence_sec', '6', 'algorithm', 'Thời gian duy trì biến thiên góc nghiêng để xác nhận (giây)'],
    ['filter_ema_alpha', '0.3', 'algorithm', 'Hệ số lọc trung bình trượt EMA (0.1 - 0.9)'],
    ['baseline_soil_threshold', '65.0', 'baseline', 'Ngưỡng độ ẩm cố định baseline (%)'],
    ['baseline_rain_threshold', '5.0', 'baseline', 'Ngưỡng lượng mưa tích lũy cố định baseline (mm)'],
    ['baseline_tilt_threshold', '2.0', 'baseline', 'Ngưỡng góc nghiêng cố định baseline (độ)'],
    ['safe_open_tilt_threshold', '0.8', 'safety', 'Ngưỡng góc nghiêng tối đa cho phép mở barie an toàn (độ)'],
    ['safe_open_duration_sec', '10', 'safety', 'Thời gian góc nghiêng phải ổn định dưới ngưỡng trước khi cho phép mở barie (giây)'],
    ['calibration_soil_dry_raw', '850', 'calibration', 'Giá trị ADC đất khô hoàn toàn (0%)'],
    ['calibration_soil_wet_raw', '420', 'calibration', 'Giá trị ADC đất ướt bão hòa (100%)'],
    ['calibration_zero_tilt_x', '0.0', 'calibration', 'Góc lệch zero trục X (độ)'],
    ['calibration_zero_tilt_y', '0.0', 'calibration', 'Góc lệch zero trục Y (độ)'],
    ['data_retention_days', '30', 'system', 'Số ngày lưu trữ telemetry trước khi dọn dẹp']
  ];

  const insertStmt = db.prepare('INSERT INTO system_config (key, value, category, description) VALUES (?, ?, ?, ?)');
  for (const [key, val, cat, desc] of defaults) {
    insertStmt.run(key, val, cat, desc);
  }

  reloadAlgorithmConfig();

  recordAuditLog({
    userId: user.id,
    username: user.username,
    action: 'RESET_CONFIG_DEFAULTS',
    details: 'Đã khôi phục các tham số cấu hình về giá trị mặc định nhà sản xuất',
    ip: clientIp,
    status: 'SUCCESS'
  });

  return res.json({ ok: true, message: 'Đã khôi phục cài đặt mặc định thành công!', configs: getAllConfig() });
}

export function setScenarioTag(req, res) {
  const { scenario } = req.body;
  const valid = ['dry', 'soaking', 'movement', 'custom'];
  if (!scenario || !valid.includes(scenario)) {
    return res.status(400).json({ ok: false, error: `Kịch bản phải là một trong các giá trị: ${valid.join(', ')}` });
  }

  db.prepare('UPDATE runtime_state SET active_scenario_tag = ? WHERE id = 1').run(scenario);
  return res.json({ ok: true, scenario, message: `Đã kích hoạt gắn nhãn thực nghiệm: ${scenario}` });
}

export function calibrateZeroTilt(req, res) {
  const clientIp = getClientIp(req);
  const latestBottom = db.prepare(`SELECT tilt_x, tilt_y FROM telemetry WHERE node_id = 'node_bottom' ORDER BY id DESC LIMIT 1`).get();
  if (!latestBottom || latestBottom.tilt_x === null) {
    return res.status(400).json({ ok: false, error: 'Chưa nhận được dữ liệu góc nghiêng từ node_bottom.' });
  }

  updateConfigKey('calibration_zero_tilt_x', latestBottom.tilt_x);
  updateConfigKey('calibration_zero_tilt_y', latestBottom.tilt_y);
  reloadAlgorithmConfig();

  recordAuditLog({
    userId: req.user.id,
    username: req.user.username,
    action: 'CALIBRATE_ZERO_TILT',
    details: `Đặt điểm 0 cho góc nghiêng: X=${latestBottom.tilt_x}°, Y=${latestBottom.tilt_y}°`,
    ip: clientIp,
    status: 'SUCCESS'
  });

  return res.json({
    ok: true,
    message: `Đã hiệu chuẩn điểm 0 thành công: X=${latestBottom.tilt_x}°, Y=${latestBottom.tilt_y}°`,
    zeroX: latestBottom.tilt_x,
    zeroY: latestBottom.tilt_y
  });
}
