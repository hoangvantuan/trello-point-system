# Trello Point System Power-Up — Thiết kế

Ngày: 2026-06-06
Trạng thái: Đã chốt qua brainstorming + grill, chờ lập plan triển khai.

## 1. Mục tiêu

Một Trello Power-Up tự host, giải quyết 3 nhu cầu:

1. **Estimate** một con số chung cho mỗi card (per-card).
2. **Log point** kiểu log time, mỗi lần ghi rõ ai + bao nhiêu point + ngày + ghi chú (per-member).
3. **Lịch sử theo ngày** xem được trên từng card.

Đơn vị là **point** (không phải giờ). Không backend: toàn bộ dữ liệu lưu trong card ở chế độ `shared`.

Phi mục tiêu (ngoài phạm vi MVP): export Google Sheet/CSV, dashboard xuyên board, velocity/burndown, nén ngày, backend, submit Trello marketplace.

## 2. Kiến trúc tổng quan

```
┌─────────────┐   nhúng iframe   ┌──────────────────────────┐
│ Trello Board│ ───────────────► │  Power-Up (TS + Vite)    │
└─────────────┘                  │                          │
                                 │  ┌────────────────────┐  │
   t.member ◄────── danh tính ───┤  │ Lớp keo SDK (mỏng) │  │
   t.get/t.set ◄─── đọc/ghi ─────┤  └─────────┬──────────┘  │
        │                        │            │ gọi          │
        ▼                        │  ┌─────────▼──────────┐  │
  card+shared pluginData         │  │ Lõi logic thuần    │  │
  (lưu trong card)               │  │ (không biết Trello)│  │
                                 │  └────────────────────┘  │
                                 └──────────────────────────┘
```

- **Lõi logic thuần**: không phụ thuộc Trello. Chứa encode/decode, tính tổng + làm tròn, tính % dung lượng, validate, gộp lịch sử từ nhiều key. Đây là nơi đặt unit test.
- **Lớp keo SDK**: mỏng, chỉ gọi `t.set`/`t.get`/`t.member` và render DOM (badge, popup). Test thủ công trên board thật.

### Tech stack

| Hạng mục | Lựa chọn |
|---|---|
| Ngôn ngữ | TypeScript |
| Build | Vite (ra file tĩnh) |
| Framework UI | Không (vanilla DOM) |
| Test lõi | Vitest |
| Host | Cloudflare Pages (HTTPS) |
| Đăng ký | Power-Up private nội bộ tại `trello.com/power-ups/admin` |
| Capabilities | `card-badges`, `card-detail-badges` |
| API key lúc chạy | Không cần (chạy trong context iframe) |

## 3. Mô hình dữ liệu

Tất cả lưu ở scope `card`, visibility `shared`.

| Key | Kiểu | Nội dung |
|---|---|---|
| `est` | number | Estimate chung của card (tùy chọn) |
| `log_<memberId>` | object | Log của một thành viên |

Hình dạng value của `log_<memberId>`:

```json
{
  "v": 1,
  "n": "Tuấn",
  "u": "tuanhv",
  "e": [
    ["2026-06-06", 3, "fix login"],
    ["2026-06-05", 2, ""]
  ]
}
```

- `v`: phiên bản schema, để migrate về sau (bắt đầu từ 1).
- `n`, `u`: fullName và username, lưu một lần trong header. Tự ghi đè bằng tên hiện tại mỗi lần member đó log mới (làm tươi). Sống sót khi member rời board.
- `e`: mảng entry, mỗi entry là mảng vị trí `[ngày, point, comment]`.
  - `ngày`: chuỗi `YYYY-MM-DD`, không kèm giờ, không kèm timezone.
  - `point`: number > 0, tối đa 1 chữ số thập phân, ≤ 100.
  - `comment`: chuỗi, có thể rỗng `""`.

### Vì sao tách key theo member

`t.set` ghi đè cả value của một key. Nếu mọi người dùng chung một key, hai người log đồng thời sẽ đè nhau (last-write-wins), mất log âm thầm. Tách key `log_<memberId>` đảm bảo **mỗi người chỉ ghi key của chính mình**, triệt tiêu va chạm. memberId nằm ở tên key nên không lặp lại trong từng entry (tiết kiệm ký tự).

### Giới hạn 4096 ký tự

Đã xác minh từ tài liệu Atlassian: trần **4096 ký tự tính trên TOÀN BỘ object đã stringify của cặp `card + shared`**, gộp mọi key. Vượt thì `t.set` reject với lỗi "PluginData length of 4096 characters exceeded.".

Hệ quả: tách key theo member **không** cộng thêm budget; cả `est` và mọi `log_*` chia chung 4096 trên một card. Card càng nhiều người log thì mỗi người càng ít chỗ.

Nguồn:
- https://developer.atlassian.com/cloud/trello/power-ups/client-library/getting-and-setting-data/
- https://community.developer.atlassian.com/t/update-t-set-data-size-limits/32879

## 4. Hành vi nghiệp vụ

### Estimate
- Tùy chọn (card chưa estimate vẫn log point được).
- Thập phân, chặn số âm, ≤ 100.
- Ai trong board cũng sửa được. Là một số chung nên chấp nhận last-write-wins (sửa rất hiếm).
- Lưu key riêng `est`.

### Log point
- point > 0, tối đa 1 chữ số thập phân, ≤ 100/entry.
- Ngày mặc định hôm nay (theo ngày **local của trình duyệt** người log). Cho backdate về quá khứ không giới hạn xa. **Chặn ngày tương lai** (max của date picker = hôm nay).
- Có comment (có thể rỗng).
- Người log được tự nhận diện qua `t.member('id','username','fullName')`, không cần nhập tay.

### Quyền
- Log: **chỉ chủ nhân sửa/xóa log của mình**. UI chỉ hiện nút ✎/🗑 trên dòng của bạn.
- Estimate: ai trong board cũng sửa.
- Xóa log có **xác nhận một bước nhẹ** (nút 🗑 đổi thành "Chắc chứ? ✓/✗" tại chỗ), không bung dialog nặng.

### Con số và làm tròn
- Tổng point hiển thị làm tròn 2 chữ số: `Math.round(sum * 100) / 100`, né rác số thực (`1.1 + 2.2`).
- Validate lúc nhập: rỗng / không phải số / âm / > 100 / quá 1 chữ số thập phân → chặn, báo lỗi đỏ ngay dưới ô, không cho lưu.

### Dung lượng (xử lý trần 4096)
- Đo thực `JSON.stringify(<object card+shared>).length` mỗi lần chuẩn bị ghi.
- Thanh % trong popup: ví dụ `61% (2510/4096)`. Vàng ở **80%** (3277), đỏ ở **92%** (3768). Chỉ hiện thanh %, không hiện "số log còn lại" (tránh ước lượng gây hiểu nhầm).
- **Không tự xóa** khi đầy. Người dùng tự quyết.
- Nếu `t.set` vẫn reject vì vượt trần: bắt lỗi, hiện banner đỏ "Card đã đầy, xóa bớt log cũ để tiếp tục", **giữ nguyên nội dung đang gõ**.

## 5. Giao diện

### Badge mặt card (`card-badges`)
- Dạng `<icon> đã_log/estimate`, ví dụ `🎯 6.5/8`. Một icon để dễ nhận diện, không lẫn với badge khác.
- Trạng thái:
  - Có estimate + log → `6.5/8`.
  - Có estimate, chưa log → `0/8`.
  - Có log, chưa estimate → `6.5` (ẩn mẫu số).
  - Trống cả hai → **không hiện badge**.
- Khi log **vượt** estimate (ví dụ `9/8`): tô **màu cam** (lưu ý nhẹ, không báo động đỏ).

### Badge chi tiết card (`card-detail-badges`)
- Một nút `Log point · 6.5/8`, bấm mở popup.

### Popup (màn chính, ~320px)

```
┌──────────────────────────────┐
│ Estimate: [  8  ] point       │
│ ▓▓▓▓▓▓░░░░ 61%  (2510/4096)    │
├──────────────────────────────┤
│ + Log point  (luôn mở)        │
│  Point: [ 1.5 ]               │
│  Ngày:  [ 2026-06-06 ▾]       │
│  Ghi chú: [____________]      │
│            [ Lưu log ]        │
├──────────────────────────────┤
│ Lịch sử         Tổng: 6.5/8   │
│ ▸ 06/06  (4.5)                │
│   Tuấn   3    "fix login"  ✎🗑 │
│   Mai    1.5  "review"        │
│ ▸ 06/05  (2)                  │
│   Tuấn   2                ✎🗑 │
└──────────────────────────────┘
```

- Một popup duy nhất: sửa estimate + nhập log (form luôn mở) + xem lịch sử.
- Lịch sử **nhóm theo ngày, mỗi ngày có tổng phụ**, ngày mới nhất trên cùng.
- Nút ✎/🗑 chỉ trên dòng của chính mình.
- Dòng tổng `6.5/8` cố định.

### Trạng thái rỗng / tải / lỗi
- Card chưa có log: lịch sử hiện dòng nhạt "Chưa có log nào", estimate để placeholder.
- Đang tải: `t.get` đọc từ cache nên nhanh; spinner nhỏ, render ngay khi có data.
- Lỗi SDK/mạng: thông báo lỗi gọn, không để popup trắng câm.
- Member đã rời board: vẫn hiện tên từ header đã lưu.

## 6. Chiến lược kiểm thử

- **Vitest cho lõi thuần**: encode/decode, cộng + làm tròn, tính % dung lượng, validate point/ngày, chặn ngày tương lai, gộp lịch sử từ nhiều key. Hàm thuần, test dễ và đáng.
- **Test thủ công** lớp keo SDK trên một board Trello thật: badge, popup, `t.set`/`t.get`/`t.member`, nhận diện member, va chạm đồng thời.

## 7. Quyết định mở rộng tương lai (không làm bây giờ)

- Export ra Google Sheet/CSV qua script ngoài đọc REST API (`GET /cards/{id}/pluginData` với token board). Data đã ở `shared` nên đọc được, thêm sau không phá vỡ gì.
- Dashboard xuyên board, velocity, burndown.
- Nén ngày thành số (tiết kiệm ~11% trần) khi đụng giới hạn thường xuyên, dùng `v:2` để migrate.
- Backend khi cần lịch sử bền vững kể cả khi xóa card, hoặc log vô hạn vượt 4096.
