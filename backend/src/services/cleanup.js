import { db, getAllConfig } from '../db/index.js';

/**
 * Service định kỳ dọn dẹp dữ liệu telemetry cũ để giữ SQLite tinh gọn.
 */
export function startDataCleanupService() {
  const runCleanup = () => {
    try {
      const config = getAllConfig();
      const retentionDays = parseInt(config.data_retention_days || '30', 10);
      const cutoffSec = Math.floor(Date.now() / 1000) - (retentionDays * 86400);

      const res = db.prepare('DELETE FROM telemetry WHERE ts < ?').run(cutoffSec);
      if (res.changes > 0) {
        console.log(`🧹 [Data Cleanup] Purged ${res.changes} telemetry records older than ${retentionDays} days.`);
      }
    } catch (err) {
      console.error('Error during data cleanup:', err.message);
    }
  };

  // Chạy ngay khi khởi động và lặp lại mỗi 24 giờ
  runCleanup();
  setInterval(runCleanup, 24 * 60 * 60 * 1000);
}
