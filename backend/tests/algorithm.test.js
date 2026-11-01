import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProposedAlgorithm } from '../src/algorithms/proposed.js';
import { BaselineAlgorithm } from '../src/algorithms/baseline.js';

test('Baseline triggers False Alarm on 2-second temporary tilt spike, Proposed ignores it', () => {
  const config = {
    tilt_delta_threshold: 2.0,
    tilt_persistence_sec: 6,
    baseline_tilt_threshold: 2.0,
    filter_ema_alpha: 0.5
  };

  const proposed = new ProposedAlgorithm(config);
  const baseline = new BaselineAlgorithm(config);

  const t0 = 1730000000;

  // Normal reading at t=0
  proposed.processTelemetry({ ts: t0, rain_mm_step: 0, soil_top: 20, soil_bottom: 18, tilt_delta: 0.2 });
  baseline.processTelemetry({ ts: t0, rain_mm_step: 0, soil_top: 20, tilt_delta: 0.2 });

  assert.equal(proposed.currentState, 'NORMAL');
  assert.equal(baseline.currentState, 'NORMAL');

  // Spurious spike at t=2s (accidental shock/vibration)
  const resB = baseline.processTelemetry({ ts: t0 + 2, rain_mm_step: 0, soil_top: 20, tilt_delta: 3.5 });
  const resP = proposed.processTelemetry({ ts: t0 + 2, rain_mm_step: 0, soil_top: 20, soil_bottom: 18, tilt_delta: 3.5 });

  // Baseline falsely triggers MOVEMENT immediately
  assert.equal(resB.state, 'MOVEMENT', 'Baseline should immediately trigger MOVEMENT on single spike');

  // Proposed remains NORMAL because persistence (6s) has not been reached
  assert.equal(resP.state, 'NORMAL', 'Proposed should filter out temporary transient spike');
});

test('Proposed Algorithm triggers MOVEMENT on persistent tilt >= 6 seconds and latches', () => {
  const config = {
    tilt_delta_threshold: 2.0,
    tilt_persistence_sec: 6,
    filter_ema_alpha: 1.0 // direct pass for exact math test
  };

  const proposed = new ProposedAlgorithm(config);
  const t0 = 1730000000;

  // t=0s: tilt exceeds threshold
  proposed.processTelemetry({ ts: t0, tilt_delta: 2.5 });
  assert.equal(proposed.currentState, 'NORMAL');

  // t=2s
  proposed.processTelemetry({ ts: t0 + 2, tilt_delta: 2.5 });
  assert.equal(proposed.currentState, 'NORMAL');

  // t=4s
  proposed.processTelemetry({ ts: t0 + 4, tilt_delta: 2.5 });
  assert.equal(proposed.currentState, 'NORMAL');

  // t=6s: Persistence satisfied (6 seconds continuous)
  const res = proposed.processTelemetry({ ts: t0 + 6, tilt_delta: 2.5 });
  assert.equal(res.state, 'MOVEMENT', 'Proposed should transition to MOVEMENT after 6 seconds');
  assert.equal(proposed.isLatched, true, 'Proposed should latch in MOVEMENT');

  // Even if tilt drops to 0 at t=8s, state stays MOVEMENT because of latching!
  const resAfter = proposed.processTelemetry({ ts: t0 + 8, tilt_delta: 0.1 });
  assert.equal(resAfter.state, 'MOVEMENT', 'Proposed must remain latched even when sensor drops');
});

test('Safety Reset Latch enforces safe stabilization duration', () => {
  const config = {
    tilt_delta_threshold: 2.0,
    tilt_persistence_sec: 4,
    safe_open_tilt_threshold: 0.8,
    safe_open_duration_sec: 5,
    filter_ema_alpha: 1.0
  };

  const proposed = new ProposedAlgorithm(config);
  const t0 = Math.floor(Date.now() / 1000);

  // Trigger movement
  proposed.processTelemetry({ ts: t0, tilt_delta: 2.5 });
  proposed.processTelemetry({ ts: t0 + 5, tilt_delta: 2.5 });
  assert.equal(proposed.isLatched, true);

  // Attempting to reset immediately without stabilization
  const resetFail = proposed.resetLatch(false);
  assert.equal(resetFail.ok, false);

  // Simulate force override by admin
  const resetForce = proposed.resetLatch(true);
  assert.equal(resetForce.ok, true);
  assert.equal(proposed.isLatched, false);
  assert.equal(proposed.currentState, 'NORMAL');
});
