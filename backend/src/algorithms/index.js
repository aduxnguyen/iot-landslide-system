import { db, getAllConfig } from '../db/index.js';
import { ProposedAlgorithm } from './proposed.js';
import { BaselineAlgorithm } from './baseline.js';

let proposedAlgo;
let baselineAlgo;
let mqttClientInstance = null;
let wsBroadcastFn = null;

export function initAlgorithms(mqttClient, broadcastFn) {
  mqttClientInstance = mqttClient;
  wsBroadcastFn = broadcastFn;

  const config = getAllConfig();
  proposedAlgo = new ProposedAlgorithm(config);
  baselineAlgo = new BaselineAlgorithm(config);

  console.log('✔ [Algorithms] Both Proposed (A) and Baseline (B) algorithms initialized.');
}

export function reloadAlgorithmConfig() {
  const config = getAllConfig();
  if (proposedAlgo) proposedAlgo.updateConfig(config);
  if (baselineAlgo) baselineAlgo.updateConfig(config);
  console.log('✔ [Algorithms] Configuration reloaded dynamically from database.');
}

export function getAlgorithmInstances() {
  return { proposedAlgo, baselineAlgo };
}

// Hàm xử lý telemetry từ MQTT
export function processIncomingTelemetry(data) {
  if (!proposedAlgo || !baselineAlgo) return;

  const nowSec = data.ts || Math.floor(Date.now() / 1000);

  // Lấy scenario tag và control_mode hiện tại từ runtime_state
  const runtime = db.prepare('SELECT active_scenario_tag, control_mode, is_latched FROM runtime_state WHERE id = 1').get() || {
    active_scenario_tag: 'unspecified',
    control_mode: 'AUTO',
    is_latched: 0
  };

  const currentScenario = runtime.active_scenario_tag;
  const controlMode = runtime.control_mode;

  // 1. Chạy thuật toán đề xuất (A)
  const resProposed = proposedAlgo.processTelemetry(data);

  // 2. Chạy thuật toán baseline (B)
  const resBaseline = baselineAlgo.processTelemetry(data);

  // Ghi log chuyển trạng thái cho thuật toán Đề xuất A
  if (resProposed.changed) {
    const isFalseAlarm = (currentScenario === 'dry') ? 0 : (currentScenario === 'movement' && resProposed.state === 'MOVEMENT' ? 1 : null);

    db.prepare(`
      INSERT INTO alarm_events (ts, algorithm, old_state, new_state, reason, sensor_snapshot, scenario_tag, is_valid)
      VALUES (?, 'PROPOSED', ?, ?, ?, ?, ?, ?)
    `).run(
      nowSec,
      proposedAlgo.currentState === resProposed.state ? 'PREVIOUS' : 'NORMAL', // old state
      resProposed.state,
      resProposed.reason,
      JSON.stringify(resProposed.snapshot),
      currentScenario,
      isFalseAlarm
    );

    console.log(`🚨 [Algorithm A - PROPOSED] State Changed -> ${resProposed.state}: ${resProposed.reason}`);

    // Hành động kích hoạt chấp hành tự động nếu ở chế độ AUTO và vào MOVEMENT
    if (resProposed.state === 'MOVEMENT') {
      if (mqttClientInstance) {
        mqttClientInstance.publish('landslide/node_bottom/state', 'MOVEMENT', { retain: true, qos: 1 });
        if (controlMode === 'AUTO') {
          const cmdId = 'auto_' + Date.now();
          const cmdPayload = JSON.stringify({
            cmd_id: cmdId,
            action: 'barrier_close',
            value: 'AUTO_TRIGGER_MOVEMENT',
            ts: nowSec
          });
          mqttClientInstance.publish('landslide/node_bottom/cmd', cmdPayload, { qos: 1 });
        }
      }
    } else if (resProposed.state === 'WATCH') {
      if (mqttClientInstance) {
        mqttClientInstance.publish('landslide/node_bottom/state', 'WATCH', { retain: true, qos: 1 });
      }
    } else if (resProposed.state === 'NORMAL') {
      if (mqttClientInstance) {
        mqttClientInstance.publish('landslide/node_bottom/state', 'NORMAL', { retain: true, qos: 1 });
      }
    }
  }

  // Ghi log chuyển trạng thái cho thuật toán Baseline B
  if (resBaseline.changed) {
    const isFalseAlarm = (currentScenario === 'dry') ? 0 : (currentScenario === 'movement' && resBaseline.state === 'MOVEMENT' ? 1 : null);

    db.prepare(`
      INSERT INTO alarm_events (ts, algorithm, old_state, new_state, reason, sensor_snapshot, scenario_tag, is_valid)
      VALUES (?, 'BASELINE', ?, ?, ?, ?, ?, ?)
    `).run(
      nowSec,
      baselineAlgo.currentState === resBaseline.state ? 'PREVIOUS' : 'NORMAL',
      resBaseline.state,
      resBaseline.reason,
      JSON.stringify(resBaseline.snapshot),
      currentScenario,
      isFalseAlarm
    );
  }

  // Cập nhật runtime_state trong DB
  db.prepare(`
    UPDATE runtime_state SET
      proposed_state = ?,
      baseline_state = ?,
      is_latched = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(resProposed.state, resBaseline.state, proposedAlgo.isLatched ? 1 : 0);

  // Broadcast WebSocket update
  if (wsBroadcastFn) {
    wsBroadcastFn({
      type: 'ALGORITHM_EVALUATION',
      data: {
        ts: nowSec,
        proposed: {
          state: resProposed.state,
          changed: resProposed.changed,
          reason: resProposed.reason,
          snapshot: resProposed.snapshot
        },
        baseline: {
          state: resBaseline.state,
          changed: resBaseline.changed,
          reason: resBaseline.reason,
          snapshot: resBaseline.snapshot
        },
        is_latched: proposedAlgo.isLatched,
        scenario: currentScenario
      }
    });
  }
}
