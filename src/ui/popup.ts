import { formatBadge } from '../core/badge';
import { capacityInfo } from '../core/capacity';
import { formatDayLabel, todayLocal } from '../core/dateutil';
import { buildHistory } from '../core/history';
import { roundTotal, sumEntries } from '../core/totals';
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

// Các mốc point quen thuộc (kiểu scrum) để điền nhanh.
const QUICK_POINTS = [0.5, 1, 2, 3, 5, 8];

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Thiếu phần tử #${id}`);
  return el;
}

let me: TrelloMember;
let card: CardData;
let editingIndex: number | null = null;

async function refresh(): Promise<void> {
  card = await loadCard(t);
  renderSummary();
  renderEstimateField();
  renderCapacity();
  renderHistory();
  await t.sizeTo?.('#app');
}

function renderEstimateField(): void {
  const input = $('estimate') as HTMLInputElement;
  if (document.activeElement !== input) {
    input.value = card.estimate === null ? '' : String(card.estimate);
  }
}

// Bảng cân đối: đã log so với mục tiêu (estimate). Đây là tiến độ point THẬT.
function renderSummary(): void {
  const entries = Object.values(card.logs).flatMap((l) => l.entries);
  const logged = sumEntries(entries);
  const estimate = card.estimate;

  $('sum-logged').textContent = String(logged);
  const target = $('sum-estimate');
  const bar = $('progress-bar');
  const fill = bar.firstElementChild as HTMLElement;
  const meta = $('sum-meta');

  if (estimate === null) {
    target.textContent = '/ —';
    fill.style.width = '0%';
    bar.className = 'progress empty';
    meta.textContent = 'Chưa đặt mục tiêu';
    meta.className = 'sum-meta muted';
    return;
  }

  const pct = estimate === 0 ? 0 : Math.round((logged / estimate) * 100);
  target.textContent = `/ ${estimate}`;
  fill.style.width = `${Math.min(100, pct)}%`;

  if (logged > estimate) {
    const over = roundTotal(logged - estimate);
    bar.className = 'progress over';
    meta.textContent = `${pct}% · vượt ${over}`;
    meta.className = 'sum-meta over';
  } else {
    const left = roundTotal(estimate - logged);
    bar.className = `progress ${pct >= 100 ? 'done' : ''}`.trim();
    meta.textContent = `${pct}% · còn ${left}`;
    meta.className = 'sum-meta';
  }
}

// Dung lượng lưu trữ pluginData. Kín đáo, chỉ nổi bật khi sắp đầy.
function renderCapacity(): void {
  const info = capacityInfo(card.usedChars);
  const bar = $('capacity-bar');
  bar.className = `capbar ${info.level === 'ok' ? '' : info.level}`.trim();
  (bar.firstElementChild as HTMLElement).style.width = `${info.percent}%`;
  $('capacity-text').textContent = `Bộ nhớ thẻ ${info.percent}%`;
}

function renderHistory(): void {
  const entries = Object.values(card.logs).flatMap((l) => l.entries);
  const logged = sumEntries(entries);
  const badge = formatBadge(logged, card.estimate);
  $('grand-total').textContent = badge ? badge.text : '0';

  const groups = buildHistory(card.logs);
  const host = $('history');
  host.innerHTML = '';
  if (groups.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Chưa có log nào. Ghi mốc đầu tiên ở trên.';
    host.appendChild(empty);
    return;
  }

  for (const g of groups) {
    const head = document.createElement('div');
    head.className = 'day-head';
    head.innerHTML =
      `<span class="day-date">${formatDayLabel(g.date)}</span>` +
      `<span class="day-sub">${g.subtotal}</span>`;
    host.appendChild(head);

    for (const row of g.rows) {
      const div = document.createElement('div');
      const isMine = row.memberId === me.id;
      div.className = `row${isMine ? ' mine' : ''}`;
      div.innerHTML =
        `<span class="pt">${row.point}</span>` +
        `<span class="rmain">` +
        `<span class="name">${escapeHtml(row.fullName)}</span>` +
        (row.comment ? `<span class="cm">${escapeHtml(row.comment)}</span>` : '') +
        `</span>`;
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
  wrap.className = 'row-actions';

  const edit = document.createElement('button');
  edit.className = 'icon-btn';
  edit.title = 'Sửa';
  edit.setAttribute('aria-label', 'Sửa');
  edit.textContent = '✎';
  edit.onclick = () => beginEdit(entryIndex);

  const del = document.createElement('button');
  del.className = 'icon-btn';
  del.title = 'Xóa';
  del.setAttribute('aria-label', 'Xóa');
  del.textContent = '🗑';
  del.onclick = () => beginDelete(wrap, entryIndex);

  wrap.append(edit, del);
  return wrap;
}

// Xác nhận xóa một bước tại chỗ: 🗑 -> "Xóa? ✓/✗".
function beginDelete(wrap: HTMLElement, entryIndex: number): void {
  wrap.innerHTML = '<span class="confirm-q">Xóa?</span>';
  const yes = document.createElement('button');
  yes.className = 'icon-btn danger';
  yes.textContent = '✓';
  yes.title = 'Xác nhận xóa';
  yes.onclick = async () => {
    await guarded(() => deleteEntry(t, card, me, entryIndex));
    await refresh();
    await t.render?.();
  };
  const no = document.createElement('button');
  no.className = 'icon-btn';
  no.textContent = '✗';
  no.title = 'Hủy';
  no.onclick = () => renderHistory();
  wrap.append(yes, no);
}

// Sửa: nạp entry vào form, đổi nút Lưu thành cập nhật, hiện nút Hủy.
function beginEdit(entryIndex: number): void {
  const log = card.logs[me.id];
  if (!log) return;
  const entry = log.entries[entryIndex];
  if (!entry) return;
  ($('log-point') as HTMLInputElement).value = String(entry.point);
  ($('log-date') as HTMLInputElement).value = entry.date;
  ($('log-comment') as HTMLInputElement).value = entry.comment;
  editingIndex = entryIndex;
  setEditMode(true);
  ($('log-point') as HTMLInputElement).focus();
}

function setEditMode(on: boolean): void {
  ($('log-save') as HTMLButtonElement).textContent = on ? 'Cập nhật' : 'Lưu log';
  $('log-cancel').classList.toggle('hidden', !on);
  $('log-section').classList.toggle('editing', on);
}

function resetForm(): void {
  editingIndex = null;
  setEditMode(false);
  ($('log-point') as HTMLInputElement).value = '';
  ($('log-comment') as HTMLInputElement).value = '';
  ($('log-error') as HTMLElement).textContent = '';
  clearActiveChip();
}

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

  resetForm();
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

// Quick chips: điền nhanh point, chừa ngày + ghi chú cho người dùng.
function buildQuickChips(): void {
  const host = $('quick-points');
  for (const v of QUICK_POINTS) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.dataset.val = String(v);
    chip.textContent = String(v);
    chip.onclick = () => {
      const input = $('log-point') as HTMLInputElement;
      input.value = String(v);
      setActiveChip(chip);
      input.focus();
    };
    host.appendChild(chip);
  }
}

function setActiveChip(active: HTMLElement): void {
  for (const c of document.querySelectorAll('#quick-points .chip')) {
    c.classList.toggle('active', c === active);
  }
}
function clearActiveChip(): void {
  for (const c of document.querySelectorAll('#quick-points .chip')) {
    c.classList.remove('active');
  }
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
  const dateInput = $('log-date') as HTMLInputElement;
  dateInput.max = todayLocal(new Date());
  dateInput.value = todayLocal(new Date());

  buildQuickChips();
  ($('log-save') as HTMLButtonElement).onclick = onSaveLog;
  ($('log-cancel') as HTMLButtonElement).onclick = resetForm;
  ($('estimate') as HTMLInputElement).onchange = onSaveEstimate;

  // Enter trong ô point hoặc ghi chú -> lưu nhanh.
  for (const id of ['log-point', 'log-comment']) {
    ($(id) as HTMLInputElement).addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        e.preventDefault();
        void onSaveLog();
      }
    });
  }
  // Gõ tay point -> bỏ trạng thái chip đang chọn.
  ($('log-point') as HTMLInputElement).addEventListener('input', clearActiveChip);

  await refresh();
}

init().catch(() => showBanner('Không tải được dữ liệu card'));
