import { db } from '../db/index.js';
import { getAlgorithmInstances } from '../algorithms/index.js';

export function getLatestTelemetry(req, res) {
  const runtime = db.prepare('SELECT * FROM runtime_state WHERE id = 1').get() || {};

  const latestTop = db.prepare(`
    SELECT ts, rain_mm_step, soil_top, rssi
    FROM telemetry WHERE node_id = 'node_top'
    ORDER BY id DESC LIMIT 1
  `).get() || {};

  const latestBottom = db.prepare(`
    SELECT ts, soil_bottom, tilt_x, tilt_y, tilt_delta, state_local, barrier, buzzer, rssi
    FROM telemetry WHERE node_id = 'node_bottom'
    ORDER BY id DESC LIMIT 1
  `).get() || {};

  // Tính mưa tích lũy 1h và 24h từ DB
  const nowSec = Math.floor(Date.now() / 1000);
  const rain1h = db.prepare(`
    SELECT COALESCE(SUM(rain_mm_step), 0) as total
    FROM telemetry WHERE node_id = 'node_top' AND ts >= ?
  `).get(nowSec - 3600).total;

  const rain24h = db.prepare(`
    SELECT COALESCE(SUM(rain_mm_step), 0) as total
    FROM telemetry WHERE node_id = 'node_top' AND ts >= ?
  `).get(nowSec - 86400).total;

  const { proposedAlgo } = getAlgorithmInstances();
  const snapshot = proposedAlgo ? proposedAlgo.processTelemetry({}).snapshot : {};

  return res.json({
    ok: true,
    serverTime: nowSec,
    runtime: {
      proposed_state: runtime.proposed_state || 'NORMAL',
      baseline_state: runtime.baseline_state || 'NORMAL',
      is_latched: Boolean(runtime.is_latched),
      control_mode: runtime.control_mode || 'AUTO',
      active_scenario_tag: runtime.active_scenario_tag || 'dry',
      barrier: runtime.barrier_state || 'OPEN',
      buzzer: Boolean(runtime.buzzer_state),
      node_top: {
        status: runtime.node_top_status || 'offline',
        last_seen: runtime.node_top_last_seen || 0,
        rssi: latestTop.rssi ?? null
      },
      node_bottom: {
        status: runtime.node_bottom_status || 'offline',
        last_seen: runtime.node_bottom_last_seen || 0,
        rssi: latestBottom.rssi ?? null
      }
    },
    latest: {
      ts: Math.max(latestTop.ts || 0, latestBottom.ts || 0),
      rain_mm_step: latestTop.rain_mm_step ?? 0,
      rain_1h: parseFloat(rain1h.toFixed(2)),
      rain_24h: parseFloat(rain24h.toFixed(2)),
      rain_short_10m: snapshot.rain_short_10m ?? 0,
      soil_top: latestTop.soil_top ?? null,
      soil_bottom: latestBottom.soil_bottom ?? null,
      soil_derivative: snapshot.soil_derivative ?? 0,
      tilt_x: latestBottom.tilt_x ?? null,
      tilt_y: latestBottom.tilt_y ?? null,
      tilt_delta: latestBottom.tilt_delta ?? null,
      tilt_delta_smoothed: snapshot.tilt_delta_smoothed ?? null,
      safe_duration_sec: snapshot.safe_duration_sec ?? 0,
    }
  });
}

export function getTelemetryHistory(req, res) {
  const { range = '5m', from, to } = req.query;
  const nowSec = Math.floor(Date.now() / 1000);
  let startTime = nowSec - 300; // default 5m

  if (range === '5m') startTime = nowSec - 300;
  else if (range === '1h') startTime = nowSec - 3600;
  else if (range === '24h') startTime = nowSec - 86400;
  else if (from) startTime = parseInt(from, 10);

  let endTime = to ? parseInt(to, 10) : nowSec;

  const rows = db.prepare(`
    SELECT ts, node_id, rain_mm_step, soil_top, soil_bottom, tilt_x, tilt_y, tilt_delta, state_local
    FROM telemetry
    WHERE ts >= ? AND ts <= ?
    ORDER BY ts ASC
    LIMIT 2000
  `).all(startTime, endTime);

  // Lấy các điểm đánh dấu sự kiện đổi trạng thái trong khoảng này
  const events = db.prepare(`
    SELECT ts, algorithm, old_state, new_state, reason
    FROM alarm_events
    WHERE ts >= ? AND ts <= ?
    ORDER BY ts ASC
  `).all(startTime, endTime);

  return res.json({
    ok: true,
    startTime,
    endTime,
    count: rows.length,
    telemetry: rows,
    stateTransitions: events
  });
}

export function exportTelemetryCsv(req, res) {
  const { from, to } = req.query;
  const nowSec = Math.floor(Date.now() / 1000);
  const startTime = from ? parseInt(from, 10) : (nowSec - 86400);
  const endTime = to ? parseInt(to, 10) : nowSec;

  const rows = db.prepare(`
    SELECT id, ts, node_id, rain_mm_step, soil_top, soil_bottom, tilt_x, tilt_y, tilt_delta, state_local, barrier, buzzer, rssi, created_at
    FROM telemetry
    WHERE ts >= ? AND ts <= ?
    ORDER BY ts ASC
  `).all(startTime, endTime);

  let csv = 'id,timestamp,iso_time,node_id,rain_mm_step,soil_top,soil_bottom,tilt_x,tilt_y,tilt_delta,state_local,barrier,buzzer,rssi\n';
  for (const r of rows) {
    const iso = new Date(r.ts * 1000).toISOString();
    csv += `${r.id},${r.ts},"${iso}",${r.node_id},${r.rain_mm_step ?? ''},${r.soil_top ?? ''},${r.soil_bottom ?? ''},${r.tilt_x ?? ''},${r.tilt_y ?? ''},${r.tilt_delta ?? ''},${r.state_local || ''},${r.barrier || ''},${r.buzzer ?? ''},${r.rssi ?? ''}\n`;
  }

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`telemetry_export_${startTime}_${endTime}.csv`);
  return res.send(csv);
}
