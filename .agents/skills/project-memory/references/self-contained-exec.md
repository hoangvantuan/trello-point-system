# Thực thi tự chứa (không gọi skill ngoài)

project-memory chạy độc lập. Khi execute entry Tool, làm trực tiếp bằng năng lực chung, không phụ thuộc `skill-auto-improver` hay `skill-creator` (máy khác có thể không cài).

## Cải tiến skill (subtype improve)

1. Đọc SKILL.md và toàn bộ references/ của skill mục tiêu.
2. Đối chiếu với Contract đề xuất và Hành động ghi trong entry.
3. Sửa tối thiểu, giữ skill gọn. Xóa mà output không đổi nghĩa là dead content.
4. Giữ progressive disclosure: workflow ở SKILL.md, chi tiết đẩy sang references/.
5. Verify: đọc lại, ranh giới quyết định có rõ không, có placeholder nào không.

## Tạo skill mới (subtype new)

Theo cấu trúc chuẩn (xem CLAUDE.md mục Skill Structure):

1. `skills/<name>/SKILL.md` với frontmatter `name` và `description`.
2. references/ cho chi tiết, scripts/ cho thực thi, templates/ cho output.
3. Đặt tên kebab-case, mỗi file dưới 200 dòng.
4. Cập nhật CLAUDE.md và README.md (danh sách skill).

## Nguyên tắc giữ chất lượng

- Giải thích lý do thay vì ra lệnh, LLM hiểu "tại sao" tốt hơn "phải làm".
- Tổng quát hóa, không fix cứng cho 1 case.
- Mỗi dòng phải earn chỗ đứng.
- Single source of truth: reference thay vì copy nội dung.

## Ranh giới

Execute là pha tách riêng, user kích hoạt. Consolidation không bao giờ tự nhảy sang execute. Sau khi execute xong, ghi log: `log.py execute "<id> <tóm tắt>"`.
