import React, { useEffect, useState } from 'react';
import {
  CloudRain,
  Droplets,
  Compass,
  Activity,
  Shield,
  Clock,
  Radio,
  AlertTriangle,
  CheckCircle,
  Volume2,
  VolumeX,
  Gauge
} from 'lucide-react';

export function Overview({ latestData, nodeStatus, isStale }) {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial telemetry snapshot
  const fetchSnapshot = async () => {
    try {
      const res = await fetch('/api/telemetry/latest');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (e) {
      console.error('Error fetching snapshot:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 10000); // sync every 10s fallback
    return () => clearInterval(interval);
  }, []);

  // Sync real-time updates from WebSocket
  useEffect(() => {
    if (!latestData) return;

    if (latestData.type === 'TELEMETRY_TOP') {
      setTelemetry((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          latest: {
            ...prev.latest,
            rain_mm_step: latestData.data.rain_mm_step,
            soil_top: latestData.data.soil_top
          }
        };
      });
    }

    if (latestData.type === 'TELEMETRY_BOTTOM') {
      setTelemetry((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          runtime: {
            ...prev.runtime,
            barrier: latestData.data.barrier,
            buzzer: latestData.data.buzzer
          },
          latest: {
            ...prev.latest,
            soil_bottom: latestData.data.soil_bottom,
            tilt_x: latestData.data.tilt_x,
            tilt_y: latestData.data.tilt_y,
            tilt_delta: latestData.data.tilt_delta
          }
        };
      });
    }

    if (latestData.type === 'ALGORITHM_EVALUATION') {
      setTelemetry((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          runtime: {
            ...prev.runtime,
            proposed_state: latestData.data.proposed.state,
            baseline_state: latestData.data.baseline.state,
            is_latched: latestData.data.is_latched
          },
          latest: {
            ...prev.latest,
            rain_short_10m: latestData.data.proposed.snapshot?.rain_short_10m ?? prev.latest?.rain_short_10m,
            soil_derivative: latestData.data.proposed.snapshot?.soil_derivative ?? prev.latest?.soil_derivative,
            tilt_delta_smoothed: latestData.data.proposed.snapshot?.tilt_delta_smoothed ?? prev.latest?.tilt_delta_smoothed
          }
        };
      });
    }
  }, [latestData]);

  if (loading && !telemetry) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Activity className="w-8 h-8 animate-spin text-sky-400 mr-3" />
        Đang đồng bộ dữ liệu cảm biến từ máy chủ...
      </div>
    );
  }

  const runtime = telemetry?.runtime || {};
  const current = telemetry?.latest || {};
  const proposedState = runtime.proposed_state || 'NORMAL';
  const isLatched = Boolean(runtime.is_latched);

  // Status Styling Configuration
  const stateConfig = {
    NORMAL: {
      title: 'AN TOÀN (NORMAL)',
      color: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400',
      badge: 'bg-emerald-500 text-emerald-950 font-bold',
      desc: 'Mái taluy ổn định. Không có dấu hiệu dịch chuyển đất nguy hiểm.'
    },
    WATCH: {
      title: 'CẦN THEO DÕI (WATCH)',
      color: 'bg-amber-500/10 border-amber-500/40 text-amber-400',
      badge: 'bg-amber-500 text-amber-950 font-bold',
      desc: 'Mưa kéo dài hoặc đất đang ngấm nước nhanh. Đang giám sát diễn biến.'
    },
    MOVEMENT: {
      title: 'BÁO ĐỘNG SẠT LỞ (MOVEMENT)',
      color: 'bg-red-500/15 border-red-500 text-red-400 animate-pulse',
      badge: 'bg-red-500 text-white font-bold',
      desc: 'ĐÃ PHÁT HIỆN BIẾN THIÊN GÓC NGHIÊNG BẤT THƯỜNG! BARIE TỰ ĐỘNG HẠ ĐÓNG ĐƯỜNG!'
    }
  }[proposedState] || stateConfig.NORMAL;

  return (
    <div className="space-y-6">
      {/* 1. THẺ TRẠNG THÁI CHÍNH LỚN */}
      <div className={`border rounded-2xl p-6 sm:p-8 transition-all shadow-xl ${stateConfig.color} relative overflow-hidden`}>
        {isStale && (
          <div className="absolute top-3 right-4 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-md text-xs font-mono">
            ⚠ Dữ liệu chưa cập nhật (&gt;8s)
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-lg text-xs uppercase tracking-wider ${stateConfig.badge}`}>
                {proposedState}
              </span>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Thuật toán đề xuất A
              </span>
              {isLatched && (
                <span className="bg-red-900/60 text-red-300 border border-red-700/60 text-xs px-2.5 py-0.5 rounded font-mono font-bold">
                  🔒 LATCH CHỐT CỨNG
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              {stateConfig.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl">
              {stateConfig.desc}
            </p>
          </div>

          {/* Quick Actuator State Overview */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/80 backdrop-blur border border-slate-800 p-4 rounded-xl">
            <div className="text-center px-3 border-r border-slate-800">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Barie Đường</p>
              <p className={`text-base font-bold font-mono mt-0.5 ${runtime.barrier === 'CLOSED' ? 'text-red-400' : 'text-emerald-400'}`}>
                {runtime.barrier === 'CLOSED' ? 'HẠ ĐÓNG' : 'MỞ THÔNG'}
              </p>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Còi Cảnh Báo</p>
              <p className={`text-base font-bold font-mono mt-0.5 flex items-center justify-center gap-1 ${runtime.buzzer ? 'text-red-400 animate-bounce' : 'text-slate-400'}`}>
                {runtime.buzzer ? <Volume2 className="w-4 h-4 text-red-400" /> : <VolumeX className="w-4 h-4" />}
                {runtime.buzzer ? 'KÊU' : 'TẮT'}
              </p>
            </div>
            <div className="text-center px-3">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Chế Độ</p>
              <p className="text-base font-bold font-mono text-sky-400 mt-0.5">
                {runtime.control_mode || 'AUTO'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CÁC THẺ ĐO LƯỜNG THỰC TẾ (TELEMETRY METRICS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Mưa */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs uppercase font-semibold tracking-wider flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-sky-400" /> Lượng Mưa Gàu Lật
            </span>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-300">ESP #1 Đỉnh</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-white">
                {current.rain_mm_step !== undefined ? current.rain_mm_step : '--'}
              </span>
              <span className="text-sm font-semibold text-slate-400">mm / bước 2s</span>
            </div>
            <div className="text-xs text-slate-400 pt-2 flex justify-between border-t border-slate-800/80">
              <span>Tích lũy 10m: <strong className="text-sky-300 font-mono">{current.rain_short_10m ?? 0} mm</strong></span>
              <span>1h: <strong className="text-slate-200 font-mono">{current.rain_1h ?? 0} mm</strong></span>
            </div>
          </div>
        </div>

        {/* Metric 2: Độ ẩm đất tầng trên */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs uppercase font-semibold tracking-wider flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-emerald-400" /> Độ Ẩm Đất Trên Dốc
            </span>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-300">ESP #1 Đỉnh</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-white">
                {current.soil_top !== undefined && current.soil_top !== null ? current.soil_top : '--'}
              </span>
              <span className="text-sm font-semibold text-slate-400">%</span>
            </div>
            <div className="text-xs text-slate-400 pt-2 flex justify-between border-t border-slate-800/80">
              <span>Tốc độ thấm (đạo hàm):</span>
              <strong className="text-emerald-400 font-mono">+{current.soil_derivative ?? 0}%/phút</strong>
            </div>
          </div>
        </div>

        {/* Metric 3: Độ ẩm đất tầng dưới chân dốc */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs uppercase font-semibold tracking-wider flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-cyan-400" /> Độ Ẩm Chân Dốc
            </span>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-300">ESP #2 Chân</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-white">
                {current.soil_bottom !== undefined && current.soil_bottom !== null ? current.soil_bottom : '--'}
              </span>
              <span className="text-sm font-semibold text-slate-400">%</span>
            </div>
            <div className="text-xs text-slate-400 pt-2 flex justify-between border-t border-slate-800/80">
              <span>Độ chênh lệch ngấm:</span>
              <strong className="text-cyan-300 font-mono">
                {current.soil_top && current.soil_bottom ? Math.abs(current.soil_top - current.soil_bottom).toFixed(1) : 0}%
              </strong>
            </div>
          </div>
        </div>

        {/* Metric 4: Góc nghiêng & Delta Tilt */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs uppercase font-semibold tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-violet-400" /> Biến Thiên Góc Nghiêng
            </span>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-300">MPU6050</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold font-mono ${current.tilt_delta_smoothed > 2.0 ? 'text-red-400' : 'text-white'}`}>
                {current.tilt_delta_smoothed ?? current.tilt_delta ?? '--'}
              </span>
              <span className="text-sm font-semibold text-slate-400">độ (ΔTilt)</span>
            </div>
            <div className="text-xs text-slate-400 pt-2 flex justify-between border-t border-slate-800/80">
              <span>X: <strong className="text-slate-200 font-mono">{current.tilt_x ?? 0}°</strong></span>
              <span>Y: <strong className="text-slate-200 font-mono">{current.tilt_y ?? 0}°</strong></span>
              <span>Raw Δ: <strong className="text-violet-300 font-mono">{current.tilt_delta ?? 0}°</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BẢNG SO SÁNH 2 THUẬT TOÁN SONG SONG */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-sky-400" />
          Trạng Thái Đánh Giá Song Song 2 Thuật Toán
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Algorithm A */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-sky-400">Thuật toán Đề xuất A (Diễn biến thời gian)</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                proposedState === 'MOVEMENT' ? 'bg-red-500 text-white' : (proposedState === 'WATCH' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950')
              }`}>
                {proposedState}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Có lọc nhiễu EMA, tính toán mưa tích lũy, đạo hàm tốc độ thấm nước và yêu cầu góc nghiêng duy trì vượt ngưỡng trong 6s. Có cơ chế chốt an toàn Latch.
            </p>
          </div>

          {/* Algorithm B */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-400">Thuật toán Baseline B (Ngưỡng cố định)</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                runtime.baseline_state === 'MOVEMENT' ? 'bg-red-500 text-white' : (runtime.baseline_state === 'WATCH' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950')
              }`}>
                {runtime.baseline_state || 'NORMAL'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              So sánh độc lập từng cảm biến với ngưỡng cố định. Dễ phát sinh cảnh báo giả do rung lắc chớp nhoáng và lập tức mất cảnh báo khi giá trị giảm.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
