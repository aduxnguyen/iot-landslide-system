import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { initDatabase } from './db/index.js';
import { verifySecurityOnStartup, login, refreshToken, getMe, changePassword, logout } from './controllers/auth.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { authLimiter, controlLimiter, apiLimiter } from './middleware/rateLimiter.js';
import { initWebSocketServer } from './websocket/server.js';
import { initMqttClient } from './mqtt/client.js';
import { initAlgorithms } from './algorithms/index.js';
import { startDataCleanupService } from './services/cleanup.js';

import { getLatestTelemetry, getTelemetryHistory, exportTelemetryCsv } from './controllers/telemetry.js';
import { sendControlCommand, getCommandHistory } from './controllers/control.js';
import { getConfig, updateConfig, resetConfigDefaults, setScenarioTag, calibrateZeroTilt } from './controllers/config.js';
import { getComparisonSummary, getComparisonTimeline, labelAlarmEvent, exportComparisonCsv } from './controllers/comparison.js';
import { getAlarmLogs, getAuditLogs, exportAuditCsv } from './controllers/logs.js';

// 1. Kiểm tra an toàn bảo mật bắt buộc
verifySecurityOnStartup();

// 2. Khởi tạo Database SQLite
initDatabase();

const app = express();
const server = http.createServer(app);

// 3. Middlewares bảo mật & phân tích gói tin
app.use(helmet({
  contentSecurityPolicy: false, // Để Nginx proxy và inline resources hoạt động mượt mà
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Gán rate limit chung
app.use('/api', apiLimiter);

// 4. Các Router Endpoint

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Auth Routes
app.post('/api/auth/login', authLimiter, login);
app.post('/api/auth/refresh', refreshToken);
app.get('/api/auth/me', authenticateToken, getMe);
app.post('/api/auth/change-password', authenticateToken, changePassword);
app.post('/api/auth/logout', logout);

// Telemetry Routes (Cho phép người dùng đã xác thực xem)
app.get('/api/telemetry/latest', authenticateToken, getLatestTelemetry);
app.get('/api/telemetry/history', authenticateToken, getTelemetryHistory);
app.get('/api/telemetry/export', authenticateToken, exportTelemetryCsv);

// Control Routes (BẮT BUỘC quyền Admin)
app.post('/api/control/command', authenticateToken, requireAdmin, controlLimiter, sendControlCommand);
app.get('/api/control/history', authenticateToken, requireAdmin, getCommandHistory);

// Config Routes (Chỉ Admin mới được thay đổi)
app.get('/api/config', authenticateToken, getConfig);
app.put('/api/config', authenticateToken, requireAdmin, updateConfig);
app.post('/api/config/reset', authenticateToken, requireAdmin, resetConfigDefaults);
app.post('/api/config/scenario', authenticateToken, requireAdmin, setScenarioTag);
app.post('/api/config/calibration/zero-tilt', authenticateToken, requireAdmin, calibrateZeroTilt);

// Comparison & Analysis Routes
app.get('/api/comparison/summary', authenticateToken, getComparisonSummary);
app.get('/api/comparison/timeline', authenticateToken, getComparisonTimeline);
app.put('/api/comparison/label', authenticateToken, requireAdmin, labelAlarmEvent);
app.get('/api/comparison/export', authenticateToken, exportComparisonCsv);

// Logs Routes
app.get('/api/logs/alarms', authenticateToken, getAlarmLogs);
app.get('/api/logs/audit', authenticateToken, requireAdmin, getAuditLogs);
app.get('/api/logs/audit/export', authenticateToken, requireAdmin, exportAuditCsv);

// 5. Khởi tạo WebSocket Server
const broadcastFn = initWebSocketServer(server);

// 6. Khởi tạo MQTT Client & Thuật toán
const mqttClient = initMqttClient(broadcastFn);
initAlgorithms(mqttClient, broadcastFn);

// 7. Khởi chạy định kỳ dọn dẹp dữ liệu cũ
startDataCleanupService();

// 8. Lắng nghe Port
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`========================================================================`);
  console.log(`🚀 [Landslide IoT Backend] Listening on http://localhost:${PORT}`);
  console.log(`📡 [WebSocket] Endpoint ready at ws://localhost:${PORT}/ws`);
  console.log(`========================================================================`);
});
