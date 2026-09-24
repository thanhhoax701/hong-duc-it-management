# Tích hợp vào repo hiện tại

Do GitHub connector hiện chỉ có quyền đọc repo và GitHub API trả 403 khi ghi, hai file này được chuẩn bị sẵn để đưa vào repo.

1. Copy `js/it-catalog.js` vào thư mục `js/`.
2. Trong `js/app.js`, import:

```js
import { IT_CATALOG, IT_TICKET_STEPS } from './it-catalog.js';
```

3. Đổi ticket type từ 2 nhóm thành 3 nhóm:

```text
hardware = Phần cứng
system   = Hệ thống
server   = Máy chủ
```

4. Thêm field `category` vào ticket.
5. Sidebar dùng 3 mục chính: Phần cứng / Hệ thống / Máy chủ.
6. Mỗi mục hiển thị category, Cơ bản, Nâng cao và công cụ/SOP.
7. Firestore/Firebase giữ nguyên.
