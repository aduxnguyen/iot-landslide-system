/**
 * THUẬT TOÁN ĐỀ XUẤT (ALGORITHM A)
 * Phân tích chuỗi thời gian, cửa sổ trượt lượng mưa, tốc độ ngấm nước và bộ lọc duy trì biến thiên góc nghiêng (Persistence Debounce).
 */

export class ProposedAlgorithm {
  constructor(config = {}) {
    this.updateConfig(config);

    // Runtime state
    this.currentState = 'NORMAL';
    this.stateSince = Date.now();
    this.isLatched = false;

    // Filters & Histories
    this.emaSoilTop = null;
    this.emaSoilBottom = null;
    this.emaTiltDelta = null;

    this.lastSoilTop = null;
    this.lastSoilTopTs = null;
    this.soilDerivative = 0; // %/phút

    this.tiltExceedStartTime = null;
    this.tiltSafeStartTime = Date.now();

    // Sliding window of rain telemetry: array of { ts, rain_mm }
    this.rainHistory = [];
  }

  updateConfig(cfg) {
    this.config = {
      rain_window_short_min: cfg.rain_window_short_min ?? 10,
      rain_window_long_min: cfg.rain_window_long_min ?? 60,
      rain_short_threshold_mm: cfg.rain_short_threshold_mm ?? 3.0,
      rain_long_threshold_mm: cfg.rain_long_threshold_mm ?? 10.0,
      soil_derivative_threshold: cfg.soil_derivative_threshold ?? 1.5,
      soil_high_threshold: cfg.soil_high_threshold ?? 65.0,
      tilt_delta_threshold: cfg.tilt_delta_threshold ?? 2.0,
      tilt_persistence_sec: cfg.tilt_persistence_sec ?? 6,
      filter_ema_alpha: cfg.filter_ema_alpha ?? 0.3,
      safe_open_tilt_threshold: cfg.safe_open_tilt_threshold ?? 0.8,
      safe_open_duration_sec: cfg.safe_open_duration_sec ?? 10,
    };
  }

  processTelemetry({ ts, rain_mm_step, soil_top, soil_bottom, tilt_delta }) {
    const nowMs = ts ? ts * 1000 : Date.now();
    const alpha = this.config.filter_ema_alpha;

    // 1. Cập nhật lượng mưa vào cửa sổ trượt
    if (rain_mm_step !== undefined && rain_mm_step !== null) {
      this.rainHistory.push({ ts: nowMs, rain_mm: rain_mm_step });
    }

    // Dọn dẹp các mẩu tin cũ quá rain_window_long_min
    const maxWindowMs = this.config.rain_window_long_min * 60 * 1000;
    this.rainHistory = this.rainHistory.filter(r => nowMs - r.ts <= maxWindowMs);

    // Tính tổng mưa tích lũy
    const shortWindowMs = this.config.rain_window_short_min * 60 * 1000;
    let rainShortTotal = 0;
    let rainLongTotal = 0;

    for (const r of this.rainHistory) {
      if (nowMs - r.ts <= shortWindowMs) {
        rainShortTotal += r.rain_mm;
      }
      rainLongTotal += r.rain_mm;
    }

    // 2. Lọc EMA cho độ ẩm
    if (soil_top !== undefined && soil_top !== null) {
      if (this.emaSoilTop === null) {
        this.emaSoilTop = soil_top;
      } else {
        this.emaSoilTop = alpha * soil_top + (1 - alpha) * this.emaSoilTop;
      }

      // Tính đạo hàm tốc độ tăng độ ẩm (%/phút)
      if (this.lastSoilTopTs !== null && nowMs > this.lastSoilTopTs) {
        const deltaMinutes = (nowMs - this.lastSoilTopTs) / 60000;
        if (deltaMinutes > 0.05) { // tránh chia cho 0
          const rate = (this.emaSoilTop - this.lastSoilTop) / deltaMinutes;
          this.soilDerivative = Math.max(0, rate); // chỉ xét tốc độ tăng nước
          this.lastSoilTop = this.emaSoilTop;
          this.lastSoilTopTs = nowMs;
        }
      } else {
        this.lastSoilTop = this.emaSoilTop;
        this.lastSoilTopTs = nowMs;
      }
    }

    if (soil_bottom !== undefined && soil_bottom !== null) {
      if (this.emaSoilBottom === null) {
        this.emaSoilBottom = soil_bottom;
      } else {
        this.emaSoilBottom = alpha * soil_bottom + (1 - alpha) * this.emaSoilBottom;
      }
    }

    // 3. Lọc EMA cho độ nghiêng và kiểm tra Persistence (Duy trì vượt ngưỡng)
    let smoothedTiltDelta = tilt_delta ?? 0;
    if (tilt_delta !== undefined && tilt_delta !== null) {
      if (this.emaTiltDelta === null) {
        this.emaTiltDelta = tilt_delta;
      } else {
        this.emaTiltDelta = alpha * tilt_delta + (1 - alpha) * this.emaTiltDelta;
      }
      smoothedTiltDelta = this.emaTiltDelta;

      // Kiểm tra duy trì vượt ngưỡng
      if (smoothedTiltDelta >= this.config.tilt_delta_threshold) {
        if (!this.tiltExceedStartTime) {
          this.tiltExceedStartTime = nowMs;
        }
        this.tiltSafeStartTime = null;
      } else {
        this.tiltExceedStartTime = null;
        if (!this.tiltSafeStartTime) {
          this.tiltSafeStartTime = nowMs;
        }
      }
    }

    const tiltDurationSec = this.tiltExceedStartTime ? (nowMs - this.tiltExceedStartTime) / 1000 : 0;
    const safeDurationSec = this.tiltSafeStartTime ? (nowMs - this.tiltSafeStartTime) / 1000 : 0;

    // Snapshot chỉ số hiện tại
    const snapshot = {
      rain_short_10m: parseFloat(rainShortTotal.toFixed(2)),
      rain_long_60m: parseFloat(rainLongTotal.toFixed(2)),
      soil_top: parseFloat((this.emaSoilTop ?? soil_top ?? 0).toFixed(1)),
      soil_bottom: parseFloat((this.emaSoilBottom ?? soil_bottom ?? 0).toFixed(1)),
      soil_derivative: parseFloat(this.soilDerivative.toFixed(2)),
      tilt_delta_smoothed: parseFloat(smoothedTiltDelta.toFixed(2)),
      tilt_exceed_duration_sec: parseFloat(tiltDurationSec.toFixed(1)),
      safe_duration_sec: parseFloat(safeDurationSec.toFixed(1)),
      is_latched: this.isLatched
    };

    // 4. Máy trạng thái (State Machine)
    let nextState = this.currentState;
    let transitionReason = '';

    // A. Nếu đang bị LATCH ở MOVEMENT:
    if (this.isLatched) {
      nextState = 'MOVEMENT';
      return {
        state: nextState,
        changed: false,
        reason: 'Hệ thống đang chốt an toàn ở trạng thái MOVEMENT. Chờ xác nhận từ người vận hành.',
        snapshot
      };
    }

    // B. Kiểm tra điều kiện vào MOVEMENT:
    const isMovementTriggered = tiltDurationSec >= this.config.tilt_persistence_sec;
    if (isMovementTriggered) {
      nextState = 'MOVEMENT';
      this.isLatched = true; // Chốt cứng an toàn
      transitionReason = `Phát hiện dịch chuyển đất bền vững: Độ lệch góc nghiêng duy trì ${tiltDurationSec.toFixed(1)}s (>= ${this.config.tilt_persistence_sec}s) với góc ${smoothedTiltDelta.toFixed(1)}°`;
    } 
    // C. Kiểm tra điều kiện vào WATCH:
    else {
      const isRainExceeded = (rainShortTotal >= this.config.rain_short_threshold_mm) || 
                             (rainLongTotal >= this.config.rain_long_threshold_mm);
      const isSoilMoistRising = (this.soilDerivative >= this.config.soil_derivative_threshold) ||
                                (this.emaSoilTop >= this.config.soil_high_threshold);

      if (isRainExceeded && isSoilMoistRising) {
        nextState = 'WATCH';
        transitionReason = `Mưa tích lũy tăng (${rainShortTotal.toFixed(1)}mm/10m) kết hợp độ ẩm đất thấm nhanh (${this.soilDerivative.toFixed(1)}%/phút, đỉnh: ${(this.emaSoilTop ?? 0).toFixed(1)}%)`;
      } else if (this.currentState === 'WATCH') {
        // Điều kiện quay về NORMAL từ WATCH: mưa tạnh và đất không còn tăng độ ẩm
        if (!isRainExceeded && this.soilDerivative < 0.2 && (this.emaSoilTop ?? 0) < this.config.soil_high_threshold) {
          nextState = 'NORMAL';
          transitionReason = 'Lượng mưa và độ ẩm đất đã suy giảm về ngưỡng an toàn bình thường.';
        }
      }
    }

    const changed = nextState !== this.currentState;
    if (changed) {
      this.currentState = nextState;
      this.stateSince = nowMs;
    }

    return {
      state: nextState,
      changed,
      reason: transitionReason || `Duy trì trạng thái ${nextState}`,
      snapshot
    };
  }

  // Phương thức reset chốt an toàn (Latch Reset) từ người dùng có thẩm quyền
  resetLatch(force = false) {
    const nowMs = Date.now();
    const safeDurationSec = this.tiltSafeStartTime ? (nowMs - this.tiltSafeStartTime) / 1000 : 0;
    const isSafe = safeDurationSec >= this.config.safe_open_duration_sec;

    if (!isSafe && !force) {
      return {
        ok: false,
        msg: `Chưa đủ điều kiện an toàn: góc nghiêng cần duy trì ổn định dưới ${this.config.safe_open_tilt_threshold}° trong ít nhất ${this.config.safe_open_duration_sec}s (hiện tại: ${safeDurationSec.toFixed(1)}s)`
      };
    }

    this.isLatched = false;
    this.currentState = 'NORMAL';
    this.stateSince = nowMs;
    this.tiltExceedStartTime = null;

    return {
      ok: true,
      msg: 'Đã giải phóng chốt cảnh báo an toàn. Trạng thái trở về NORMAL.'
    };
  }
}
