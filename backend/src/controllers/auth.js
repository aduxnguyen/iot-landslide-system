import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { getClientIp, recordAuditLog } from '../middleware/auth.js';

const getJwtSecret = () => process.env.JWT_SECRET;
const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '15m';
const getRefreshExpiresIn = () => process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Kiểm tra tính bảo mật khi khởi động
export function verifySecurityOnStartup() {
  const secret = process.env.JWT_SECRET;
  const invalidSecrets = [
    'secret',
    'admin',
    'password',
    '123456',
    'CHANGE_THIS_TO_A_SECURE_RANDOM_SECRET_KEY_32_CHARS_MIN',
    'your_jwt_secret_here'
  ];

  if (!secret || secret.length < 32 || invalidSecrets.includes(secret)) {
    console.error('========================================================================');
    console.error('🚨 [SECURITY FATAL ERROR]: JWT_SECRET chưa được cấu hình an toàn!');
    console.error('Yêu cầu bắt buộc: JWT_SECRET phải có độ dài ít nhất 32 ký tự ngẫu nhiên');
    console.error('và không được sử dụng giá trị mặc định từ template.');
    console.error('Vui lòng tạo khóa bí mật trong file .env trước khi khởi động!');
    console.error('========================================================================');
    process.exit(1);
  }
  console.log('✔ [Security] JWT_SECRET passed strength validation check.');
}

// Đăng nhập
export async function login(req, res) {
  const clientIp = getClientIp(req);
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Vui lòng cung cấp tài khoản và mật khẩu.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    recordAuditLog({
      username,
      action: 'LOGIN_FAILED',
      details: 'Tên người dùng không tồn tại',
      ip: clientIp,
      status: 'FAILED'
    });
    return res.status(401).json({ ok: false, error: 'Tên tài khoản hoặc mật khẩu không chính xác.' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    recordAuditLog({
      userId: user.id,
      username: user.username,
      action: 'LOGIN_FAILED',
      details: 'Sai mật khẩu',
      ip: clientIp,
      status: 'FAILED'
    });
    return res.status(401).json({ ok: false, error: 'Tên tài khoản hoặc mật khẩu không chính xác.' });
  }

  // Cập nhật last_login
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  // Tạo access token & refresh token
  const tokenPayload = { id: user.id, username: user.username, role: user.role };
  const secret = getJwtSecret();
  const accessToken = jwt.sign(tokenPayload, secret, { expiresIn: getJwtExpiresIn() });
  const refreshToken = jwt.sign(tokenPayload, secret, { expiresIn: getRefreshExpiresIn() });

  // Đặt refresh token vào HttpOnly cookie
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
  });

  // Đặt access_token vào cookie tiện lợi
  res.cookie('access_token', accessToken, {
    httpOnly: false, // để frontend đọc nếu cần hoặc lưu memory
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000
  });

  recordAuditLog({
    userId: user.id,
    username: user.username,
    action: 'LOGIN_SUCCESS',
    details: `Đăng nhập thành công với vai trò ${user.role}`,
    ip: clientIp,
    status: 'SUCCESS'
  });

  return res.json({
    ok: true,
    token: accessToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
}

// Refresh Token
export function refreshToken(req, res) {
  const token = req.cookies?.refresh_token;
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Không tìm thấy refresh token.' });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Người dùng không còn tồn tại.' });
    }

    const newAccessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn: getJwtExpiresIn() }
    );

    res.cookie('access_token', newAccessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    return res.json({ ok: true, token: newAccessToken, user });
  } catch (err) {
    return res.status(403).json({ ok: false, error: 'Refresh token đã hết hạn hoặc không hợp lệ.' });
  }
}

// Thông tin người dùng hiện tại
export function getMe(req, res) {
  const user = db.prepare('SELECT id, username, role, created_at, last_login FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ ok: false, error: 'Không tìm thấy thông tin tài khoản.' });
  return res.json({ ok: true, user });
}

// Đổi mật khẩu
export async function changePassword(req, res) {
  const clientIp = getClientIp(req);
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ ok: false, error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) {
    recordAuditLog({
      userId: user.id,
      username: user.username,
      action: 'CHANGE_PASSWORD_FAILED',
      details: 'Sai mật khẩu hiện tại',
      ip: clientIp,
      status: 'FAILED'
    });
    return res.status(400).json({ ok: false, error: 'Mật khẩu hiện tại không đúng.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword, salt);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

  recordAuditLog({
    userId: user.id,
    username: user.username,
    action: 'CHANGE_PASSWORD_SUCCESS',
    details: 'Đã đổi mật khẩu thành công',
    ip: clientIp,
    status: 'SUCCESS'
  });

  return res.json({ ok: true, message: 'Đổi mật khẩu thành công!' });
}

// Đăng xuất
export function logout(req, res) {
  res.clearCookie('refresh_token');
  res.clearCookie('access_token');
  return res.json({ ok: true, message: 'Đã đăng xuất.' });
}
