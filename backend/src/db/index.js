import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'data/landslide.db');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`[Database] Connecting to SQLite database at: ${DB_PATH}`);
export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Schema
export function initDatabase() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  seedDefaultUsers();
  seedDefaultConfig();
  seedRuntimeState();
  console.log('✔ [Database] Schema and initial seed initialized successfully.');
}

function seedDefaultUsers() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const adminUser = process.env.INITIAL_ADMIN_USERNAME || 'admin';
    const adminPass = process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePassword@2026!';
    const viewerUser = process.env.INITIAL_VIEWER_USERNAME || 'viewer';
    const viewerPass = process.env.INITIAL_VIEWER_PASSWORD || 'ViewerGuestPass@2026!';

    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync(adminPass, salt);
    const viewerHash = bcrypt.hashSync(viewerPass, salt);

    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, role)
      VALUES (?, ?, ?)
    `);

    insertUser.run(adminUser, adminHash, 'admin');
    insertUser.run(viewerUser, viewerHash, 'viewer');
    console.log(`✔ [Database] Seeded default users: "${adminUser}" (admin), "${viewerUser}" (viewer)`);
  }
}

function seedDefaultConfig() {
  const count = db.prepare('SELECT COUNT(*) as count FROM system_config').get().count;
  if (count === 0) {
    const defaults = [
      // Proposed Algorithm Parameters
      ['rain_window_short_min', '10', 'algorithm', 'Cửa sổ trượt mưa ngắn hạn (phút)'],
      ['rain_window_long_min', '60', 'algorithm', 'Cửa sổ trượt mưa dài hạn (phút)'],
      ['rain_short_threshold_mm', '3.0', 'algorithm', 'Ngưỡng mưa ngắn hạn kích hoạt cảnh báo (mm)'],
      ['rain_long_threshold_mm', '10.0', 'algorithm', 'Ngưỡng mưa dài hạn kích hoạt cảnh báo (mm)'],
      ['soil_derivative_threshold', '1.5', 'algorithm', 'Tốc độ tăng độ ẩm dốc (%/phút)'],
      ['soil_high_threshold', '65.0', 'algorithm', 'Ngưỡng độ ẩm đất cao (%)'],
      ['tilt_delta_threshold', '2.0', 'algorithm', 'Ngưỡng biến thiên góc nghiêng (độ)'],
      ['tilt_persistence_sec', '6', 'algorithm', 'Thời gian duy trì biến thiên góc nghiêng để xác nhận (giây)'],
      ['filter_ema_alpha', '0.3', 'algorithm', 'Hệ số lọc trung bình trượt EMA (0.1 - 0.9)'],

      // Baseline Algorithm Parameters
      ['baseline_soil_threshold', '65.0', 'baseline', 'Ngưỡng độ ẩm cố định baseline (%)'],
      ['baseline_rain_threshold', '5.0', 'baseline', 'Ngưỡng lượng mưa tích lũy cố định baseline (mm)'],
      ['baseline_tilt_threshold', '2.0', 'baseline', 'Ngưỡng góc nghiêng cố định baseline (độ)'],

      // Safety & Calibration
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
    console.log(`✔ [Database] Seeded ${defaults.length} default configuration parameters.`);
  }
}

function seedRuntimeState() {
  const row = db.prepare('SELECT id FROM runtime_state WHERE id = 1').get();
  if (!row) {
    db.prepare(`
      INSERT INTO runtime_state (id, proposed_state, baseline_state, is_latched, control_mode, active_scenario_tag)
      VALUES (1, 'NORMAL', 'NORMAL', 0, 'AUTO', 'dry')
    `).run();
  }
}

// Config Helper
export function getAllConfig() {
  const rows = db.prepare('SELECT key, value, category, description FROM system_config').all();
  const map = {};
  for (const r of rows) {
    const num = parseFloat(r.value);
    map[r.key] = isNaN(num) ? r.value : num;
  }
  return map;
}

export function updateConfigKey(key, value) {
  const stmt = db.prepare('UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?');
  stmt.run(String(value), key);
}
