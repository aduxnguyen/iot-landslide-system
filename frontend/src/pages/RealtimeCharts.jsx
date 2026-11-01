import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { RefreshCw, Clock, Filter, AlertCircle } from 'lucide-react';

export function RealtimeCharts({ latestData }) {
  const [range, setRange] = useState('5m');
  const [dataPoints, setDataPoints] = useState([]);
  const [stateTransitions, setStateTransitions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/telemetry/history?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        // Format ts to readable time
        const formatted = json.telemetry.map((t) => ({
          ...t,
          timeStr: new Date(t.ts * 1000).toLocaleTimeString(),
          rain_mm_step: t.rain_mm_step || 0,
          soil_top: t.soil_top,
          soil_bottom: t.soil_bottom,
          tilt_delta: t.tilt_delta
        }));
        setDataPoints(formatted);
        setStateTransitions(json.stateTransitions || []);
      }
    } catch (e) {
      console.error('Error fetching telemetry history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [range]);

  // Real-time appends from WebSocket
  useEffect(() => {
    if (!latestData) return;

    if (latestData.type === 'TELEMETRY_TOP' || latestData.type === 'TELEMETRY_BOTTOM') {
      const d = latestData.data;
      const ts = d.ts || Math.floor(Date.now() / 1000);
      const timeStr = new Date(ts * 1000).toLocaleTimeString();

      setDataPoints((prev) => {
        const last = prev[prev.length - 1];
        if (last && Math.abs(last.ts - ts) < 2) {
          // Merge into current window sample
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            soil_top: d.soil_top !== undefined ? d.soil_top : last.soil_top,
            soil_bottom: d.soil_bottom !== undefined ? d.soil_bottom : last.soil_bottom,
            tilt_delta: d.tilt_delta !== undefined ? d.tilt_delta : last.tilt_delta,
            rain_mm_step: d.rain_mm_step !== undefined ? d.rain_mm_step : last.rain_mm_step,
          };
          return updated;
        }

        const next = [
          ...prev,
          {
            ts,
            timeStr,
            soil_top: d.soil_top ?? null,
            soil_bottom: d.soil_bottom ?? null,
            tilt_delta: d.tilt_delta ?? null,
            rain_mm_step: d.rain_mm_step ?? 0,
          }
        ];
        // Giữ tối đa 150 điểm cho biểu đồ mượt mà
        return next.slice(-150);
      });
    }

    if (latestData.type === 'ALGORITHM_EVALUATION' && latestData.data?.proposed?.changed) {
      setStateTransitions((prev) => [
        ...prev,
        {
          ts: latestData.data.ts,
          new_state: latestData.data.proposed.state,
          reason: latestData.data.proposed.reason
        }
      ]);
    }
  }, [latestData]);

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-2 text-slate-200">
          <Clock className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-sm sm:text-base">Khoảng thời gian hiển thị:</span>
        </div>

        <div className="flex items-center gap-2">
          {['5m', '1h', '24h'].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition ${
                range === r
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {r === '5m' ? '5 Phút (Realtime)' : (r === '1h' ? '1 Giờ' : '24 Giờ')}
            </button>
          ))}

          <button
            onClick={fetchHistory}
            title="Làm mới dữ liệu"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg ml-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart 1: Độ ẩm đất 2 vị trí (Top vs Bottom) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-200 text-sm sm:text-base">
              Biểu đồ Độ Ẩm Đất Hai Tầng (Quá trình ngấm nước vào mái dốc)
            </h3>
            <p className="text-xs text-slate-400">So sánh tốc độ thấm từ tầng trên đỉnh dốc xuống tầng dưới chân dốc</p>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Đơn vị: %
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timeStr" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="monotone"
                dataKey="soil_top"
                name="Độ ẩm đỉnh dốc (Top %)"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="soil_bottom"
                name="Độ ẩm chân dốc (Bottom %)"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Biến thiên góc nghiêng Delta Tilt (MPU6050) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-200 text-sm sm:text-base">
              Biến Thiên Góc Nghiêng Mái Dốc (MPU6050 Tilt Delta)
            </h3>
            <p className="text-xs text-slate-400">Độ lệch góc so với trạng thái ổn định ban đầu (Threshold: 2.0°)</p>
          </div>
          <span className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
            Đơn vị: Độ (°)
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timeStr" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend verticalAlign="top" height={36} />
              {/* Ngưỡng cảnh báo 2.0 độ */}
              <ReferenceLine y={2.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Ngưỡng 2.0°', fill: '#ef4444', fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="tilt_delta"
                name="Độ lệch góc nghiêng (Tilt Δ)"
                stroke="#a855f7"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3: Lượng mưa gàu lật */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-200 text-sm sm:text-base">
              Lượng Mưa Tức Thời Từng Bước Đo
            </h3>
            <p className="text-xs text-slate-400">Số mm nước mưa do gàu lật ghi nhận mỗi chu kỳ 2 giây</p>
          </div>
          <span className="text-xs font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
            Đơn vị: mm
          </span>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timeStr" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="step"
                dataKey="rain_mm_step"
                name="Lượng mưa chu kỳ (mm)"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
