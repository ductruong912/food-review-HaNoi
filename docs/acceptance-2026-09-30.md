# Nghiệm thu UI/UX và dữ liệu cá nhân — 30/09/2026

## Trạng thái lưu

- Các thay đổi đã được giữ trên nhánh `feature/ui-ux-upgrade`; không reset hay
  xóa thay đổi ban đầu.
- Kết quả và hướng dẫn áp dụng migration được lưu trong tài liệu này và
  [`setup.md`](./setup.md).
- Chưa áp dụng migration lên Supabase production, chưa push hoặc deploy.
- Ảnh chụp nằm trong `test-results/` và bị Git ignore; không chứa trong commit.

## Kết quả kiểm tra

| Hạng mục | Kết quả | Bằng chứng / giới hạn |
| --- | --- | --- |
| Build production | Đạt | `npm.cmd run build:local` thành công với Next.js 16.3.5, Google Fonts thật và biến Supabase local đã được inject vào tiến trình. |
| Lint | Đạt | `npm.cmd run lint` không báo lỗi. |
| Kiểu TypeScript | Đạt | `npx.cmd tsc --noEmit` không báo lỗi. |
| Unit và quyền PostgreSQL | Đạt: 34/34 | `npm.cmd test`; chạy nguyên SQL migrations trong PGlite. Kiểm tra giá legacy, ảnh/vị trí cũ, constraint, grants, RLS, dữ liệu trùng và vai trò. Auth/Storage được mô phỏng ở riêng bộ unit này. |
| Browser E2E | Đạt | `npm.cmd run test:e2e:local`; API trình duyệt dùng fixture. Bao gồm bộ lọc/URL/list↔map, theme/viewport, lưu/nhập trùng/đổi tài khoản, bộ sưu tập, upload lỗi/ảnh bìa, draft, pin, lỗi bản đồ và retry. Đây không phải kiểm thử tích hợp Auth/REST/Storage thật. |
| Supabase integration thật | Đạt trên local | `npm run test:integration` dùng Supabase CLI 2.118.0, Docker Engine 29.4.3, Node.js 24.14.0, Auth email qua Mailpit, JWT/PKCE, PostgREST, Storage và database local. Kiểm tra A/B, viewer/contributor/admin, đồng bộ phiên, import trùng, tối đa 5 ảnh/đổi bìa, quyền Storage, ghim chính xác, offline/retry, logout/đổi tài khoản. Các bài ghi được chặn nếu endpoint không phải project local ID/cổng đã định. Không có hosted URL/project nào được truy cập. |
| Migrations và seed | Đạt trên database local mới | Migration list xác nhận `20260930095000_001` đến `20260930095500_006` theo thứ tự; chạy lại từ database local sạch, sáu migration và `supabase/seed.sql` đều hoàn tất. Seed chỉ dùng UUID/email `example.test` và nhà hàng tổng hợp. |
| Supabase DB lint | Đạt | `npm.cmd run supabase:lint`: `No schema errors found`. |
| Google OAuth | Chưa kiểm thử | Provider tắt trong Supabase local vì chưa có OAuth client credentials. Kiểm thử email không thay thế cho Google OAuth. |
| Bản đồ điện thoại | Đạt về UI và nền thật | [`map-google-live-mobile.png`](../test-results/map-google-live-mobile.png): nền Google tải được và ghim hiện đúng. [`map-cluster-mobile.png`](../test-results/map-cluster-mobile.png): chọn quán trong cụm, bảng thông tin, chỉ đường và vị trí ước lượng. |
| Bản đồ desktop | Đạt về UI và nền thật | [`map-desktop-live-light.png`](../test-results/map-desktop-live-light.png): 18 ô Google Maps tải được; cụm 2 quán mở bảng thông tin, chọn “Phở Bò”, thấy nhãn vị trí ước lượng và link chỉ đường. |
| Nền bản đồ lỗi | Đạt qua kiểm thử lỗi có kiểm soát | [`map-tiles-unavailable-mobile.png`](../test-results/map-tiles-unavailable-mobile.png) và [`form-map-tiles-unavailable-mobile.png`](../test-results/form-map-tiles-unavailable-mobile.png): thông báo và nút thử lại hiện; thông báo ở dưới bản đồ, không che nút zoom. Lỗi OSM ngoài mạng này không được xác minh trực tiếp trong trình duyệt. |

### Bản đồ và Google Fonts

Ứng dụng dùng Google Streets (`mt*.google.com/vt/lyrs=m`) và Google Hybrid
(`lyrs=y`) trong `MapComponent`; form chọn ghim dùng OpenStreetMap tile server.
Ban đầu build bị lỗi vì sandbox không kết nối được `fonts.googleapis.com`.
Trong lần nghiệm thu có mạng, Google Fonts trả HTTP 200 và build production hoàn
thành với font thật. Trình duyệt kiểm tra thực tế tải 18 ô Google Maps trên
desktop và hiển thị nền trên điện thoại. Các lần thử OSM trực tiếp bị reset kết
nối; UI đã kiểm tra trạng thái lỗi/thử lại bằng fixture, chưa thể xác nhận khả
năng truy cập OSM từ mạng triển khai.

## Hai migration

1. [`20260930095400_005_structured_prices.sql`](../supabase/migrations/20260930095400_005_structured_prices.sql)
   thêm `price_min_vnd`, `price_max_vnd`, `price_unit`; giữ nguyên `price` cũ và
   không tự phân tích/chuyển giá mơ hồ. Constraint buộc cặp giá cùng có hoặc
   cùng thiếu, giá dương, max ≥ min, và unit chỉ là `vnd_per_person`,
   `vnd_per_group` hoặc chưa biết. Migration cấp quyền UPDATE cột mới cho
   `authenticated`, phù hợp cách migration `002` giới hạn quyền theo cột.
2. [`20260930095500_006_personal_saved_collections_photos_location.sql`](../supabase/migrations/20260930095500_006_personal_saved_collections_photos_location.sql)
   giữ `image_url`, backfill ảnh bìa cũ vào `image_urls`, giới hạn tối đa 5 ảnh,
   giữ vị trí cũ là ước lượng và buộc pin `exact` có đủ tọa độ trong biên hợp lệ.
   Ba bảng riêng tư bật RLS, cấp quyền phù hợp và giới hạn thao tác theo
   `auth.uid()`; collection item có khóa ngoại ghép bảo đảm `user_id` là chủ
   collection. Ảnh và nhà hàng vẫn dùng chính sách chung sẵn có; role quản trị/
   contributor không bị thay bằng quyền cá nhân mới.

PGlite vẫn được dùng cho bài test SQL đơn vị. Ngoài ra, bộ tích hợp mới đã gọi
Auth, PostgREST, Storage và database của Supabase local đang chạy; các khóa chỉ
được giữ trong tiến trình, không ghi vào `.env.local` hay đầu ra terminal. Hướng
dẫn cài và xác minh stack nằm trong [`setup.md`](./setup.md).

Chưa áp dụng migration lên Supabase production, chưa push hoặc deploy. `.env.local`
được giữ nguyên; test/build local đã override cấu hình này chỉ trong tiến trình.
