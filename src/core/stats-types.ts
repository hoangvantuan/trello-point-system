// src/core/stats-types.ts

// Một lần log đã phẳng hoá kèm member, dùng tổng hợp cross-card. Chỉ sống trong RAM.
export interface LogEntry {
  memberId: string;
  fullName: string;
  date: string; // YYYY-MM-DD
  point: number;
}

// Một card sau khi parse từ REST. KHÔNG persist.
export interface CardStat {
  id: string;
  idShort: number;
  name: string;
  idList: string;
  closed: boolean; // true = đã archive
  estimate: number | null;
  entries: LogEntry[];
}

// Bộ lọc thời gian. CHỈ áp cho tab User (flow). Tab List là stock nên không dùng.
export type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'year';

// Khoảng ngày [start, end] bao gồm 2 đầu, dạng YYYY-MM-DD.
export interface DateRange {
  start: string;
  end: string;
}

// Một dòng bảng "Theo List".
export interface ListStat {
  idList: string;
  name: string;
  cards: number; // số card có point data
  estimate: number; // Σ estimate (null tính 0)
  logged: number; // Σ logged tích lũy toàn thời gian (KHÔNG filter — đây là stock)
}

export interface ListAggregate {
  rows: ListStat[];
  totalCards: number;
  totalEstimate: number;
  totalLogged: number;
}

// Một dòng bảng "Theo User".
export interface UserStat {
  memberId: string;
  fullName: string;
  entries: number; // số lần log (đã filter)
  logged: number; // Σ point (đã filter)
}

export interface UserAggregate {
  rows: UserStat[];
  totalEntries: number;
  totalLogged: number;
}

// Độ mịn breakdown theo filter.
export type Granularity = 'week' | 'month' | 'none';

// Một cột breakdown (1 kỳ: tuần hoặc tháng).
export interface BreakdownBucket {
  key: string; // định danh kỳ để sort, ví dụ '2026-06-01' (thứ 2) hoặc '2026-06'
  label: string; // nhãn hiển thị, ví dụ 'W23' hoặc 'T6'
  total: number; // tổng point trong kỳ
  byUser: Record<string, number>; // memberId -> point (tab User dùng, tab List bỏ qua)
}
