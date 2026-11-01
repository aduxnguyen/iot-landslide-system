import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

const BROKER_HOST = process.env.MQTT_HOST || '127.0.0.1';
const BROKER_PORT = process.env.MQTT_PORT || 1883;
const BROKER_USER = process.env.MQTT_USER || 'iot_user';
const BROKER_PASS = process.env.MQTT_PASSWORD || 'iot_secure_pass2026';

console.log('=====================================================');
console.log('  LANDSLIDE IoT SYSTEM - VIRTUAL HARDWARE SIMULATOR  ');
console.log('=====================================================');
console.log(`Connecting to MQTT Broker at ${BROKER_HOST}:${BROKER_PORT}...`);

// CLI Argument parsing
const args = process.argv.slice(2);
let currentScenario = 'dry'; // 'dry' | 'soaking' | 'movement' | 'auto_cycle'
const scenarioArgIndex = args.indexOf('--scenario');
if (scenarioArgIndex !== -1 && args[scenarioArgIndex + 1]) {
  currentScenario = args[scenarioArgIndex + 1].toLowerCase();
}

console.log(`[Simulator] Active Scenario: ${currentScenario.toUpperCase()}`);

// Internal Virtual Hardware State
const hwState = {
  barrier: 'OPEN',      // 'OPEN' | 'CLOSED'
  buzzer: false,
  led: 'GREEN',         // 'GREEN' | 'YELLOW' | 'RED'
  mode: 'AUTO',         // 'AUTO' | 'MANUAL'
  local_alarm_latched: false,
};

// Simulated Physics State
let stepCount = 0;
let rainCumulative = 0;
let soilTop = 18.0;
let soilBottom = 16.0;
let tiltX = 0.5;
let tiltY = -0.2;
let tiltDelta = 0.1;

// MQTT Clients for Node Top and Node Bottom
const clientTop = mqtt.connect(`mqtt://${BROKER_HOST}:${BROKER_PORT}`, {
  clientId: 'esp8266_sim_node_top',
  username: BROKER_USER,
  password: BROKER_PASS,
  will: {
    topic: 'landslide/node_top/status',
    payload: 'offline',
    qos: 1,
    retain: true
  }
});

const clientBottom = mqtt.connect(`mqtt://${BROKER_HOST}:${BROKER_PORT}`, {
  clientId: 'esp8266_sim_node_bottom',
  username: BROKER_USER,
  password: BROKER_PASS,
  will: {
    topic: 'landslide/node_bottom/status',
    payload: 'offline',
    qos: 1,
    retain: true
  }
});

// Setup Node Top
clientTop.on('connect', () => {
  console.log('✔ Node Top (ESP #1) connected to broker.');
  clientTop.publish('landslide/node_top/status', 'online', { retain: true, qos: 1 });
});

// Setup Node Bottom
clientBottom.on('connect', () => {
  console.log('✔ Node Bottom (ESP #2) connected to broker.');
  clientBottom.publish('landslide/node_bottom/status', 'online', { retain: true, qos: 1 });

  // Subscribe to commands and desired states
  clientBottom.subscribe('landslide/node_bottom/cmd', { qos: 1 });
  clientBottom.subscribe('landslide/node_bottom/state', { qos: 1 });
});

// Handle Commands from Server / Web Dashboard
clientBottom.on('message', (topic, message) => {
  if (topic === 'landslide/node_bottom/state') {
    const desiredState = message.toString();
    console.log(`[Node Bottom] Server pushed state: ${desiredState}`);
    if (desiredState === 'NORMAL') hwState.led = 'GREEN';
    if (desiredState === 'WATCH') hwState.led = 'YELLOW';
    if (desiredState === 'MOVEMENT') {
      hwState.led = 'RED';
      if (hwState.mode === 'AUTO') {
        hwState.barrier = 'CLOSED';
        hwState.buzzer = true;
        hwState.local_alarm_latched = true;
      }
    }
    return;
  }

  if (topic === 'landslide/node_bottom/cmd') {
    try {
      const cmd = JSON.parse(message.toString());
      console.log(`[Node Bottom] Received command:`, cmd);

      let ok = true;
      let msg = '';

      switch (cmd.action) {
        case 'barrier_close':
          hwState.barrier = 'CLOSED';
          msg = 'Barie đã hạ xuống đóng đường';
          break;
        case 'barrier_open':
          hwState.barrier = 'OPEN';
          hwState.local_alarm_latched = false;
          msg = 'Barie đã nâng lên mở đường';
          break;
        case 'buzzer_mute':
          hwState.buzzer = false;
          msg = 'Đã tắt còi báo';
          break;
        case 'reset_alarm':
          hwState.barrier = 'OPEN';
          hwState.buzzer = false;
          hwState.local_alarm_latched = false;
          hwState.led = 'GREEN';
          msg = 'Đã reset toàn bộ cảnh báo an toàn';
          break;
        case 'set_led_test':
          hwState.led = cmd.value || 'TEST';
          msg = `Đã test LED: ${hwState.led}`;
          break;
        case 'set_mode':
          hwState.mode = cmd.value === 'MANUAL' ? 'MANUAL' : 'AUTO';
          msg = `Chế độ chuyển sang ${hwState.mode}`;
          break;
        default:
          ok = false;
          msg = `Lệnh không hỗ trợ: ${cmd.action}`;
      }

      // Publish ACK to server
      const ackPayload = JSON.stringify({
        cmd_id: cmd.cmd_id,
        ok,
        msg,
        state: { ...hwState },
        ts: Math.floor(Date.now() / 1000)
      });

      clientBottom.publish('landslide/node_bottom/cmd_ack', ackPayload, { qos: 1 });
      console.log(`[Node Bottom] Sent ACK for cmd_id=${cmd.cmd_id}`);
    } catch (err) {
      console.error('Error handling command:', err.message);
    }
  }
});

// Physics simulation loop (runs every 2 seconds as specified in prompt)
setInterval(() => {
  stepCount++;

  // Auto cycle scenario logic
  if (currentScenario === 'auto_cycle') {
    const cycle = stepCount % 90; // 90 steps * 2s = 180s cycle
    if (cycle < 20) {
      // 0-40s: Dry
      simulatePhysics('dry');
    } else if (cycle < 55) {
      // 40-110s: Soaking
      simulatePhysics('soaking');
    } else {
      // 110-180s: Movement
      simulatePhysics('movement');
    }
  } else {
    simulatePhysics(currentScenario);
  }

  // Failsafe edge logic on ESP8266 node_bottom:
  // If tilt_delta exceeds local threshold (e.g. > 3.0 deg), trigger local alarm immediately!
  let stateLocal = 'NORMAL';
  if (soilTop > 50 && soilBottom > 45) stateLocal = 'WATCH';
  if (tiltDelta > 2.5) {
    stateLocal = 'MOVEMENT';
    if (hwState.mode === 'AUTO' && !hwState.local_alarm_latched) {
      hwState.barrier = 'CLOSED';
      hwState.buzzer = true;
      hwState.led = 'RED';
      hwState.local_alarm_latched = true;
      console.log('🚨 [Node Bottom LOCAL FAILSAFE] Movement detected on edge! Auto-closing barrier!');
    }
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Publish Node Top Telemetry
  const topPayload = JSON.stringify({
    ts: nowSec,
    rain_mm_step: parseFloat(currentRainStep.toFixed(2)),
    soil_top: parseFloat(soilTop.toFixed(1)),
    rssi: -58 + Math.floor(Math.random() * 5)
  });
  clientTop.publish('landslide/node_top/telemetry', topPayload, { qos: 0 });

  // 2. Publish Node Bottom Telemetry
  const bottomPayload = JSON.stringify({
    ts: nowSec,
    soil_bottom: parseFloat(soilBottom.toFixed(1)),
    tilt_x: parseFloat(tiltX.toFixed(2)),
    tilt_y: parseFloat(tiltY.toFixed(2)),
    tilt_delta: parseFloat(tiltDelta.toFixed(2)),
    state_local: stateLocal,
    barrier: hwState.barrier,
    buzzer: hwState.buzzer,
    rssi: -62 + Math.floor(Math.random() * 6)
  });
  clientBottom.publish('landslide/node_bottom/telemetry', bottomPayload, { qos: 0 });

  console.log(`[Step ${stepCount} - ${currentScenario.toUpperCase()}] Top: Soil=${soilTop.toFixed(1)}% RainStep=${currentRainStep.toFixed(2)}mm | Bottom: Soil=${soilBottom.toFixed(1)}% TiltΔ=${tiltDelta.toFixed(2)}° Barrier=${hwState.barrier} LocalState=${stateLocal}`);
}, 2000);

let currentRainStep = 0.0;

function simulatePhysics(scenario) {
  const noise = (min, max) => (Math.random() * (max - min) + min);

  if (scenario === 'dry') {
    currentRainStep = 0.0;
    soilTop = Math.max(12.0, soilTop - 0.2 + noise(-0.1, 0.1));
    soilBottom = Math.max(10.0, soilBottom - 0.1 + noise(-0.1, 0.1));
    tiltX = 0.5 + noise(-0.05, 0.05);
    tiltY = -0.2 + noise(-0.05, 0.05);
    tiltDelta = Math.abs(noise(0.02, 0.15));
  } else if (scenario === 'soaking') {
    // Rain is falling, water starts infiltrating top first, then bottom
    currentRainStep = noise(0.25, 0.65);
    rainCumulative += currentRainStep;

    soilTop = Math.min(85.0, soilTop + noise(0.4, 0.9));
    // Water percolates to bottom with some lag
    if (soilTop > 35.0) {
      soilBottom = Math.min(78.0, soilBottom + noise(0.3, 0.7));
    }
    // Soil settles slightly but no structural failure yet
    tiltX = 0.6 + noise(-0.1, 0.1);
    tiltY = -0.3 + noise(-0.1, 0.1);
    tiltDelta = Math.abs(noise(0.1, 0.4));
  } else if (scenario === 'movement') {
    // Heavy rain, soil saturated, slope shifting!
    currentRainStep = noise(0.5, 1.2);
    rainCumulative += currentRainStep;
    soilTop = Math.min(95.0, soilTop + noise(0.2, 0.5));
    soilBottom = Math.min(92.0, soilBottom + noise(0.3, 0.6));

    // Severe tilt shifts
    tiltX += noise(0.4, 1.2);
    tiltY += noise(0.3, 0.9);
    tiltDelta = Math.sqrt(tiltX * tiltX + tiltY * tiltY) + noise(1.5, 3.5);
  }
}

// Graceful exit
process.on('SIGINT', () => {
  console.log('\nShutting down virtual nodes...');
  clientTop.publish('landslide/node_top/status', 'offline', { retain: true, qos: 1 });
  clientBottom.publish('landslide/node_bottom/status', 'offline', { retain: true, qos: 1 });
  setTimeout(() => {
    clientTop.end();
    clientBottom.end();
    process.exit(0);
  }, 500);
});
