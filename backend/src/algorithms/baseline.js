/**
 * THUẬT TOÁN BASELINE (ALGORITHM B)
 * Phương pháp so sánh từng giá trị cảm biến tức thời với các ngưỡng cố định độc lập.
 * Nhược điểm: Dễ bị nhiễu tức thời (False Alarm) và tự biến mất cảnh báo ngay khi giá trị rơi xuống ngưỡng.
 */

export class BaselineAlgorithm {
  constructor(config = {}) {
    this.updateConfig(config);
    this.currentState = 'NORMAL';
    this.stateSince = Date.now();
  }

  updateConfig(cfg) {
    this.config = {
      baseline_soil_threshold: cfg.baseline_soil_threshold ?? 65.0,
      baseline_rain_threshold: cfg.baseline_rain_threshold ?? 5.0,
      baseline_tilt_threshold: cfg.baseline_tilt_threshold ?? 2.0,
    };
  }

  processTelemetry({ ts, rain_mm_step, soil_top, tilt_delta }) {
    const nowMs = ts ? ts * 1000 : Date.now();
    let nextState = 'NORMAL';
    let transitionReason = 'Các chỉ số nằm dưới ngưỡng cố định';

    const currentTilt = tilt_delta ?? 0;
    const currentSoil = soil_top ?? 0;
    const currentRain = rain_mm_step ?? 0;

    if (currentTilt >= this.config.baseline_tilt_threshold) {
      nextState = 'MOVEMENT';
      transitionReason = `Ngưỡng góc nghiêng tức thời (${currentTilt.toFixed(1)}°) vượt ngưỡng cố định (${this.config.baseline_tilt_threshold}°)`;
    } else if (currentSoil >= this.config.baseline_soil_threshold || currentRain >= this.config.baseline_rain_threshold) {
      nextState = 'WATCH';
      transitionReason = `Độ ẩm tức thời (${currentSoil.toFixed(1)}%) hoặc lượng mưa (${currentRain.toFixed(1)}mm) vượt ngưỡng cố định`;
    }

    const changed = nextState !== this.currentState;
    if (changed) {
      this.currentState = nextState;
      this.stateSince = nowMs;
    }

    return {
      state: nextState,
      changed,
      reason: transitionReason,
      snapshot: {
        rain_step: currentRain,
        soil_top: currentSoil,
        tilt_delta: currentTilt
      }
    };
  }
}
