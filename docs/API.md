# Tài Liệu REST API & WebSocket Events

Toàn bộ hệ thống giao tiếp qua cổng `3000` được điều phối bởi Nginx Reverse Proxy.
- REST Base URL: `/api`
- WebSocket Endpoint: `/ws?token=<JWT_TOKEN>`

---

## 1. Xác Thực & Người Dùng (`/api/auth`)

| Endpoint | Method | Quyền | Mô tả |
| :--- | :---: | :---: | :--- |
| `/api/auth/login` | POST | Public | Đăng nhập lấy access_token + refresh_token trong cookie |
| `/api/auth/refresh` | POST | Public | Lấy access_token mới từ refresh_token |
| `/api/auth/me` | GET | Token | Lấy thông tin user đăng nhập |
| `/api/auth/change-password` | POST | Token | Đổi mật khẩu tài khoản |
| `/api/auth/logout` | POST | Token | Đăng xuất |

---

## 2. Dữ Liệu Cảm Biến Telemetry (`/api/telemetry`)

| Endpoint | Method | Quyền | Mô tả |
| :--- | :---: | :---: | :--- |
| `/api/telemetry/latest` | GET | Token | Snapshot dữ liệu mới nhất, trạng thái 2 node, barie, còi, mưa 10m/1h/24h |
| `/api/telemetry/history` | GET | Token | Chuỗi thời gian (`?range=5m`, `1h`, `24h`) kèm các mốc đổi trạng thái |
| `/api/telemetry/export` | GET | Token | Xuất tệp CSV dữ liệu thô |

---

## 3. Lệnh Điều Khiển Từ Xa (`/api/control`)

*Lưu ý: Mọi lệnh điều khiển bắt buộc quyền **Admin**. Kiểm tra nghiêm ngặt tại Backend.*

### `POST /api/control/command`
Request Body:
```json
{
  "action": "barrier_close", // "barrier_close" | "barrier_open" | "buzzer_mute" | "reset_alarm" | "set_led_test" | "set_mode"
  "value": null,             // hoặc "AUTO" / "MANUAL" đối với set_mode
  "force": false             // true nếu người dùng cố ý ghi đè an toàn khi reset
}
```

Phản hồi thành công:
```json
{
  "ok": true,
  "cmd_id": "c1f71df8-8bc6-4b2a-a53d-275d27b9a572",
  "message": "Thiết bị đã thực thi và gửi phản hồi ACK thành công!",
  "state": { "barrier": "CLOSED", "buzzer": false }
}
```

Nếu thiết bị (ESP8266 node_bottom) offline:
```json
{
  "ok": false,
  "error": "ESP8266 chấp hành (node_bottom) đang OFFLINE! Không thể gửi lệnh điều khiển."
}
```

### `GET /api/control/history`
Lấy danh sách lịch sử lệnh, IP client gửi lệnh, trạng thái ACK và thời gian thực thi.

---

## 4. Cấu Hình & Hiệu Chuẩn Thuật Toán (`/api/config`)

| Endpoint | Method | Quyền | Mô tả |
| :--- | :---: | :---: | :--- |
| `/api/config` | GET | Token | Lấy danh sách toàn bộ tham số cấu hình |
| `/api/config` | PUT | Admin | Cập nhật tham số thuật toán (áp dụng ngay vào RAM) |
| `/api/config/reset` | POST | Admin | Khôi phục toàn bộ tham số về giá trị mặc định |
| `/api/config/scenario` | POST | Admin | Gắn nhãn kịch bản thử nghiệm: `dry`, `soaking`, `movement` |
| `/api/config/calibration/zero-tilt` | POST | Admin | Lấy góc X, Y hiện tại làm điểm 0 mốc chuẩn |

---

## 5. Sự Kiện & Báo Cáo So Sánh Thuật Toán (`/api/comparison`)

| Endpoint | Method | Quyền | Mô tả |
| :--- | :---: | :---: | :--- |
| `/api/comparison/summary` | GET | Token | Tỉ lệ cảnh báo sai (FAR), tổng số cảnh báo đúng/sai của Thuật toán A vs Baseline B |
| `/api/comparison/timeline` | GET | Token | Dòng thời gian chuyển đổi trạng thái của cả 2 thuật toán |
| `/api/comparison/label` | PUT | Admin | Gán nhãn đánh giá sự kiện là True Alarm (1) hoặc False Alarm (0) |
| `/api/comparison/export` | GET | Token | Tải file CSV báo cáo so sánh phục vụ viết slide/báo cáo |

---

## 6. WebSocket Protocol (`/ws?token=<JWT>`)

### Kết nối:
Client kết nối tới `/ws?token=<ACCESS_TOKEN>`. Client gửi định kỳ ping/pong (Heartbeat) mỗi 25s.

### Các loại gói tin máy chủ đẩy xuống (Server-to-Client):
1. **`INIT_CONNECTED`**:
   ```json
   { "type": "INIT_CONNECTED", "data": { "username": "admin", "role": "admin", "serverTime": 1730000000 } }
   ```
2. **`TELEMETRY_TOP`**:
   ```json
   { "type": "TELEMETRY_TOP", "data": { "ts": 1730000002, "rain_mm_step": 0.28, "soil_top": 45.2, "rssi": -58 } }
   ```
3. **`TELEMETRY_BOTTOM`**:
   ```json
   { "type": "TELEMETRY_BOTTOM", "data": { "ts": 1730000002, "soil_bottom": 41.0, "tilt_x": 0.8, "tilt_y": -0.2, "tilt_delta": 0.3, "barrier": "OPEN", "buzzer": false, "rssi": -62 } }
   ```
4. **`ALGORITHM_EVALUATION`**:
   ```json
   {
     "type": "ALGORITHM_EVALUATION",
     "data": {
       "ts": 1730000002,
       "proposed": { "state": "WATCH", "changed": true, "reason": "Mưa tích lũy tăng kết hợp độ ẩm thấm nhanh", "snapshot": { ... } },
       "baseline": { "state": "NORMAL", "changed": false, "reason": "...", "snapshot": { ... } },
       "is_latched": false,
       "scenario": "soaking"
     }
   }
   ```
5. **`NODE_STATUS`**: Cập nhật trạng thái `online` / `offline` của từng node ESP8266 khi mất tín hiệu quá 6s.
6. **`CMD_ACK`**: Phản hồi tức thời khi phần cứng chấp hành hoàn tất lệnh từ xa.
