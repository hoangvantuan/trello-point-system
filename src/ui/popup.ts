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
