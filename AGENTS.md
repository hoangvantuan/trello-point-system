# AGENTS.md

Hướng dẫn cho agent làm việc trong repo này.

## Dùng /project-memory

Mọi agent đều dùng `/project-memory` để ghi và tra cứu tri thức dự án. Bộ nhớ nằm tại `memory/` ở gốc repo.

### Đầu phiên

**Bắt buộc**: load toàn bộ index trước khi làm bất kỳ việc gì.

```bash
cat memory/index.md
```

Mục đích: nắm toàn bộ tri thức hiện có, không bỏ sót entry liên quan. Đọc index xong mới recall theo từ khoá nếu cần.

Xem 5 sự kiện gần nhất để biết vừa làm gì:

```bash
grep "^## \[" memory/log.md | tail -5
```

Sau đó tra sâu entry liên quan đến task hiện tại:

```
/project-memory recall <từ khoá liên quan>
```

Tránh lặp lại lỗi đã có trong Fact, tránh làm sai thứ tự đã có trong Map.

### Trong phiên

Ghi nhớ ngay khi gặp một trong các tín hiệu sau:

| Tín hiệu | Loại entry |
|----------|-----------|
| Mất thời gian thử sai mới ra | Fact (F-) |
| Một trình tự làm từ 2 lần trở lên | Map (M-) |
| Skill có sẵn yếu hoặc thiếu | Tool (T-) |

Tạo entry bằng script, không ghi tay vào index:

```bash
python skills/project-memory/scripts/new-entry.py fact
python skills/project-memory/scripts/new-entry.py map
python skills/project-memory/scripts/new-entry.py tool improve
```

### Cuối phiên

Quét lại hội thoại, liệt kê đề xuất "nên capture X vào nhóm Y" cho user duyệt. Không tự ghi lén.

### Tóm tắt 4 lệnh

| Lệnh | Mục đích |
|------|---------|
| `/project-memory capture` | Ghi một bài học hoặc context |
| `/project-memory recall [query]` | Tra cứu entry liên quan |
| `/project-memory consolidate` | Đúc kết, gộp trùng, tìm pattern |
| `/project-memory execute <id>` | Thực thi entry Tool hoặc Map |
