import React, { useState, useEffect } from 'react';
import { Sliders, RotateCcw, Save, Crosshair, Droplets, CheckCircle, AlertCircle, Tag } from 'lucide-react';

export function AlgorithmConfig() {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeScenario, setActiveScenario] = useState('dry');
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const json = await res.json();
        const map = {};
        for (const item of json.configs) {
          map[item.key] = item.value;
        }
        setConfigs(map);
        if (json.runtime?.active_scenario_tag) {
          setActiveScenario(json.runtime.active_scenario_tag);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleChange = (key, value) => {
    setConfigs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs)
      });
      const json = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', msg: json.message || 'Đã lưu và áp dụng cấu hình thuật toán ngay lập tức!' });
      } else {
        setFeedback({ type: 'error', msg: json.error || 'Lưu cấu hình thất bại.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn khôi phục toàn bộ tham số về giá trị mặc định của nhà phát triển?')) return;
    try {
      const res = await fetch('/api/config/reset', { method: 'POST' });
      if (res.ok) {
        setFeedback({ type: 'success', msg: 'Đã khôi phục cài đặt mặc định thành công!' });
        fetchConfig();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSetScenario = async (sc) => {
    try {
      const res = await fetch('/api/config/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: sc })
      });
      if (res.ok) {
        setActiveScenario(sc);
        setFeedback({ type: 'success', msg: `Đã kích hoạt chế độ gắn nhãn kịch bản: [${sc.toUpperCase()}]` });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCalibrateZero = async () => {
    try {
      const res = await fetch('/api/config/calibration/zero-tilt', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', msg: json.message });
        fetchConfig();
      } else {
        setFeedback({ type: 'error', msg: json.error || 'Lỗi khi hiệu chuẩn điểm 0.' });
      }
    } catch (e) {
      setFeedback({ type: 'error', msg: e.message });
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Đang tải bảng tham số cấu hình...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${
          feedback.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300' : 'bg-red-500/20 border border-red-500 text-red-300'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Header & Quick Experiment Tagging */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Tag className="w-5 h-5 text-sky-400" />
            Gắn Nhãn Kịch Bản Thử Nghiệm Mô Hình
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gắn nhãn dữ liệu thực nghiệm để tự động đo đạc tỉ lệ cảnh báo đúng / cảnh báo sai của 2 thuật toán
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[
            { id: 'dry', label: '1. Đất khô' },
            { id: 'soaking', label: '2. Đất ngấm nước' },
            { id: 'movement', label: '3. Đất dịch chuyển sạt lở' }
          ].map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => handleSetScenario(sc.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeScenario === sc.id
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form Cấu Hình Tham Số */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Nhóm 1: Thuật toán đề xuất A */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base flex items-center gap-2">
                <Sliders className="w-5 h-5 text-sky-400" />
                Tham Số Thuật Toán Đề Xuất A (Diễn Biến Chuỗi Thời Gian)
              </h3>
              <p className="text-xs text-slate-400">Hiệu chỉnh cửa sổ trượt, đạo hàm ngấm nước và bộ lọc duy trì góc nghiêng</p>
            </div>
            <span className="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded font-mono">Dynamic Reload</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cửa sổ mưa ngắn hạn (phút)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="60"
                value={configs.rain_window_short_min || ''}
                onChange={(e) => handleChange('rain_window_short_min', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">Mặc định: 10 phút</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ngưỡng mưa ngắn hạn (mm)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={configs.rain_short_threshold_mm || ''}
                onChange={(e) => handleChange('rain_short_threshold_mm', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">Mặc định: 3.0 mm</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tốc độ tăng độ ẩm dốc (%/phút)
              </label>
              <input
                type="number"
                step="0.1"
                value={configs.soil_derivative_threshold || ''}
                onChange={(e) => handleChange('soil_derivative_threshold', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">Đạo hàm nước thấm. Mặc định: 1.5 %/m</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ngưỡng biến thiên góc nghiêng (độ)
              </label>
              <input
                type="number"
                step="0.1"
                value={configs.tilt_delta_threshold || ''}
                onChange={(e) => handleChange('tilt_delta_threshold', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">ΔTilt kích hoạt sạt lở. Mặc định: 2.0°</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Thời gian duy trì góc nghiêng (giây)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={configs.tilt_persistence_sec || ''}
                onChange={(e) => handleChange('tilt_persistence_sec', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">Persistence Debounce. Mặc định: 6s</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Hệ số lọc trượt EMA Alpha (0.1 - 0.9)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="1.0"
                value={configs.filter_ema_alpha || ''}
                onChange={(e) => handleChange('filter_ema_alpha', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">Độ làm mượt tín hiệu. Mặc định: 0.3</span>
            </div>
          </div>
        </div>

        {/* Nhóm 2: Thuật toán Baseline B */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-100 text-sm sm:text-base">
              Ngưỡng Cố Định Baseline B (Đối chứng)
            </h3>
            <p className="text-xs text-slate-400">Mỗi thông số so sánh trực tiếp độc lập với ngưỡng tĩnh</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ngưỡng độ ẩm đất Baseline (%)
              </label>
              <input
                type="number"
                step="1"
                value={configs.baseline_soil_threshold || ''}
                onChange={(e) => handleChange('baseline_soil_threshold', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">Mặc định: 65%</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ngưỡng lượng mưa Baseline (mm)
              </label>
              <input
                type="number"
                step="0.5"
                value={configs.baseline_rain_threshold || ''}
                onChange={(e) => handleChange('baseline_rain_threshold', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">Mặc định: 5.0 mm</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ngưỡng góc nghiêng Baseline (độ)
              </label>
              <input
                type="number"
                step="0.1"
                value={configs.baseline_tilt_threshold || ''}
                onChange={(e) => handleChange('baseline_tilt_threshold', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">Mặc định: 2.0°</span>
            </div>
          </div>
        </div>

        {/* Nhóm 3: Hiệu chuẩn Phần Cứng (Hardware Calibration) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-emerald-400" />
                Hiệu Chuẩn Cảm Biến Hiện Trường
              </h3>
              <p className="text-xs text-slate-400">Cân chỉnh điểm 0 MPU6050 và dải đo ADC cảm biến điện dung</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">Hiệu chuẩn Điểm 0 MPU6050</span>
                <span className="text-xs font-mono text-emerald-400">
                  X0: {configs.calibration_zero_tilt_x || 0}°, Y0: {configs.calibration_zero_tilt_y || 0}°
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Nhấn khi mái dốc đang ở trạng thái cân bằng ổn định để lưu tọa độ góc nghiêng hiện tại làm mốc 0.
              </p>
              <button
                type="button"
                onClick={handleCalibrateZero}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Crosshair className="w-4 h-4 text-emerald-400" />
                <span>Đặt Góc 0 Hiện Tại Làm Mốc Chuẩn</span>
              </button>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">Hiệu chuẩn ADC Độ Ẩm Đất</span>
                <span className="text-xs font-mono text-sky-400">
                  Dry: {configs.calibration_soil_dry_raw || 850} | Wet: {configs.calibration_soil_wet_raw || 420}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Lưu giá trị ADC min/max đo được khi cắm cảm biến ngoài không khí (khô 0%) và cắm vào cốc nước (ướt 100%).
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Dry Raw (0%)"
                  value={configs.calibration_soil_dry_raw || ''}
                  onChange={(e) => handleChange('calibration_soil_dry_raw', e.target.value)}
                  className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
                <input
                  type="number"
                  placeholder="Wet Raw (100%)"
                  value={configs.calibration_soil_wet_raw || ''}
                  onChange={(e) => handleChange('calibration_soil_wet_raw', e.target.value)}
                  className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions Save & Reset */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 transition"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>Khôi Phục Mặc Định</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : 'Lưu & Áp Dụng Cấu Hình'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
