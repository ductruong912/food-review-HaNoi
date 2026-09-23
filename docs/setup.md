# Thiết lập nhóm bạn

Ứng dụng vẫn cho phép mọi người xem và chia sẻ quán. Chỉ tài khoản được
chủ nhóm cấp quyền mới có thể thêm quán hoặc tải ảnh.

## Cập nhật database đang dùng

Nếu đã chạy đến `003`, chỉ chạy
[`004_refine_categories_and_occasions.sql`](../supabase/migrations/004_refine_categories_and_occasions.sql).
Migration này giữ nguyên quán và quyền thành viên, đổi các danh mục cũ và thêm
trường `occasions` cho các tag Hẹn hò, Đi nhóm, Gia đình, Một mình.
Quán từng thuộc “Đi date” được giữ tag “Hẹn hò” và tạm chuyển sang
“Món Việt hằng ngày”; hãy kiểm tra lại loại món của những quán này trong form sửa.
`004` có thể chạy lại mà không nhân đôi tag. Chạy trước khi deploy frontend mới.

Với database chưa thiết lập phân quyền, làm theo các bước dưới đây:

1. Xuất bản sao lưu bảng `restaurants` và `profiles` trước khi chuyển đổi.
2. Trong Supabase SQL Editor, chạy
   [`002_member_permissions.sql`](../supabase/migrations/002_member_permissions.sql)
   rồi [`003_fix_images_bucket.sql`](../supabase/migrations/003_fix_images_bucket.sql)
   Nếu đã chạy `002`, chỉ cần chạy `003`; không chạy lại `002` vì nó đặt lại quyền.
   Sau `003`, chạy `004`. Nếu tạo database mới, chạy `001`, `002`, `003`, rồi `004`
   theo thứ tự. Không chạy lại `001` sau `002` vì `001` chứa các policy công khai cũ.
3. Migration giữ nguyên quán và ảnh cũ, nhưng đưa mọi profile về `viewer`.
   Quyền cũ cần cấp lại vì trước đây API cho phép sửa công khai trường `role`.
   Chạy migration trước khi đưa frontend mới lên để đóng quyền ghi công khai.
4. Đăng nhập app bằng Google hoặc email để tạo profile, rồi cấp lại quyền
   bằng UUID của tài khoản trong **Authentication → Users**:

   ```sql
   -- Thay UUID bằng tài khoản của bạn.
   update public.profiles
   set role = 'admin'
   where id = 'YOUR-AUTH-USER-UUID';

   -- Sau khi bạn bè đăng nhập lần đầu, cấp quyền đóng góp từng người.
   update public.profiles
   set role = 'contributor'
   where id = 'FRIEND-AUTH-USER-UUID';
   ```

   Bấm **Kiểm tra lại quyền** ở trang cá nhân sau khi cấp quyền. Dùng UUID từ Authentication, không dựa
   vào tên hiển thị hoặc email lưu trong profile cũ.
5. Kiểm tra bằng tài khoản được cấp quyền: thêm quán, tải ảnh, sửa và xóa
   quán của mình. Tài khoản chưa được cấp quyền chỉ được xem.

`003` giới hạn ảnh ở 8 MiB và các định dạng JPG, PNG, WebP, GIF, AVIF.
Bucket public chỉ làm URL ảnh có thể đọc được; quyền upload vẫn do RLS kiểm tra.
Migration `003` có thể chạy lại để chuẩn hóa cấu hình. Phản hồi 404 khi đọc
metadata bucket bằng khóa anonymous không đủ kết luận bucket bị thiếu.

## Bản nháp và quán đã lưu

- Form thêm/sửa tự lưu bản nháp theo tài khoản và mã quán trên thiết bị.
  Bản nháp được khôi phục khi mở lại form và xóa sau khi lưu thành công.
- Khi ảnh đang tải, nút đăng bài bị khóa. Ảnh tối đa 8 MiB; chỉ nhận
  JPG, PNG, WebP, GIF và AVIF. Form hiển thị lỗi và giữ nội dung để thử lại.
- Quán đánh dấu yêu thích được lưu chung trên trình duyệt hiện tại,
  đồng bộ giữa các tab, chưa đồng bộ sang thiết bị khác.
- Từ khóa, quận, loại quán, đánh giá và cách sắp xếp được lưu vào URL.
  Chia sẻ URL để mở cùng bộ lọc; danh sách yêu thích vẫn phụ thuộc thiết bị.

| Vai trò | Thêm quán/ảnh | Sửa/xóa quán |
| --- | --- | --- |
| Chưa đăng nhập / viewer | Không | Không |
| contributor | Có | Chỉ bài của mình |
| admin | Có | Tất cả, bao gồm bài khách cũ |

Tài khoản khách cũ được tạo trong trình duyệt nên không thể xác minh chủ sở
hữu bằng đăng nhập mới. Bài cũ vẫn hiển thị; admin quản lý hoặc gán lại
`created_by` bằng SQL sau khi xác nhận chủ bài. Không tự nhận lại bài theo tên.

## Đăng nhập

- Cấu hình Google và/hoặc Email trong **Authentication → Providers**.
- Đặt **Site URL** thành địa chỉ website. Thêm URL callback chính xác vào
  **Redirect URLs**, ví dụ `https://your-site.example/auth/callback` và
  `http://localhost:3000/auth/callback` khi phát triển.
- Giữ mẫu email Magic Link sử dụng `{{ .ConfirmationURL }}`.
- Copy `.env.local.example` thành `.env.local`, điền URL và anon/publishable
  key của Supabase. Xóa biến `NEXT_PUBLIC_ADMIN_PIN` cũ khỏi môi trường deploy.
- Link email phải mở trong cùng trình duyệt và thiết bị đã yêu cầu link.
  Phiên đăng nhập được lưu trong trình duyệt; Google/email dùng PKCE.
  Xem [hướng dẫn PKCE của Supabase](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

Quyền ghi được kiểm tra tại database bằng RLS và giới hạn cột cập nhật;
ẩn nút ở giao diện chỉ giúp người dùng hiểu quyền của mình.
Xem [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
và [quyền theo cột](https://supabase.com/docs/guides/database/postgres/column-level-security).

## Bản đồ và tìm kiếm

- Gõ `bun cha`, `dong da` hoặc chữ có dấu đều tìm được cùng dữ liệu.
- Trang chủ và trang tìm kiếm dùng chung bộ chuẩn hóa tên, địa chỉ, quận
  và nhận xét. Trang tìm kiếm không còn giới hạn riêng 50 kết quả.
  Cả hai vẫn dùng dữ liệu tải một lần, phù hợp danh sách nhóm nhỏ và chịu
  giới hạn trả về của Supabase (thường 1.000 dòng).
- Link Google Maps có tọa độ địa điểm `!3d...!4d...`, `q=lat,lng`,
  `query=lat,lng` hoặc `/place/lat,lng` được dùng làm vị trí quán.
- Link rút gọn hoặc chỉ có tọa độ khung nhìn `@lat,lng` chưa xác định được
  vị trí quán: ghim được ghi là ước lượng và không hiện khoảng cách.
- Khoảng cách cho vị trí xác định là đường thẳng, không phải quãng đường đi xe.

## Kiểm tra thay đổi

Với Node.js 22.18+ hoặc Node.js 24:

```sh
npm ci
npm run lint
npm test
npm run build
```

Kiểm thử phân quyền chạy cả bốn migration nguyên bản trong PostgreSQL
cục bộ qua PGlite. Chỉ hạ tầng `auth` và `storage` của Supabase được mô phỏng.
Các kiểm thử này không thay thế kiểm tra đăng nhập thật và cấu hình project
Supabase đang triển khai. `npm run build` cần mạng để tải Google Fonts.

Để chạy kiểm thử trình duyệt, mở `npm run dev` ở terminal thứ nhất, rồi chạy
`npm run test:e2e` ở terminal thứ hai. Windows mặc định dùng Edge đã cài;
trên máy khác chạy `npx playwright install chromium` trước. Có thể đặt
`TEST_URL`, `BROWSER_CHANNEL` và `HEADLESS=1` trong môi trường chạy.

Bộ kiểm thử chặn và mô phỏng API Supabase phía trình duyệt: tìm kiếm,
bộ lọc, bản nháp, tải ảnh, lưu lỗi/thành công, quyền tài khoản và callback
PKCE. Không gửi email và không ghi dữ liệu lên project thật. Ảnh chụp
mobile/desktop ở cả hai theme nằm trong `test-results/` (không commit).
Các trang render trên server vẫn có thể đọc dữ liệu thật; bài kiểm thử tránh
dùng trang chi tiết thật cho kết quả ghi mô phỏng.

Trước khi dùng bản deploy, kiểm tra một lần với tài khoản thật được cấp
quyền: đăng nhập email/Google, tải ảnh hợp lệ và thêm/sửa/xóa một quán thử.
Kiểm thử mô phỏng không xác nhận cấu hình provider, redirect hoặc Storage
của project đang chạy.
