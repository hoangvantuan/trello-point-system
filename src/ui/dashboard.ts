import { APP_KEY, APP_NAME, PLUGIN_ID } from '../config';
import {
  aggregateByList, aggregateByUser, breakdown, collectEntries,
  granularityFor, periodRange,
} from '../core/stats';
import type { BreakdownBucket, TimeFilter } from '../core/stats-types';
import { fetchBoardStats, UnauthorizedError, type BoardStats } from '../trello/fetch-board';
import type { TrelloRestApi } from '../trello/trello-types';

const t = window.TrelloPowerUp.iframe({
  appKey: APP_KEY,
  appName: APP_NAME,
});

const FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
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
  if (!el) throw new Error(`Missing element #${id}`);
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
  if (!ctx) throw new Error('Missing board context');
  return ctx.board;
}

async function restApiClient(): Promise<TrelloRestApi | null> {
  return (await t.getRestApi?.()) ?? null;
}

async function load(): Promise<void> {
  if (loading) return;
  loading = true;
  showOnly('state-loading');
  try {
    const restApi = await restApiClient();
    if (!restApi) throw new Error('REST API unavailable');
    data = await fetchBoardStats(restApi, boardId(), PLUGIN_ID, APP_KEY);
    fetchedAt = new Date();
    render();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      const restApi = await restApiClient();
      await restApi?.clearToken();
      showOnly('state-auth');
    } else {
      $('error-msg').textContent = `Load error: ${e instanceof Error ? e.message : String(e)}`;
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
    `<th class="num">Est</th><th class="num">Log</th><th>Progress</th></tr></thead>` +
    `<tbody>${body}</tbody>` +
    `<tfoot><tr><td>TOTAL</td><td class="num">${agg.totalCards}</td>` +
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
    `${escapeHtml(r.fullName || '(anonymous)')}</td>` +
    `<td class="num">${r.entries}</td><td class="num">${r.logged}</td></tr>`
  ).join('');

  $('table-host').innerHTML =
    `<table class="stat"><thead><tr><th>User</th><th class="num">Entries</th>` +
    `<th class="num">Total Log</th></tr></thead>` +
    `<tbody>${body}</tbody>` +
    `<tfoot><tr><td>TOTAL</td><td class="num">${agg.totalEntries}</td>` +
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

  host.innerHTML = `<div class="bk-title">Breakdown by period</div>${rows}`;
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
  const restApi = await restApiClient();
  if (!restApi) {
    $('error-msg').textContent = 'REST API unavailable from the dashboard iframe';
    showOnly('state-error');
    return;
  }
  const token = await restApi.getToken();
  if (!token) { showOnly('state-auth'); return; } // lazy: chờ user bấm "Authorize & load"
  await load();
}

init().catch((e) => {
  $('error-msg').textContent = `Init error: ${e instanceof Error ? e.message : String(e)}`;
  showOnly('state-error');
});
