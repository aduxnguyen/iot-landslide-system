-- SQLite Schema for IoT Landslide Early Warning System

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'viewer')) NOT NULL DEFAULT 'viewer',
    totp_secret TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- 2. Telemetry Timeseries Table
CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    rain_mm_step REAL DEFAULT 0,
    soil_top REAL,
    soil_bottom REAL,
    tilt_x REAL,
    tilt_y REAL,
    tilt_delta REAL,
    state_local TEXT,
    barrier TEXT,
    buzzer INTEGER,
    rssi INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(ts);
CREATE INDEX IF NOT EXISTS idx_telemetry_node ON telemetry(node_id);

-- 3. Alarm State Transition Events Table
CREATE TABLE IF NOT EXISTS alarm_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    algorithm TEXT CHECK(algorithm IN ('PROPOSED', 'BASELINE')) NOT NULL,
    old_state TEXT NOT NULL,
    new_state TEXT NOT NULL,
    reason TEXT NOT NULL,
    sensor_snapshot TEXT NOT NULL, -- JSON string
    scenario_tag TEXT DEFAULT 'unspecified', -- 'dry' | 'soaking' | 'movement' | 'custom'
    is_valid INTEGER, -- 1 = True Alarm, 0 = False Alarm, NULL = Pending Evaluation
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alarm_ts ON alarm_events(ts);
CREATE INDEX IF NOT EXISTS idx_alarm_algo ON alarm_events(algorithm);

-- 4. Remote Control Commands & ACK Table
CREATE TABLE IF NOT EXISTS control_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cmd_id TEXT UNIQUE NOT NULL,
    action TEXT NOT NULL,
    value TEXT,
    user_id INTEGER,
    username TEXT NOT NULL,
    client_ip TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'acked', 'timeout', 'failed')) DEFAULT 'pending',
    retries INTEGER DEFAULT 0,
    ack_msg TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acked_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_cmd_id ON control_commands(cmd_id);

-- 5. Dynamic Algorithm & System Configuration Table
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. System Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    user_id INTEGER,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT NOT NULL,
    status TEXT DEFAULT 'SUCCESS',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(ts);

-- 7. Runtime System State (Persistent Singleton)
CREATE TABLE IF NOT EXISTS runtime_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    proposed_state TEXT DEFAULT 'NORMAL',
    proposed_state_since INTEGER DEFAULT 0,
    baseline_state TEXT DEFAULT 'NORMAL',
    baseline_state_since INTEGER DEFAULT 0,
    is_latched INTEGER DEFAULT 0,
    control_mode TEXT DEFAULT 'AUTO',
    active_scenario_tag TEXT DEFAULT 'dry',
    node_top_status TEXT DEFAULT 'offline',
    node_top_last_seen INTEGER DEFAULT 0,
    node_bottom_status TEXT DEFAULT 'offline',
    node_bottom_last_seen INTEGER DEFAULT 0,
    barrier_state TEXT DEFAULT 'OPEN',
    buzzer_state INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
