# Power-Up Listing — English Draft

Bản nháp để dán vào trang quản trị Power-Up (https://trello.com/power-ups/admin → tab **Listing**).
Tham khảo cấu trúc mẫu Trello khen: https://trello.com/power-ups/58c85f41d7f012a1879c7b2e

---

## Overview (short, ~1 dòng — hiển thị ở thẻ tóm tắt)

> Log effort points on cards, set targets, and see team progress by list and member — all stored inside Trello.

## Author / Support

- **Author:** Hoang Van Tuan
- **Support / Privacy:** https://trello-point-system.hoangvantuan.com/privacy.html

---

## Description (full — hỗ trợ Markdown)

**Point System** turns each Trello card into a lightweight effort ledger. Log how many points you spent, set a target, and watch progress add up across your whole board — without sending any data to external servers.

### What you can do

- **Log points in one tap** — quick chips (0.5, 1, 2, 3, 5, 8) or a custom value, right on the card back.
- **Set a target per card** — see a live progress bar (logged vs. target) and how much is left or over.
- **Track team effort** — every entry is attributed to the member who logged it, so you see who contributed what.
- **Board-wide stats dashboard** — totals by List and by User, plus a per-period breakdown (week / month), with time filters (Today, This week, This month, This year, All).
- **Undo & edit** — undo a log within 5 seconds, or edit/delete any of your past entries.

### Privacy first

Point System stores everything in Trello's own `pluginData` — **no external servers, no tracking, no cookies**. Remove the Power-Up from a board and all its data goes with it. See our [Privacy Policy](https://trello-point-system.hoangvantuan.com/privacy.html).

### Getting started

1. Add Point System to your board.
2. Open any card → find the **🎯 Point** section on the card back → tap a chip to log points.
3. Click the section to open the full ledger (set a target, view history).
4. Use the **Point Stats** board button to open the dashboard.

---

## Images (đã có, serve từ domain)

3 ảnh đã đặt trong `public/listing/` và sẽ được serve sau khi deploy:

| Ảnh | Màn hình | URL công khai |
|---|---|---|
| `card-section.png` | Card-back section (🎯 Point) — chip + progress bar | https://trello-point-system.hoangvantuan.com/listing/card-section.png |
| `popup-ledger.png` | Popup ledger — Log point + History + team total | https://trello-point-system.hoangvantuan.com/listing/popup-ledger.png |
| `dashboard.png` | Dashboard — By List + Breakdown by period | https://trello-point-system.hoangvantuan.com/listing/dashboard.png |

Khi điền listing trên admin portal: upload trực tiếp 3 file này (hoặc dán URL nếu form cho phép).

### Nâng cấp tùy chọn (nếu có thời gian)

- [ ] GIF **log nhanh**: bấm chip → toast "✓ Logged X pts" → progress bar chạy.
- [ ] Ảnh **Dashboard By User**: bảng theo user với swatch màu + breakdown stacked.

Lưu ý: ảnh ngang, rõ nét; GIF dung lượng vừa phải để load nhanh.
