# Food Review Hà Nội

🚀 **Live Demo:** [food-review-psi.vercel.app](https://food-review-psi.vercel.app/)

Sổ tay quán ăn cho cá nhân và nhóm bạn: tìm kiếm không dấu, lọc quán,
bản đồ, đồng bộ quán đã lưu theo tài khoản, bộ sưu tập cá nhân và chọn quán
nhanh theo dữ liệu đã ghi.
Thành viên được cấp quyền có thể đăng quán, tải ảnh và sửa bài của mình.

## Chạy dự án

Dùng Node.js 22.18+ hoặc 24. Copy `.env.local.example` thành `.env.local`
và điền cấu hình Supabase, rồi chạy:

```sh
npm ci
npm run dev
```

Mở `http://localhost:3000`. Đọc [hướng dẫn thiết lập](docs/setup.md) để chạy
migration, cấu hình Google/email và cấp quyền cho nhóm. Nếu đã chạy `004`, chạy
`20260930095400_005_structured_prices.sql` rồi
`20260930095500_006_personal_saved_collections_photos_location.sql`
trên database local/test. Không chạy lại `002` vì migration này đặt lại quyền.

## Kiểm thử

```sh
npm run supabase:start
npm run lint
npm test
npm run supabase:lint
npm run test:integration
npm run test:e2e:local
npm run supabase:stop
```

`test:integration` dùng Auth/JWT, PostgREST và Storage thật trong Supabase local;
`test:e2e:local` kiểm tra giao diện bằng fixture API trên server local. Xem lệnh
chi tiết, dữ liệu mẫu và giới hạn kiểm thử trong [hướng dẫn thiết lập](docs/setup.md).

## Dùng bản production

```sh
npm run build
npm run start
```

Build cần mạng để tải font Playfair Display và Be Vietnam Pro.
Đăng nhập/upload thật cần được kiểm tra trên project Supabase đã cấu hình.
Bản nháp vẫn lưu trên thiết bị. Khách lưu yêu thích trên thiết bị; tài khoản
đăng nhập đồng bộ yêu thích và bộ sưu tập giữa các thiết bị. Xem hướng dẫn
thiết lập để biết cách nhập danh sách thiết bị mà vẫn giữ bản gốc.
