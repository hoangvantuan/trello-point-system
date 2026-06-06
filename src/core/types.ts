// Một lần log: ngày + số point + ghi chú.
export interface Entry {
  date: string; // YYYY-MM-DD, không giờ, không timezone
  point: number; // > 0, tối đa 1 chữ số thập phân, <= 100
  comment: string; // có thể rỗng
}

// Hình dạng compact lưu trong pluginData dưới key log_<memberId>.
export interface MemberLog {
  v: number; // version schema, bắt đầu từ 1
  n: string; // fullName (header, làm tươi mỗi lần log)
  u: string; // username
  e: [string, number, string][]; // [date, point, comment]
}

// Hình dạng friendly sau khi decode, dùng trong logic + UI.
export interface DecodedMemberLog {
  version: number;
  fullName: string;
  username: string;
  entries: Entry[];
}

// Một dòng trong lịch sử (một entry của một member).
export interface Row {
  memberId: string;
  fullName: string;
  point: number;
  comment: string;
  entryIndex: number; // vị trí entry trong entries của member đó (để sửa/xóa)
}

// Một ngày trong lịch sử, kèm tổng phụ.
export interface DayGroup {
  date: string; // YYYY-MM-DD
  subtotal: number; // tổng point trong ngày (đã làm tròn)
  rows: Row[];
}

export const SCHEMA_VERSION = 1;
