import React, { useState } from 'react';
import { Settings as SettingsIcon, KeyRound, Shield, Server, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Settings() {
  const { user, isAdmin } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', msg: 'Mật khẩu xác nhận không khớp.' });
      return;
    }

    if (newPassword.length < 8) {
      setFeedback({ type: 'error', msg: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const json = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', msg: json.message || 'Đổi mật khẩu thành công!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setFeedback({ type: 'error', msg: json.error || 'Đổi mật khẩu thất bại.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${
          feedback.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300' : 'bg-red-500/20 border border-red-500 text-red-300'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Account Info & Password Change */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-sky-400" />
              Bảo Mật Tài Khoản Cá Nhân
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Đổi mật khẩu tài khoản truy cập bảng điều khiển
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase ${isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
            {user?.role}
          </span>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Mật khẩu hiện tại
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Mật khẩu mới (tối thiểu 8 ký tự)
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Xác nhận mật khẩu mới
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow transition disabled:opacity-50"
          >
            {saving ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
          </button>
        </form>
      </div>

      {/* Security Guidance for Defense Presentation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          Hướng Dẫn Cung Cấp Quyền Truy Cập Cho Giảng Viên &amp; Khách
        </h2>
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            • <strong>Tài khoản Khách (Viewer):</strong> Dành để gửi cho Giảng viên hướng dẫn và các bạn sinh viên khác mở liên kết qua 4G/Internet từ xa.
          </p>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-300">
            Username: <strong className="text-sky-300">viewer</strong><br />
            Password: <strong className="text-sky-300">ViewerGuestPass@2026!</strong>
          </div>
          <p>
            • <strong>Bảo vệ an toàn tại chỗ:</strong> Tài khoản Viewer chỉ có quyền quan sát biểu đồ thời gian thực. Toàn bộ các API điều khiển barie và cấu hình thuật toán được chặn cứng tại máy chủ backend đối với vai trò Viewer.
          </p>
          <p>
            • <strong>Tuyệt đối không chia sẻ tài khoản Quản trị viên (admin)</strong> cho các thiết bị không đáng tin cậy khi đang mở cổng công khai ra Internet.
          </p>
        </div>
      </div>
    </div>
  );
}
