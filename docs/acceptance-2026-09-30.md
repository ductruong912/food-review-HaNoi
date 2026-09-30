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
| Build production | Đạt | `npm run build` thành công với Next.js 16.3.5 và `next/font/google` thật. Google Fonts CSS tải được khi chạy trong môi trường có mạng; không dùng font giả hoặc thay font. |
| Lint | Đạt | `npm run lint` không báo lỗi. |
| Kiểu TypeScript | Đạt | `npx tsc --noEmit` không báo lỗi. |
| Unit và quyền PostgreSQL | Đạt: 34/34 | `npm test`; chạy nguyên SQL migrations trong PGlite. Kiểm tra legacy price/image/location, constraint, grant mới, A không đọc/ghi/xóa dữ liệu riêng B, dữ liệu trùng và quyền contributor/admin/shared restaurant. Auth/Storage infrastructure của Supabase được mô phỏng. |
| Browser E2E | Đạt | `npm run test:e2e`; API Auth/REST/Storage được chặn và thay bằng fixture. Bao gồm URL/filter/list↔map, quay lại và vị trí cuộn, theme/viewport, lưu/nhập trùng/đổi tài khoản, bộ sưu tập, upload lỗi/ảnh bìa, draft, pin và retry. Đây không phải kiểm thử tích hợp Supabase thật. |
| Bản đồ điện thoại | Đạt về UI và nền thật | [`map-google-live-mobile.png`](../test-results/map-google-live-mobile.png): nền Google tải được và ghim hiện đúng. [`map-cluster-mobile.png`](../test-results/map-cluster-mobile.png): chọn quán trong cụm, bảng thông tin, chỉ đường và vị trí ước lượng. |
| Bản đồ desktop | Đạt về UI và nền thật | [`map-desktop-live-light.png`](../test-results/map-desktop-live-light.png): 18 ô Google Maps tải được; cụm 2 quán mở bảng thông tin, chọn “Phở Bò”, thấy nhãn vị trí ước lượng và link chỉ đường. |
| Nền bản đồ lỗi | Đạt qua kiểm thử lỗi có kiểm soát | [`map-tiles-unavailable-mobile.png`](../test-results/map-tiles-unavailable-mobile.png) và [`form-map-tiles-unavailable-mobile.png`](../test-results/form-map-tiles-unavailable-mobile.png): thông báo và nút thử lại hiện; thông báo ở dưới bản đồ, không che nút zoom. Lỗi OSM ngoài mạng này không được xác minh trực tiếp trong trình duyệt. |
| Supabase integration thật | Bị chặn bởi môi trường | Không có Supabase CLI, `supabase/config.toml` hoặc Docker container local. `.env.local` trỏ đến Supabase hosted nhưng chưa xác minh được là test hay production nên không được sử dụng. Cổng `54321` đang chạy là REST fixture, không phải Supabase. Không có migration nào được chạy trên project hosted. |

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

1. [`005_structured_prices.sql`](../supabase/migrations/005_structured_prices.sql)
   thêm `price_min_vnd`, `price_max_vnd`, `price_unit`; giữ nguyên `price` cũ và
   không tự phân tích/chuyển giá mơ hồ. Constraint buộc cặp giá cùng có hoặc
   cùng thiếu, giá dương, max ≥ min, và unit chỉ là `vnd_per_person`,
   `vnd_per_group` hoặc chưa biết. Migration cấp quyền UPDATE cột mới cho
   `authenticated`, phù hợp cách migration `002` giới hạn quyền theo cột.
2. [`006_personal_saved_collections_photos_location.sql`](../supabase/migrations/006_personal_saved_collections_photos_location.sql)
   giữ `image_url`, backfill ảnh bìa cũ vào `image_urls`, giới hạn tối đa 5 ảnh,
   giữ vị trí cũ là ước lượng và buộc pin `exact` có đủ tọa độ trong biên hợp lệ.
   Ba bảng riêng tư bật RLS, cấp quyền phù hợp và giới hạn thao tác theo
   `auth.uid()`; collection item có khóa ngoại ghép bảo đảm `user_id` là chủ
   collection. Ảnh và nhà hàng vẫn dùng chính sách chung sẵn có; role quản trị/
   contributor không bị thay bằng quyền cá nhân mới.

PGlite đã thực thi cả migration nguyên bản và kiểm tra hành vi RLS với các vai trò
thử. Điều đó xác nhận SQL/logic quyền ở PostgreSQL, nhưng chưa xác nhận cấu hình
JWT, Auth, Storage và policy của một project Supabase đang chạy. Chi tiết lệnh xác
minh, thứ tự áp dụng và phương án khôi phục nằm trong [`setup.md`](./setup.md).

## Cần bổ sung để nghiệm thu tích hợp thật

Chọn **một** môi trường biệt lập:

- Supabase local: cài Supabase CLI và Docker-compatible runtime; tạo
  `supabase/config.toml` bằng `supabase init`; chạy local stack bằng
  `supabase start`.
- Hoặc project Supabase test riêng, không chứa dữ liệu production.

Sau đó:

1. Đặt `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` trong
   `.env.local` thành giá trị của môi trường thử. Không đưa secret/service-role
   key vào frontend hay commit.
2. Đăng ký Site URL và redirect URI đúng cổng app, gồm `/auth/callback`; bật
   provider email test và hộp thư nhận magic link. Nếu kiểm tra Google OAuth,
   bổ sung client credentials test riêng.
3. Chạy migration theo hướng dẫn trong `setup.md`, chỉ trên local/test; tạo
   tài khoản A/B, contributor/admin và vài nhà hàng fixture.
4. Chạy lại luồng thật: đăng nhập và tiếp tục thao tác, đồng bộ hai thiết bị,
   đổi tài khoản, nhập dữ liệu trùng, collection, nhiều ảnh/ảnh bìa, pin exact,
   quyền từ chối của B, lỗi mạng và upload lỗi. Ghi nhận kết quả Auth, RLS,
   Storage và truy vấn SQL xác minh trước khi xem nghiệm thu tích hợp hoàn tất.

Không dùng URL hosted chưa xác minh, dữ liệu thật hoặc service-role key để thay
thế các bước trên.
