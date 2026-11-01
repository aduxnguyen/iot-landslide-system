import { db } from '../db/index.js';

export function getAlarmLogs(req, res) {
  const { algorithm, state, limit = 100 } = req.query;
  const parsedLimit = Math.min(parseInt(limit, 10), 500);

  let query = 'SELECT * FROM alarm_events WHERE 1=1';
  const params = [];

  if (algorithm) {
    query += ' AND algorithm = ?';
    params.push(algorithm);
  }
  if (state) {
    query += ' AND new_state = ?';
    params.push(state);
  }

  query += ' ORDER BY id DESC LIMIT ?';
  params.push(parsedLimit);

  const rows = db.prepare(query).all(...params);
  return res.json({ ok: true, logs: rows });
}

export function getAuditLogs(req, res) {
  const { limit = 100 } = req.query;
  const parsedLimit = Math.min(parseInt(limit, 10), 500);

  const rows = db.prepare(`
    SELECT id, ts, user_id, username, action, details, ip_address, status, created_at
    FROM audit_logs
    ORDER BY id DESC
    LIMIT ?
  `).all(parsedLimit);

  return res.json({ ok: true, auditLogs: rows });
}

export function exportAuditCsv(req, res) {
  const rows = db.prepare(`
    SELECT id, ts, username, action, details, ip_address, status, created_at
    FROM audit_logs
    ORDER BY id ASC
  `).all();

  let csv = 'id,timestamp,iso_time,username,action,details,ip_address,status\n';
  for (const r of rows) {
    const iso = new Date(r.ts * 1000).toISOString();
    const sanitizedDetails = (r.details || '').replace(/"/g, '""');
    csv += `${r.id},${r.ts},"${iso}","${r.username}","${r.action}","${sanitizedDetails}","${r.ip_address}","${r.status}"\n`;
  }

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`audit_logs_${Date.now()}.csv`);
  return res.send(csv);
}
