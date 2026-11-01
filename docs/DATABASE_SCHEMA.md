# Tài Liệu Cấu Trúc Cơ Sở Dữ Liệu SQLite

Hệ thống sử dụng tệp CSDL SQLite duy nhất được tối ưu hóa với chế độ `WAL (Write-Ahead Logging)` và `PRAGMA synchronous = NORMAL` cho tốc độ xử lý hàng trăm bản ghi mỗi giây.

---

## 1. Bảng `users` (Quản trị tài khoản)
- `id` (INTEGER, PK, Auto): Định danh.
- `username` (TEXT, Unique): Tên tài khoản.
- `password_hash` (TEXT): Mật khẩu băm bằng thuật toán `bcrypt` với muối salt 10 vòng.
- `role` (TEXT): Quyền hạn (`admin` hoặc `viewer`).
- `created_at`, `last_login`: Thời điểm tạo và lần đăng nhập cuối.

## 2. Bảng `telemetry` (Chuỗi thời gian cảm biến)
- `id` (INTEGER, PK, Auto).
- `ts` (INTEGER): Timestamp thời gian thực UNIX (giây). Đánh index `idx_telemetry_ts`.
- `node_id` (TEXT): `'node_top'` hoặc `'node_bottom'`.
- `rain_mm_step` (REAL): Lượng mưa đo được trong chu kỳ 2s từ gàu lật.
- `soil_top` (REAL): Độ ẩm đất đỉnh dốc (%).
- `soil_bottom` (REAL): Độ ẩm đất chân dốc (%).
- `tilt_x`, `tilt_y` (REAL): Góc nghiêng 2 trục MPU6050 (độ).
- `tilt_delta` (REAL): Độ lệch góc nghiêng tổng hợp $\Delta\text{Tilt}$.
- `state_local` (TEXT): Trạng thái suy luận cục bộ tại firmware ESP.
- `barrier` (TEXT): Trạng thái barie vật lý (`OPEN` hoặc `CLOSED`).
- `buzzer` (INTEGER): Trạng thái còi (1: kêu, 0: tắt).
- `rssi` (INTEGER): Cường độ tín hiệu Wi-Fi (dBm).

*Chính sách dọn dẹp: Service nền tự động xóa các bản ghi telemetry cũ hơn `DATA_RETENTION_DAYS` (mặc định 30 ngày) để giữ database luôn nhỏ gọn.*

## 3. Bảng `alarm_events` (Sự kiện chuyển đổi trạng thái cảnh báo)
- `id` (INTEGER, PK, Auto).
- `ts` (INTEGER): Thời điểm ghi nhận.
- `algorithm` (TEXT): `'PROPOSED'` (Thuật toán A) hoặc `'BASELINE'` (Thuật toán B).
- `old_state`, `new_state` (TEXT): Trạng thái trước và sau chuyển đổi.
- `reason` (TEXT): Lý do toán học / cảm biến kích hoạt chuyển đổi.
- `sensor_snapshot` (TEXT): Chuỗi JSON lưu toàn bộ giá trị cảm biến tại thời điểm báo động.
- `scenario_tag` (TEXT): Nhãn kịch bản thử nghiệm (`dry`, `soaking`, `movement`).
- `is_valid` (INTEGER): Đánh giá kiểm thử (1: Cảnh báo đúng, 0: Cảnh báo sai, NULL: Chưa xét).

## 4. Bảng `control_commands` (Nhật ký điều khiển & phản hồi ACK)
- `id` (INTEGER, PK, Auto).
- `cmd_id` (TEXT, Unique): UUID duy nhất của từng lệnh gửi xuống MQTT.
- `action` (TEXT): Hành động điều khiển (`barrier_close`, `barrier_open`, `buzzer_mute`, `reset_alarm`, `set_led_test`, `set_mode`).
- `value` (TEXT): Tham số bổ trợ.
- `username` (TEXT): Tên người thực hiện lệnh.
- `client_ip` (TEXT): Địa chỉ IP thực tế của client (trích xuất qua tunnel).
- `status` (TEXT): `'pending'` -> `'acked'` / `'timeout'` / `'failed'`.
- `retries` (INTEGER): Số lần đã tự động gửi lại.
- `ack_msg` (TEXT): Thông điệp xác nhận từ vi điều khiển gửi về qua topic `cmd_ack`.

## 5. Bảng `system_config` (Cấu hình động thời gian thực)
- `key` (TEXT, PK): Mã tham số.
- `value` (TEXT): Giá trị tham số.
- `category` (TEXT): Phân nhóm (`algorithm`, `baseline`, `safety`, `calibration`, `system`).
- `description` (TEXT): Mô tả ý nghĩa tham số.

## 6. Bảng `audit_logs` (Nhật ký kiểm toán bảo mật)
- Ghi lại mọi lần đăng nhập thành công/thất bại, thao tác đổi mật khẩu, cập nhật tham số cấu hình hệ thống, và các lệnh điều khiển barie kèm địa chỉ IP và mã người dùng.

## 7. Bảng `runtime_state` (Bảng trạng thái đơn lẻ - Singleton)
- Lưu giữ trạng thái tức thời của hệ thống: `proposed_state`, `baseline_state`, `is_latched`, `control_mode`, `node_top_status`, `node_bottom_status`.
