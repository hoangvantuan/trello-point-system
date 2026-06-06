---
name: project-memory
description: "Bộ nhớ tri thức cấp dự án tự cải tiến: capture bài học, consolidate đúc kết, recall khi làm việc, execute tách riêng. Dữ liệu ghi vào memory/ ở gốc repo."
---

# Project Memory

Bộ nhớ tri thức cho dự án đang mở. Gom bài học và context rời rạc vào kho có index routing, đúc kết định kỳ thành tri thức sạch, làm nền cải tiến dự án.

Cái lõi: tách 2 pha. Pha tri thức (capture, consolidate) và pha thực thi (execute) tách riêng. Consolidation không bao giờ tự nhảy sang execute.

## Cơ chế portable, dữ liệu theo repo

Skill nằm trong `skills/project-memory/`, dùng cho mọi dự án. Dữ liệu ghi vào `memory/` ở thư mục gốc repo đang mở. Script tự tìm gốc repo qua `git rev-parse --show-toplevel`.

## Định tuyến theo lệnh

`/project-memory <op> [query]`:

| op | Việc |
|----|------|
| capture | Ghi một bài học hoặc context vào kho |
| consolidate | Đúc kết kho: gộp trùng, phát hiện pattern, lint, archive |
| recall [query] | Đọc index, load entry liên quan |
| execute <id> | Thực thi entry Tool/Map (pha tách riêng, user kích hoạt) |

Không có op: hỏi user muốn làm gì.

## Taxonomy: 3 loại bản chất

| Loại | Prefix | Trả lời | Ghi gì |
|------|--------|---------|--------|
| Tool (subtype improve/new) | T- | Làm việc X thế nào? | Cách làm + contract |
| Map | M- | Khi nào dùng tool nào, thứ tự ra sao? | Trình tự + tool mỗi bước |
| Fact | F- | Cần nhớ gì khi làm? | Sự kiện + khi nào liên quan |

Schema chi tiết 3 loại, index, log, frontmatter mở rộng: [references/schemas.md](references/schemas.md).

## Phân vai LLM vs script

Script giữ index và log luôn đồng bộ với frontmatter, LLM khỏi gõ tay bảng:

| Việc | Ai |
|------|----|
| Tạo entry, cấp ID tăng dần | `scripts/new-entry.py <type> [subtype]` |
| Dựng lại index.md từ frontmatter | `scripts/reindex.py` |
| Archive entry, đổi status, reindex | `scripts/archive.py <id>` |
| Append timeline | `scripts/log.py <op> <summary>` |
| Đúc kết, phát hiện pattern, lint, cross-ref | LLM đề xuất, user duyệt thay đổi cấu trúc |

Chạy script bằng python (stdlib, không cần cài gói):
`python skills/project-memory/scripts/new-entry.py fact`

## capture

Hai ngả, cùng đổ về `memory/entries/`.

Thủ công: user gọi `capture` hoặc nói "ghi nhớ cái này". Đoán type và tags từ ngữ cảnh, hỏi gọn nếu chưa chắc (type? tiêu đề?). Chạy `new-entry.py <type> [subtype]`, mở file vừa tạo, điền `title`, `tags`, và các section theo schema. Chạy `reindex.py`.

Gợi ý cuối phiên: khi task xong, quét hội thoại tìm tín hiệu đáng ghi, liệt kê đề xuất "nên capture X vào nhóm Y". User duyệt rồi mới ghi. Không tự ghi lén.

Tín hiệu nhận biết: [references/capture-signals.md](references/capture-signals.md). Tóm tắt:
- Gotcha mất thời gian thử sai, ghi Fact.
- Một trình tự làm 2 lần trở lên, ghi Map.
- Skill có sẵn yếu hoặc thiếu năng lực, ghi Tool.

## consolidate

Chạy thủ công. Quy trình đầy đủ, lint, cross-ref: [references/consolidation.md](references/consolidation.md).

Năm chốt:
- Đọc index, lọc entry `status: raw`, nhóm theo type + tags + related.
- Gộp trùng thành 1 entry gọn `status: consolidated`. Entry gốc không xóa, chuyển archive qua `archive.py` (giữ vết).
- Phát hiện pattern: từ 3 entry cùng trỏ 1 gốc, tạo entry tổng hợp mới.
- Lint health-check (orphan, mâu thuẫn, thiếu cross-ref, gap), chỉ đề xuất.
- Mọi thay đổi cấu trúc (merge, archive, sửa cross-ref) user duyệt trước, script chỉ chạy sau khi duyệt.

Consolidation dừng ở tầng tri thức. Output là entry consolidated sạch, danh sách pattern, báo cáo lint. Không tự thực thi.

## recall

`recall [query]`: đọc chỉ `index.md` trước, match theo type/tags/tiêu đề, rồi chỉ load file entry liên quan (progressive disclosure).

Tự động gợi recall: đầu phiên hoặc khi task khớp tag, chủ động hỏi "memory có N entry liên quan, đọc không?".

File-answer-back: khi recall tổng hợp ra câu trả lời có giá trị (so sánh, phân tích, quy trình vừa đúc), đề nghị lưu thành entry mới (thường Map hoặc Fact). User duyệt. Nhờ vậy khám phá compound vào kho thay vì trôi vào chat.

Lấy 5 sự kiện gần nhất để biết vừa làm gì: `grep "^## \[" memory/log.md | tail -5`.

## execute (pha tách riêng)

User kích hoạt, không tự nối tiếp consolidate. Đọc entry rồi làm trực tiếp bằng năng lực chung, không gọi skill ngoài.

- Entry Tool: đọc Contract đề xuất và Hành động, làm trực tiếp (sửa SKILL.md, hoặc tạo skill theo cấu trúc chuẩn). Checklist tối thiểu: [references/self-contained-exec.md](references/self-contained-exec.md).
- Entry Map: chính là playbook, chạy theo trình tự.

Sau khi execute, ghi log: `log.py execute "<id> <tóm tắt>"`.

## Mọi thao tác ghi log

Capture, consolidate, execute đều append 1 dòng vào `memory/log.md`. Script new-entry và archive tự ghi. Thao tác thủ công gọi `log.py`.
