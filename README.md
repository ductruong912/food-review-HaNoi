# Food Review Hà Nội

Sổ tay quán ăn cho cá nhân và nhóm bạn: tìm kiếm không dấu, lọc quán,
bản đồ, lưu yêu thích trên thiết bị và gợi ý hôm nay ăn gì.
Thành viên được cấp quyền có thể đăng quán, tải ảnh và sửa bài của mình.

## Chạy dự án

Dùng Node.js 22.18+ hoặc 24. Copy `.env.local.example` thành `.env.local`
và điền cấu hình Supabase, rồi chạy:

```sh
npm ci
npm run dev
```

Mở `http://localhost:3000`. Đọc [hướng dẫn thiết lập](docs/setup.md) để chạy
migration, cấu hình Google/email và cấp quyền cho nhóm. Nếu đã chạy `002`,
không chạy lại vì migration này đặt lại quyền; áp dụng `003` nếu chưa chạy,
sau đó chạy `004_refine_categories_and_occasions.sql` để cập nhật danh mục.

## Kiểm thử

```sh
npm run lint
npm test
npm run build
```

Giữ server local đang chạy rồi dùng `npm run test:e2e` để kiểm thử trình
duyệt. API phía trình duyệt được mô phỏng, không gửi email hoặc ghi dữ liệu
lên Supabase thật. Xem cấu hình browser và phạm vi kiểm thử trong
[hướng dẫn kiểm tra](docs/setup.md#kiểm-tra-thay-đổi).

## Dùng bản production

```sh
npm run build
npm run start
```

Build cần mạng để tải font Playfair Display và Be Vietnam Pro.
Đăng nhập/upload thật cần được kiểm tra trên project Supabase đã cấu hình.
Bản nháp và quán yêu thích chỉ lưu trên trình duyệt, chưa đồng bộ đa thiết bị.
