# Bộ Lọc Khoảng Ngày Cho Bảng Thống Kê, Thiết Kế

Ngày: 2026-06-07
Trạng thái: đã duyệt hướng thiết kế trong brainstorming. Chờ bạn rà soát đặc tả (spec).

## 1. Mục tiêu

Thêm bộ lọc khoảng ngày cho bảng thống kê (dashboard).

Người dùng có thể chọn:

- `Từ ngày`, tức ngày bắt đầu (start date).
- `Đến ngày`, tức ngày kết thúc (end date).

Khoảng ngày này lọc theo ngày của từng lần log point. Dữ liệu hiện chỉ lưu ngày dạng `YYYY-MM-DD`, nên không có lọc theo giờ phút.

## 2. Phạm vi

Trong phạm vi:

- Thêm 2 ô ngày vào dashboard.
- Giữ các bộ lọc nhanh hiện có: `Tất cả`, `Hôm nay`, `Tuần này`, `Tháng này`, `Năm này`.
- Thêm trạng thái bộ lọc `Tùy chỉnh`.
- Áp khoảng ngày cho điểm đã log, số dòng log, và phân rã theo kỳ (breakdown).
- Giữ estimate ở tab `Theo List` theo ngữ nghĩa hiện tại.

Ngoài phạm vi:

- Không đổi cấu trúc pluginData.
- Không thêm giờ phút.
- Không thêm lưu thiết lập ưa thích (preference).
- Không thêm xuất dữ liệu (export).

## 3. Hành Vi Giao Diện

Dashboard có thêm một cụm chọn ngày cạnh bộ lọc nhanh:

- Nhãn `Từ ngày` kèm `<input type="date">`.
- Nhãn `Đến ngày` kèm `<input type="date">`.

Khi người dùng nhập một trong hai ô ngày:

- Bộ lọc chuyển sang `Tùy chỉnh`.
- Dashboard vẽ lại bằng khoảng ngày hiện tại.

Khi người dùng bấm bộ lọc nhanh:

- `Hôm nay`, `Tuần này`, `Tháng này`, `Năm này` cập nhật 2 ô ngày theo khoảng tương ứng.
- `Tất cả` xóa cả 2 ô ngày.
- Dashboard vẽ lại theo bộ lọc nhanh.

Trạng thái đang chọn:

- Nút `Tùy chỉnh` được chọn khi khoảng ngày lấy từ 2 ô ngày.
- Các nút nhanh được chọn khi khoảng ngày lấy từ bộ lọc nhanh.

## 4. Luồng Dữ Liệu

Dashboard tiếp tục dùng `DateRange | null`.

```typescript
interface DateRange {
  start: string;
  end: string;
}
```

Với bộ lọc nhanh, khoảng ngày lấy từ `periodRange(filter, now)`.

Với `Tùy chỉnh`, khoảng ngày lấy từ 2 ô nhập ngày:

- Có cả `start` và `end`: lọc trong khoảng bao gồm 2 đầu.
- Chỉ có `start`: lọc từ ngày đó trở đi.
- Chỉ có `end`: lọc tới ngày đó.
- Không có cả 2: tương đương `Tất cả`.

Các hàm tổng hợp hiện có giữ nguyên hướng dùng khoảng ngày:

- `aggregateByList(cards, lists, range)`.
- `aggregateByUser(cards, range)`.
- `collectEntries(cards, range, visibleOnly)`.
- `breakdown(entries, granularity, maxBuckets)`.

Có thể mở rộng kiểu khoảng ngày để hỗ trợ một phía:

```typescript
interface DateRange {
  start?: string;
  end?: string;
}
```

`inRange(date, range)` sẽ chỉ so sánh đầu nào tồn tại.

## 5. Ngữ Nghĩa Thống Kê

Tab `Theo List`:

- Chỉ tính card đang hiện, như hiện tại.
- `Cards` vẫn là số card có point data trong list.
- `Est` vẫn là tổng estimate của card đang hiện.
- `Log` chỉ tính entry trong khoảng ngày.
- `Tiến độ` dùng `Log / Est`.

Tab `Theo User`:

- Tính cả card mở và card đã archive, như hiện tại.
- `Entries` chỉ tính số entry trong khoảng ngày.
- `Tổng Log` chỉ tính point trong khoảng ngày.

Phân rã theo kỳ:

- Chỉ dùng entry trong khoảng ngày.
- Với `Tùy chỉnh`, dùng cùng độ mịn như `all`, tức theo tuần.
- Giữ giới hạn `MAX_BUCKETS = 8`.

## 6. Xử Lý Lỗi

Nếu `Từ ngày` lớn hơn `Đến ngày`:

- Hiện cảnh báo nhỏ gần cụm ngày.
- Không cập nhật bảng bằng số liệu sai.
- Giữ kết quả vẽ gần nhất hợp lệ.

Nếu ô nhập rỗng:

- Chấp nhận range một phía.
- Nếu cả 2 ô nhập rỗng, coi là `Tất cả`.

Nếu ô nhập sai định dạng:

- Trình duyệt thường chặn vì dùng `type="date"`.
- Luồng xử lý vẫn bỏ qua giá trị không khớp `YYYY-MM-DD`.

## 7. Kiến Trúc Và Tệp Dự Kiến

`src/core/stats-types.ts`:

- Mở rộng `TimeFilter` thêm `custom`.
- Cho `DateRange` hỗ trợ `start?` và `end?`.

`src/core/stats.ts`:

- Cập nhật `inRange` để xử lý khoảng ngày một phía.
- Cập nhật `granularityFor('custom')` thành `week`.

`src/ui/dashboard.ts`:

- Thêm trạng thái `customStart` và `customEnd`.
- Thêm hàm đọc khoảng ngày hiện tại.
- Đồng bộ ô nhập ngày khi bấm bộ lọc nhanh.
- Chuyển bộ lọc sang `custom` khi người dùng nhập ngày.
- Hiện cảnh báo khi khoảng ngày đảo chiều.

`dashboard.html`:

- Thêm cụm ô nhập ngày.
- Thêm vùng cảnh báo lỗi ngày.

`src/ui/dashboard.css`:

- Tạo style cho cụm ngày theo ngôn ngữ hiện tại của dashboard.
- Giữ bố cục responsive, không tạo tràn ngang ở modal hẹp.

## 8. Kiểm Thử

Kiểm thử đơn vị cho lõi:

- `inRange` chấp nhận khoảng ngày chỉ có start.
- `inRange` chấp nhận khoảng ngày chỉ có end.
- `inRange` trả false khi ngày nằm ngoài đầu đã nhập.
- `granularityFor('custom')` trả `week`.

Kiểm thử giao diện:

- Bấm bộ lọc nhanh cập nhật 2 ô nhập ngày.
- Nhập ngày chuyển bộ lọc sang `Tùy chỉnh`.
- Khoảng ngày đảo chiều hiện cảnh báo và không vẽ số liệu sai.

Xác minh cuối:

- `npm test`.
- `npm run build`.

## 9. Tiêu Chí Hoàn Thành

Tính năng hoàn thành khi:

- Người dùng lọc dashboard bằng `Từ ngày` và `Đến ngày`.
- Các bộ lọc nhanh vẫn hoạt động như trước.
- Khoảng ngày một phía hoạt động.
- Khoảng ngày đảo chiều không vẽ sai số.
- Dashboard không tràn ngang ở khung nhìn hẹp.
- Kiểm thử và build đều thành công.
