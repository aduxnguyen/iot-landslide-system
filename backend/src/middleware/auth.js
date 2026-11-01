import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';

// Helper trích xuất IP client từ reverse proxy / tunnel headers
export function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return Array.isArray(cfIp) ? cfIp[0] : cfIp;

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',');
    return ips[0].trim();
  }
  return req.socket.remoteAddress || req.ip || '127.0.0.1';
}

// Helper ghi audit log
export function recordAuditLog({ userId, username, action, details, ip, status = 'SUCCESS' }) {
  try {
    const ts = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO audit_logs (ts, user_id, username, action, details, ip_address, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ts, userId ?? null, username || 'ANONYMOUS', action, details || '', ip || '127.0.0.1', status);
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

// Middleware xác thực JWT token
export function authenticateToken(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Yêu cầu đăng nhập để truy cập tài nguyên này.' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(403).json({ ok: false, error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

// Middleware bắt buộc quyền Admin
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    const clientIp = getClientIp(req);
    recordAuditLog({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'ACCESS_DENIED_ADMIN_REQUIRED',
      details: `Yêu cầu bị từ chối tới ${req.originalUrl}`,
      ip: clientIp,
      status: 'FAILED'
    });

    return res.status(403).json({
      ok: false,
      error: 'Truy cập bị từ chối: Chức năng này yêu cầu quyền Quản trị viên (Admin).'
    });
  }
  next();
}
