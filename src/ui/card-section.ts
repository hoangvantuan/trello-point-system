import { todayLocal } from '../core/dateutil';
import { roundTotal, sumEntries } from '../core/totals';
import { validateEstimate, validatePoint } from '../core/validate';
import {
  CapacityExceededError,
  deleteEntry,
  loadCard,
  saveEntry,
  saveEstimate,
  type CardData,
} from '../trello/storage';
import type { TrelloMember, TrelloT } from '../trello/trello-types';
import type { Entry } from '../core/types';

const t = (window.TrelloPowerUp as unknown as { iframe: () => TrelloT }).iframe();

const QUICK_POINTS = [0.5, 1, 2, 3, 5, 8];
const UNDO_MS = 3000;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

let me: TrelloMember;
let card: CardData;
let undoTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedIndex: number | null = null;

/* ================================================================
   RENDER
   ================================================================ */

async function refresh(): Promise<void> {
  card = await loadCard(t);
  renderSummary();
  renderEstimate();
  renderTodayLine();
  t.sizeTo?.('#app').catch(() => {});
}

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

function renderEstimate(): void {
  $('est-display').textContent = card.estimate === null ? '—' : String(card.estimate);
}

function renderTodayLine(): void {
  const today = todayLocal(new Date());
  const parts: string[] = [];

  for (const log of Object.values(card.logs)) {
    const todayPts = log.entries
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + e.point, 0);
    if (todayPts > 0) {
      parts.push(`${roundTotal(todayPts)} (${log.fullName})`);
    }
  }

  const el = $('today-line');
  if (parts.length === 0) {
    el.textContent = 'Hôm nay: chưa có log';
    el.className = 'today-line muted';
  } else {
    el.textContent = `Hôm nay: ${parts.join(' · ')}`;
    el.className = 'today-line';
  }
}

/* ================================================================
   QUICK LOG (1-tap chip)
   ================================================================ */

function buildChips(): void {
  const host = $('quick-chips');
  host.innerHTML = '';

  for (const v of QUICK_POINTS) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.textContent = String(v);
    chip.onclick = () => void quickLog(v);
    host.appendChild(chip);
  }

  const plus = document.createElement('button');
  plus.className = 'chip chip-plus';
  plus.type = 'button';
  plus.textContent = '+';
  plus.onclick = showCustomInput;
  host.appendChild(plus);
}

let customCommitted = false;

function showCustomInput(): void {
  customCommitted = false;
  const host = $('quick-chips');
  const plusBtn = host.querySelector('.chip-plus');
  if (!plusBtn) return;

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'chip-input';
  input.min = '0';
  input.max = '100';
  input.step = '0.1';
  input.placeholder = '0';

  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const res = validatePoint(input.value);
      if (res.ok) {
        customCommitted = true;
        void quickLog(res.value);
      } else {
        showError(res.error);
      }
    } else if (e.key === 'Escape') {
      buildChips();
    }
  };

  input.onblur = () => {
    if (!customCommitted) buildChips();
  };

  plusBtn.replaceWith(input);
  input.focus();
}

async function quickLog(point: number): Promise<void> {
  const today = todayLocal(new Date());
  const entry: Entry = { date: today, point, comment: '' };

  try {
    await saveEntry(t, card, me, entry);
  } catch (e) {
    showError(e instanceof CapacityExceededError ? e.message : 'Lỗi lưu dữ liệu');
    return;
  }

  card = await loadCard(t);
  const myLog = card.logs[me.id];
  lastSavedIndex = myLog ? myLog.entries.length - 1 : null;

  showUndoToast(point);
  renderSummary();
  renderEstimate();
  renderTodayLine();

}

/* ================================================================
   UNDO TOAST
   ================================================================ */

function showUndoToast(point: number): void {
  if (undoTimer !== null) clearTimeout(undoTimer);

  $('chips-row').classList.add('hidden');
  const toast = $('undo-toast');
  toast.classList.remove('hidden');
  $('undo-msg').textContent = `✓ Đã ghi ${point} điểm`;

  undoTimer = setTimeout(hideUndoToast, UNDO_MS);
}

function hideUndoToast(): void {
  if (undoTimer !== null) {
    clearTimeout(undoTimer);
    undoTimer = null;
  }
  lastSavedIndex = null;
  $('undo-toast').classList.add('hidden');
  $('chips-row').classList.remove('hidden');
  buildChips();
}

async function onUndo(): Promise<void> {
  if (lastSavedIndex === null) return;

  try {
    await deleteEntry(t, card, me, lastSavedIndex);
  } catch {
    return;
  }

  hideUndoToast();
  await refresh();

}

/* ================================================================
   ESTIMATE CLICK-TO-EDIT
   ================================================================ */

function onEstClick(e: Event): void {
  e.stopPropagation();
  const display = $('est-display');
  const input = $('est-input') as HTMLInputElement;

  input.value = card.estimate === null ? '' : String(card.estimate);
  display.classList.add('hidden');
  input.classList.remove('hidden');
  input.focus();
  input.select();
  t.sizeTo?.('#app').catch(() => {});
}

async function commitEstimate(): Promise<void> {
  const input = $('est-input') as HTMLInputElement;
  const res = validateEstimate(input.value);

  if (res.ok) {
    try {
      await saveEstimate(t, card, res.value);
    } catch (e) {
      showError(e instanceof CapacityExceededError ? e.message : 'Lỗi lưu estimate');
    }
  }

  input.classList.add('hidden');
  $('est-display').classList.remove('hidden');
  await refresh();

}

function cancelEstimate(): void {
  ($('est-input') as HTMLInputElement).classList.add('hidden');
  $('est-display').classList.remove('hidden');
}

/* ================================================================
   ERROR FEEDBACK
   ================================================================ */

let errorTimer: ReturnType<typeof setTimeout> | null = null;

function showError(msg: string): void {
  if (errorTimer !== null) clearTimeout(errorTimer);
  const el = $('error-line');
  el.textContent = msg;
  el.classList.remove('hidden');
  errorTimer = setTimeout(() => {
    el.classList.add('hidden');
    errorTimer = null;
  }, 4000);
}

/* ================================================================
   OPEN MODAL
   ================================================================ */

function openModal(): void {
  t.modal?.({
    title: 'Point System',
    url: './popup.html',
    fullscreen: false,
    height: 560,
  });
}

/* ================================================================
   INIT
   ================================================================ */

async function init(): Promise<void> {
  me = await t.member('id', 'username', 'fullName');

  buildChips();

  $('summary').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#est-area')) return;
    openModal();
  });

  $('est-area').onclick = onEstClick;

  const estInput = $('est-input') as HTMLInputElement;
  estInput.onblur = () => void commitEstimate();
  estInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      estInput.blur();
    }
    if (e.key === 'Escape') cancelEstimate();
  };

  $('undo-btn').onclick = () => void onUndo();

  t.render?.(() => void refresh());

  await refresh();
}

init().catch((e) => {
  console.error('[card-section] init failed', e);
});
