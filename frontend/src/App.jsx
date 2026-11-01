import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useWebSocket } from './hooks/useWebSocket';
import { Navbar } from './components/Navbar';
import { BannerAlert } from './components/BannerAlert';

import { Overview } from './pages/Overview';
import { RealtimeCharts } from './pages/RealtimeCharts';
import { RemoteControl } from './pages/RemoteControl';
import { AlgorithmConfig } from './pages/AlgorithmConfig';
import { AlgorithmCompare } from './pages/AlgorithmCompare';
import { EventLogs } from './pages/EventLogs';
import { Settings } from './pages/Settings';
import { Mountain, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export function App() {
  const { isAuthenticated, login, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // WebSocket connection & real-time streams
  const { isConnected, isStale, latestData, nodeStatus } = useWebSocket();

  // Login form state
  const [loginUser, setLoginUser] = useState('admin');
  const [loginPass, setLoginPass] = useState('AdminSecurePassword@2026!');
  const [loginError, setLoginError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);
    try {
      await login(loginUser, loginPass);
    } catch (err) {
      setLoginError(err.message || 'Đăng nhập không thành công');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. GIAO DIỆN ĐĂNG NHẬP (NẾU CHƯA XÁC THỰC)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
        {/* Background gradient decorative glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg mb-2">
              <Mountain className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Landslide Guard IoT
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Hệ thống giám sát &amp; cảnh báo sạt lở đất do mưa (Nhóm 4)
            </p>
          </div>

          {loginError && (
            <div className="p-3.5 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tài khoản
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="admin hoặc viewer"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Đang xác thực...' : 'Đăng nhập vào Hệ thống'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Credential Helper for Demo */}
          <div className="pt-4 border-t border-slate-800 text-slate-400 space-y-2 text-xs">
            <p className="font-semibold text-slate-300">Tài khoản demo sẵn có:</p>
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="font-mono text-amber-400">admin (Quản trị &amp; Điều khiển)</span>
              <button
                type="button"
                onClick={() => {
                  setLoginUser('admin');
                  setLoginPass('AdminSecurePassword@2026!');
                }}
                className="text-[11px] text-sky-400 underline hover:text-sky-300"
              >
                Điền nhanh
              </button>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="font-mono text-emerald-400">viewer (Chỉ xem - Giảng viên)</span>
              <button
                type="button"
                onClick={() => {
                  setLoginUser('viewer');
                  setLoginPass('ViewerGuestPass@2026!');
                }}
                className="text-[11px] text-sky-400 underline hover:text-sky-300"
              >
                Điền nhanh
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. GIAO DIỆN BẢNG ĐIỀU KHIỂN CHÍNH
  const currentProposedState = latestData?.data?.proposed?.state || 'NORMAL';
  const isLatched = Boolean(latestData?.data?.is_latched);
  const stateReason = latestData?.data?.proposed?.reason;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Navbar & Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isWsConnected={isConnected}
        isDataStale={isStale}
        nodeStatus={nodeStatus}
        currentState={currentProposedState}
      />

      {/* Flashing Alert Banner */}
      <BannerAlert
        state={currentProposedState}
        isLatched={isLatched}
        reason={stateReason}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <Overview
            latestData={latestData}
            nodeStatus={nodeStatus}
            isStale={isStale}
          />
        )}
        {activeTab === 'charts' && (
          <RealtimeCharts latestData={latestData} />
        )}
        {activeTab === 'control' && (
          <RemoteControl nodeStatus={nodeStatus} latestData={latestData} />
        )}
        {activeTab === 'config' && (
          <AlgorithmConfig />
        )}
        {activeTab === 'compare' && (
          <AlgorithmCompare />
        )}
        {activeTab === 'logs' && (
          <EventLogs />
        )}
        {activeTab === 'settings' && (
          <Settings />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500 font-mono">
        <p>Đồ án môn học: IoT và Ứng dụng • Nhóm 4 • ĐH Công Nghệ - ĐHQGHN • 2026</p>
      </footer>
    </div>
  );
}
