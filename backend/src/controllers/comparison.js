import { db } from '../db/index.js';

export function getComparisonSummary(req, res) {
  // Thống kê tổng số cảnh báo của mỗi thuật toán
  const statsA = db.prepare(`
    SELECT
      COUNT(*) as total_events,
      SUM(CASE WHEN new_state = 'WATCH' THEN 1 ELSE 0 END) as watch_count,
      SUM(CASE WHEN new_state = 'MOVEMENT' THEN 1 ELSE 0 END) as movement_count,
      SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as true_alarms,
      SUM(CASE WHEN is_valid = 0 THEN 1 ELSE 0 END) as false_alarms,
      SUM(CASE WHEN is_valid IS NULL THEN 1 ELSE 0 END) as unreviewed
    FROM alarm_events
    WHERE algorithm = 'PROPOSED'
  `).get();

  const statsB = db.prepare(`
    SELECT
      COUNT(*) as total_events,
      SUM(CASE WHEN new_state = 'WATCH' THEN 1 ELSE 0 END) as watch_count,
      SUM(CASE WHEN new_state = 'MOVEMENT' THEN 1 ELSE 0 END) as movement_count,
      SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as true_alarms,
      SUM(CASE WHEN is_valid = 0 THEN 1 ELSE 0 END) as false_alarms,
      SUM(CASE WHEN is_valid IS NULL THEN 1 ELSE 0 END) as unreviewed
    FROM alarm_events
    WHERE algorithm = 'BASELINE'
  `).get();

  // Tính tỉ lệ cảnh báo sai (False Alarm Rate)
  const calcFar = (falseCount, trueCount) => {
    const total = falseCount + trueCount;
    if (total === 0) return 0;
    return parseFloat(((falseCount / total) * 100).toFixed(1));
  };

  const summary = {
    proposed: {
      ...statsA,
      false_alarm_rate_pct: calcFar(statsA.false_alarms, statsA.true_alarms),
    },
    baseline: {
      ...statsB,
      false_alarm_rate_pct: calcFar(statsB.false_alarms, statsB.true_alarms),
    }
  };

  return res.json({ ok: true, summary });
}

export function getComparisonTimeline(req, res) {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);

  const events = db.prepare(`
    SELECT id, ts, algorithm, old_state, new_state, reason, scenario_tag, is_valid, created_at
    FROM alarm_events
    ORDER BY ts DESC
    LIMIT ?
  `).all(limit);

  return res.json({ ok: true, events });
}

export function labelAlarmEvent(req, res) {
  const { eventId, isValid, notes } = req.body;
  if (!eventId) return res.status(400).json({ ok: false, error: 'Thiếu eventId.' });

  const validVal = isValid === null ? null : (isValid ? 1 : 0);
  db.prepare(`
    UPDATE alarm_events
    SET is_valid = ?, notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(validVal, notes || null, eventId);

  return res.json({ ok: true, message: 'Đã cập nhật nhãn đánh giá sự kiện.' });
}

export function exportComparisonCsv(req, res) {
  const rows = db.prepare(`
    SELECT id, ts, algorithm, old_state, new_state, reason, scenario_tag, is_valid, notes, created_at
    FROM alarm_events
    ORDER BY ts ASC
  `).all();

  let csv = 'id,timestamp,iso_time,algorithm,old_state,new_state,scenario_tag,is_valid_evaluated,reason,notes\n';
  for (const r of rows) {
    const iso = new Date(r.ts * 1000).toISOString();
    let validityStr = 'Chưa đánh giá';
    if (r.is_valid === 1) validityStr = 'Cảnh báo đúng (True Alarm)';
    if (r.is_valid === 0) validityStr = 'Cảnh báo sai (False Alarm)';

    const sanitizedReason = (r.reason || '').replace(/"/g, '""');
    const sanitizedNotes = (r.notes || '').replace(/"/g, '""');

    csv += `${r.id},${r.ts},"${iso}",${r.algorithm},${r.old_state},${r.new_state},"${r.scenario_tag || ''}","${validityStr}","${sanitizedReason}","${sanitizedNotes}"\n`;
  }

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`algorithm_comparison_report_${Date.now()}.csv`);
  return res.send(csv);
}
