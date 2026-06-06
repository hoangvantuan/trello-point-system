# Dashboard Thống Kê Point System — Thiết kế

Ngày: 2026-06-06
Trạng thái: Đã chốt qua brainstorming, chờ review spec.

## 1. Mục tiêu

Thêm **dashboard thống kê** ở cấp board, giải quyết 2 nhu cầu:

1. **Theo List**: tổng hợp tiến độ (estimate vs. logged) mỗi list, kèm thanh progress.
2. **Theo User**: tổng hợp point mỗi user đã log, breakdown theo ngày/tuần/tháng/năm.

Cả hai tab dùng chung **bộ lọc thời gian** (tất cả / hôm nay / tuần này / tháng này / năm này).

Phi mục tiêu: export CSV, biểu đồ burndown/velocity, sync tự động (webhook).

## 2. Ràng buộc kỹ thuật đã xác minh

### Trello Power-Up API không hỗ trợ inject UI vào list header

Không có capability `list-header-section`. Chỉ có `list-actions` (menu "..." của list) và `list-sorters`. Do đó dùng **board-button** mở modal.

### Không thể bulk fetch pluginData

`t.cards('all')` không trả pluginData. Cần gọi REST API `GET /1/cards/{id}/pluginData` từng card. Do đó dùng sync thủ công + cache.

### Rate limit REST API

- 100 request/10 giây per token.
- Board 100 card = ~10 giây sync. Chấp nhận được cho sync thủ công.

### Dung lượng board-scope

- Board-scope `shared`: **8192 ký tự** (gấp đôi card-scope).
- Cần thiết kế cache compact để vừa 8192.

## 3. Kiến trúc

```
┌──────────────┐    board-button click    ┌────────────────────────┐
│ Trello Board │ ──────────────────────► │ Modal Dashboard        │
└──────────────┘                         │  ┌──────────────────┐  │
                                         │  │ Tab: Theo List   │  │
       board+shared                      │  │ Tab: Theo User   │  │
       "stats" key ◄── cache ────────────┤  │ Filter thời gian │  │
       (8192 max)                        │  │ Nút Sync         │  │
                                         │  └──────────────────┘  │
                                         └────────────────────────┘

Sync flow:
  Nút Sync → authorize REST API (lần đầu)
           → GET /1/boards/{id}/cards
           → GET /1/cards/{id}/pluginData (batch)
           → parse + tổng hợp theo ngày + member
           → t.set('board', 'shared', 'stats', cache)
```

### Capability mới

| Capability | Mô tả |
|---|---|
| `board-buttons` | Nút "📊 Point Stats" trên thanh board |

Cần đăng ký thêm capability `board-buttons` tại `trello.com/power-ups/admin`.

### Cần appKey khi initialize

`TrelloPowerUp.initialize({...}, { appKey: '...', appName: '...' })` để dùng `t.getRestApi()`. appKey lấy từ Power-Up admin portal (`trello.com/power-ups/admin`), truyền vào qua biến môi trường hoặc hardcode (Power-Up private nội bộ nên chấp nhận được).

## 4. Mô hình dữ liệu cache

### Cấu trúc lưu tại `board > shared > stats`

```typescript
interface StatsCache {
  v: 1;                        // schema version
  at: string;                  // ISO timestamp lần sync gần nhất
  lists: ListMeta[];           // metadata list trên board
  cards: CompactCard[];        // dữ liệu tổng hợp mỗi card
}

interface ListMeta {
  id: string;                  // list ID (24 ký tự)
  name: string;                // tên list
}

interface CompactCard {
  id: string;                  // card ID (24 ký tự)
  l: string;                   // listId (24 ký tự)
  e: number | null;            // estimate
  d: DaySummary[];             // tổng hợp theo ngày + member
}

interface DaySummary {
  dt: string;                  // YYYY-MM-DD
  m: string;                   // memberId (24 ký tự)
  n: string;                   // fullName (cho hiển thị)
  p: number;                   // tổng point trong ngày của member đó
}
```

### Ước tính dung lượng

Mỗi `DaySummary` ≈ 80 ký tự serialize. Mỗi card (1 member, 5 ngày log) ≈ 470 ký tự.

- Board 10 card: ≈ 5000 ký tự → vừa 8192.
- Board 15+ card: có thể vượt.

**Chiến lược khi vượt 8192:**
1. Rút gọn fullName → chỉ giữ ký tự đầu (initial). Tiết kiệm ~30%.
2. Nếu vẫn vượt: chỉ giữ data trong khung thời gian được chọn khi sync (ví dụ: 3 tháng gần nhất).
3. Hiện cảnh báo: "Board có quá nhiều dữ liệu, chỉ hiển thị N tháng gần nhất".

## 5. Sync flow chi tiết

### Bước 1: Authorize (lần đầu)

```typescript
const restApi = t.getRestApi();
const token = await restApi.getToken();
if (!token) {
  await restApi.authorize({ scope: 'read', expiration: 'never' });
}
```

User chỉ cần cấp quyền `read`. Không cần `write`.

### Bước 2: Fetch cards

```
GET /1/boards/{boardId}/cards?fields=id,idList,name&filter=visible
```

Dùng `filter=visible` để bỏ card đã archive. Nếu user muốn cả archive, thêm `filter=all`.

### Bước 3: Fetch pluginData (batch)

Gọi `GET /1/cards/{id}/pluginData` cho từng card. Batch 10 request đồng thời, chờ batch xong mới batch tiếp. Tránh vượt rate limit 100/10s.

Hiển thị progress bar: "Đang sync... 25/50 cards".

### Bước 4: Parse và tổng hợp

Với mỗi card:
1. Tìm pluginData có `idPlugin` khớp Power-Up ID.
2. Parse value (JSON), lấy `est` và các key `log_*`.
3. Decode mỗi `log_*` thành entries.
4. Tổng hợp entries theo ngày + member → mảng `DaySummary`.

### Bước 5: Lưu cache

```typescript
await t.set('board', 'shared', 'stats', cache);
```

Kiểm tra `JSON.stringify(cache).length <= 8192` trước khi ghi. Nếu vượt, áp dụng chiến lược rút gọn.

### Bước 6: Fetch list metadata

```
GET /1/boards/{boardId}/lists?fields=id,name&filter=open
```

Lưu vào `cache.lists` để map listId → tên list.

## 6. Giao diện

### Board button

- Icon: `📊` (hoặc SVG tương tự)
- Text: `Point Stats`
- Condition: `edit` (chỉ member có quyền edit board mới thấy)
- Click: mở modal `dashboard.html`, fullscreen: false, height: 600

### Dashboard modal

```
┌──────────────────────────────────────────────────────┐
│  📊 Point Stats Dashboard                            │
│                                                      │
│  Filter: [Tất cả ▾] [Tuần này] [Tháng này] [Năm]   │
│                                                      │
│  [Theo List]  [Theo User]          [🔄 Sync]  ⏱ 5m  │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ List          Cards   Est   Log   Tiến độ        │ │
│ │ ─────────────────────────────────────────────     │ │
│ │ To Do           5      20    0    ░░░░░░░░  0%   │ │
│ │ In Progress     3      15    8    ▓▓▓▓░░░░ 53%   │ │
│ │ Done            8      30   30    ▓▓▓▓▓▓▓▓ 100%  │ │
│ │ ─────────────────────────────────────────────     │ │
│ │ TỔNG           16      65   38    ▓▓▓▓▓░░░ 58%   │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│  ── Breakdown theo tuần ──                           │
│  W22: ████████ 12                                    │
│  W23: ████████████ 18                                │
│  W24: █████ 8                                        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Tab "Theo List"

| Cột | Nội dung |
|---|---|
| List | Tên list |
| Cards | Số card có point data trong list |
| Est | Σ estimate các card (null tính là 0) |
| Log | Σ logged (filter theo thời gian) |
| Tiến độ | thanh progress bar + phần trăm. Nếu không có estimate → hiện "—" |

Dòng **TỔNG** cố định ở cuối bảng.

Bên dưới bảng: **breakdown theo tuần** (bar chart text-based hoặc div bar). Hiện 4-8 tuần gần nhất, mỗi bar = tổng logged trong tuần đó.

### Tab "Theo User"

```
┌──────────────────────────────────────────────────┐
│ User           Entries   Tổng Log                 │
│ ────────────────────────────────────────────      │
│ Tuấn              12       24.5                   │
│ Mai                8       15.0                   │
│ Khoa               3        6.0                   │
│ ────────────────────────────────────────────      │
│ TỔNG              23       45.5                   │
└──────────────────────────────────────────────────┘

── Breakdown theo tuần ──
      Tuấn   Mai   Khoa
W22:  ████   ██    █
W23:  ██████ ████  ██
W24:  ███    ██    
```

| Cột | Nội dung |
|---|---|
| User | fullName |
| Entries | Số lần log (filter theo thời gian) |
| Tổng Log | Σ point (filter theo thời gian) |

Dòng **TỔNG** cố định ở cuối.

Breakdown theo tuần: grouped bar (text-based), mỗi user một màu/pattern. Hiện 4-8 tuần gần nhất.

### Bộ lọc thời gian

| Giá trị | Ý nghĩa |
|---|---|
| Tất cả | Không filter, hiện mọi dữ liệu |
| Hôm nay | entries.date = today (local browser) |
| Tuần này | Thứ 2 → Chủ nhật tuần hiện tại |
| Tháng này | Ngày 1 → cuối tháng hiện tại |
| Năm này | 1/1 → 31/12 năm hiện tại |

Filter áp dụng lên `DaySummary.dt`, xử lý client-side. Breakdown tự động điều chỉnh granularity: filter "Hôm nay" → breakdown theo giờ không có (chỉ hiện tổng). Filter "Năm này" → breakdown theo tháng.

### Nút Sync

- Text: "🔄 Sync"
- Bên cạnh: "⏱ 5 phút trước" (thời gian tương đối từ `cache.at`)
- Khi đang sync: "Đang sync... 25/50" (progress)
- Sync xong: cập nhật data + refresh bảng + cập nhật timestamp

### Trạng thái rỗng / lỗi

| Trạng thái | Hiển thị |
|---|---|
| Chưa sync lần nào | "Nhấn Sync để tải dữ liệu thống kê" + nút Sync lớn |
| Không có card nào có point | "Board chưa có card nào có point data" |
| Sync thất bại | Banner đỏ: "Lỗi khi sync: \{message\}. Thử lại?" |
| Cache quá cũ (>24h) | Nhắc nhẹ: "Dữ liệu đã cũ, nhấn Sync để cập nhật" |

## 7. File mới và file sửa

### File mới

| File | Mô tả |
|---|---|
| `dashboard.html` | HTML cho modal dashboard |
| `src/ui/dashboard.ts` | Logic UI dashboard (tabs, filter, render bảng) |
| `src/ui/dashboard.css` | Style cho dashboard |
| `src/core/stats.ts` | Logic tổng hợp: filter theo thời gian, tính tổng theo list/user, breakdown tuần/tháng |
| `src/core/stats-types.ts` | Types cho StatsCache, DaySummary, etc. |
| `src/trello/sync.ts` | Sync flow: authorize, fetch cards, fetch pluginData, parse, lưu cache |
| `tests/stats.test.ts` | Unit test cho stats.ts |

### File sửa

| File | Thay đổi |
|---|---|
| `src/connector.ts` | Thêm capability `board-buttons`, thêm appKey/appName vào initialize |
| `src/trello/trello-types.ts` | Thêm type cho `board` scope, `getRestApi()`, `modal()` |
| `src/trello/global.d.ts` | Cập nhật PowerUp interface cho board-buttons |
| `vite.config.ts` | Thêm `dashboard.html` vào multi-page build |

## 8. Chiến lược kiểm thử

### Vitest cho lõi thuần

- `stats.ts`: filter theo thời gian (ngày/tuần/tháng/năm), tổng hợp theo list, tổng hợp theo user, breakdown tuần/tháng, edge case (card không estimate, list rỗng, member rời board).

### Test thủ công trên board thật

- Board-button hiện đúng, click mở modal.
- Sync: authorize lần đầu, progress bar, lưu cache thành công.
- Dashboard: 2 tab chuyển đúng, filter thay đổi data, breakdown hiện đúng.
- Edge case: board rỗng, board 1 card, board nhiều card (>50).

## 9. Quyết định thiết kế đã chốt

| Câu hỏi | Quyết định | Lý do |
|---|---|---|
| Hiển thị ở đâu? | Board-button mở modal | API không hỗ trợ inject list header |
| Lấy data cách nào? | Cache board-scope + sync thủ công | Tránh gọi API mỗi lần mở, kiểm soát được |
| Cấu trúc cache? | Tổng hợp theo ngày + member | Cân bằng: filter được theo ngày, compact hơn lưu từng entry |
| Board-scope limit? | 8192 ký tự, rút gọn nếu vượt | Đủ cho ~10-15 card, chiến lược fallback rõ ràng |
| Cần authorize? | Có, scope read, expiration never | Cần REST API để fetch pluginData cross-card |
