# Dashboard Thống Kê Point System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm dashboard thống kê cấp board (mở qua board-button) tổng hợp point theo list và theo user, có bộ lọc thời gian, fetch tươi mỗi lần qua REST API bulk-fetch (không cache).

**Architecture:** Mở modal là gọi REST `GET /boards/{id}/cards?filter=all&pluginData=true` (1 request lấy đủ card gồm archive) + `GET /boards/{id}/lists`. Parse pluginData client-side thành `CardStat[]` trong RAM, rồi tổng hợp on-the-fly mỗi khi đổi tab/filter. Lõi tổng hợp là hàm thuần (test bằng Vitest); lớp IO authorize/fetch test thủ công trên board thật.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vite multi-page, Vitest, Trello Power-Up client (`TrelloPowerUp.iframe()` + `getRestApi()`), tái dùng codec `decodeMemberLog` hiện có.

---

## Bối cảnh cho người mới (đọc trước khi code)

- Mỗi card lưu point trong **pluginData**. Khi đọc qua REST, mỗi card có mảng `pluginData: [{ idPlugin, value }]`, trong đó `value` là **chuỗi JSON** (không phải object) dạng `{"est":5,"log_<memberId>":{...}}`. Phải `JSON.parse(value)` trước.
- Hình dạng `log_<memberId>` compact: `{ v, n, u, e: [[date, point, comment], ...] }`. Đã có sẵn `decodeMemberLog` để giải mã an toàn — TÁI DÙNG, đừng tự parse.
- `tsconfig.json` bật `noUncheckedIndexedAccess`: `arr[i]` có kiểu `T | undefined`. Trong test dùng `arr[0]!`; trong source phải guard hoặc destructure cẩn thận. Đây là lỗi hay gặp (memory F-002).
- Số thực cộng dồn sinh rác (`1.1 + 2.2 = 3.3000000000000003`). Luôn bọc tổng qua `roundTotal` từ `src/core/totals.ts`.
- Test đặt dưới `tests/`, vitest include `tests/**/*.test.ts`. Tên test viết tiếng Việt như các file hiện có.
- Chạy toàn bộ kiểm tra: `npm test` (chạy `vitest run`). Build + typecheck: `npm run build` (chạy `tsc --noEmit && vite build`).

## Cấu trúc file

### File mới

| File | Trách nhiệm |
|---|---|
| `src/core/stats-types.ts` | Types thuần: `CardStat`, `LogEntry`, `TimeFilter`, `DateRange`, `ListStat`, `UserStat`, `ListAggregate`, `UserAggregate`, `BreakdownBucket`, `Granularity` |
| `src/core/stats.ts` | Lõi tổng hợp thuần: `periodRange`, `inRange`, `collectEntries`, `aggregateByList`, `aggregateByUser`, `granularityFor`, `breakdown` |
| `src/trello/parse-card.ts` | Thuần: `RawCard` + `parseCard(rawCard, pluginId): CardStat \| null` (tái dùng `decodeMemberLog`) |
| `src/trello/fetch-board.ts` | IO: `collectAllRawCards` (phân trang, test được) + `fetchBoardStats` (authorize + fetch + map) + `UnauthorizedError` |
| `src/config.ts` | Hằng cấu hình: `APP_KEY`, `APP_NAME`, `PLUGIN_ID` (con người điền từ admin portal) |
| `src/ui/dashboard.ts` | UI: tabs, filter, render bảng + breakdown, authorize lazy, refresh |
| `src/ui/dashboard.css` | Style dashboard (kế thừa thẩm mỹ "engineer's ledger") |
| `dashboard.html` | HTML cho modal dashboard |
| `tests/core/dateutil.test.ts` | (sửa) thêm test cho helper ngày mới |
| `tests/core/stats.test.ts` | Unit test cho `stats.ts` |
| `tests/trello/parse-card.test.ts` | Unit test cho `parse-card.ts` |
| `tests/trello/fetch-board.test.ts` | Unit test cho `collectAllRawCards` |

### File sửa

| File | Thay đổi |
|---|---|
| `src/core/dateutil.ts` | Thêm `parseLocalDate`, `mondayOf`, `isoWeek`, `weekBucket`, `monthBucket` |
| `src/trello/trello-types.ts` | Thêm `TrelloRestApi`, `getRestApi`, `modal`, `getContext` vào `TrelloT` |
| `src/trello/global.d.ts` | Thêm capability `board-buttons` + tham số `options { appKey, appName }` vào `initialize` |
| `src/connector.ts` | Đăng ký `board-buttons` mở `dashboard.html`, truyền `appKey`/`appName` |
| `vite.config.ts` | Thêm `dashboard.html` vào multi-page input |

> **Lưu ý lệch nhẹ so với spec mục 8:** spec gộp parse vào `fetch-board.ts` và đặt test ở `tests/stats.test.ts`. Plan này tách phần parse thuần ra `parse-card.ts` để test được không cần network, và đặt test theo cấu trúc `tests/core/`, `tests/trello/` cho khớp repo hiện tại. Thêm `src/config.ts` cho `APP_KEY`/`PLUGIN_ID`.

---

## Task 1: Types nền cho thống kê

**Files:**
- Create: `src/core/stats-types.ts`

Types thuần không có logic nên không TDD; xác minh bằng `tsc`.

- [ ] **Step 1: Tạo file types**

```typescript
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

// Bộ lọc thời gian dùng chung 2 tab.
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
  logged: number; // Σ logged (đã filter thời gian)
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
```

- [ ] **Step 2: Xác minh typecheck pass**

Run: `npx tsc --noEmit`
Expected: PASS, không lỗi (file mới chưa được import nên không có lỗi "unused").

- [ ] **Step 3: Commit**

```bash
git add src/core/stats-types.ts
git commit -m "feat: add stats-types for dashboard aggregation"
```

---

## Task 2: Helper ngày (tuần ISO, tháng, parse local)

**Files:**
- Modify: `src/core/dateutil.ts`
- Test: `tests/core/dateutil.test.ts`

- [ ] **Step 1: Thêm test cho helper mới**

Thêm vào CUỐI `tests/core/dateutil.test.ts` (giữ nguyên test cũ, sửa dòng import đầu file):

Sửa import đầu file thành:

```typescript
import { describe, expect, it } from 'vitest';
import {
  formatDayLabel,
  isoWeek,
  mondayOf,
  monthBucket,
  parseLocalDate,
  todayLocal,
  weekBucket,
} from '../../src/core/dateutil';
```

Thêm vào cuối file:

```typescript
describe('parseLocalDate', () => {
  it('parse YYYY-MM-DD thành Date local (không lệch UTC)', () => {
    const d = parseLocalDate('2026-06-06');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // tháng 6, 0-index
    expect(d.getDate()).toBe(6);
  });
});

describe('mondayOf', () => {
  it('trả thứ 2 của tuần chứa ngày (thứ 7 -> thứ 2 cùng tuần)', () => {
    const monday = mondayOf(parseLocalDate('2026-06-06')); // 06/06 là thứ 7
    expect(todayLocal(monday)).toBe('2026-06-01');
  });

  it('chính ngày thứ 2 -> giữ nguyên', () => {
    const monday = mondayOf(parseLocalDate('2026-06-01'));
    expect(todayLocal(monday)).toBe('2026-06-01');
  });
});

describe('isoWeek', () => {
  it('01/01/2026 (thứ 5) là tuần 1', () => {
    expect(isoWeek(parseLocalDate('2026-01-01'))).toBe(1);
  });

  it('06/06/2026 là tuần 23', () => {
    expect(isoWeek(parseLocalDate('2026-06-06'))).toBe(23);
  });
});

describe('weekBucket', () => {
  it('key là thứ 2 của tuần, label là W<isoWeek>', () => {
    expect(weekBucket('2026-06-06')).toEqual({ key: '2026-06-01', label: 'W23' });
    expect(weekBucket('2026-06-05')).toEqual({ key: '2026-06-01', label: 'W23' });
  });
});

describe('monthBucket', () => {
  it('key YYYY-MM, label T<tháng>', () => {
    expect(monthBucket('2026-06-06')).toEqual({ key: '2026-06', label: 'T6' });
    expect(monthBucket('2026-01-15')).toEqual({ key: '2026-01', label: 'T1' });
  });
});
```

- [ ] **Step 2: Chạy test để chắc nó fail**

Run: `npx vitest run tests/core/dateutil.test.ts`
Expected: FAIL với lỗi import (`isoWeek`, `mondayOf`, `parseLocalDate`, `weekBucket`, `monthBucket` chưa tồn tại).

- [ ] **Step 3: Cài đặt helper**

Thêm vào CUỐI `src/core/dateutil.ts` (giữ nguyên `pad2`, `todayLocal`, `formatDayLabel`):

```typescript
// Parse 'YYYY-MM-DD' thành Date local. Tránh new Date(string) vì nó hiểu UTC -> lệch ngày.
export function parseLocalDate(date: string): Date {
  const parts = date.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d);
}

// Thứ 2 của tuần chứa ngày (ISO: tuần bắt đầu thứ 2).
export function mondayOf(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (copy.getDay() + 6) % 7; // 0 = thứ 2 ... 6 = chủ nhật
  copy.setDate(copy.getDate() - offset);
  return copy;
}

// Số tuần ISO-8601 (tuần 1 là tuần chứa thứ 5 đầu tiên của năm). Dùng UTC để né DST.
export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // thứ 2 = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // tới thứ 5 cùng tuần
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

// Định danh + nhãn kỳ tuần cho breakdown.
export function weekBucket(date: string): { key: string; label: string } {
  const d = parseLocalDate(date);
  return { key: todayLocal(mondayOf(d)), label: `W${isoWeek(d)}` };
}

// Định danh + nhãn kỳ tháng cho breakdown.
export function monthBucket(date: string): { key: string; label: string } {
  const parts = date.split('-');
  return { key: `${parts[0]}-${parts[1]}`, label: `T${Number(parts[1])}` };
}
```

- [ ] **Step 4: Chạy test để chắc nó pass**

Run: `npx vitest run tests/core/dateutil.test.ts`
Expected: PASS toàn bộ (cũ + mới).

- [ ] **Step 5: Commit**

```bash
git add src/core/dateutil.ts tests/core/dateutil.test.ts
git commit -m "feat: add ISO week, month bucket and local date helpers"
```

---

## Task 3: Lọc thời gian (periodRange, inRange, collectEntries)

**Files:**
- Create: `src/core/stats.ts`
- Test: `tests/core/stats.test.ts`

- [ ] **Step 1: Viết test thất bại**

```typescript
// tests/core/stats.test.ts
import { describe, expect, it } from 'vitest';
import { collectEntries, inRange, periodRange } from '../../src/core/stats';
import type { CardStat } from '../../src/core/stats-types';

const cards: CardStat[] = [
  {
    id: 'cA', idShort: 1, name: 'A', idList: 'L1', closed: false, estimate: 5,
    entries: [
      { memberId: 'm1', fullName: 'Tuấn', date: '2026-06-06', point: 3 },
      { memberId: 'm2', fullName: 'Mai', date: '2026-06-06', point: 1.5 },
    ],
  },
  {
    id: 'cB', idShort: 2, name: 'B', idList: 'L1', closed: true, estimate: null,
    entries: [{ memberId: 'm1', fullName: 'Tuấn', date: '2026-05-25', point: 2 }],
  },
];

describe('periodRange', () => {
  it('all -> null', () => {
    expect(periodRange('all', new Date(2026, 5, 6, 10))).toBeNull();
  });
  it('today -> ngày hôm nay', () => {
    expect(periodRange('today', new Date(2026, 5, 6, 10))).toEqual({
      start: '2026-06-06', end: '2026-06-06',
    });
  });
  it('week -> thứ 2 đến chủ nhật', () => {
    expect(periodRange('week', new Date(2026, 5, 6, 10))).toEqual({
      start: '2026-06-01', end: '2026-06-07',
    });
  });
  it('month -> ngày 1 đến cuối tháng', () => {
    expect(periodRange('month', new Date(2026, 5, 6, 10))).toEqual({
      start: '2026-06-01', end: '2026-06-30',
    });
  });
  it('year -> 1/1 đến 31/12', () => {
    expect(periodRange('year', new Date(2026, 5, 6, 10))).toEqual({
      start: '2026-01-01', end: '2026-12-31',
    });
  });
});

describe('inRange', () => {
  const r = { start: '2026-06-01', end: '2026-06-07' };
  it('trong khoảng -> true', () => expect(inRange('2026-06-03', r)).toBe(true));
  it('ngoài khoảng -> false', () => expect(inRange('2026-06-08', r)).toBe(false));
  it('range null -> luôn true', () => expect(inRange('1999-01-01', null)).toBe(true));
});

describe('collectEntries', () => {
  it('visibleOnly=true bỏ entry của card archive', () => {
    const out = collectEntries(cards, null, true);
    expect(out.map((e) => e.date).sort()).toEqual(['2026-06-06', '2026-06-06']);
  });
  it('visibleOnly=false gồm cả card archive', () => {
    const out = collectEntries(cards, null, false);
    expect(out.length).toBe(3);
  });
  it('áp range lọc theo ngày', () => {
    const out = collectEntries(cards, { start: '2026-05-01', end: '2026-05-31' }, false);
    expect(out.map((e) => e.point)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Chạy test để chắc nó fail**

Run: `npx vitest run tests/core/stats.test.ts`
Expected: FAIL với "Cannot find module '../../src/core/stats'".

- [ ] **Step 3: Cài đặt**

```typescript
// src/core/stats.ts
import { mondayOf, todayLocal } from './dateutil';
import type { CardStat, DateRange, LogEntry, TimeFilter } from './stats-types';

// Khoảng ngày tương ứng filter. 'all' -> null (không lọc).
export function periodRange(filter: TimeFilter, now: Date): DateRange | null {
  if (filter === 'all') return null;
  const today = todayLocal(now);
  if (filter === 'today') return { start: today, end: today };
  if (filter === 'week') {
    const monday = mondayOf(now);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { start: todayLocal(monday), end: todayLocal(sunday) };
  }
  if (filter === 'month') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0); // ngày 0 của tháng sau = ngày cuối tháng này
    return { start: todayLocal(first), end: todayLocal(last) };
  }
  // year
  const y = now.getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

// So sánh chuỗi YYYY-MM-DD đủ để kiểm tra trong khoảng (bao gồm 2 đầu).
export function inRange(date: string, range: DateRange | null): boolean {
  if (!range) return true;
  return date >= range.start && date <= range.end;
}

// Gom mọi entry (đã lọc thời gian) từ tập card. visibleOnly=true bỏ card archive.
export function collectEntries(
  cards: CardStat[],
  range: DateRange | null,
  visibleOnly: boolean
): LogEntry[] {
  const out: LogEntry[] = [];
  for (const card of cards) {
    if (visibleOnly && card.closed) continue;
    for (const e of card.entries) {
      if (inRange(e.date, range)) out.push(e);
    }
  }
  return out;
}
```

- [ ] **Step 4: Chạy test để chắc nó pass**

Run: `npx vitest run tests/core/stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/stats.ts tests/core/stats.test.ts
git commit -m "feat: add time filter and entry collection for stats"
```

---

## Task 4: Tổng hợp theo List (chỉ card visible)

**Files:**
- Modify: `src/core/stats.ts`
- Test: `tests/core/stats.test.ts`

- [ ] **Step 1: Viết test thất bại**

Thêm import `aggregateByList` vào dòng import của `src/core/stats` trong test:

```typescript
import { aggregateByList, collectEntries, inRange, periodRange } from '../../src/core/stats';
```

Thêm vào cuối `tests/core/stats.test.ts`:

```typescript
const lists = [
  { id: 'L1', name: 'To Do' },
  { id: 'L2', name: 'Done' },
];

describe('aggregateByList', () => {
  it('chỉ tính card visible, gộp theo list, giữ thứ tự lists', () => {
    const agg = aggregateByList(cards, lists, null);
    expect(agg.rows).toEqual([
      { idList: 'L1', name: 'To Do', cards: 1, estimate: 5, logged: 4.5 },
    ]);
    expect(agg.totalCards).toBe(1);
    expect(agg.totalEstimate).toBe(5);
    expect(agg.totalLogged).toBe(4.5);
  });

  it('card không estimate vẫn được đếm nếu có entry', () => {
    const visibleNoEst: CardStat[] = [
      {
        id: 'cC', idShort: 3, name: 'C', idList: 'L2', closed: false, estimate: null,
        entries: [{ memberId: 'm1', fullName: 'Tuấn', date: '2026-06-06', point: 2 }],
      },
    ];
    const agg = aggregateByList(visibleNoEst, lists, null);
    expect(agg.rows).toEqual([
      { idList: 'L2', name: 'Done', cards: 1, estimate: 0, logged: 2 },
    ]);
  });

  it('range lọc logged nhưng card vẫn được đếm nếu có estimate', () => {
    const agg = aggregateByList(cards, lists, { start: '2026-01-01', end: '2026-01-31' });
    expect(agg.rows).toEqual([
      { idList: 'L1', name: 'To Do', cards: 1, estimate: 5, logged: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Chạy test để chắc nó fail**

Run: `npx vitest run tests/core/stats.test.ts`
Expected: FAIL với "aggregateByList is not a function" / import lỗi.

- [ ] **Step 3: Cài đặt**

Thêm import `roundTotal` (mới) và mở rộng import types ở đầu `src/core/stats.ts`:

```typescript
import { mondayOf, todayLocal } from './dateutil';
import { roundTotal } from './totals';
import type {
  CardStat, DateRange, ListAggregate, ListStat, LogEntry, TimeFilter,
} from './stats-types';
```

Thêm hàm vào cuối file:

```typescript
// Tab "Theo List": CHỈ card visible (closed === false). Card "có point data" = có estimate hoặc có entry.
export function aggregateByList(
  cards: CardStat[],
  lists: { id: string; name: string }[],
  range: DateRange | null
): ListAggregate {
  const nameById = new Map(lists.map((l) => [l.id, l.name]));
  const acc = new Map<string, { name: string; cards: number; estimate: number; logged: number }>();

  for (const card of cards) {
    if (card.closed) continue;
    const hasData = card.estimate !== null || card.entries.length > 0;
    if (!hasData) continue;
    const logged = roundTotal(
      card.entries.filter((e) => inRange(e.date, range)).reduce((s, e) => s + e.point, 0)
    );
    const name = nameById.get(card.idList) ?? '(list ẩn)';
    const row = acc.get(card.idList) ?? { name, cards: 0, estimate: 0, logged: 0 };
    row.cards += 1;
    row.estimate = roundTotal(row.estimate + (card.estimate ?? 0));
    row.logged = roundTotal(row.logged + logged);
    acc.set(card.idList, row);
  }

  // Giữ thứ tự list như board trả về.
  const rows: ListStat[] = [];
  for (const l of lists) {
    const r = acc.get(l.id);
    if (r) rows.push({ idList: l.id, name: r.name, cards: r.cards, estimate: r.estimate, logged: r.logged });
  }

  return {
    rows,
    totalCards: rows.reduce((s, r) => s + r.cards, 0),
    totalEstimate: roundTotal(rows.reduce((s, r) => s + r.estimate, 0)),
    totalLogged: roundTotal(rows.reduce((s, r) => s + r.logged, 0)),
  };
}
```

- [ ] **Step 4: Chạy test để chắc nó pass**

Run: `npx vitest run tests/core/stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/stats.ts tests/core/stats.test.ts
git commit -m "feat: aggregate stats by list (visible cards only)"
```

---

## Task 5: Tổng hợp theo User (tất cả card, gồm archive)

**Files:**
- Modify: `src/core/stats.ts`
- Test: `tests/core/stats.test.ts`

- [ ] **Step 1: Viết test thất bại**

Cập nhật import test:

```typescript
import {
  aggregateByList, aggregateByUser, collectEntries, inRange, periodRange,
} from '../../src/core/stats';
```

Thêm vào cuối `tests/core/stats.test.ts`:

```typescript
describe('aggregateByUser', () => {
  it('gồm card archive, sắp theo logged giảm dần', () => {
    const agg = aggregateByUser(cards, null);
    expect(agg.rows).toEqual([
      { memberId: 'm1', fullName: 'Tuấn', entries: 2, logged: 5 },
      { memberId: 'm2', fullName: 'Mai', entries: 1, logged: 1.5 },
    ]);
    expect(agg.totalEntries).toBe(3);
    expect(agg.totalLogged).toBe(6.5);
  });

  it('range lọc entry theo ngày', () => {
    const agg = aggregateByUser(cards, { start: '2026-06-01', end: '2026-06-30' });
    expect(agg.rows).toEqual([
      { memberId: 'm1', fullName: 'Tuấn', entries: 1, logged: 3 },
      { memberId: 'm2', fullName: 'Mai', entries: 1, logged: 1.5 },
    ]);
  });

  it('không entry -> mảng rỗng, tổng 0', () => {
    const agg = aggregateByUser([], null);
    expect(agg).toEqual({ rows: [], totalEntries: 0, totalLogged: 0 });
  });
});
```

- [ ] **Step 2: Chạy test để chắc nó fail**

Run: `npx vitest run tests/core/stats.test.ts`
Expected: FAIL với "aggregateByUser is not a function".

- [ ] **Step 3: Cài đặt**

Cập nhật import types `src/core/stats.ts` thêm `UserAggregate, UserStat`:

```typescript
import type {
  CardStat, DateRange, ListAggregate, ListStat, LogEntry, TimeFilter, UserAggregate, UserStat,
} from './stats-types';
```

Thêm hàm vào cuối file:

```typescript
// Tab "Theo User": TẤT CẢ card (gồm archive). Đóng góp tích lũy phải đủ.
export function aggregateByUser(cards: CardStat[], range: DateRange | null): UserAggregate {
  const acc = new Map<string, { fullName: string; entries: number; logged: number }>();
  for (const card of cards) {
    for (const e of card.entries) {
      if (!inRange(e.date, range)) continue;
      const row = acc.get(e.memberId) ?? { fullName: e.fullName, entries: 0, logged: 0 };
      if (e.fullName) row.fullName = e.fullName; // giữ tên mới nhất không rỗng
      row.entries += 1;
      row.logged = roundTotal(row.logged + e.point);
      acc.set(e.memberId, row);
    }
  }
  const rows: UserStat[] = [...acc.entries()]
    .map(([memberId, r]) => ({ memberId, fullName: r.fullName, entries: r.entries, logged: r.logged }))
    .sort((a, b) => b.logged - a.logged);
  return {
    rows,
    totalEntries: rows.reduce((s, r) => s + r.entries, 0),
    totalLogged: roundTotal(rows.reduce((s, r) => s + r.logged, 0)),
  };
}
```

- [ ] **Step 4: Chạy test để chắc nó pass**

Run: `npx vitest run tests/core/stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/stats.ts tests/core/stats.test.ts
git commit -m "feat: aggregate stats by user (all cards incl. archive)"
```

---

## Task 6: Breakdown theo kỳ (tuần/tháng) + chọn độ mịn

**Files:**
- Modify: `src/core/stats.ts`
- Test: `tests/core/stats.test.ts`

- [ ] **Step 1: Viết test thất bại**

Cập nhật import test:

```typescript
import {
  aggregateByList, aggregateByUser, breakdown, collectEntries,
  granularityFor, inRange, periodRange,
} from '../../src/core/stats';
import type { CardStat, LogEntry } from '../../src/core/stats-types';
```

Thêm vào cuối `tests/core/stats.test.ts`:

```typescript
describe('granularityFor', () => {
  it('today -> none, year -> month, còn lại -> week', () => {
    expect(granularityFor('today')).toBe('none');
    expect(granularityFor('year')).toBe('month');
    expect(granularityFor('all')).toBe('week');
    expect(granularityFor('week')).toBe('week');
    expect(granularityFor('month')).toBe('week');
  });
});

describe('breakdown', () => {
  const entries: LogEntry[] = [
    { memberId: 'm1', fullName: 'Tuấn', date: '2026-06-06', point: 3 },
    { memberId: 'm1', fullName: 'Tuấn', date: '2026-06-05', point: 2 },
    { memberId: 'm2', fullName: 'Mai', date: '2026-05-25', point: 4 },
  ];

  it('none -> rỗng', () => {
    expect(breakdown(entries, 'none', 8)).toEqual([]);
  });

  it('week -> gộp theo tuần, sort tăng dần theo key', () => {
    const b = breakdown(entries, 'week', 8);
    expect(b.map((x) => x.label)).toEqual(['W22', 'W23']);
    expect(b.map((x) => x.total)).toEqual([4, 5]);
    expect(b[1]!.byUser).toEqual({ m1: 5 });
    expect(b[0]!.byUser).toEqual({ m2: 4 });
  });

  it('month -> gộp theo tháng', () => {
    const b = breakdown(entries, 'month', 8);
    expect(b.map((x) => x.label)).toEqual(['T5', 'T6']);
    expect(b.map((x) => x.total)).toEqual([4, 5]);
  });

  it('maxBuckets giữ N kỳ gần nhất (cuối mảng)', () => {
    const many: LogEntry[] = [
      { memberId: 'm1', fullName: 'A', date: '2026-05-04', point: 1 }, // W19
      { memberId: 'm1', fullName: 'A', date: '2026-05-11', point: 1 }, // W20
      { memberId: 'm1', fullName: 'A', date: '2026-05-18', point: 1 }, // W21
    ];
    const b = breakdown(many, 'week', 2);
    expect(b.map((x) => x.label)).toEqual(['W20', 'W21']);
  });
});
```

- [ ] **Step 2: Chạy test để chắc nó fail**

Run: `npx vitest run tests/core/stats.test.ts`
Expected: FAIL với "breakdown is not a function" / "granularityFor is not a function".

- [ ] **Step 3: Cài đặt**

Cập nhật import đầu `src/core/stats.ts` để thêm `monthBucket, weekBucket` và types:

```typescript
import { monthBucket, mondayOf, todayLocal, weekBucket } from './dateutil';
```

```typescript
import type {
  BreakdownBucket, CardStat, DateRange, Granularity, ListAggregate, ListStat,
  LogEntry, TimeFilter, UserAggregate, UserStat,
} from './stats-types';
```

Thêm hàm vào cuối file:

```typescript
// Độ mịn breakdown theo filter. Hôm nay -> chỉ tổng (none). Năm -> theo tháng. Còn lại -> theo tuần.
export function granularityFor(filter: TimeFilter): Granularity {
  if (filter === 'today') return 'none';
  if (filter === 'year') return 'month';
  return 'week';
}

// Gom entries thành các kỳ, sort tăng dần theo key, giữ tối đa maxBuckets kỳ gần nhất.
export function breakdown(
  entries: LogEntry[],
  granularity: Granularity,
  maxBuckets: number
): BreakdownBucket[] {
  if (granularity === 'none') return [];
  const bucketOf = granularity === 'week' ? weekBucket : monthBucket;
  const byKey = new Map<string, BreakdownBucket>();
  for (const e of entries) {
    const { key, label } = bucketOf(e.date);
    const b = byKey.get(key) ?? { key, label, total: 0, byUser: {} };
    b.total = roundTotal(b.total + e.point);
    b.byUser[e.memberId] = roundTotal((b.byUser[e.memberId] ?? 0) + e.point);
    byKey.set(key, b);
  }
  const sorted = [...byKey.values()].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  );
  return sorted.slice(Math.max(0, sorted.length - maxBuckets));
}
```

- [ ] **Step 4: Chạy test để chắc nó pass**

Run: `npx vitest run tests/core/stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Chạy toàn bộ test + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS toàn bộ. (Lưu ý: `mondayOf`, `todayLocal` import trong stats.ts dùng ở Task 3; nếu `tsc` báo unused thì xoá import thừa.)

- [ ] **Step 6: Commit**

```bash
git add src/core/stats.ts tests/core/stats.test.ts
git commit -m "feat: weekly/monthly breakdown buckets for stats"
```

---

## Task 7: Parse card REST -> CardStat (thuần)

**Files:**
- Create: `src/trello/parse-card.ts`
- Test: `tests/trello/parse-card.test.ts`

- [ ] **Step 1: Viết test thất bại**

```typescript
// tests/trello/parse-card.test.ts
import { describe, expect, it } from 'vitest';
import { parseCard, type RawCard } from '../../src/trello/parse-card';

const PID = 'plugin-123';

function cardWith(value: string, overrides: Partial<RawCard> = {}): RawCard {
  return {
    id: 'c1', idShort: 7, name: 'Card', idList: 'L1', closed: false,
    pluginData: [{ idPlugin: PID, value }],
    ...overrides,
  };
}

describe('parseCard', () => {
  it('parse value JSON, phẳng hoá entries kèm member', () => {
    const value = JSON.stringify({
      est: 5,
      log_m1: { v: 1, n: 'Tuấn', u: 'tuanhv', e: [['2026-06-06', 3, 'fix']] },
    });
    expect(parseCard(cardWith(value), PID)).toEqual({
      id: 'c1', idShort: 7, name: 'Card', idList: 'L1', closed: false, estimate: 5,
      entries: [{ memberId: 'm1', fullName: 'Tuấn', date: '2026-06-06', point: 3 }],
    });
  });

  it('nhiều member -> gộp mọi entry', () => {
    const value = JSON.stringify({
      log_m1: { v: 1, n: 'Tuấn', u: 'tuanhv', e: [['2026-06-06', 3, '']] },
      log_m2: { v: 1, n: 'Mai', u: 'mai', e: [['2026-06-06', 1.5, '']] },
    });
    const out = parseCard(cardWith(value), PID);
    expect(out?.estimate).toBeNull();
    expect(out?.entries.length).toBe(2);
  });

  it('không có pluginData của plugin này -> null', () => {
    const c = cardWith('{}', { pluginData: [{ idPlugin: 'other', value: '{}' }] });
    expect(parseCard(c, PID)).toBeNull();
  });

  it('không có mảng pluginData -> null', () => {
    const c: RawCard = { id: 'c2', idShort: 8, name: 'x', idList: 'L1', closed: false };
    expect(parseCard(c, PID)).toBeNull();
  });

  it('value hỏng JSON -> null (không ném)', () => {
    expect(parseCard(cardWith('{not json'), PID)).toBeNull();
  });

  it('giữ closed/idList/idShort của card archive', () => {
    const value = JSON.stringify({ est: 2 });
    const out = parseCard(cardWith(value, { closed: true, idList: 'L9', idShort: 99 }), PID);
    expect(out).toMatchObject({ closed: true, idList: 'L9', idShort: 99, estimate: 2, entries: [] });
  });
});
```

- [ ] **Step 2: Chạy test để chắc nó fail**

Run: `npx vitest run tests/trello/parse-card.test.ts`
Expected: FAIL với "Cannot find module '../../src/trello/parse-card'".

- [ ] **Step 3: Cài đặt**

```typescript
// src/trello/parse-card.ts
import { decodeMemberLog } from '../core/codec';
import type { CardStat, LogEntry } from '../core/stats-types';

const LOG_PREFIX = 'log_';

// Hình dạng tối thiểu của 1 card trong REST response (chỉ field ta yêu cầu + pluginData).
export interface RawCard {
  id: string;
  idShort: number;
  name: string;
  idList: string;
  closed: boolean;
  pluginData?: Array<{ idPlugin: string; value: string }>;
}

// Parse 1 card REST -> CardStat. Trả null nếu không có pluginData của Power-Up này (hoặc value hỏng).
export function parseCard(card: RawCard, pluginId: string): CardStat | null {
  const pd = (card.pluginData ?? []).find((p) => p.idPlugin === pluginId);
  if (!pd) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(pd.value) as Record<string, unknown>;
  } catch {
    return null; // value hỏng -> bỏ qua card, không làm sập dashboard
  }

  const estimate = typeof raw.est === 'number' ? raw.est : null;
  const entries: LogEntry[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith(LOG_PREFIX)) continue;
    const memberId = key.slice(LOG_PREFIX.length);
    const log = decodeMemberLog(value); // tái dùng codec phòng thủ
    for (const e of log.entries) {
      entries.push({ memberId, fullName: log.fullName, date: e.date, point: e.point });
    }
  }

  return {
    id: card.id,
    idShort: card.idShort,
    name: card.name,
    idList: card.idList,
    closed: card.closed,
    estimate,
    entries,
  };
}
```

- [ ] **Step 4: Chạy test để chắc nó pass**

Run: `npx vitest run tests/trello/parse-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/trello/parse-card.ts tests/trello/parse-card.test.ts
git commit -m "feat: parse REST card pluginData into CardStat"
```

---

## Task 8: Mở rộng kiểu Trello (RestApi, modal, board-buttons)

**Files:**
- Modify: `src/trello/trello-types.ts`
- Modify: `src/trello/global.d.ts`

Types-only, xác minh bằng `tsc`.

- [ ] **Step 1: Thêm kiểu RestApi/modal/getContext vào `TrelloT`**

Thay TOÀN BỘ `src/trello/trello-types.ts` bằng:

```typescript
// Khai báo tối thiểu cho object `t` mà Trello truyền vào.
// Không dùng @types chính thức để giữ phụ thuộc gọn.
export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
}

// Client REST của Power-Up (t.getRestApi()). Mỗi member tự cấp token đọc của mình.
export interface TrelloRestApi {
  getToken(): Promise<string | null>;
  authorize(opts: { scope: string; expiration: string }): Promise<string>;
  clearToken(): Promise<void>;
}

export interface TrelloT {
  get(scope: 'card', visibility: 'shared'): Promise<Record<string, unknown>>;
  set(scope: 'card', visibility: 'shared', key: string, value: unknown): Promise<void>;
  remove(scope: 'card', visibility: 'shared', key: string): Promise<void>;
  member(
    ...fields: Array<'id' | 'username' | 'fullName'>
  ): Promise<TrelloMember>;
  render?(): Promise<void>;
  sizeTo?(selector: string): Promise<void>;
  popup?(opts: { title: string; url: string; height?: number }): void;
  modal?(opts: {
    title: string;
    url: string;
    fullscreen?: boolean;
    height?: number;
  }): void;
  getRestApi?(): TrelloRestApi;
  getContext?(): { board: string; card?: string; member?: string };
}
```

- [ ] **Step 2: Thêm capability `board-buttons` + options vào `global.d.ts`**

Thay TOÀN BỘ `src/trello/global.d.ts` bằng:

```typescript
import type { TrelloT } from './trello-types';

interface BadgeResult {
  text: string;
  color?: string;
}

interface DetailBadgeResult {
  title: string;
  text: string;
  callback: (t: TrelloT) => void;
}

interface BoardButtonResult {
  text: string;
  icon?: { dark: string; light: string };
  condition?: string;
  callback?: (t: TrelloT) => void;
}

interface PowerUpOptions {
  appKey: string;
  appName: string;
}

interface PowerUp {
  initialize(
    capabilities: {
      'card-badges'?: (t: TrelloT) => Promise<BadgeResult[]>;
      'card-detail-badges'?: (t: TrelloT) => Promise<DetailBadgeResult[]>;
      'board-buttons'?: (t: TrelloT) => Promise<BoardButtonResult[]>;
    },
    options?: PowerUpOptions
  ): void;
}

declare global {
  interface Window {
    TrelloPowerUp: PowerUp;
  }
  const TrelloPowerUp: PowerUp;
}

export {};
```

- [ ] **Step 3: Xác minh typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (connector.ts hiện tại vẫn hợp lệ vì các field mới đều optional).

- [ ] **Step 4: Commit**

```bash
git add src/trello/trello-types.ts src/trello/global.d.ts
git commit -m "feat: add RestApi, modal, board-buttons types"
```

---

## Task 9: Bulk fetch board (phân trang test được + IO)

**Files:**
- Create: `src/trello/fetch-board.ts`
- Test: `tests/trello/fetch-board.test.ts`

Tách phần phân trang thuần (`collectAllRawCards`) để TDD; phần `fetchBoardStats` (network) test thủ công ở Task 14.

- [ ] **Step 1: Viết test thất bại cho phân trang**

```typescript
// tests/trello/fetch-board.test.ts
import { describe, expect, it } from 'vitest';
import { collectAllRawCards, PAGE_LIMIT } from '../../src/trello/fetch-board';
import type { RawCard } from '../../src/trello/parse-card';

function page(n: number, prefix: string): RawCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`, idShort: i, name: '', idList: '', closed: false,
  }));
}

describe('collectAllRawCards', () => {
  it('một trang < limit -> không phân trang, không truncated', async () => {
    const res = await collectAllRawCards(() => Promise.resolve(page(10, 'x')));
    expect(res.cards.length).toBe(10);
    expect(res.truncated).toBe(false);
  });

  it('trang đầy = limit -> fetch tiếp với before = id card cuối', async () => {
    const pages = [page(PAGE_LIMIT, 'a'), page(2, 'b')];
    const befores: (string | null)[] = [];
    let call = 0;
    const res = await collectAllRawCards((before) => {
      befores.push(before);
      return Promise.resolve(pages[call++] ?? []);
    });
    expect(res.cards.length).toBe(PAGE_LIMIT + 2);
    expect(res.truncated).toBe(false);
    expect(befores).toEqual([null, `a${PAGE_LIMIT - 1}`]);
  });
});
```

- [ ] **Step 2: Chạy test để chắc nó fail**

Run: `npx vitest run tests/trello/fetch-board.test.ts`
Expected: FAIL với "Cannot find module '../../src/trello/fetch-board'".

- [ ] **Step 3: Cài đặt**

```typescript
// src/trello/fetch-board.ts
import type { CardStat } from '../core/stats-types';
import { parseCard, type RawCard } from './parse-card';
import type { TrelloRestApi } from './trello-types';

export const PAGE_LIMIT = 1000;
const FIELDS = 'id,idShort,name,idList,closed';
const API = 'https://api.trello.com/1';

// Lỗi khi token bị thu hồi (HTTP 401). UI bắt để mời authorize lại.
export class UnauthorizedError extends Error {
  constructor() {
    super('Token bị thu hồi, cấp quyền lại');
    this.name = 'UnauthorizedError';
  }
}

export interface BoardStats {
  cards: CardStat[];
  lists: { id: string; name: string }[];
  truncated: boolean; // true = nghi ngờ chưa lấy đủ card
}

// Gom mọi trang card. fetchPage nhận `before` (id card cuối trang trước, null cho trang đầu).
// THUẦN với fetchPage được tiêm vào -> test được không cần network.
export async function collectAllRawCards(
  fetchPage: (before: string | null) => Promise<RawCard[]>
): Promise<{ cards: RawCard[]; truncated: boolean }> {
  const all: RawCard[] = [];
  let before: string | null = null;
  for (let guard = 0; guard < 50; guard++) {
    const pageCards = await fetchPage(before);
    all.push(...pageCards);
    if (pageCards.length < PAGE_LIMIT) return { cards: all, truncated: false };
    const last = pageCards[pageCards.length - 1];
    if (!last) return { cards: all, truncated: false };
    before = last.id;
  }
  return { cards: all, truncated: true }; // chạm guard 50 trang -> nghi thiếu
}

// IO: authorize lazy + bulk fetch cards (filter=all gồm archive) + lists (filter=open) -> CardStat[].
export async function fetchBoardStats(
  restApi: TrelloRestApi,
  boardId: string,
  pluginId: string,
  appKey: string
): Promise<BoardStats> {
  let token = await restApi.getToken();
  if (!token) {
    token = await restApi.authorize({ scope: 'read', expiration: 'never' });
  }
  const auth = `key=${appKey}&token=${token}`;

  const fetchPage = async (before: string | null): Promise<RawCard[]> => {
    const beforeParam = before ? `&before=${before}` : '';
    const url =
      `${API}/boards/${boardId}/cards?filter=all&pluginData=true` +
      `&fields=${FIELDS}&limit=${PAGE_LIMIT}${beforeParam}&${auth}`;
    const res = await fetch(url);
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new Error(`Lỗi tải card (HTTP ${res.status})`);
    return (await res.json()) as RawCard[];
  };

  const { cards: rawCards, truncated } = await collectAllRawCards(fetchPage);

  const listRes = await fetch(`${API}/boards/${boardId}/lists?filter=open&fields=id,name&${auth}`);
  if (listRes.status === 401) throw new UnauthorizedError();
  if (!listRes.ok) throw new Error(`Lỗi tải list (HTTP ${listRes.status})`);
  const lists = (await listRes.json()) as { id: string; name: string }[];

  const cards = rawCards
    .map((c) => parseCard(c, pluginId))
    .filter((c): c is CardStat => c !== null);

  return { cards, lists, truncated };
}
```

- [ ] **Step 4: Chạy test để chắc nó pass**

Run: `npx vitest run tests/trello/fetch-board.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/trello/fetch-board.ts tests/trello/fetch-board.test.ts
git commit -m "feat: bulk fetch board cards with pagination guard"
```

---

## Task 10: Cấu hình appKey / pluginId

**Files:**
- Create: `src/config.ts`

> **QUAN TRỌNG (giá trị con người phải cấp):** `APP_KEY` và `PLUGIN_ID` lấy từ `trello.com/power-up/admin`. `APP_KEY` lộ trong client JS nên không phải bí mật (xác nhận trong spec mục 3). `PLUGIN_ID` là ID của Power-Up, phải khớp `idPlugin` trong pluginData mỗi card. Dashboard sẽ rỗng nếu `PLUGIN_ID` sai và authorize sẽ lỗi nếu `APP_KEY` sai. Đây là cấu hình bên ngoài, KHÔNG phải placeholder logic.

- [ ] **Step 1: Tạo file config**

```typescript
// src/config.ts
// Lấy từ trello.com/power-up/admin (Power-Up đã tạo) -> tab "API Key".
// appKey lộ trong client JS nên không phải bí mật (spec mục 3).
export const APP_KEY = 'PASTE_APP_KEY_HERE';
export const APP_NAME = 'Point System';

// ID của Power-Up này (khớp idPlugin trong pluginData mỗi card). Xem ở admin portal.
export const PLUGIN_ID = 'PASTE_POWERUP_ID_HERE';
```

- [ ] **Step 2: Người triển khai thay 2 giá trị thật**

- Mở `trello.com/power-up/admin`, chọn Power-Up "Point System".
- Copy "API Key" -> dán thay `PASTE_APP_KEY_HERE`.
- Copy Power-Up ID (trên URL/trang Power-Up) -> dán thay `PASTE_POWERUP_ID_HERE`.

- [ ] **Step 3: Xác minh typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/config.ts
git commit -m "feat: add app key and plugin id config"
```

---

## Task 11: Đăng ký board-button mở dashboard

**Files:**
- Modify: `src/connector.ts`

Lớp IO Trello, xác minh bằng `tsc` + test thủ công ở Task 14.

- [ ] **Step 1: Thêm board-buttons + options vào initialize**

Thay TOÀN BỘ `src/connector.ts` bằng:

```typescript
import { APP_KEY, APP_NAME } from './config';
import { formatBadge } from './core/badge';
import { sumEntries } from './core/totals';
import { loadCard } from './trello/storage';
import type { TrelloT } from './trello/trello-types';

const ICON = '🎯';

async function computeBadgeText(t: TrelloT): Promise<string | null> {
  const card = await loadCard(t);
  const logged = sumEntries(Object.values(card.logs).flatMap((l) => l.entries));
  const badge = formatBadge(logged, card.estimate);
  return badge ? badge.text : null;
}

TrelloPowerUp.initialize(
  {
    'card-badges': async (t) => {
      const card = await loadCard(t);
      const logged = sumEntries(Object.values(card.logs).flatMap((l) => l.entries));
      const badge = formatBadge(logged, card.estimate);
      if (!badge) return [];
      return [
        {
          text: `${ICON} ${badge.text}`,
          color: badge.color === 'orange' ? 'orange' : undefined,
        },
      ];
    },

    'card-detail-badges': async (t) => {
      const text = await computeBadgeText(t);
      return [
        {
          title: 'Point',
          text: text ? `Log point · ${text}` : 'Log point',
          callback: (t2: TrelloT) => {
            t2.modal?.({
              title: 'Point System',
              url: './popup.html',
              fullscreen: false,
              height: 560,
            });
          },
        },
      ];
    },

    'board-buttons': async () => [
      {
        text: '📊 Point Stats',
        condition: 'edit', // chỉ member có quyền edit board mới thấy
        callback: (t: TrelloT) => {
          t.modal?.({
            title: 'Point Stats Dashboard',
            url: './dashboard.html',
            fullscreen: false,
            height: 600,
          });
        },
      },
    ],
  },
  { appKey: APP_KEY, appName: APP_NAME }
);
```

- [ ] **Step 2: Xác minh typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

> **Lưu ý kiểm thử thủ công (Task 14):** một số tài khoản Trello yêu cầu board-button có `icon` (cặp URL `{dark, light}`) mới render. Nếu nút không hiện dù đã reload Power-Up, thêm `icon: { dark: '<url>', light: '<url>' }` (host SVG 📊 ở CDN hoặc dùng URL icon sẵn có). Emoji trong `text` vẫn hiển thị khi nút đã render.

- [ ] **Step 3: Commit**

```bash
git add src/connector.ts
git commit -m "feat: register board-button opening stats dashboard"
```

---

## Task 12: HTML + CSS cho dashboard (đã thiết kế ở pha frontend-design)

**Files:**
- Create: `dashboard.html` (đã tạo)
- Create: `src/ui/dashboard.css` (đã tạo)

> Hai tệp này đã được tạo và tinh chỉnh trong pha `frontend-design` (concept "trang sổ cái cân đối", kế thừa thẩm mỹ ledger của popup). Bản xem trước tĩnh có dữ liệu mẫu: `docs/superpowers/design/dashboard-preview.html` (mở bằng trình duyệt). Task này chỉ xác minh + commit, KHÔNG viết lại CSS.

**Hợp đồng class/id mà `dashboard.ts` (Task 13) phụ thuộc — đừng đổi tên:**

- id: `fetched-at`, `refresh`, `filters`, `tabs`, `truncated`, `state-loading`, `state-auth`, `authorize`, `state-empty`, `state-error`, `error-msg`, `retry`, `content`, `table-host`, `breakdown`.
- `#tabs` chứa sẵn 2 nút `<button class="tab" data-tab="list|user">`.
- `dashboard.ts` tự tạo các nút `<button class="fbtn" data-filter>` và chèn vào `#filters`.
- Bảng render: `table.stat > thead/tbody/tfoot`; ô số dùng class `num`; ô tiến độ dùng class `prog` chứa `.pbar(.over) > span[style="width:.."]` + `.pct` (hoặc `.muted` khi không có estimate).
- Breakdown render: `.bk-row > .bk-label + .bk-bar[style="width:.."] (> span[style="width:..;background:.."]) + .bk-val`.
- Ẩn/hiện trạng thái bằng class `hidden`.

- [ ] **Step 1: Xác minh 3 tệp tồn tại đúng chỗ**

Run: `ls dashboard.html src/ui/dashboard.css docs/superpowers/design/dashboard-preview.html`
Expected: cả 3 đường dẫn in ra, không lỗi.

- [ ] **Step 2: Xem trước thẩm mỹ (tuỳ chọn)**

Mở `docs/superpowers/design/dashboard-preview.html` bằng trình duyệt. Kiểm: masthead serif nghiêng, dòng TỔNG kẻ đôi kiểu kế toán, kẻ dọc giữa cột, thanh tiến độ, breakdown xếp chồng theo user, các trạng thái (cấp quyền / rỗng / lỗi / cảnh báo).

- [ ] **Step 3: Commit**

```bash
git add dashboard.html src/ui/dashboard.css docs/superpowers/design/dashboard-preview.html
git commit -m "feat: design dashboard UI (ledger spread) + static preview"
```

---

## Task 13: Logic UI dashboard

**Files:**
- Create: `src/ui/dashboard.ts`

Lớp UI điều phối, test thủ công ở Task 14. Mọi hàm thuần nó gọi đã được test ở Task 2-9.

- [ ] **Step 1: Tạo `src/ui/dashboard.ts`**

```typescript
import { APP_KEY, PLUGIN_ID } from '../config';
import {
  aggregateByList, aggregateByUser, breakdown, collectEntries,
  granularityFor, periodRange,
} from '../core/stats';
import type { BreakdownBucket, TimeFilter } from '../core/stats-types';
import { fetchBoardStats, UnauthorizedError, type BoardStats } from '../trello/fetch-board';
import type { TrelloT } from '../trello/trello-types';

const t = (window.TrelloPowerUp as unknown as { iframe: () => TrelloT }).iframe();

const FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
  { value: 'year', label: 'Năm này' },
];

const PALETTE = ['#2c6e49', '#b07a16', '#3a6ea5', '#b33a22', '#6f4a8e', '#1f7a6f', '#9c5a2c', '#4a7a1f'];
const MAX_BUCKETS = 8;

let data: BoardStats | null = null;
let tab: 'list' | 'user' = 'list';
let filter: TimeFilter = 'all';
let fetchedAt: Date | null = null;
let loading = false;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Thiếu phần tử #${id}`);
  return el;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function clock(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `⏱ ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type StateId = 'state-auth' | 'state-empty' | 'state-error' | 'state-loading' | 'content';
function showOnly(id: StateId): void {
  const all: StateId[] = ['state-auth', 'state-empty', 'state-error', 'state-loading', 'content'];
  for (const s of all) $(s).classList.toggle('hidden', s !== id);
}

function boardId(): string {
  const ctx = t.getContext?.();
  if (!ctx) throw new Error('Thiếu context board');
  return ctx.board;
}

async function load(): Promise<void> {
  if (loading) return;
  loading = true;
  showOnly('state-loading');
  try {
    const restApi = t.getRestApi?.();
    if (!restApi) throw new Error('REST API không khả dụng');
    data = await fetchBoardStats(restApi, boardId(), PLUGIN_ID, APP_KEY);
    fetchedAt = new Date();
    render();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      await t.getRestApi?.().clearToken();
      showOnly('state-auth');
    } else {
      $('error-msg').textContent = `Lỗi khi tải: ${e instanceof Error ? e.message : String(e)}`;
      showOnly('state-error');
    }
  } finally {
    loading = false;
  }
}

function render(): void {
  if (!data) return;
  if (data.cards.length === 0) { showOnly('state-empty'); return; }
  showOnly('content');

  $('truncated').classList.toggle('hidden', !data.truncated);
  if (fetchedAt) $('fetched-at').textContent = clock(fetchedAt);

  for (const b of document.querySelectorAll('#tabs .tab')) {
    b.classList.toggle('active', (b as HTMLElement).dataset.tab === tab);
  }
  for (const b of document.querySelectorAll('#filters .fbtn')) {
    b.classList.toggle('active', (b as HTMLElement).dataset.filter === filter);
  }

  if (tab === 'list') renderList();
  else renderUser();
}

function progressBar(pct: number): string {
  const w = Math.max(0, Math.min(100, pct));
  return `<span class="pbar ${pct > 100 ? 'over' : ''}"><span style="width:${w}%"></span></span>`;
}

function renderList(): void {
  if (!data) return;
  const range = periodRange(filter, fetchedAt ?? new Date());
  const agg = aggregateByList(data.cards, data.lists, range);

  const body = agg.rows.map((r) => {
    const pct = r.estimate === 0 ? null : Math.round((r.logged / r.estimate) * 100);
    const prog = pct === null
      ? '<span class="muted">—</span>'
      : `${progressBar(pct)}<span class="pct">${pct}%</span>`;
    return `<tr><td>${escapeHtml(r.name)}</td><td class="num">${r.cards}</td>` +
      `<td class="num">${r.estimate}</td><td class="num">${r.logged}</td><td class="prog">${prog}</td></tr>`;
  }).join('');

  const tPct = agg.totalEstimate === 0 ? null : Math.round((agg.totalLogged / agg.totalEstimate) * 100);
  const tProg = tPct === null ? '<span class="muted">—</span>' : `${progressBar(tPct)}<span class="pct">${tPct}%</span>`;

  $('table-host').innerHTML =
    `<table class="stat"><thead><tr><th>List</th><th class="num">Cards</th>` +
    `<th class="num">Est</th><th class="num">Log</th><th>Tiến độ</th></tr></thead>` +
    `<tbody>${body}</tbody>` +
    `<tfoot><tr><td>TỔNG</td><td class="num">${agg.totalCards}</td>` +
    `<td class="num">${agg.totalEstimate}</td><td class="num">${agg.totalLogged}</td>` +
    `<td class="prog">${tProg}</td></tr></tfoot></table>`;

  renderBreakdown(breakdown(collectEntries(data.cards, range, true), granularityFor(filter), MAX_BUCKETS), null);
}

function renderUser(): void {
  if (!data) return;
  const range = periodRange(filter, fetchedAt ?? new Date());
  const agg = aggregateByUser(data.cards, range);

  const colorByUser = new Map<string, string>();
  agg.rows.forEach((r, i) => colorByUser.set(r.memberId, PALETTE[i % PALETTE.length] ?? '#999'));

  const body = agg.rows.map((r) =>
    `<tr><td><span class="swatch" style="background:${colorByUser.get(r.memberId)}"></span>` +
    `${escapeHtml(r.fullName || '(ẩn danh)')}</td>` +
    `<td class="num">${r.entries}</td><td class="num">${r.logged}</td></tr>`
  ).join('');

  $('table-host').innerHTML =
    `<table class="stat"><thead><tr><th>User</th><th class="num">Entries</th>` +
    `<th class="num">Tổng Log</th></tr></thead>` +
    `<tbody>${body}</tbody>` +
    `<tfoot><tr><td>TỔNG</td><td class="num">${agg.totalEntries}</td>` +
    `<td class="num">${agg.totalLogged}</td></tr></tfoot></table>`;

  renderBreakdown(breakdown(collectEntries(data.cards, range, false), granularityFor(filter), MAX_BUCKETS), colorByUser);
}

function renderBreakdown(buckets: BreakdownBucket[], colorByUser: Map<string, string> | null): void {
  const host = $('breakdown');
  if (buckets.length === 0) { host.innerHTML = ''; return; }
  const max = Math.max(...buckets.map((b) => b.total), 1);

  const rows = buckets.map((b) => {
    const widthPct = Math.round((b.total / max) * 100);
    let inner: string;
    if (colorByUser) {
      inner = Object.entries(b.byUser).map(([mid, pt]) => {
        const seg = b.total === 0 ? 0 : Math.round((pt / b.total) * 100);
        return `<span style="width:${seg}%;background:${colorByUser.get(mid) ?? '#999'}"></span>`;
      }).join('');
    } else {
      inner = `<span style="width:100%;background:var(--green)"></span>`;
    }
    return `<div class="bk-row"><span class="bk-label">${escapeHtml(b.label)}</span>` +
      `<span class="bk-bar" style="width:${widthPct}%">${inner}</span>` +
      `<span class="bk-val">${b.total}</span></div>`;
  }).join('');

  host.innerHTML = `<div class="bk-title">Breakdown theo kỳ</div>${rows}`;
}

function buildControls(): void {
  const fhost = $('filters');
  for (const f of FILTERS) {
    const b = document.createElement('button');
    b.className = 'fbtn';
    b.dataset.filter = f.value;
    b.textContent = f.label;
    b.onclick = () => { filter = f.value; render(); };
    fhost.appendChild(b);
  }
  for (const b of document.querySelectorAll('#tabs .tab')) {
    (b as HTMLElement).onclick = () => { tab = (b as HTMLElement).dataset.tab as 'list' | 'user'; render(); };
  }
  ($('refresh') as HTMLButtonElement).onclick = () => void load();
  ($('authorize') as HTMLButtonElement).onclick = () => void load();
  ($('retry') as HTMLButtonElement).onclick = () => void load();
}

async function init(): Promise<void> {
  buildControls();
  const restApi = t.getRestApi?.();
  if (!restApi) {
    $('error-msg').textContent = 'REST API không khả dụng (thiếu appKey khi initialize?)';
    showOnly('state-error');
    return;
  }
  const token = await restApi.getToken();
  if (!token) { showOnly('state-auth'); return; } // lazy: chờ user bấm "Cấp quyền & tải"
  await load();
}

init().catch((e) => {
  $('error-msg').textContent = `Lỗi khởi tạo: ${e instanceof Error ? e.message : String(e)}`;
  showOnly('state-error');
});
```

- [ ] **Step 2: Xác minh typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. Nếu báo unused import nào trong `stats.ts` (vd `mondayOf`/`todayLocal`), xoá import thừa cho sạch rồi chạy lại.

- [ ] **Step 3: Commit**

```bash
git add src/ui/dashboard.ts
git commit -m "feat: dashboard UI with tabs, filters, breakdown"
```

---

## Task 14: Thêm dashboard vào build + kiểm thử end-to-end

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Thêm `dashboard.html` vào multi-page input**

Thay TOÀN BỘ `vite.config.ts` bằng:

```typescript
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        connector: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'popup.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
      },
    },
  },
});
```

- [ ] **Step 2: Build + test toàn bộ**

Run: `npm run build && npm test`
Expected: 
- `tsc --noEmit` PASS.
- `vite build` tạo `dist/dashboard.html` (kiểm tra: `ls dist/dashboard.html`).
- Toàn bộ vitest PASS.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add dashboard to vite multi-page build"
```

- [ ] **Step 4: Kiểm thử thủ công trên board thật**

Triển khai (push để Cloudflare auto build+deploy, xem memory F-004) rồi mở Trello board:

- [ ] Board-button "📊 Point Stats" hiện trên thanh board (nếu không hiện, áp lưu ý icon ở Task 11).
- [ ] Click button mở modal dashboard.
- [ ] Lần đầu (chưa có token): hiện state "Cấp quyền đọc board" + nút. Bấm -> popup authorize Trello -> fetch -> render.
- [ ] Tab "Theo List": chỉ card visible; số Est/Log/tiến độ khớp tay tính trên vài list.
- [ ] Tab "Theo User": gồm cả card đã archive (kiểm bằng 1 card archive có log -> point vẫn tính).
- [ ] Đổi filter (Hôm nay/Tuần/Tháng/Năm): số liệu + breakdown đổi đúng. "Hôm nay" breakdown rỗng; "Năm này" breakdown theo tháng (T...).
- [ ] Nút "🔄 Làm mới": fetch lại, cập nhật timestamp ⏱.
- [ ] Edge: board rỗng -> state "chưa có point data"; board 1 card; board nhiều archive.
- [ ] Verify cap phân trang (spec mục 11): nếu có board lớn, xác nhận `before`/`limit=1000` lấy đủ; nếu chạm guard -> banner cảnh báo.

- [ ] **Step 5: Ghi nhớ phát hiện (project-memory)**

Nếu có giá trị cap thực tế của `/boards/{id}/cards?filter=all`, hoặc lỗi authorize/icon board-button, capture vào memory:

```bash
python skills/project-memory/scripts/new-entry.py fact
```

---

## Spec coverage map (tự rà soát)

| Yêu cầu spec | Task |
|---|---|
| Bulk fetch `filter=all&pluginData=true` + lists | Task 9 |
| Phân trang `before`/`limit=1000` + guard cảnh báo | Task 9 (`collectAllRawCards`, `truncated`) + Task 13 (banner) |
| Parse pluginData tái dùng `decodeMemberLog` | Task 7 |
| Model RAM `CardStat`/`LogEntry` | Task 1 |
| Phạm vi per-tab (User=tất cả, List=visible) | Task 4 (`closed` skip), Task 5, Task 13 (`collectEntries` visibleOnly) |
| Tab List: Cards/Est/Log/Tiến độ + dòng TỔNG | Task 4 + Task 13 |
| Tab User: Entries/Tổng Log + dòng TỔNG | Task 5 + Task 13 |
| Bộ lọc thời gian (all/today/week/month/year) | Task 3 (`periodRange`/`inRange`) |
| Breakdown tuần/tháng, granularity theo filter | Task 6 + Task 13 |
| Authorize lazy per-user, scope read, never | Task 9 + Task 13 (chờ bấm nút) |
| Board-button mở modal, condition edit | Task 11 |
| appKey/appName khi initialize | Task 10 + Task 11 |
| Trạng thái rỗng/lỗi/401/cảnh báo cap | Task 12 (markup) + Task 13 (logic) |
| Không cache, fetch tươi mỗi lần | Toàn bộ kiến trúc (không có lớp store) |
| Nút Làm mới + timestamp | Task 12 + Task 13 |

Phi mục tiêu (export CSV, burndown, webhook, backend) — không có task, đúng spec.
