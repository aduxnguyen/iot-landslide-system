# Hướng Dẫn Cấu Hình Cloudflare Named Tunnel (Dành Cho Ai Có Tên Miền Riêng)

Phương án này sử dụng Cloudflare Tunnel (Named Tunnel) cố định trỏ về subdomain riêng của bạn (ví dụ: `https://slope.yourdomain.com`).
*Lưu ý: Tuyệt đối không dùng Quick Tunnel (`cloudflared tunnel --url`) vì đường link sẽ thay đổi ngẫu nhiên mỗi lần chạy lại.*

---

## 1. Cài Đặt `cloudflared` CLI

- Tải file thực thi `cloudflared.exe` từ trang chính thức: [https://github.com/cloudflare/cloudflared/releases](https://github.com/cloudflare/cloudflared/releases)
- Đặt `cloudflared.exe` vào một thư mục trong PATH hệ thống (ví dụ `C:\Windows\System32` hoặc thư mục dự án).

---

## 2. Các Lệnh Tạo Named Tunnel Cố Định

### Bước 1: Đăng nhập vào Cloudflare
```bash
cloudflared tunnel login
```
Trình duyệt sẽ mở ra để bạn chọn tên miền muốn liên kết.

### Bước 2: Tạo Named Tunnel
```bash
cloudflared tunnel create landslide-tunnel
```
Lệnh sẽ trả về mã `Tunnel-ID` (dạng UUID) và tạo file credentials `.json` tại `%USERPROFILE%\.cloudflared\<Tunnel-ID>.json`.

### Bước 3: Định tuyến DNS cho Subdomain
```bash
cloudflared tunnel route dns landslide-tunnel slope.yourdomain.com
```

---

## 3. Cấu Hình File `config.yml`

Tạo file `config.yml` (hoặc đặt trong thư mục `%USERPROFILE%\.cloudflared\config.yml`):

```yaml
tunnel: <Tunnel-ID>
credentials-file: C:\Users\<Username>\.cloudflared\<Tunnel-ID>.json

ingress:
  # Chuyển tiếp traffic HTTPS Internet vào cổng 3000 của Nginx
  - hostname: slope.yourdomain.com
    service: http://localhost:3000
    originRequest:
      noTLSVerify: false
      httpHostHeader: slope.yourdomain.com

  # Catch-all 404 cho các hostname khác
  - service: http_status:404
```

---

## 4. Chạy Tunnel

### Chạy trực tiếp qua lệnh CLI:
```bash
cloudflared tunnel run landslide-tunnel
```

### Hoặc cài đặt thành Windows Service (Tự khởi động cùng máy):
```powershell
cloudflared service install
```

---

## 5. Tùy Chọn: Thêm Lớp Bảo Mật Cloudflare Zero Trust (Access)
Nếu muốn tăng cường bảo mật hơn nữa:
1. Vào Cloudflare One -> **Access** -> **Applications**.
2. Thêm policy bảo vệ `slope.yourdomain.com`.
3. Chỉ cho phép các email trong danh sách hoặc gửi mã One-Time PIN (OTP) vào email giảng viên trước khi truy cập.
