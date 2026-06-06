# Schema dữ liệu memory

Đây là source of truth runtime cho cấu trúc kho. Script đọc frontmatter, LLM điền nội dung.

## index.md (catalog routing)

`reindex.py` dựng lại từ frontmatter mọi entry trong `entries/` và `archive/`. Đừng sửa tay, sẽ bị ghi đè. Bố cục:

```markdown
# Memory Index

## 🔧 Tools (skill cải tiến + skill mới)
| ID | Tiêu đề | Loại | Status | Tags | File |
|----|---------|------|--------|------|------|
| T-001 | style-writer thiếu ví dụ voice | improve | raw | style-writer | [↗](entries/T-001.md) |

## 🗺️ Maps (workflow lặp lại)
| ID | Tiêu đề | Status | Tags | File |
|----|---------|--------|------|------|
| M-001 | Quy trình tạo skill mới end-to-end | raw | skill-dev | [↗](entries/M-001.md) |

## 📌 Facts (context rời rạc)
| ID | Tiêu đề | Status | Tags | File |
|----|---------|--------|------|------|
| F-001 | gws CLI dùng --params JSON | raw | gdrive | [↗](entries/F-001.md) |
```

## Frontmatter chung mọi entry

| Field | Ý nghĩa |
|-------|---------|
| id | T-/M-/F- + số 3 chữ số (script cấp, đừng đặt tay) |
| type | tool, map, fact |
| title | tiêu đề ngắn (LLM điền, chảy vào cột Tiêu đề của index) |
| status | raw, sau đó consolidated, sau đó archived |
| created | YYYY-MM-DD |
| tags | inline list, vd [style-writer] |
| related | inline list id, consolidate bảo trì 2 chiều |

## Entry Tool (T-)

Thêm field: `subtype` (improve hoặc new), `source` (conversation hoặc manual).

```markdown
---
id: T-001
type: tool
subtype: improve
title: style-writer thiếu ví dụ voice
status: raw
created: 2026-06-05
source: conversation
tags: [style-writer]
related: [T-005, M-002]
---
## Vấn đề / Cơ hội
Tool yếu chỗ nào, hoặc khoảng trống năng lực cần tool mới.
## Bài học gốc
Tình huống thực tế phát sinh insight.
## Contract đề xuất (làm gì, không phải làm sao)
Input / Output / ranh giới của tool.
## Hành động (khi execute)
Bước cụ thể, tự chứa, không gọi skill ngoài.
```

## Entry Map (M-)

```markdown
---
id: M-001
type: map
title: Quy trình tạo skill mới end-to-end
status: raw
created: 2026-06-05
tags: [skill-dev]
related: []
---
## Mục tiêu workflow
Đạt được gì khi chạy hết bản đồ này.
## Trigger
Khi nào kích hoạt workflow này.
## Trình tự (bản đồ)
1. Bước A: dùng tool/skill nào → ra output gì
2. Bước B: dùng tool/skill nào → ra output gì
## Cạm bẫy / lưu ý
Chỗ hay sai khi chạy.
```

## Entry Fact (F-)

```markdown
---
id: F-001
type: fact
title: gws CLI dùng --params JSON
status: raw
created: 2026-06-05
tags: [gdrive]
related: []
---
## Sự kiện / quy tắc
Nội dung fact.
## Khi nào liên quan
Tình huống fact này hữu ích.
## Nguồn
Vì sao ghi lại.
```

## Frontmatter mở rộng (consolidate bảo trì)

- `contradicts: [id]`: gắn cờ khi entry mâu thuẫn entry khác. Lint phát hiện, consolidate ghi cờ để không mất dấu.
- `related` bảo trì 2 chiều: nếu A liên quan B thì B cũng có A. Link là công dân hạng nhất.

## log.md (timeline append-only)

Mỗi dòng một sự kiện, prefix nhất quán để grep:

```markdown
## [2026-06-05] capture | T-001 style-writer thiếu ví dụ voice
## [2026-06-05] consolidate | gộp T-003 + T-007 → T-003, archive 2 entry
## [2026-06-06] execute | T-001 đã cải tiến style-writer
## [2026-06-06] recall | "cách tạo skill" → file-answer-back M-004
```

Lấy 5 sự kiện gần nhất: `grep "^## \[" memory/log.md | tail -5`. Giúp biết "vừa làm gì" để gợi ý cuối phiên chính xác.
