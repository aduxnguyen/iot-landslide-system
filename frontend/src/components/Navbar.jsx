import React from 'react';
import {
  Mountain,
  LayoutDashboard,
  LineChart,
  Radio,
  Sliders,
  GitCompare,
  FileText,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AudioAlarm } from './AudioAlarm';

export function Navbar({ activeTab, setActiveTab, isWsConnected, isDataStale, nodeStatus, currentState }) {
  const { user, logout, isAdmin } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'charts', label: 'Biểu đồ', icon: LineChart },
    { id: 'control', label: 'Điều khiển', icon: Radio, adminOnly: true },
    { id: 'config', label: 'Cấu hình', icon: Sliders, adminOnly: true },
    { id: 'compare', label: 'So sánh thuật toán', icon: GitCompare },
    { id: 'logs', label: 'Nhật ký', icon: FileText },
    { id: 'settings', label: 'Cài đặt', icon: Settings }
  ];

  const topOnline = nodeStatus?.node_top?.status === 'online';
  const bottomOnline = nodeStatus?.node_bottom?.status === 'online';

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Mountain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white">
                  Landslide Guard
                </span>
                <span className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded uppercase font-semibold">
                  IoT v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Hệ thống cảnh báo sớm sạt lở đất do mưa (Nhóm 4)
              </p>
            </div>
          </div>

          {/* Node & WebSocket Status Pills */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* WS Connection Pill */}
            <div
              title={isWsConnected ? (isDataStale ? "Dữ liệu có dấu hiệu gián đoạn (>8s)" : "WebSocket kết nối trực tiếp") : "Mất kết nối WebSocket"}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
                isWsConnected
                  ? (isDataStale
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30')
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isWsConnected ? (isDataStale ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse') : 'bg-red-400'}`} />
              <span>{isWsConnected ? (isDataStale ? 'WS STALE' : 'WS LIVE') : 'WS OFFLINE'}</span>
            </div>

            {/* Node Top Status */}
            <div
              title={`ESP8266 Đỉnh dốc (Mưa + Độ ẩm trên): ${topOnline ? 'Online' : 'Offline'}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                topOnline ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {topOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-slate-500" />}
              <span>Node 1 (Đỉnh): {topOnline ? `${nodeStatus.node_top.rssi || -60}dBm` : 'OFF'}</span>
            </div>

            {/* Node Bottom Status */}
            <div
              title={`ESP8266 Chân dốc (Nghiêng + Barie + Độ ẩm dưới): ${bottomOnline ? 'Online' : 'Offline'}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                bottomOnline ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {bottomOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-slate-500" />}
              <span>Node 2 (Chân): {bottomOnline ? `${nodeStatus.node_bottom.rssi || -60}dBm` : 'OFF'}</span>
            </div>
          </div>

          {/* User Controls & Audio Alarm */}
          <div className="flex items-center gap-2 sm:gap-3">
            <AudioAlarm isMovement={currentState === 'MOVEMENT'} />

            <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
              <UserCheck className="w-4 h-4 text-sky-400" />
              <div className="text-left text-xs">
                <span className="font-semibold text-slate-200 block leading-tight">{user?.username}</span>
                <span className={`text-[10px] font-mono leading-none ${isAdmin ? 'text-amber-400' : 'text-slate-400'}`}>
                  {isAdmin ? 'ADMIN' : 'VIEWER'}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Đăng xuất"
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
