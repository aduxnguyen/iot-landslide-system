import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  Download,
  CheckCircle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  TrendingDown,
  Clock,
  Layers
} from 'lucide-react';

export function AlgorithmCompare() {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, evRes] = await fetchParallel();
      setSummary(sumRes.summary);
      setEvents(evRes.events);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchParallel = async () => {
    const s = await fetch('/api/comparison/summary').then((r) => r.json());
    const e = await fetch('/api/comparison/timeline?limit=100').then((r) => r.json());
    return [s, e];
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLabel = async (eventId, isValid) => {
    try {
      await fetch('/api/comparison/label', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, isValid })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const proposed = summary?.proposed || {};
  const baseline = summary?.baseline || {};

  return (
    <div className="space-y-6">
      {/* Header & Export Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-sky-400" />
            Đánh Giá So Sánh Thuật Toán Đề Xuất (A) &amp; Baseline (B)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Phân tích số lượng cảnh báo sai (False Alarms), độ trễ phát hiện và hiệu quả của cơ chế chuỗi thời gian
          </p>
        </div>

        <a
          href="/api/comparison/export"
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
        >
          <Download className="w-4 h-4 text-sky-400" />
          <span>Xuất Báo Cáo CSV (Dùng Cho Slide)</span>
        </a>
      </div>

      {/* KPI Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Thuật toán đề xuất A */}
        <div className="bg-slate-900 border-2 border-sky-500/40 rounded-xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-mono font-bold">
                PROPOSED METHOD
              </span>
              <h3 className="text-lg font-bold text-white mt-1">Thuật Toán Đề Xuất A</h3>
            </div>
            <ShieldCheck className="w-8 h-8 text-sky-400" />
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase">Tổng Sự Kiện</p>
              <p className="text-xl font-extrabold font-mono text-white mt-1">{proposed.total_events || 0}</p>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase">Cảnh Báo Đúng</p>
              <p className="text-xl font-extrabold font-mono text-emerald-400 mt-1">{proposed.true_alarms || 0}</p>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase">Cảnh Báo Giả</p>
              <p className="text-xl font-extrabold font-mono text-amber-400 mt-1">{proposed.false_alarms || 0}</p>
            </div>
          </div>

          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-slate-300">Tỉ lệ cảnh báo sai (False Alarm Rate):</span>
            <span className="text-base font-extrabold font-mono text-emerald-400">
              {proposed.false_alarm_rate_pct ?? 0}%
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            ✔ Nhờ bộ lọc thời gian và tính toán tốc độ ngấm nước, thuật toán loại bỏ hoàn toàn các cú sốc góc nghiêng tức thời dưới 6 giây và không gây báo động giả khi chỉ mới mưa nhỏ.
          </p>
        </div>

        {/* Thuật toán Baseline B */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono font-bold">
                BASELINE METHOD
              </span>
              <h3 className="text-lg font-bold text-slate-300 mt-1">Thuật Toán Baseline B</h3>
            </div>
            <Layers className="w-8 h-8 text-slate-500" />
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase">Tổng Sự Kiện</p>
              <p className="text-xl font-extrabold font-mono text-white mt-1">{baseline.total_events || 0}</p>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase">Cảnh Báo Đúng</p>
              <p className="text-xl font-extrabold font-mono text-emerald-400 mt-1">{baseline.true_alarms || 0}</p>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase">Cảnh Báo Giả</p>
              <p className="text-xl font-extrabold font-mono text-red-400 mt-1">{baseline.false_alarms || 0}</p>
            </div>
          </div>

          <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-slate-300">Tỉ lệ cảnh báo sai (False Alarm Rate):</span>
            <span className="text-base font-extrabold font-mono text-red-400">
              {baseline.false_alarm_rate_pct ?? 0}%
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            ⚠ So sánh từng giá trị đơn lẻ với ngưỡng tĩnh nên rất dễ bị gián đoạn, phát cảnh báo sai khi va chạm cơ học nhẹ vào bàn thí nghiệm và tự ý tắt cảnh báo ngay khi rung chấn kết thúc.
          </p>
        </div>
      </div>

      {/* Timeline Sự Kiện Chi Tiết */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="font-bold text-slate-200 text-sm sm:text-base mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-sky-400" />
          Dòng Thời Gian Ghi Nhận Sự Kiện Của Cả Hai Thuật Toán
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Thời gian</th>
                <th className="p-3">Thuật toán</th>
                <th className="p-3">Kịch bản</th>
                <th className="p-3">Chuyển trạng thái</th>
                <th className="p-3">Nguyên nhân</th>
                <th className="p-3">Đánh giá thực nghiệm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {events.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-500 font-sans">
                    Chưa có sự kiện chuyển đổi trạng thái nào được ghi lại.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-400 whitespace-nowrap">
                      {new Date(ev.ts * 1000).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        ev.algorithm === 'PROPOSED' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {ev.algorithm}
                      </span>
                    </td>
                    <td className="p-3 font-sans capitalize text-slate-400">
                      {ev.scenario_tag || 'unspecified'}
                    </td>
                    <td className="p-3">
                      <span className="text-slate-500">{ev.old_state}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className={`font-bold ${
                        ev.new_state === 'MOVEMENT' ? 'text-red-400' : (ev.new_state === 'WATCH' ? 'text-amber-400' : 'text-emerald-400')
                      }`}>
                        {ev.new_state}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-300 max-w-sm truncate" title={ev.reason}>
                      {ev.reason}
                    </td>
                    <td className="p-3 font-sans">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLabel(ev.id, true)}
                          title="Đánh dấu: Cảnh báo đúng"
                          className={`p-1 rounded hover:bg-slate-800 ${ev.is_valid === 1 ? 'text-emerald-400 font-bold bg-emerald-500/20' : 'text-slate-500'}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLabel(ev.id, false)}
                          title="Đánh dấu: Cảnh báo sai"
                          className={`p-1 rounded hover:bg-slate-800 ${ev.is_valid === 0 ? 'text-red-400 font-bold bg-red-500/20' : 'text-slate-500'}`}
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] text-slate-400 ml-1">
                          {ev.is_valid === 1 ? 'Đúng' : (ev.is_valid === 0 ? 'Sai' : 'Chưa xét')}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
