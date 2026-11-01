import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 15, // Tối đa 15 lần thử đăng nhập
  message: {
    ok: false,
    error: 'Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau 15 phút để bảo đảm an toàn.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const controlLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 30, // Tối đa 30 lệnh điều khiển mỗi phút
  message: {
    ok: false,
    error: 'Tần suất gửi lệnh điều khiển quá cao. Vui lòng thử lại sau 1 phút.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // 600 requests / 15 phút
  message: {
    ok: false,
    error: 'Hệ thống đang tiếp nhận quá nhiều yêu cầu API. Vui lòng làm chậm lại.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
