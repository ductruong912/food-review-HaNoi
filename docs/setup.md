# Thiết lập nhóm bạn

Ứng dụng vẫn cho phép mọi người xem và chia sẻ quán. Chỉ tài khoản được
chủ nhóm cấp quyền mới có thể thêm quán hoặc tải ảnh.

## Nâng cấp database

Sao lưu database trước khi nâng cấp. Chạy migration trong database local/test
trước để kiểm tra dữ liệu và quyền. Đợt thay đổi này chưa chạy migration lên
Supabase production.

Nếu database đã chạy đến `004`, chạy lần lượt:

1. [`005_structured_prices.sql`](../supabase/migrations/005_structured_prices.sql)
   thêm giá tối thiểu, tối đa và đơn vị. Migration giữ nguyên cột `price` dạng
   văn bản và không chuyển các giá cũ tự động. Giá mơ hồ giữ nguyên, không có
   đơn vị suy đoán; điền cột mới sau khi xác minh thông tin quán.
2. [`006_personal_saved_collections_photos_location.sql`](../supabase/migrations/006_personal_saved_collections_photos_location.sql)
   tạo dữ liệu yêu thích và bộ sưu tập theo tài khoản, thêm thư viện ảnh và
   tọa độ có mức chính xác. Migration sao chép `image_url` cũ vào thư viện ảnh,
   giữ `image_url` để tương thích, và đánh dấu các ghim cũ là ước lượng.

Nếu database mới chưa thiết lập, chạy `001`, `002`, `003`, `004`, `005`, rồi
`006` theo thứ tự. Không chạy lại `001` sau `002` vì `001` chứa các policy
công khai cũ. Nếu đã chạy `002`, không chạy lại vì migration này đặt lại quyền;
chạy các migration còn thiếu theo đúng thứ tự.

Nếu database mới đã chạy `003`, chạy `004`, `005`, rồi `006`. Nếu đã chạy `004`,
chỉ cần `005` và `006`.

`004` giữ nguyên quán và quyền thành viên, đổi các danh mục cũ và thêm trường
`occasions` cho tag Hẹn hò, Đi nhóm, Gia đình, Một mình. Quán từng thuộc
“Đi date” được giữ tag “Hẹn hò” và tạm chuyển sang “Món Việt hằng ngày”; kiểm tra
lại loại món của những quán này trong form sửa.

Chạy các file SQL từ `supabase/migrations/` bằng kết nối database local/test
đã được chọn rõ ràng. Không dùng URL production cho các lệnh trong quá trình
kiểm tra này.

### Xác minh sau migration (chỉ trên local/test)

Sau khi chạy `005` và `006`, dùng SQL Editor của đúng database local/test để
kiểm tra schema, chính sách và quyền:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('restaurants', 'user_favorites', 'favorite_collections', 'favorite_collection_items')
order by tablename;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('restaurants', 'user_favorites', 'favorite_collections', 'favorite_collection_items'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select
  has_table_privilege('anon', 'public.user_favorites', 'SELECT') as anon_reads_favorites,
  has_table_privilege('authenticated', 'public.user_favorites', 'SELECT') as members_read_favorites,
  has_column_privilege('authenticated', 'public.restaurants', 'price_min_vnd', 'UPDATE') as members_update_price_min,
  has_column_privilege('authenticated', 'public.restaurants', 'image_urls', 'UPDATE') as members_update_gallery;

select
  count(*) filter (where location_accuracy = 'exact' and (latitude is null or longitude is null)) as exact_without_coordinates,
  count(*) filter (where price is not null and price_min_vnd is null and price_max_vnd is null) as legacy_price_not_converted,
  count(*) filter (where image_url is not null and btrim(image_url) <> '' and not (image_urls @> array[image_url])) as legacy_cover_missing_from_gallery
from public.restaurants;
```

Kết quả mong đợi: cả bốn bảng public đều bật RLS; `anon_reads_favorites = false`,
`members_read_favorites = true`, hai quyền cập nhật cột mới là `true`,
`exact_without_coordinates = 0`. `legacy_price_not_converted` có thể lớn hơn 0
vì giá cũ được giữ nguyên có chủ ý. Nếu `legacy_cover_missing_from_gallery`
lớn hơn 0, kiểm tra các quán đó: client cũ có thể đã đổi `image_url` sau lần
backfill, nhưng client mới vẫn coi `image_url` là ảnh bìa và giữ lại ảnh này khi
mở form sửa.

Sau đó dùng hai tài khoản thử A và B trong app local/test: A lưu quán và tạo bộ
sưu tập; đăng xuất, đăng nhập B, xác nhận B không thấy dữ liệu riêng của A.
Đăng nhập lại A để xác nhận dữ liệu còn nguyên. Với contributor, thử thêm/sửa
quán của mình và xác nhận không sửa được quán của tài khoản khác; với viewer,
xác nhận không thể thêm quán hoặc tải ảnh. Ảnh quán trong bucket `images` được
đọc công khai theo thiết kế, còn quyền tải ảnh yêu cầu vai trò được cấp và thư
mục mang UUID của người tải. Không dùng tài khoản hoặc dữ liệu production để
kiểm tra.

### Khôi phục

- Nếu migration lỗi trước `COMMIT`, transaction trong từng file sẽ rollback;
  xem lỗi, khôi phục snapshot nếu database đã có thao tác ngoài migration rồi
  thử lại trên database local/test.
- Nếu migration đã commit nhưng frontend gặp lỗi, rollback phiên bản app trước
  và giữ các cột/bảng mới. Đây là thay đổi cộng thêm nên giữ schema không làm
  mất dữ liệu cũ, đồng thời tránh làm mất mục yêu thích hoặc bộ sưu tập đã tạo.
- Chỉ xóa bảng/cột mới khi đã xuất và xác nhận chấp nhận mất dữ liệu trong
  `user_favorites`, `favorite_collections`, `favorite_collection_items`, các ảnh
  ngoài ảnh bìa trong `image_urls` và các trường giá có cấu trúc. Nếu cần xóa,
  dùng snapshot trước migration để khôi phục và thực hiện rollback SQL riêng
  trên database local/test trước. Không chạy lệnh xóa ngược trên production.

### Chuẩn bị kiểm thử tích hợp thật

Môi trường nghiệm thu ngày 30/09/2026 chưa có Supabase CLI, `supabase/config.toml`
hoặc Supabase local đang chạy; file `.env.local` hiện trỏ tới một Supabase hosted
chưa xác minh được là test hay production. Vì vậy chưa chạy migration hay đăng
nhập thật vào URL đó. Cần có một trong hai môi trường sau:

- **Supabase local:** cài Supabase CLI và Docker-compatible runtime, chạy
  `supabase init` nếu chưa có cấu hình, rồi `supabase start`. Xem
  [quy trình local của Supabase](https://supabase.com/docs/guides/local-development/cli-workflows).
- **Project test riêng:** tạo project chỉ chứa dữ liệu thử, không dùng chung với
  production; xác minh project ref và URL trước khi chạy SQL.

Trong cả hai trường hợp, thiết lập app bằng URL API và anon/publishable key của
môi trường test trong `.env.local` (file này đã bị Git ignore), không chép khóa
service role vào frontend. Không chạy E2E khi app đang dùng `.env.local` có URL
chưa xác minh: Playwright chặn API trong trình duyệt, nhưng request do Next.js
server tạo có thể đi ra ngoài trình duyệt. Với môi trường Supabase local mặc định,
API thường là `http://127.0.0.1:54321`; lấy URL và anon key thực tế từ đầu ra CLI,
không dùng giá trị đoán.

Tạo hai người dùng thử A và B, rồi cấp A vai trò `contributor`, B vai trò `viewer`
trong `profiles`; tạo admin riêng nếu cần kiểm tra quyền quản trị. Bật email Auth
local và hộp thư thử (Mailpit) để kiểm tra magic link, đặt Site URL theo cổng app,
thêm đúng callback `/auth/callback` vào danh sách redirect. Dùng bucket `images`
và dữ liệu nhà hàng thử riêng. Không nhập dữ liệu thật.

Trên database local/test trống, áp dụng SQL `001` đến `006` theo thứ tự trong
Supabase Studio local; với database đã ở `004`, chỉ chạy `005` rồi `006`. Sau đó
chạy các truy vấn xác minh ở phần trên và thực hiện ma trận A/B cùng contributor,
viewer, admin. Nếu thử bằng project test hosted, xác minh lại URL/project ref ngay
trước khi mở SQL Editor; không dùng `db reset --linked` cho project có dữ liệu cần
giữ. Hướng dẫn CLI hiện hành phân biệt rõ lệnh local với lệnh linked trong
[tài liệu Supabase](https://supabase.com/docs/guides/local-development/cli-workflows).

Để kiểm tra đăng nhập tiếp tục thao tác, dùng hai trình duyệt riêng: A mở trang
thêm quán hoặc yêu cầu nhập danh sách trên thiết bị, đăng nhập qua magic link
local, xác nhận trở lại đúng thao tác; lặp lại với B. Sau đó thử lưu/xóa quán,
nhập mục trùng, tạo bộ sưu tập, tải nhiều ảnh/chọn bìa và lưu ghim đã xác nhận.
Thử ngắt mạng rồi kết nối lại khi đồng bộ và upload. Xác nhận B không đọc, sửa
hoặc xóa favorite/collection/item của A; đồng thời xác nhận quyền sửa quán chung
vẫn theo policy contributor/admin hiện có.

Với database chưa thiết lập phân quyền, làm theo các bước dưới đây:

1. Xuất bản sao lưu bảng `restaurants` và `profiles` trước khi chuyển đổi.
2. Trong Supabase SQL Editor, chạy
   [`002_member_permissions.sql`](../supabase/migrations/002_member_permissions.sql)
   rồi [`003_fix_images_bucket.sql`](../supabase/migrations/003_fix_images_bucket.sql)
   Nếu đã chạy `002`, chỉ cần chạy `003`; không chạy lại `002` vì nó đặt lại quyền.
   Sau `003`, chạy `004`, `005`, rồi `006`. Nếu tạo database mới, chạy đủ sáu
   migration theo thứ tự. Không chạy lại `001` sau `002` vì `001` chứa các policy
   công khai cũ.
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

`006` giới hạn thư viện ở năm ảnh mỗi quán. `image_url` vẫn là ảnh bìa cho
client cũ. Tọa độ chỉ được ghi là chính xác khi người đóng góp xác nhận ghim;
tọa độ cũ và vị trí suy ra từ liên kết tiếp tục mang nhãn ước lượng.

## Bản nháp và quán đã lưu

- Form thêm/sửa tự lưu bản nháp theo tài khoản và mã quán trên thiết bị.
  Bản nháp được khôi phục khi mở lại form và xóa sau khi lưu thành công.
- Khi ảnh đang tải, nút đăng bài bị khóa. Ảnh tối đa 8 MiB; chỉ nhận
  JPG, PNG, WebP, GIF và AVIF. Form hiển thị lỗi và giữ nội dung để thử lại.
- Khách lưu yêu thích trên thiết bị. Sau khi đăng nhập, danh sách tài khoản
  đồng bộ giữa các thiết bị. Khi nhập danh sách trên thiết bị, chọn quán muốn
  sao chép; mục trùng được bỏ qua, còn mục không tải được vẫn nằm trên thiết bị.
- Bộ sưu tập cá nhân thuộc riêng tài khoản. Khách cần đăng nhập để tạo và đồng
  bộ bộ sưu tập.
- Form hỗ trợ tối đa năm ảnh mỗi quán và chọn ảnh bìa. Quán cũ vẫn đọc được ảnh
  từ `image_url`.
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

Kiểm thử phân quyền chạy các migration nguyên bản trong PostgreSQL
cục bộ qua PGlite. Chỉ hạ tầng `auth` và `storage` của Supabase được mô phỏng.
Các kiểm thử này không thay thế kiểm tra đăng nhập thật và cấu hình project
Supabase đang triển khai. `npm run build` cần mạng để tải Google Fonts.

Để chạy kiểm thử trình duyệt, mở `npm run dev` ở terminal thứ nhất, rồi chạy
`npm run test:e2e` ở terminal thứ hai. Windows mặc định dùng Edge đã cài;
trên máy khác chạy `npx playwright install chromium` trước. Có thể đặt
`TEST_URL`, `BROWSER_CHANNEL` và `HEADLESS=1` trong môi trường chạy.

Bộ kiểm thử chặn và mô phỏng API Supabase phía trình duyệt: tìm kiếm,
bộ lọc, chuyển danh sách/bản đồ, quay lại trang chi tiết, đồng bộ yêu thích,
đổi tài khoản, nhập mục trùng, bộ sưu tập, bản nháp, tải ảnh, chọn ghim, quyền
tài khoản và callback PKCE. Không gửi email và không ghi dữ liệu lên project
thật. Ảnh chụp
mobile/desktop ở cả hai theme nằm trong `test-results/` (không commit).
Các trang render trên server vẫn có thể đọc dữ liệu thật; bài kiểm thử tránh
dùng trang chi tiết thật cho kết quả ghi mô phỏng.

Trước khi dùng bản deploy, kiểm tra một lần với tài khoản thật được cấp
quyền: đăng nhập email/Google, tải ảnh hợp lệ và thêm/sửa/xóa một quán thử.
Kiểm thử mô phỏng không xác nhận cấu hình provider, redirect hoặc Storage
của project đang chạy.
