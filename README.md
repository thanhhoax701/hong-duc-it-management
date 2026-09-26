# HỒNG ĐỨC IT MANAGEMENT
## HTML + CSS + JavaScript thuần + Firebase

Bản này KHÔNG dùng React, Vite, Node.js.

### 1. Cấu trúc

- `index.html` — giao diện chính
- `css/style.css` — giao diện
- `js/app.js` — chức năng
- `js/firebase-config.js` — cấu hình Firebase
- `firebase/firestore.rules` — Security Rules mẫu
- `firebase/storage.rules` — Storage Rules mẫu

### 2. Chạy thử

Có thể dùng web server tĩnh. Ví dụ nếu máy đã có Python:

```powershell
python -m http.server 5500
```

Sau đó mở `http://localhost:5500`.

Hoặc dùng IIS / Firebase Hosting / bất kỳ static web server nào.

> Nếu mở trực tiếp bằng `file:///.../index.html`, một số trình duyệt có thể chặn ES Module từ CDN. Dùng web server là ổn định nhất.

### 3. Kết nối Firebase

Vào Firebase Console:

1. Tạo Project.
2. Tạo Web App.
3. Vào Project settings → Your apps → Web app.
4. Copy `firebaseConfig`.
5. Mở `js/firebase-config.js`.
6. Dán cấu hình vào biến `firebaseConfig`.
7. Đổi `DEMO_MODE = false`.
8. Bật Firestore Database.
9. Bật Authentication → Sign-in method → Email/Password.
10. Tạo tài khoản IT.
11. Áp dụng `firebase/firestore.rules`.

### 4. Collection Firestore

App sử dụng các collection:

- `tickets`
- `assets`
- `departments`
- `maintenance`
- `audit`
- `ticketHistory`
- `users`

Collection `users` dùng document trùng Firebase Auth UID. Mỗi document cần có:

```json
{
	"role": "admin | it | department_manager | requester | cskh",
	"department": "Tên đơn vị"
}
```

Có thể dùng custom claim `role` thay cho trường `role`; `department` vẫn lấy từ document người dùng khi cần giới hạn theo phòng ban.

Role `cskh` chỉ được xem hai mục **Đơn vị / Phòng ban** và **Nhân viên**; quyền Firestore tương ứng chỉ cho phép đọc hai collection này, không cho ghi.

### 5. Ticket

Ticket có:
- mã phiếu
- loại quy trình
- tiêu đề
- ưu tiên
- đơn vị
- người yêu cầu
- người phụ trách
- thiết bị / hệ thống
- mô tả
- kết quả xử lý
- bước 1 → 5
- trạng thái
- thời gian tạo / cập nhật

### 6. Hai quy trình

#### Phần cứng

1. Yêu cầu
2. Kiểm tra / giao việc
3. Đề xuất / xử lý
4. Mua sắm CCDC
5. Bàn giao

#### Quản trị hệ thống

1. Giám sát / vận hành
2. Kiểm soát / phân quyền
3. Phát triển / tích hợp
4. Tối ưu / bảo trì
5. Sao lưu / dự phòng

### 7. Lưu ý bảo mật

Không đưa Firebase service account/private key vào frontend.

Frontend chỉ sử dụng Firebase Web App config. Security Rules + Firebase Authentication mới là phần bảo vệ dữ liệu.

### 8. Hướng phát triển tiếp

- Upload file / hình ảnh lên Firebase Storage
- Comment theo từng ticket
- Nhật ký từng bước
- Phê duyệt yêu cầu
- Thông báo realtime
- Firebase Cloud Functions
- Dashboard uptime / monitoring
- Quản lý server / firewall / camera / NVR
- Backup checklist
- Phân quyền Admin / IT / Trưởng phòng / Người yêu cầu
- Xuất Excel / PDF
