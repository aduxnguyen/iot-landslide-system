import React, { useState, useEffect } from 'react';
import { FileText, Download, ShieldAlert, Filter, RefreshCw, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function EventLogs() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('alarms'); // 'alarms' | 'audit' | 'telemetry_export'
  const [alarmLogs, setAlarmLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterAlgo, setFilterAlgo] = useState('');
  const [filterState, setFilterState] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (activeTab === 'alarms') {
        const query = new URLSearchParams();
        if (filterAlgo) query.set('algorithm', filterAlgo);
        if (filterState) query.set('state', filterState);
        query.set('limit', '100');

        const res = await fetch(`/api/logs/alarms?${query.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setAlarmLogs(json.logs || []);
        }
      } else if (activeTab === 'audit' && isAdmin) {
        const res = await fetch('/api/logs/audit?limit=100');
        if (res.ok) {
          const json = await res.json();
          setAuditLogs(json.auditLogs || []);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTab, filterAlgo, filterState]);

  return (
    <div className="space-y-6">
      {/* Tab Switcher & Export */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('alarms')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === 'alarms'
                ? 'bg-sky-500 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Nhật Ký Cảnh Báo Sạt Lở
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                activeTab === 'audit'
                  ? 'bg-sky-500 text-white shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Nhật Ký Bảo Mật &amp; Lệnh (Audit)
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('telemetry_export')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === 'telemetry_export'
                ? 'bg-sky-500 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Xuất Dữ Liệu Đo Telemetry
          </button>
        </div>

        <button
          onClick={fetchLogs}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Content for Tab Alarms */}
      {activeTab === 'alarms' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Bộ Lọc:
            </span>

            <select
              value={filterAlgo}
              onChange={(e) => setFilterAlgo(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              <option value="">Tất cả thuật toán</option>
              <option value="PROPOSED">Thuật toán Đề xuất (A)</option>
              <option value="BASELINE">Thuật toán Baseline (B)</option>
            </select>

            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              <option value="">Tất cả trạng thái đích</option>
              <option value="NORMAL">NORMAL (Bình thường)</option>
              <option value="WATCH">WATCH (Cần theo dõi)</option>
              <option value="MOVEMENT">MOVEMENT (Phát hiện dịch chuyển)</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Thời điểm</th>
                  <th className="p-3">Thuật toán</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Nguyên nhân</th>
                  <th className="p-3">Snapshot Dữ liệu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {alarmLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-slate-500 font-sans">
                      Không có bản ghi nhật ký phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  alarmLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.ts * 1000).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-sky-400">{log.algorithm}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.new_state === 'MOVEMENT' ? 'bg-red-500/20 text-red-300 border border-red-500/40' : (log.new_state === 'WATCH' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40')
                        }`}>
                          {log.new_state}
                        </span>
                      </td>
                      <td className="p-3 font-sans text-slate-200 max-w-xs">{log.reason}</td>
                      <td className="p-3 text-[11px] text-slate-400 font-mono truncate max-w-xs">
                        {log.sensor_snapshot}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content for Tab Audit */}
      {activeTab === 'audit' && isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Nhật Ký Thao Tác Quản Trị &amp; Bảo Mật (Audit Trail)
            </h3>
            <a
              href="/api/logs/audit/export"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Xuất Audit CSV</span>
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">Tài khoản</th>
                  <th className="p-3">IP Nguồn</th>
                  <th className="p-3">Hành động</th>
                  <th className="p-3">Chi tiết</th>
                  <th className="p-3">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 font-semibold text-slate-200">{log.username}</td>
                    <td className="p-3 text-slate-400">{log.ip_address}</td>
                    <td className="p-3 text-sky-400 font-bold">{log.action}</td>
                    <td className="p-3 font-sans text-slate-300 max-w-sm truncate">{log.details}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content for Tab Telemetry Export */}
      {activeTab === 'telemetry_export' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-xl space-y-4">
          <h3 className="font-bold text-slate-100 text-sm sm:text-base flex items-center gap-2">
            <Download className="w-5 h-5 text-sky-400" />
            Tải Toàn Bộ Dữ Liệu Cảm Biến Thô (CSV)
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Dữ liệu bao gồm các mẩu tin telemetry 2 giây từ cả hai vi điều khiển: lượng mưa gàu lật, độ ẩm đất trên/dưới, góc nghiêng X/Y, trạng thái barie, còi buzzer và cường độ sóng Wi-Fi (RSSI).
          </p>

          <div className="pt-2">
            <a
              href="/api/telemetry/export"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg transition"
            >
              <Download className="w-4 h-4" />
              <span>Tải Xuống Tệp Telemetry CSV (24h Gần Nhất)</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
