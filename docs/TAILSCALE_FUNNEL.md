# Hướng Dẫn Cấu Hình Truy Cập Công Khai Bằng Tailscale Funnel (Ổn Định & Miễn Phí)

Tailscale Funnel là giải pháp được **khuyến nghị hàng đầu** cho đồ án:
- **Tên miền HTTPS cố định, không đổi** giữa các lần chạy máy (dạng `https://<tên-máy>.<tailnet>.ts.net`).
- **Hoàn toàn miễn phí**, không cần mua tên miền riêng.
- Có chứng chỉ SSL/TLS tự động từ Let's Encrypt.
- Chỉ mở duy nhất cổng **3000** (Nginx), toàn bộ cổng MQTT 1883 và Backend 5000 nằm an toàn phía sau.

---

## 1. Cài Đặt Tailscale

1. Tải và cài đặt Tailscale trên máy chủ (Server):
   - Tải từ trang chủ: [https://tailscale.com/download](https://tailscale.com/download)
2. Mở ứng dụng Tailscale và đăng nhập bằng tài khoản Google / GitHub.

---

## 2. Bật Tính Năng MagicDNS và HTTPS trên Tailscale Admin Console

1. Truy cập [Tailscale Admin Console](https://login.tailscale.com/admin/dns).
2. Tại mục **DNS**:
   - Bật **MagicDNS** (gạt sang Enable).
3. Tại mục **HTTPS Certificates**:
   - Nhấn **Enable HTTPS** để Tailscale cấp chứng chỉ SSL tự động.
4. Tại mục **Access Controls (ACL)**, thêm quyền sử dụng Funnel cho thiết bị của bạn:
   ```json
   "nodeAttrs": [
     {
       "target": ["autogroup:members"],
       "attr": ["funnel"]
     }
   ]
   ```

---

## 3. Khởi Chạy Funnel Trỏ Vào Cổng Web 3000

Mở PowerShell / Command Prompt (chạy với quyền Administrator):

```powershell
# 1. Bật Funnel chạy ngầm chuyển hướng traffic Internet HTTPS vào cổng 3000
tailscale funnel --bg 3000
```

Kiểm tra trạng thái đường truyền:
```powershell
tailscale funnel status
```

Kết quả sẽ hiển thị link cố định:
```text
https://my-laptop.tailnet1234.ts.net (Funnel on)
|-- proxy http://127.0.0.1:3000
```

---

## 4. Cách Tắt Hoặc Đặt Lại Khi Cần

Khi kết thúc buổi bảo vệ hoặc không muốn mở ra Internet nữa:
```powershell
tailscale funnel reset
```

---

## 5. Giữ Máy Server Luôn Sẵn Sàng (24/7)

Để đường link không bị ngắt quãng khi trình diễn từ xa:
1. Cắm sạc pin laptop đầy đủ.
2. Tắt chế độ Sleep / Hibernate trong Windows Power Settings:
   - Vào `Settings` -> `System` -> `Power & battery` -> Chỉnh `When plugged in, put my device to sleep after` thành **Never**.
3. Bật Docker Desktop tự khởi động cùng máy tính (`Start Docker Desktop when you log in`).
