# Trello Point System Power-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây một Trello Power-Up tự host cho phép estimate per-card, log point per-member theo ngày, và xem lịch sử nhóm theo ngày, toàn bộ dữ liệu lưu trong card (`shared` pluginData), không backend.

**Architecture:** Tách hai lớp. **Lõi logic thuần** (`src/core/`) không biết gì về Trello: encode/decode, validate, tính tổng + làm tròn, đo dung lượng 4096, gộp lịch sử nhiều key, format badge. Đây là nơi đặt toàn bộ unit test Vitest. **Lớp keo SDK** (`src/trello/`, `src/ui/`) mỏng, chỉ gọi `t.get`/`t.set`/`t.member` và render DOM, test thủ công trên board thật.

**Tech Stack:** TypeScript, Vite (build tĩnh, multi-page), Vitest (test lõi), vanilla DOM (không framework), host Cloudflare Pages.

---

## File Structure

Trước khi vào task, đây là bản đồ file. Mỗi file một trách nhiệm, file thay đổi cùng nhau ở cạnh nhau.

```
trello-point-system/
├── package.json                 # scripts + deps
├── tsconfig.json                # cấu hình TS strict
├── vite.config.ts               # multi-page build (connector + popup)
├── vitest.config.ts             # cấu hình test lõi
├── index.html                   # trang connector (iframe Power-Up)
├── popup.html                   # trang popup (mở từ detail badge)
├── src/
│   ├── core/                    # LÕI THUẦN — không import Trello, có test
│   │   ├── types.ts             # Entry, MemberLog, DecodedMemberLog, DayGroup, Row
│   │   ├── dateutil.ts          # todayLocal, formatDayLabel
│   │   ├── validate.ts          # validatePoint, validateDate, validateEstimate
│   │   ├── codec.ts             # encodeMemberLog, decodeMemberLog
│   │   ├── totals.ts            # sumEntries, roundTotal
│   │   ├── capacity.ts          # measureLength, capacityInfo
│   │   ├── badge.ts             # formatBadge
│   │   └── history.ts           # buildHistory
│   ├── trello/                  # LỚP KEO — gọi SDK, test thủ công
│   │   └── storage.ts           # loadCard, saveEstimate, saveEntry, updateEntry, deleteEntry
│   ├── connector.ts             # TrelloPowerUp.initialize (badges)
│   └── ui/
│       └── popup.ts             # render popup, wiring form + lịch sử
└── tests/
    └── core/
        ├── dateutil.test.ts
        ├── validate.test.ts
        ├── codec.test.ts
        ├── totals.test.ts
        ├── capacity.test.ts
        ├── badge.test.ts
        └── history.test.ts
```

Lõi thuần được chia nhỏ theo trách nhiệm để mỗi file gọn, dễ giữ trong đầu và test độc lập. Lớp keo gom vào ít file vì chủ yếu là I/O.

---

## Task 1: Scaffold dự án

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Tạo `package.json`**

```json
{
  "name": "trello-point-system",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Tạo `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Tạo `vite.config.ts` (multi-page: connector + popup)**

```ts
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        connector: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'popup.html'),
      },
    },
  },
});
```

- [ ] **Step 4: Tạo `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Tạo `.gitignore`**

```
node_modules
dist
*.local
.DS_Store
```

- [ ] **Step 6: Cài dependencies**

Run: `npm install`
Expected: tạo `node_modules` và `package-lock.json`, không lỗi.

- [ ] **Step 7: Verify Vitest chạy được (chưa có test)**

Run: `npm test`
Expected: Vitest báo "No test files found" và exit 0 (hoặc tương đương, không crash).

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts .gitignore package-lock.json
git commit -m "chore: scaffold Vite + TS + Vitest cho Trello Point System"
```

---

## Task 2: Kiểu dữ liệu lõi

**Files:**
- Create: `src/core/types.ts`

Không có test riêng (chỉ là khai báo type). Các task sau import từ đây.

- [ ] **Step 1: Tạo `src/core/types.ts`**

```ts
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
```

- [ ] **Step 2: Verify TS biên dịch sạch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: thêm kiểu dữ liệu lõi cho Point System"
```

---

## Task 3: Tiện ích ngày

**Files:**
- Create: `src/core/dateutil.ts`
- Test: `tests/core/dateutil.test.ts`

`todayLocal` nhận `Date` (inject để test được), trả về `YYYY-MM-DD` theo **local** của trình duyệt. `formatDayLabel` đổi `YYYY-MM-DD` thành `DD/MM` cho header lịch sử.

- [ ] **Step 1: Viết test thất bại**

```ts
// tests/core/dateutil.test.ts
import { describe, expect, it } from 'vitest';
import { formatDayLabel, todayLocal } from '../../src/core/dateutil';

describe('todayLocal', () => {
  it('trả YYYY-MM-DD theo giờ local, zero-pad tháng và ngày', () => {
    // 2026-06-06 09:30 local
    const d = new Date(2026, 5, 6, 9, 30, 0);
    expect(todayLocal(d)).toBe('2026-06-06');
  });

  it('zero-pad tháng/ngày một chữ số', () => {
    const d = new Date(2026, 0, 3, 0, 0, 0); // 2026-01-03
    expect(todayLocal(d)).toBe('2026-01-03');
  });
});

describe('formatDayLabel', () => {
  it('đổi YYYY-MM-DD thành DD/MM', () => {
    expect(formatDayLabel('2026-06-06')).toBe('06/06');
    expect(formatDayLabel('2026-01-03')).toBe('03/01');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run tests/core/dateutil.test.ts`
Expected: FAIL với "Cannot find module '../../src/core/dateutil'".

- [ ] **Step 3: Viết implementation tối thiểu**

```ts
// src/core/dateutil.ts
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Lấy ngày local hôm nay dạng YYYY-MM-DD (KHÔNG dùng toISOString — nó là UTC).
export function todayLocal(now: Date): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

// YYYY-MM-DD -> DD/MM cho header lịch sử.
export function formatDayLabel(date: string): string {
  const parts = date.split('-');
  return `${parts[2]}/${parts[1]}`;
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run tests/core/dateutil.test.ts`
Expected: PASS, 4 test xanh.

- [ ] **Step 5: Commit**

```bash
git add src/core/dateutil.ts tests/core/dateutil.test.ts
git commit -m "feat: thêm tiện ích ngày local + nhãn ngày"
```

---

## Task 4: Validate point

**Files:**
- Create: `src/core/validate.ts`
- Test: `tests/core/validate.test.ts`

`validatePoint` parse chuỗi nhập, trả về kết quả union. Quy tắc spec: rỗng / không phải số / ≤ 0 / > 100 / quá 1 chữ số thập phân đều bị chặn với thông báo lỗi tiếng Việt.

- [ ] **Step 1: Viết test thất bại**

```ts
// tests/core/validate.test.ts
import { describe, expect, it } from 'vitest';
import { validatePoint } from '../../src/core/validate';

describe('validatePoint', () => {
  it('nhận số hợp lệ nguyên', () => {
    expect(validatePoint('3')).toEqual({ ok: true, value: 3 });
  });

  it('nhận số 1 chữ số thập phân', () => {
    expect(validatePoint('1.5')).toEqual({ ok: true, value: 1.5 });
  });

  it('cắt khoảng trắng hai đầu', () => {
    expect(validatePoint('  2  ')).toEqual({ ok: true, value: 2 });
  });

  it('chặn rỗng', () => {
    const r = validatePoint('');
    expect(r.ok).toBe(false);
  });

  it('chặn không phải số', () => {
    expect(validatePoint('abc').ok).toBe(false);
  });

  it('chặn số 0', () => {
    expect(validatePoint('0').ok).toBe(false);
  });

  it('chặn số âm', () => {
    expect(validatePoint('-2').ok).toBe(false);
  });

  it('chặn > 100', () => {
    expect(validatePoint('100.5').ok).toBe(false);
  });

  it('nhận đúng 100', () => {
    expect(validatePoint('100')).toEqual({ ok: true, value: 100 });
  });

  it('chặn quá 1 chữ số thập phân', () => {
    expect(validatePoint('1.25').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run tests/core/validate.test.ts`
Expected: FAIL với "Cannot find module '../../src/core/validate'".

- [ ] **Step 3: Viết implementation tối thiểu**

```ts
// src/core/validate.ts
export type ValidationResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

const MAX_POINT = 100;

// Kiểm tra point: rỗng / NaN / <=0 / >100 / quá 1 chữ số thập phân đều bị chặn.
export function validatePoint(input: string): ValidationResult {
  const s = input.trim();
  if (s === '') return { ok: false, error: 'Nhập số point' };

  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, error: 'Point phải là số' };
  if (value <= 0) return { ok: false, error: 'Point phải lớn hơn 0' };
  if (value > MAX_POINT) return { ok: false, error: `Point tối đa ${MAX_POINT}` };

  // Tối đa 1 chữ số thập phân: nhân 10 phải ra số nguyên.
  if (Math.round(value * 10) !== value * 10) {
    return { ok: false, error: 'Point tối đa 1 chữ số thập phân' };
  }

  return { ok: true, value };
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run tests/core/validate.test.ts`
Expected: PASS, 10 test xanh.

- [ ] **Step 5: Commit**

```bash
git add src/core/validate.ts tests/core/validate.test.ts
git commit -m "feat: validate point cho log"
```

---

## Task 5: Validate ngày (chặn tương lai)

**Files:**
- Modify: `src/core/validate.ts`
- Test: `tests/core/validate.test.ts` (thêm describe block)

`validateDate(input, today)` kiểm tra định dạng `YYYY-MM-DD` và chặn ngày **lớn hơn** `today` (chặn tương lai). Cho backdate không giới hạn.

- [ ] **Step 1: Thêm test thất bại vào file test**

Thêm vào cuối `tests/core/validate.test.ts`:

```ts
import { validateDate } from '../../src/core/validate';

describe('validateDate', () => {
  const today = '2026-06-06';

  it('nhận ngày hôm nay', () => {
    expect(validateDate('2026-06-06', today)).toEqual({ ok: true });
  });

  it('nhận ngày quá khứ bất kỳ', () => {
    expect(validateDate('2020-01-01', today)).toEqual({ ok: true });
  });

  it('chặn ngày tương lai', () => {
    expect(validateDate('2026-06-07', today).ok).toBe(false);
  });

  it('chặn định dạng sai', () => {
    expect(validateDate('06/06/2026', today).ok).toBe(false);
    expect(validateDate('', today).ok).toBe(false);
    expect(validateDate('2026-6-6', today).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run tests/core/validate.test.ts -t validateDate`
Expected: FAIL với "validateDate is not a function" (chưa export).

- [ ] **Step 3: Thêm implementation vào `src/core/validate.ts`**

```ts
export type DateValidationResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Kiểm tra ngày: đúng định dạng YYYY-MM-DD và không vượt quá hôm nay.
export function validateDate(input: string, today: string): DateValidationResult {
  if (!DATE_RE.test(input)) {
    return { ok: false, error: 'Ngày phải dạng YYYY-MM-DD' };
  }
  if (input > today) {
    return { ok: false, error: 'Không log cho ngày tương lai' };
  }
  return { ok: true };
}
```

So sánh chuỗi `YYYY-MM-DD` bằng `>` đúng theo thứ tự thời gian vì định dạng cố định độ dài, lớn-bé tính trái sang phải.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run tests/core/validate.test.ts`
Expected: PASS, toàn bộ test (point + date) xanh.

- [ ] **Step 5: Commit**

```bash
git add src/core/validate.ts tests/core/validate.test.ts
git commit -m "feat: validate ngày, chặn ngày tương lai"
```

---

## Task 6: Validate estimate

**Files:**
- Modify: `src/core/validate.ts`
- Test: `tests/core/validate.test.ts` (thêm describe block)

Estimate **tùy chọn**: rỗng nghĩa là "xóa estimate" (hợp lệ, trả `null`). Khi có số: thập phân, chặn âm, ≤ 100. Khác `validatePoint` ở chỗ cho phép rỗng và cho phép 0 thì... spec nói "chặn số âm, ≤ 100". 0 không nói rõ; coi 0 là không hợp lệ (estimate 0 vô nghĩa, dùng rỗng để clear).

- [ ] **Step 1: Thêm test thất bại**

Thêm vào cuối `tests/core/validate.test.ts`:

```ts
import { validateEstimate } from '../../src/core/validate';

describe('validateEstimate', () => {
  it('rỗng nghĩa là xóa estimate (value null)', () => {
    expect(validateEstimate('')).toEqual({ ok: true, value: null });
    expect(validateEstimate('   ')).toEqual({ ok: true, value: null });
  });

  it('nhận số hợp lệ', () => {
    expect(validateEstimate('8')).toEqual({ ok: true, value: 8 });
    expect(validateEstimate('2.5')).toEqual({ ok: true, value: 2.5 });
  });

  it('chặn âm', () => {
    expect(validateEstimate('-1').ok).toBe(false);
  });

  it('chặn 0', () => {
    expect(validateEstimate('0').ok).toBe(false);
  });

  it('chặn > 100', () => {
    expect(validateEstimate('101').ok).toBe(false);
  });

  it('chặn không phải số', () => {
    expect(validateEstimate('abc').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run tests/core/validate.test.ts -t validateEstimate`
Expected: FAIL với "validateEstimate is not a function".

- [ ] **Step 3: Thêm implementation vào `src/core/validate.ts`**

```ts
export type EstimateValidationResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

// Estimate tùy chọn: rỗng -> null (xóa). Có số: >0, <=100.
export function validateEstimate(input: string): EstimateValidationResult {
  const s = input.trim();
  if (s === '') return { ok: true, value: null };

  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, error: 'Estimate phải là số' };
  if (value <= 0) return { ok: false, error: 'Estimate phải lớn hơn 0' };
  if (value > 100) return { ok: false, error: 'Estimate tối đa 100' };

  return { ok: true, value };
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run tests/core/validate.test.ts`
Expected: PASS, toàn bộ test xanh.

- [ ] **Step 5: Commit**

```bash
git add src/core/validate.ts tests/core/validate.test.ts
git commit -m "feat: validate estimate, cho phép rỗng để xóa"
```

---

## Task 7: Encode/decode log member

**Files:**
- Create: `src/core/codec.ts`
- Test: `tests/core/codec.test.ts`

`encodeMemberLog` đổi `DecodedMemberLog` (friendly) thành `MemberLog` (compact). `decodeMemberLog` làm ngược lại, **phòng thủ** trước dữ liệu hỏng (thiếu field, sai kiểu) bằng cách bỏ qua entry hỏng và điền mặc định.

- [ ] **Step 1: Viết test thất bại**

```ts
// tests/core/codec.test.ts
import { describe, expect, it } from 'vitest';
import { decodeMemberLog, encodeMemberLog } from '../../src/core/codec';
import type { DecodedMemberLog } from '../../src/core/types';

const decoded: DecodedMemberLog = {
  version: 1,
  fullName: 'Tuấn',
  username: 'tuanhv',
  entries: [
    { date: '2026-06-06', point: 3, comment: 'fix login' },
    { date: '2026-06-05', point: 2, comment: '' },
  ],
};

const compact = {
  v: 1,
  n: 'Tuấn',
  u: 'tuanhv',
  e: [
    ['2026-06-06', 3, 'fix login'],
    ['2026-06-05', 2, ''],
  ],
};

describe('encodeMemberLog', () => {
  it('đổi friendly -> compact', () => {
    expect(encodeMemberLog(decoded)).toEqual(compact);
  });
});

describe('decodeMemberLog', () => {
  it('đổi compact -> friendly', () => {
    expect(decodeMemberLog(compact)).toEqual(decoded);
  });

  it('roundtrip giữ nguyên', () => {
    expect(decodeMemberLog(encodeMemberLog(decoded))).toEqual(decoded);
  });

  it('dữ liệu null/undefined -> log rỗng version 1', () => {
    expect(decodeMemberLog(null)).toEqual({
      version: 1,
      fullName: '',
      username: '',
      entries: [],
    });
  });

  it('bỏ qua entry hỏng (thiếu field, point không phải số)', () => {
    const dirty = {
      v: 1,
      n: 'Mai',
      u: 'mai',
      e: [
        ['2026-06-06', 1.5, 'ok'],
        ['2026-06-06', 'x', 'point hỏng'],
        ['bad-row'],
      ],
    };
    expect(decodeMemberLog(dirty).entries).toEqual([
      { date: '2026-06-06', point: 1.5, comment: 'ok' },
    ]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run tests/core/codec.test.ts`
Expected: FAIL với "Cannot find module '../../src/core/codec'".

- [ ] **Step 3: Viết implementation tối thiểu**

```ts
// src/core/codec.ts
import type { DecodedMemberLog, Entry, MemberLog } from './types';
import { SCHEMA_VERSION } from './types';

export function encodeMemberLog(log: DecodedMemberLog): MemberLog {
  return {
    v: log.version,
    n: log.fullName,
    u: log.username,
    e: log.entries.map((en) => [en.date, en.point, en.comment]),
  };
}

function decodeEntry(raw: unknown): Entry | null {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const [date, point, comment] = raw;
  if (typeof date !== 'string') return null;
  if (typeof point !== 'number' || !Number.isFinite(point)) return null;
  if (typeof comment !== 'string') return null;
  return { date, point, comment };
}

// Phòng thủ: dữ liệu pluginData có thể hỏng/thiếu. Không tin, điền mặc định.
export function decodeMemberLog(raw: unknown): DecodedMemberLog {
  const obj = (raw ?? {}) as Partial<MemberLog>;
  const rawEntries = Array.isArray(obj.e) ? obj.e : [];
  const entries: Entry[] = [];
  for (const r of rawEntries) {
    const e = decodeEntry(r);
    if (e) entries.push(e);
  }
  return {
    version: typeof obj.v === 'number' ? obj.v : SCHEMA_VERSION,
    fullName: typeof obj.n === 'string' ? obj.n : '',
    username: typeof obj.u === 'string' ? obj.u : '',
    entries,
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run tests/core/codec.test.ts`
Expected: PASS, toàn bộ test xanh.

- [ ] **Step 5: Commit**

```bash
git add src/core/codec.ts tests/core/codec.test.ts
git commit -m "feat: encode/decode log member, decode phòng thủ"
```

---

## Task 8: Tổng point + làm tròn

**Files:**
- Create: `src/core/totals.ts`
- Test: `tests/core/totals.test.ts`

`roundTotal` làm tròn 2 chữ số né rác số thực. `sumEntries` cộng point của một mảng entry rồi làm tròn.

- [ ] **Step 1: Viết test thất bại**

```ts
// tests/core/totals.test.ts
import { describe, expect, it } from 'vitest';
import { roundTotal, sumEntries } from '../../src/core/totals';
import type { Entry } from '../../src/core/types';

describe('roundTotal', () => {
  it('né rác số thực 1.1 + 2.2', () => {
    expect(roundTotal(1.1 + 2.2)).toBe(3.3);
  });

  it('làm tròn 2 chữ số', () => {
    expect(roundTotal(6.555)).toBe(6.56);
  });

  it('giữ số nguyên', () => {
    expect(roundTotal(8)).toBe(8);
  });
});

describe('sumEntries', () => {
  const entries: Entry[] = [
    { date: '2026-06-06', point: 3, comment: '' },
    { date: '2026-06-06', point: 1.5, comment: '' },
    { date: '2026-06-05', point: 2, comment: '' },
  ];

  it('cộng tổng đã làm tròn', () => {
    expect(sumEntries(entries)).toBe(6.5);
  });

  it('mảng rỗng -> 0', () => {
    expect(sumEntries([])).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run tests/core/totals.test.ts`
Expected: FAIL với "Cannot find module '../../src/core/totals'".

- [ ] **Step 3: Viết implementation tối thiểu**

```ts
// src/core/totals.ts
import type { Entry } from './types';

// Làm tròn 2 chữ số, né rác dấu phẩy động (1.1 + 2.2 = 3.3000000000000003).
export function roundTotal(sum: number): number {
  return Math.round(sum * 100) / 100;
}

export function sumEntries(entries: Entry[]): number {
  const raw = entries.reduce((acc, e) => acc + e.point, 0);
  return roundTotal(raw);
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run tests/core/totals.test.ts`
Expected: PASS, toàn bộ test xanh.

- [ ] **Step 5: Commit**

```bash
git add src/core/totals.ts tests/core/totals.test.ts
git commit -m "feat: tổng point + làm tròn 2 chữ số"
```

---

## Task 9: Đo dung lượng 4096

**Files:**
- Create: `src/core/capacity.ts`
- Test: `tests/core/capacity.test.ts`

Trần Trello là 4096 ký tự trên toàn bộ object `card+shared` đã stringify. `measureLength` đo độ dài. `capacityInfo` trả % và mức cảnh báo: vàng ở 80% (3277), đỏ ở 92% (3768).

- [ ] **Step 1: Viết test thất bại**

```ts
// tests/core/capacity.test.ts
import { describe, expect, it } from 'vitest';
import { capacityInfo, measureLength } from '../../src/core/capacity';

describe('measureLength', () => {
  it('đo độ dài JSON.stringify của object', () => {
    expect(measureLength({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
  });
});

describe('capacityInfo', () => {
  it('tính % làm tròn và used/max', () => {
    const info = capacityInfo(2510);
    expect(info.used).toBe(2510);
    expect(info.max).toBe(4096);
    expect(info.percent).toBe(61);
  });

  it('mức ok khi dưới 80%', () => {
    expect(capacityInfo(3276).level).toBe('ok');
  });

  it('mức warn (vàng) từ 3277', () => {
    expect(capacityInfo(3277).level).toBe('warn');
    expect(capacityInfo(3767).level).toBe('warn');
  });

  it('mức danger (đỏ) từ 3768', () => {
    expect(capacityInfo(3768).level).toBe('danger');
    expect(capacityInfo(4096).level).toBe('danger');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run tests/core/capacity.test.ts`
Expected: FAIL với "Cannot find module '../../src/core/capacity'".

- [ ] **Step 3: Viết implementation tối thiểu**

```ts
// src/core/capacity.ts
export const MAX_CHARS = 4096;
const WARN_AT = 3277; // ceil(4096 * 0.80)
const DANGER_AT = 3768; // ceil(4096 * 0.92)

export type CapacityLevel = 'ok' | 'warn' | 'danger';

export interface CapacityInfo {
  used: number;
  max: number;
  percent: number; // làm tròn để hiển thị
  level: CapacityLevel;
}

export function measureLength(obj: unknown): number {
  return JSON.stringify(obj).length;
}

export function capacityInfo(used: number): CapacityInfo {
  let level: CapacityLevel = 'ok';
  if (used >= DANGER_AT) level = 'danger';
  else if (used >= WARN_AT) level = 'warn';

  return {
    used,
    max: MAX_CHARS,
    percent: Math.round((used / MAX_CHARS) * 100),
    level,
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run tests/core/capacity.test.ts`
Expected: PASS, toàn bộ test xanh.

- [ ] **Step 5: Commit**

```bash
git add src/core/capacity.ts tests/core/capacity.test.ts
git commit -m "feat: đo dung lượng 4096, mức cảnh báo vàng/đỏ"
```

---

## Task 10: Format badge

**Files:**
- Create: `src/core/badge.ts`
- Test: `tests/core/badge.test.ts`

`formatBadge(logged, estimate)` quyết định text + màu badge. `logged` là tổng đã log (số, có thể 0). `estimate` là `number | null`. Trống cả hai trả `null` (không hiện badge). Log vượt estimate trả màu cam.

- [ ] **Step 1: Viết test thất bại**

```ts
// tests/core/badge.test.ts
import { describe, expect, it } from 'vitest';
import { formatBadge } from '../../src/core/badge';

describe('formatBadge', () => {
  it('có estimate + log -> log/est, màu mặc định', () => {
    expect(formatBadge(6.5, 8)).toEqual({ text: '6.5/8', color: 'default' });
  });

  it('có estimate, chưa log -> 0/est', () => {
    expect(formatBadge(0, 8)).toEqual({ text: '0/8', color: 'default' });
  });

  it('có log, chưa estimate -> chỉ log (ẩn mẫu số)', () => {
    expect(formatBadge(6.5, null)).toEqual({ text: '6.5', color: 'default' });
  });

  it('trống cả hai -> null (không badge)', () => {
    expect(formatBadge(0, null)).toBeNull();
  });

  it('log vượt estimate -> màu cam', () => {
    expect(formatBadge(9, 8)).toEqual({ text: '9/8', color: 'orange' });
  });

  it('log đúng bằng estimate -> không cam', () => {
    expect(formatBadge(8, 8)).toEqual({ text: '8/8', color: 'default' });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run tests/core/badge.test.ts`
Expected: FAIL với "Cannot find module '../../src/core/badge'".

- [ ] **Step 3: Viết implementation tối thiểu**

```ts
// src/core/badge.ts
export type BadgeColor = 'default' | 'orange';

export interface BadgeData {
  text: string;
  color: BadgeColor;
}

// logged: tổng đã log (>=0). estimate: number | null.
// Trống cả hai -> null. Log vượt estimate -> cam.
export function formatBadge(
  logged: number,
  estimate: number | null
): BadgeData | null {
  const hasEstimate = estimate !== null;
  const hasLog = logged > 0;

  if (!hasEstimate && !hasLog) return null;

  if (hasEstimate) {
    const color: BadgeColor = logged > (estimate as number) ? 'orange' : 'default';
    return { text: `${logged}/${estimate}`, color };
  }

  // Có log, chưa estimate: ẩn mẫu số.
  return { text: `${logged}`, color: 'default' };
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run tests/core/badge.test.ts`
Expected: PASS, toàn bộ test xanh.

- [ ] **Step 5: Commit**

```bash
git add src/core/badge.ts tests/core/badge.test.ts
git commit -m "feat: format badge mặt card, tô cam khi vượt estimate"
```

---

## Task 11: Gộp lịch sử nhiều member

**Files:**
- Create: `src/core/history.ts`
- Test: `tests/core/history.test.ts`

`buildHistory` nhận map `memberId -> DecodedMemberLog`, gộp tất cả entry, nhóm theo ngày, mỗi ngày có tổng phụ. Ngày mới nhất trên cùng. Mỗi `Row` giữ `memberId` + `entryIndex` để UI biết ai sở hữu và sửa/xóa đúng entry.

- [ ] **Step 1: Viết test thất bại**

```ts
// tests/core/history.test.ts
import { describe, expect, it } from 'vitest';
import { buildHistory } from '../../src/core/history';
import type { DecodedMemberLog } from '../../src/core/types';

const logs: Record<string, DecodedMemberLog> = {
  m1: {
    version: 1,
    fullName: 'Tuấn',
    username: 'tuanhv',
    entries: [
      { date: '2026-06-06', point: 3, comment: 'fix login' },
      { date: '2026-06-05', point: 2, comment: '' },
    ],
  },
  m2: {
    version: 1,
    fullName: 'Mai',
    username: 'mai',
    entries: [{ date: '2026-06-06', point: 1.5, comment: 'review' }],
  },
};

describe('buildHistory', () => {
  it('nhóm theo ngày, ngày mới nhất trên cùng', () => {
    const groups = buildHistory(logs);
    expect(groups.map((g) => g.date)).toEqual(['2026-06-06', '2026-06-05']);
  });

  it('tính tổng phụ mỗi ngày', () => {
    const groups = buildHistory(logs);
    expect(groups[0].subtotal).toBe(4.5); // 3 + 1.5
    expect(groups[1].subtotal).toBe(2);
  });

  it('mỗi row giữ memberId, fullName, entryIndex', () => {
    const groups = buildHistory(logs);
    const day0 = groups[0].rows;
    expect(day0).toContainEqual({
      memberId: 'm1',
      fullName: 'Tuấn',
      point: 3,
      comment: 'fix login',
      entryIndex: 0,
    });
    expect(day0).toContainEqual({
      memberId: 'm2',
      fullName: 'Mai',
      point: 1.5,
      comment: 'review',
      entryIndex: 0,
    });
  });

  it('entryIndex trỏ đúng vị trí trong entries của member', () => {
    const groups = buildHistory(logs);
    const day1 = groups[1].rows; // 2026-06-05
    expect(day1).toEqual([
      {
        memberId: 'm1',
        fullName: 'Tuấn',
        point: 2,
        comment: '',
        entryIndex: 1,
      },
    ]);
  });

  it('không member nào -> mảng rỗng', () => {
    expect(buildHistory({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run tests/core/history.test.ts`
Expected: FAIL với "Cannot find module '../../src/core/history'".

- [ ] **Step 3: Viết implementation tối thiểu**

```ts
// src/core/history.ts
import type { DayGroup, DecodedMemberLog, Row } from './types';
import { roundTotal } from './totals';

// Gộp entry từ mọi member, nhóm theo ngày, ngày mới nhất trước.
export function buildHistory(
  logs: Record<string, DecodedMemberLog>
): DayGroup[] {
  const byDate = new Map<string, Row[]>();

  for (const [memberId, log] of Object.entries(logs)) {
    log.entries.forEach((entry, entryIndex) => {
      const row: Row = {
        memberId,
        fullName: log.fullName,
        point: entry.point,
        comment: entry.comment,
        entryIndex,
      };
      const list = byDate.get(entry.date);
      if (list) list.push(row);
      else byDate.set(entry.date, [row]);
    });
  }

  const dates = [...byDate.keys()].sort().reverse(); // mới nhất trước
  return dates.map((date) => {
    const rows = byDate.get(date) as Row[];
    const subtotal = roundTotal(rows.reduce((acc, r) => acc + r.point, 0));
    return { date, subtotal, rows };
  });
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run tests/core/history.test.ts`
Expected: PASS, toàn bộ test xanh.

- [ ] **Step 5: Chạy toàn bộ test lõi**

Run: `npm test`
Expected: PASS toàn bộ 7 file test (dateutil, validate, codec, totals, capacity, badge, history).

- [ ] **Step 6: Commit**

```bash
git add src/core/history.ts tests/core/history.test.ts
git commit -m "feat: gộp lịch sử nhiều member, nhóm theo ngày"
```

---

## Task 12: Lớp keo storage (Trello SDK)

**Files:**
- Create: `src/trello/storage.ts`

Lớp này gọi `t.get`/`t.set`, KHÔNG có unit test (test thủ công ở Task 16). Nó dùng lõi thuần để encode/decode. Quy tắc then chốt: **mỗi member chỉ ghi key `log_<memberId>` của chính mình**, triệt va chạm.

- [ ] **Step 1: Tạo khai báo kiểu tối thiểu cho SDK Trello**

Tạo `src/trello/trello-types.ts`:

```ts
// Khai báo tối thiểu cho object `t` mà Trello truyền vào.
// Không dùng @types chính thức để giữ phụ thuộc gọn.
export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
}

export interface TrelloT {
  get(scope: 'card', visibility: 'shared'): Promise<Record<string, unknown>>;
  set(scope: 'card', visibility: 'shared', key: string, value: unknown): Promise<void>;
  remove(scope: 'card', visibility: 'shared', key: string): Promise<void>;
  member(
    ...fields: Array<'id' | 'username' | 'fullName'>
  ): Promise<TrelloMember>;
}
```

- [ ] **Step 2: Tạo `src/trello/storage.ts`**

```ts
import { decodeMemberLog, encodeMemberLog } from '../core/codec';
import { measureLength, MAX_CHARS } from '../core/capacity';
import type { DecodedMemberLog, Entry } from '../core/types';
import { SCHEMA_VERSION } from '../core/types';
import type { TrelloMember, TrelloT } from './trello-types';

const LOG_PREFIX = 'log_';

export interface CardData {
  estimate: number | null;
  logs: Record<string, DecodedMemberLog>; // memberId -> log
  usedChars: number; // độ dài hiện tại của toàn bộ object card+shared
  raw: Record<string, unknown>; // bản gốc để đo dung lượng khi thử ghi
}

export async function loadCard(t: TrelloT): Promise<CardData> {
  const raw = await t.get('card', 'shared');
  const estimate = typeof raw.est === 'number' ? raw.est : null;

  const logs: Record<string, DecodedMemberLog> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith(LOG_PREFIX)) {
      const memberId = key.slice(LOG_PREFIX.length);
      logs[memberId] = decodeMemberLog(value);
    }
  }

  return { estimate, logs, usedChars: measureLength(raw), raw };
}

// Lỗi ném ra khi ghi vượt trần 4096 — UI bắt để hiện banner đỏ.
export class CapacityExceededError extends Error {
  constructor() {
    super('Card đã đầy, xóa bớt log cũ để tiếp tục');
    this.name = 'CapacityExceededError';
  }
}

// Đo trước khi ghi: thay key trong bản raw rồi đo lại. Vượt -> ném lỗi.
function assertFits(raw: Record<string, unknown>, key: string, value: unknown): void {
  const next = { ...raw, [key]: value };
  if (measureLength(next) > MAX_CHARS) throw new CapacityExceededError();
}

export async function saveEstimate(
  t: TrelloT,
  card: CardData,
  estimate: number | null
): Promise<void> {
  if (estimate === null) {
    await t.remove('card', 'shared', 'est');
    return;
  }
  assertFits(card.raw, 'est', estimate);
  await t.set('card', 'shared', 'est', estimate);
}

// Lấy log của chính member hiện tại (tạo mới nếu chưa có), làm tươi tên.
function ownLog(card: CardData, me: TrelloMember): DecodedMemberLog {
  const existing = card.logs[me.id];
  return {
    version: existing?.version ?? SCHEMA_VERSION,
    fullName: me.fullName, // làm tươi mỗi lần ghi
    username: me.username,
    entries: existing ? [...existing.entries] : [],
  };
}

async function writeOwnLog(
  t: TrelloT,
  card: CardData,
  me: TrelloMember,
  log: DecodedMemberLog
): Promise<void> {
  const key = LOG_PREFIX + me.id;
  const value = encodeMemberLog(log);
  assertFits(card.raw, key, value);
  await t.set('card', 'shared', key, value);
}

export async function saveEntry(
  t: TrelloT,
  card: CardData,
  me: TrelloMember,
  entry: Entry
): Promise<void> {
  const log = ownLog(card, me);
  log.entries.push(entry);
  await writeOwnLog(t, card, me, log);
}

export async function updateEntry(
  t: TrelloT,
  card: CardData,
  me: TrelloMember,
  entryIndex: number,
  entry: Entry
): Promise<void> {
  const log = ownLog(card, me);
  log.entries[entryIndex] = entry;
  await writeOwnLog(t, card, me, log);
}

export async function deleteEntry(
  t: TrelloT,
  card: CardData,
  me: TrelloMember,
  entryIndex: number
): Promise<void> {
  const log = ownLog(card, me);
  log.entries.splice(entryIndex, 1);
  const key = LOG_PREFIX + me.id;
  if (log.entries.length === 0) {
    await t.remove('card', 'shared', key);
  } else {
    await t.set('card', 'shared', key, encodeMemberLog(log));
  }
}
```

- [ ] **Step 3: Verify TS biên dịch sạch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 4: Commit**

```bash
git add src/trello/trello-types.ts src/trello/storage.ts
git commit -m "feat: lớp keo storage, mỗi member chỉ ghi key của mình + chặn 4096"
```

---

## Task 13: Connector + badges

**Files:**
- Create: `index.html`
- Create: `src/connector.ts`

Connector là iframe Trello load đầu tiên. Nó gọi `TrelloPowerUp.initialize` với hai capability: `card-badges` (badge mặt card) và `card-detail-badges` (nút mở popup). Badge dùng lõi `formatBadge` + `sumEntries`.

- [ ] **Step 1: Tạo `index.html`**

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>Point System Connector</title>
    <script src="https://p.trellocdn.com/power-up.min.js"></script>
  </head>
  <body>
    <script type="module" src="/src/connector.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Tạo khai báo global cho `TrelloPowerUp`**

Tạo `src/trello/global.d.ts`:

```ts
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

interface PowerUp {
  initialize(capabilities: {
    'card-badges'?: (t: TrelloT) => Promise<BadgeResult[]>;
    'card-detail-badges'?: (t: TrelloT) => Promise<DetailBadgeResult[]>;
  }): void;
}

declare global {
  interface Window {
    TrelloPowerUp: PowerUp;
  }
  const TrelloPowerUp: PowerUp;
}

export {};
```

- [ ] **Step 3: Tạo `src/connector.ts`**

```ts
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

TrelloPowerUp.initialize({
  'card-badges': async (t) => {
    const card = await loadCard(t);
    const logged = sumEntries(Object.values(card.logs).flatMap((l) => l.entries));
    const badge = formatBadge(logged, card.estimate);
    if (!badge) return [];
    return [{ text: `${ICON} ${badge.text}`, color: badge.color === 'orange' ? 'orange' : undefined }];
  },

  'card-detail-badges': async (t) => {
    const text = await computeBadgeText(t);
    return [
      {
        title: 'Point',
        text: text ? `Log point · ${text}` : 'Log point',
        callback: (t2: TrelloT) => {
          (t2 as unknown as { popup: (o: object) => void }).popup({
            title: 'Point System',
            url: './popup.html',
            height: 480,
          });
        },
      },
    ];
  },
});
```

- [ ] **Step 4: Verify build chạy (tsc + vite build)**

Run: `npm run build`
Expected: build thành công, sinh `dist/index.html` và `dist/popup.html`. Nếu lỗi vì `popup.html` chưa tồn tại, tạm tạo file rỗng rồi build lại — Task 14 sẽ điền nội dung. (Để qua được build ở bước này, tạo `popup.html` tối thiểu: `<!doctype html><html><body></body></html>`.)

- [ ] **Step 5: Commit**

```bash
git add index.html popup.html src/connector.ts src/trello/global.d.ts
git commit -m "feat: connector + card badges (mặt card và chi tiết)"
```

---

## Task 14: Popup UI

**Files:**
- Create: `popup.html`
- Create: `src/ui/popup.ts`
- Create: `src/ui/popup.css`

Popup là một trang riêng. Render estimate + thanh dung lượng + form log (luôn mở) + lịch sử nhóm theo ngày. Nút ✎/🗑 chỉ trên dòng của chính mình. Xóa có xác nhận một bước tại chỗ.

- [ ] **Step 1: Viết `popup.html` đầy đủ**

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>Point System</title>
    <script src="https://p.trellocdn.com/power-up.min.js"></script>
    <link rel="stylesheet" href="/src/ui/popup.css" />
  </head>
  <body>
    <div id="app">
      <div id="capacity-banner" class="banner hidden"></div>

      <section class="block">
        <label>Estimate
          <input id="estimate" type="number" min="0" max="100" step="0.1" placeholder="—" />
          <span class="unit">point</span>
        </label>
        <div id="capacity-bar" class="capbar"><span></span></div>
        <div id="capacity-text" class="captext"></div>
      </section>

      <section class="block">
        <strong>+ Log point</strong>
        <label>Point <input id="log-point" type="number" min="0" max="100" step="0.1" /></label>
        <label>Ngày <input id="log-date" type="date" /></label>
        <label>Ghi chú <input id="log-comment" type="text" /></label>
        <div id="log-error" class="error"></div>
        <button id="log-save">Lưu log</button>
      </section>

      <section class="block">
        <div class="history-head"><span>Lịch sử</span><span id="grand-total"></span></div>
        <div id="history"></div>
      </section>
    </div>
    <script type="module" src="/src/ui/popup.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Viết `src/ui/popup.css` (tối giản)**

```css
body { font: 13px/1.4 -apple-system, system-ui, sans-serif; margin: 0; padding: 10px; width: 320px; }
.block { padding: 8px 0; border-bottom: 1px solid #eee; }
label { display: block; margin: 4px 0; }
input[type="text"], input[type="number"], input[type="date"] { width: 100%; box-sizing: border-box; padding: 4px; }
.unit { color: #888; }
.capbar { height: 8px; background: #eee; border-radius: 4px; overflow: hidden; margin: 4px 0; }
.capbar > span { display: block; height: 100%; background: #5aac44; width: 0; }
.capbar.warn > span { background: #f2d600; }
.capbar.danger > span { background: #eb5a46; }
.captext { color: #666; font-size: 12px; }
.error { color: #eb5a46; min-height: 16px; }
.banner { background: #eb5a46; color: #fff; padding: 6px; border-radius: 4px; margin-bottom: 8px; }
.hidden { display: none; }
.history-head { display: flex; justify-content: space-between; font-weight: bold; }
.day-head { margin-top: 6px; color: #555; }
.row { display: flex; gap: 6px; align-items: center; padding: 2px 0; }
.row .name { width: 70px; }
.row .pt { width: 36px; text-align: right; }
.row .cm { flex: 1; color: #666; }
.row button { border: none; background: none; cursor: pointer; }
.empty { color: #aaa; font-style: italic; }
.button-primary { background: #5aac44; color: #fff; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; }
</style>
```

(Bỏ dòng `</style>` thừa cuối nếu IDE thêm — đây là file `.css` thuần.)

- [ ] **Step 3: Viết `src/ui/popup.ts`**

```ts
import { formatBadge } from '../core/badge';
import { capacityInfo } from '../core/capacity';
import { formatDayLabel, todayLocal } from '../core/dateutil';
import { buildHistory } from '../core/history';
import { sumEntries } from '../core/totals';
import { validateDate, validateEstimate, validatePoint } from '../core/validate';
import {
  CapacityExceededError,
  deleteEntry,
  loadCard,
  saveEntry,
  saveEstimate,
  updateEntry,
  type CardData,
} from '../trello/storage';
import type { TrelloMember, TrelloT } from '../trello/trello-types';
import type { Entry } from '../core/types';

const t = (window.TrelloPowerUp as unknown as { iframe: () => TrelloT }).iframe();

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Thiếu phần tử #${id}`);
  return el;
}

let me: TrelloMember;
let card: CardData;

async function refresh(): Promise<void> {
  card = await loadCard(t);
  renderCapacity();
  renderEstimateField();
  renderHistory();
}

function renderEstimateField(): void {
  const input = $('estimate') as HTMLInputElement;
  if (document.activeElement !== input) {
    input.value = card.estimate === null ? '' : String(card.estimate);
  }
}

function renderCapacity(): void {
  const info = capacityInfo(card.usedChars);
  const bar = $('capacity-bar');
  bar.className = `capbar ${info.level === 'ok' ? '' : info.level}`.trim();
  (bar.firstElementChild as HTMLElement).style.width = `${info.percent}%`;
  $('capacity-text').textContent = `${info.percent}% (${info.used}/${info.max})`;
}

function renderHistory(): void {
  const entries = Object.values(card.logs).flatMap((l) => l.entries);
  const logged = sumEntries(entries);
  const badge = formatBadge(logged, card.estimate);
  $('grand-total').textContent = badge ? `Tổng: ${badge.text}` : 'Tổng: 0';

  const groups = buildHistory(card.logs);
  const host = $('history');
  host.innerHTML = '';
  if (groups.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Chưa có log nào';
    host.appendChild(empty);
    return;
  }

  for (const g of groups) {
    const head = document.createElement('div');
    head.className = 'day-head';
    head.textContent = `${formatDayLabel(g.date)}  (${g.subtotal})`;
    host.appendChild(head);

    for (const row of g.rows) {
      const div = document.createElement('div');
      div.className = 'row';
      const isMine = row.memberId === me.id;
      div.innerHTML =
        `<span class="name">${escapeHtml(row.fullName)}</span>` +
        `<span class="pt">${row.point}</span>` +
        `<span class="cm">${escapeHtml(row.comment)}</span>`;
      if (isMine) div.appendChild(makeRowActions(row.entryIndex));
      host.appendChild(div);
    }
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function makeRowActions(entryIndex: number): HTMLElement {
  const wrap = document.createElement('span');

  const edit = document.createElement('button');
  edit.textContent = '✎';
  edit.onclick = () => beginEdit(entryIndex);

  const del = document.createElement('button');
  del.textContent = '🗑';
  del.onclick = () => beginDelete(wrap, entryIndex);

  wrap.append(edit, del);
  return wrap;
}

// Xác nhận xóa một bước tại chỗ: 🗑 -> "Chắc chứ? ✓/✗".
function beginDelete(wrap: HTMLElement, entryIndex: number): void {
  wrap.innerHTML = 'Chắc chứ? ';
  const yes = document.createElement('button');
  yes.textContent = '✓';
  yes.onclick = async () => {
    await guarded(() => deleteEntry(t, card, me, entryIndex));
    await refresh();
    await t.render?.();
  };
  const no = document.createElement('button');
  no.textContent = '✗';
  no.onclick = () => renderHistory();
  wrap.append(yes, no);
}

// Sửa: nạp entry vào form, đổi nút Lưu thành cập nhật.
function beginEdit(entryIndex: number): void {
  const log = card.logs[me.id];
  if (!log) return;
  const entry = log.entries[entryIndex];
  if (!entry) return;
  ($('log-point') as HTMLInputElement).value = String(entry.point);
  ($('log-date') as HTMLInputElement).value = entry.date;
  ($('log-comment') as HTMLInputElement).value = entry.comment;
  editingIndex = entryIndex;
  ($('log-save') as HTMLButtonElement).textContent = 'Cập nhật log';
}

let editingIndex: number | null = null;

async function onSaveLog(): Promise<void> {
  const errBox = $('log-error');
  errBox.textContent = '';

  const today = todayLocal(new Date());
  const pRes = validatePoint(($('log-point') as HTMLInputElement).value);
  if (!pRes.ok) { errBox.textContent = pRes.error; return; }

  const dateStr = ($('log-date') as HTMLInputElement).value;
  const dRes = validateDate(dateStr, today);
  if (!dRes.ok) { errBox.textContent = dRes.error; return; }

  const entry: Entry = {
    date: dateStr,
    point: pRes.value,
    comment: ($('log-comment') as HTMLInputElement).value.trim(),
  };

  const ok = await guarded(async () => {
    if (editingIndex === null) await saveEntry(t, card, me, entry);
    else await updateEntry(t, card, me, editingIndex, entry);
  });
  if (!ok) return;

  editingIndex = null;
  ($('log-save') as HTMLButtonElement).textContent = 'Lưu log';
  ($('log-point') as HTMLInputElement).value = '';
  ($('log-comment') as HTMLInputElement).value = '';
  await refresh();
  await t.render?.();
}

async function onSaveEstimate(): Promise<void> {
  const res = validateEstimate(($('estimate') as HTMLInputElement).value);
  if (!res.ok) { showBanner(res.error); return; }
  const ok = await guarded(() => saveEstimate(t, card, res.value));
  if (!ok) return;
  await refresh();
  await t.render?.();
}

// Bọc thao tác ghi: bắt CapacityExceededError -> banner đỏ, giữ nội dung gõ.
async function guarded(fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    hideBanner();
    return true;
  } catch (e) {
    if (e instanceof CapacityExceededError) showBanner(e.message);
    else showBanner('Lỗi lưu dữ liệu, thử lại');
    return false;
  }
}

function showBanner(msg: string): void {
  const b = $('capacity-banner');
  b.textContent = msg;
  b.classList.remove('hidden');
}
function hideBanner(): void {
  $('capacity-banner').classList.add('hidden');
}

async function init(): Promise<void> {
  me = await t.member('id', 'username', 'fullName');
  ($('log-date') as HTMLInputElement).max = todayLocal(new Date());
  ($('log-date') as HTMLInputElement).value = todayLocal(new Date());
  ($('log-save') as HTMLButtonElement).onclick = onSaveLog;
  ($('estimate') as HTMLInputElement).onchange = onSaveEstimate;
  await refresh();
  await t.sizeTo?.('#app');
}

init().catch(() => showBanner('Không tải được dữ liệu card'));
```

- [ ] **Step 4: Bổ sung kiểu cho `t` (render, sizeTo, iframe)**

Cập nhật `src/trello/trello-types.ts`, thêm vào interface `TrelloT`:

```ts
  remove(scope: 'card', visibility: 'shared', key: string): Promise<void>;
  render?(): Promise<void>;
  sizeTo?(selector: string): Promise<void>;
  popup?(opts: { title: string; url: string; height?: number }): void;
```

(Giữ các method `get`/`set`/`member` đã có. `render`/`sizeTo`/`popup` để optional vì chỉ dùng trong iframe context.)

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: `npm run build` chạy `tsc --noEmit` rồi `vite build`, không lỗi type, sinh `dist/` với cả `index.html` + `popup.html`.

- [ ] **Step 6: Commit**

```bash
git add popup.html src/ui/popup.ts src/ui/popup.css src/trello/trello-types.ts
git commit -m "feat: popup UI estimate + form log + lịch sử + xóa xác nhận một bước"
```

---

## Task 15: Chạy toàn bộ test + build sạch

**Files:** không sửa, chỉ verify.

- [ ] **Step 1: Chạy toàn bộ unit test lõi**

Run: `npm test`
Expected: PASS toàn bộ 7 file test, 0 fail.

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: không lỗi type, `dist/` chứa `index.html`, `popup.html`, và assets.

- [ ] **Step 3: Preview cục bộ (kiểm tra trang load)**

Run: `npm run preview`
Expected: server chạy, mở được `index.html` và `popup.html` không lỗi console nghiêm trọng (badge/popup chưa hoạt động vì ngoài Trello — đó là bình thường).

- [ ] **Step 4: Commit (nếu có thay đổi lock/config)**

```bash
git add -A
git commit -m "chore: verify test xanh + build sạch" || echo "không có gì để commit"
```

---

## Task 16: Triển khai + kiểm thử thủ công trên board thật

**Files:** không sửa code. Đây là checklist deploy + manual test cho lớp keo SDK (spec mục 6: test thủ công).

- [ ] **Step 1: Deploy lên Cloudflare Pages**

- Tạo project Cloudflare Pages trỏ vào repo (hoặc `wrangler pages deploy dist`).
- Build command: `npm run build`. Output dir: `dist`.
- Ghi lại URL HTTPS, ví dụ `https://point-system.pages.dev`.

- [ ] **Step 2: Đăng ký Power-Up private**

- Vào `https://trello.com/power-ups/admin`, tạo Power-Up mới (nội bộ workspace).
- Iframe connector URL: `https://<your-app>.pages.dev/index.html`.
- Bật capabilities: `card-badges`, `card-detail-badges`.

- [ ] **Step 3: Bật Power-Up trên một board test và kiểm tra badge mặt card**

Kịch bản kiểm tra (đối chiếu spec mục 5):
- Card trống cả hai: KHÔNG hiện badge.
- Set estimate 8, chưa log: badge `🎯 0/8`.
- Log 6.5: badge `🎯 6.5/8`.
- Log vượt thành 9: badge `🎯 9/8` màu **cam**.
- Card có log, xóa estimate: badge `🎯 9` (ẩn mẫu số).

- [ ] **Step 4: Kiểm tra popup (detail badge)**

- Mở card, bấm nút `Log point · …` → popup mở.
- Form log luôn mở. Ngày mặc định hôm nay, date picker không cho chọn tương lai.
- Nhập point sai (`0`, `-1`, `1.25`, `101`, rỗng) → báo lỗi đỏ dưới ô, không lưu.
- Nhập hợp lệ → lưu, lịch sử cập nhật, badge cập nhật.
- Lịch sử nhóm theo ngày, ngày mới nhất trên cùng, mỗi ngày có tổng phụ.

- [ ] **Step 5: Kiểm tra quyền + xóa**

- Đăng nhập member A, log một entry. Member B mở card: thấy log của A nhưng KHÔNG có nút ✎/🗑 trên dòng của A.
- Member A: bấm 🗑 → đổi thành "Chắc chứ? ✓/✗". Bấm ✗ huỷ, ✓ xóa.
- Member A sửa entry của mình qua ✎ → form nạp sẵn, đổi nút "Cập nhật log".

- [ ] **Step 6: Kiểm tra va chạm đồng thời**

- Member A và B cùng mở một card, mỗi người log một entry gần như đồng thời.
- Reload: cả hai entry còn nguyên (vì tách key `log_<id>`, không đè nhau).

- [ ] **Step 7: Kiểm tra dung lượng 4096**

- Log nhiều entry đến khi thanh % vào vùng vàng (80%) rồi đỏ (92%).
- Log tiếp đến khi `t.set` reject: hiện banner đỏ "Card đã đầy, xóa bớt log cũ để tiếp tục", nội dung đang gõ GIỮ NGUYÊN.

- [ ] **Step 8: Kiểm tra member rời board**

- Member rời board: tên vẫn hiện từ header `n` đã lưu trong log.

- [ ] **Step 9: Ghi nhận kết quả**

Tạo `docs/superpowers/manual-test-2026-06-06.md` ghi pass/fail từng bước. Commit:

```bash
git add docs/superpowers/manual-test-2026-06-06.md
git commit -m "docs: kết quả kiểm thử thủ công trên board thật"
```

---

## Self-Review (đã chạy)

**1. Spec coverage:**
- Estimate (mục 4): Task 6 validate, Task 12 lưu key `est`, Task 14 form. ✔
- Log point + quy tắc point/ngày (mục 4): Task 4, 5, 12, 14. ✔
- Chặn ngày tương lai: Task 5 + Task 14 (date max). ✔
- Tự nhận diện member qua `t.member`: Task 14 init. ✔
- Quyền (chỉ chủ nhân sửa/xóa): Task 14 `isMine`. ✔
- Xóa xác nhận một bước: Task 14 `beginDelete`. ✔
- Làm tròn (mục 4): Task 8. ✔
- Dung lượng 4096 + thanh % + banner đỏ + giữ nội dung (mục 4): Task 9, 12, 14. ✔
- Badge mặt card + 4 trạng thái + màu cam (mục 5): Task 10, 13. ✔
- Detail badge mở popup (mục 5): Task 13. ✔
- Popup nhóm theo ngày + tổng phụ + tổng chung (mục 5): Task 11, 14. ✔
- Trạng thái rỗng/lỗi (mục 5): Task 14 ("Chưa có log nào", banner lỗi). ✔
- Tách key theo member chống va chạm (mục 3): Task 12. ✔
- Decode phòng thủ + member rời board (mục 5): Task 7, 12. ✔
- Test lõi Vitest (mục 6): Task 3-11. Test thủ công (mục 6): Task 16. ✔
- Tech stack (mục 2): Task 1. ✔

**2. Placeholder scan:** Không có "TBD/TODO/implement later". Mọi step code có code thật.

**3. Type consistency:** `Entry`, `MemberLog`, `DecodedMemberLog`, `Row`, `DayGroup` định nghĩa ở Task 2, dùng nhất quán. `CardData`, `CapacityExceededError` định nghĩa Task 12, dùng Task 14. Hàm storage (`loadCard`, `saveEstimate`, `saveEntry`, `updateEntry`, `deleteEntry`) ký tên khớp giữa Task 12 và Task 14. `formatBadge(logged, estimate)`, `sumEntries`, `capacityInfo`, `buildHistory` khớp chữ ký xuyên task.
