# HỆ THỐNG IOT GIÁM SÁT & CẢNH BÁO SỚM NGUY CƠ SẠT LỞ ĐẤT DO MƯA
**Đồ án môn học: IoT và Ứng dụng — Nhóm 4 (Trường ĐH Công Nghệ - ĐHQGHN, 2026)**

Web Dashboard thời gian thực, điều khiển barie từ xa qua Internet an toàn, tích hợp thuật toán phân tích chuỗi thời gian đối chứng với phương pháp ngưỡng baseline, và hỗ trợ truy cập công khai ổn định qua HTTPS cố định.

---

## 1. TỔNG QUAN KIẾN TRÚC & TECH STACK

- **MQTT Broker:** Eclipse Mosquitto 2.0 (Xác thực user/pass `iot_user`/`iot_secure_pass2026`, chỉ lắng nghe mạng nội bộ LAN cổng `1883`, tuyệt đối không mở ra Internet).
- **Backend Server:** Node.js (Express + `ws` + `mqtt` + `node:sqlite`). Kiến trúc hướng sự kiện xử lý telemetry tần suất cao.
- **Cơ sở dữ liệu:** SQLite (WAL mode, lưu trữ telemetry, sự kiện chuyển trạng thái, lệnh điều khiển, audit log, tham số cấu hình động).
- **Frontend Dashboard:** React 18 + Vite + TailwindCSS + Lucide Icons + Recharts. Tự động tương thích Mobile/Desktop, Dark mode, WebSocket tự kết nối tương đối (`/ws`).
- **Reverse Proxy:** Nginx (Toàn bộ hệ thống chỉ phơi duy nhất **cổng 3000** ra ngoài).
- **Kênh Công Khai Ổn Định:** Tailscale Funnel (Miễn phí, link `https://<tên-máy>.<tailnet>.ts.net` cố định) hoặc Cloudflare Named Tunnel (`https://slope.<domain>`).
- **Phần Cứng Mô Hình:** 2 Vi điều khiển ESP8266 (ESP #1: gàu lật + độ ẩm đỉnh; ESP #2: MPU6050 + barie servo SG90 + buzzer + LED + độ ẩm chân).

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
iot-landslide-system/
├── docker-compose.yml              # Điều phối 3 container: mosquitto, backend, nginx
├── .env.example                    # Template biến môi trường bảo mật
├── mosquitto/
│   ├── Dockerfile
│   └── config/
│       ├── mosquitto.conf          # Cấu hình Mosquitto không cho anonymous
│       └── password.txt            # Danh sách tài khoản broker
├── nginx/
│   ├── Dockerfile.full             # Multi-stage build (build frontend -> serve nginx)
│   └── nginx.conf                  # Định tuyến duy nhất port 3000: /, /api, /ws
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env
│   ├── src/
│   │   ├── index.js                # Server chính, kiểm tra bí mật JWT khởi động
│   │   ├── db/                     # SQLite schema & seed dữ liệu
│   │   ├── mqtt/                   # Subscriber, xử lý ACK và phát hiện node offline
│   │   ├── algorithms/             # Thuật toán đề xuất A & Baseline B
│   │   ├── controllers/            # Auth, Telemetry, Control, Config, Comparison, Logs
│   │   ├── middleware/             # Rate Limiter, xác thực JWT, IP tunnel
│   │   ├── websocket/              # WebSocket Server có auth & ping-pong heartbeat
│   │   └── services/               # Dọn dẹp dữ liệu cũ định kỳ (Cleanup)
│   └── tests/
│       └── algorithm.test.js       # Test kiểm thử thuật toán chống cảnh báo sai
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── dist/                       # Bản dựng tĩnh đã tối ưu hóa
│   └── src/                        # 7 Màn hình giao diện hoàn chỉnh
├── simulator/
│   ├── package.json
│   └── simulate.js                 # Mô phỏng 2 ESP ảo với 3 kịch bản thí nghiệm
├── firmware/
│   └── esp8266_node_bottom/
│       └── esp8266_node_bottom.ino # Mã nguồn C++ Arduino cho ESP8266 có Failsafe tại chỗ
└── docs/
    ├── API.md                      # Tài liệu REST API & WebSocket
    ├── DATABASE_SCHEMA.md          # Chi tiết lược đồ CSDL SQLite
    ├── TAILSCALE_FUNNEL.md         # Hướng dẫn Tailscale Funnel chi tiết
    └── CLOUDFLARE_TUNNEL.md        # Hướng dẫn Cloudflare Named Tunnel
```

---

## 3. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG

### Cách 1: Chạy bằng Docker Compose (Khuyến nghị khi triển khai)

1. Sao chép biến môi trường:
   ```bash
   cp .env.example .env
   ```
   *Lưu ý quan trọng:* Mở `.env` và đổi `JWT_SECRET` thành chuỗi ngẫu nhiên dài trên 32 ký tự.

2. Khởi động toàn bộ cụm dịch vụ:
   ```bash
   docker compose up -d --build
   ```

3. Mở trình duyệt truy cập:
   `http://localhost:3000`

---

### Cách 2: Chạy trực tiếp (Local Development không dùng Docker)

1. **Khởi chạy Mosquitto Broker:**
   Cài đặt Mosquitto trên máy tính và chạy với cổng 1883.
2. **Khởi chạy Backend:**
   ```bash
   cd backend
   npm install
   npm start
   # Server lắng nghe tại http://localhost:5000 và ws://localhost:5000/ws
   ```
3. **Chạy kiểm thử Unit Tests của thuật toán:**
   ```bash
   npm test
   # Kết quả: 3/3 tests pass (lọc nhiễu, chốt Latch, kiểm tra thời gian an toàn)
   ```
4. **Khởi chạy Frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   # Mở giao diện tại http://localhost:3001 (đã cấu hình proxy sẵn sang cổng 5000)
   ```

---

## 4. TÀI KHOẢN ĐĂNG NHẬP MẶC ĐỊNH

Hệ thống cung cấp sẵn 2 tài khoản phân quyền:

| Tài khoản | Mật khẩu mặc định | Vai trò | Quyền hạn |
| :--- | :--- | :---: | :--- |
| **`admin`** | `AdminSecurePassword@2026!` | **Quản trị viên** | Toàn quyền: đóng/mở barie, reset chốt nguy hiểm, hiệu chuẩn điểm 0, đổi tham số thuật toán. |
| **`viewer`** | `ViewerGuestPass@2026!` | **Khách / Giảng viên** | Chỉ xem biểu đồ, trạng thái thời gian thực và xuất báo cáo. **Bị chặn toàn bộ lệnh điều khiển.** |

---

## 5. CÁCH KIỂM THỬ BẰNG BỘ MÔ PHỎNG (SIMULATOR)

Khi chưa kết nối vi điều khiển vật lý, bạn có thể chạy bộ mô phỏng tạo dữ liệu giả lập cho 2 node:

1. Di chuyển vào thư mục simulator:
   ```bash
   cd simulator
   npm install
   ```

2. Chạy thử các kịch bản:
   - **Kịch bản 1: Đất khô (Dry):**
     ```bash
     node simulate.js --scenario dry
     ```
     *Dữ liệu:* Không mưa, độ ẩm ~15%, góc nghiêng ổn định.
   - **Kịch bản 2: Mưa ngấm nước (Soaking):**
     ```bash
     node simulate.js --scenario soaking
     ```
     *Dữ liệu:* Mưa tăng dần, độ ẩm tầng trên tăng vọt sau đó ngấm xuống tầng dưới. Thuật toán chuyển sang `WATCH`.
   - **Kịch bản 3: Sạt lở dịch chuyển mái dốc (Movement):**
     ```bash
     node simulate.js --scenario movement
     ```
     *Dữ liệu:* Đất bão hòa nước (>80%), góc nghiêng $\Delta\text{Tilt}$ vượt 2.5° liên tục > 6s. Thuật toán chuyển sang `MOVEMENT`, tự động chốt Latch, barie hạ xuống đóng đường, còi kêu.
   - **Kịch bản 4: Chạy tự động chu kỳ liên tục (Auto Cycle):**
     ```bash
     node simulate.js --scenario auto_cycle
     ```

---

## 6. HƯỚNG DẪN TRUY CẬP CÔNG KHAI CỐ ĐỊNH (HTTPS)

### Phương án A: Tailscale Funnel (Khuyến nghị - Miễn phí 100%)
1. Cài đặt Tailscale và đăng nhập tài khoản.
2. Bật MagicDNS & HTTPS Certificates trong [Tailscale Admin Console](https://login.tailscale.com/admin/dns).
3. Mở terminal với quyền Admin và chạy:
   ```powershell
   tailscale funnel --bg 3000
   ```
4. Kiểm tra đường link công khai cố định:
   ```powershell
   tailscale funnel status
   ```
   Link sẽ có dạng: `https://<tên-máy>.<tailnet>.ts.net`. Link này **không thay đổi** giữa các lần khởi động lại!

*Xem hướng dẫn chi tiết tại [docs/TAILSCALE_FUNNEL.md](file:///d:/Antigravity%20Project/IoT&Application/iot-landslide-system/docs/TAILSCALE_FUNNEL.md).*

### Phương án B: Cloudflare Named Tunnel (Khi có domain riêng)
*Xem hướng dẫn chi tiết tại [docs/CLOUDFLARE_TUNNEL.md](file:///d:/Antigravity%20Project/IoT&Application/iot-landslide-system/docs/CLOUDFLARE_TUNNEL.md).*

---

## 7. CHECKLIST KIỂM TRA AN TOÀN SAU TRIỂN KHAI

- [x] **Chỉ mở cổng 3000:** Kiểm tra bên ngoài Internet chỉ truy cập được cổng Web 3000 qua HTTPS. Cổng 1883 Mosquitto tuyệt đối không phản hồi từ bên ngoài.
- [x] **Xác thực qua 4G:** Dùng điện thoại tắt Wi-Fi, bật 4G mở liên kết công khai. Đăng nhập bằng tài khoản `viewer`.
- [x] **Kiểm tra WebSocket:** Quan sát trạng thái `WS LIVE` màu xanh trên thanh điều hướng. Biểu đồ nhảy số thời gian thực không bị gián đoạn.
- [x] **Bảo vệ quyền Viewer:** Trên tài khoản viewer, kiểm tra các nút điều khiển bị ẩn và thử gửi request API điều khiển thủ công bằng curl/Postman để xác nhận backend trả về lỗi `403 Forbidden`.
- [x] **Failsafe tại chỗ của vi điều khiển:** Ngắt kết nối mạng Wi-Fi tại ESP8266 node_bottom và dùng tay làm nghiêng cảm biến MPU6050 vượt 2.5°: Barie cơ học vẫn tự động hạ xuống và còi buzzer vẫn kêu báo động tức thì!
