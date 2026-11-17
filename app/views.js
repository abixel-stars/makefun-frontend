// The four surfaces, each a function from API data to an HTML string.
// Views never fetch and never touch the DOM: the router in main.js calls
// them, drops the string into #view, and wires up the controls.

import { count, esc, money, percent, pot, shortAddr, shortDate, stamp, stillOpen, timeLeft } from './format.js';
import { renderMd } from './md.js';

const API_ORIGIN = 'https://make.fun';

function avatarUrl(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : API_ORIGIN + path;
}

function avatar(handle, image) {
  const url = avatarUrl(image);
  const initial = esc((handle || '?').slice(0, 1).toUpperCase());
  if (!url) return `<span class="avatar-fallback" aria-hidden="true">${initial}</span>`;
  return `<img class="avatar" crossorigin="anonymous" src="${esc(url)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;avatar-fallback&quot; aria-hidden=&quot;true&quot;>${initial}</span>'">`;
}

function statusBadge(b) {
  if (!stillOpen(b)) return '<span class="badge closed">Entries closed</span>';
  const ms = new Date(b.deadline).getTime() - Date.now();
  if (ms < 48 * 3600000) return '<span class="badge soon">Closing soon</span>';
  return '<span class="badge open">Open</span>';
}

function feeChip(b) {
  return b.entryFeeUsd ? `<span class="chip">${money(b.entryFeeUsd)} entry fee</span>` : '';
}

/* ---------------- board ---------------- */

export function boardShell() {
  return `
  <div class="page-head">
    <h1>Open bounties</h1>
    <p class="summary">Live bounties on make.fun, with the reward as it stands now, the entry fee, the time left and the entries. Data refreshes from the public API as you browse.</p>
  </div>
  <div class="toolbar">
    <div class="tabs" role="group" aria-label="Filter bounties">
      <button class="tab" data-filter="open" aria-pressed="true">Open now</button>
      <button class="tab" data-filter="soon" aria-pressed="false">Closing soon</button>
      <button class="tab" data-filter="all" aria-pressed="false">All</button>
      <button class="tab" data-filter="ended" aria-pressed="false">Ended</button>
    </div>
    <input class="search" id="board-search" type="search" placeholder="Search bounties…" aria-label="Search bounties">
    <select class="sort" id="board-sort" aria-label="Sort bounties">
      <option value="pot">Biggest pot</option>
      <option value="deadline">Closing soonest</option>
      <option value="entries">Most entries</option>
      <option value="newest">Newest</option>
    </select>
  </div>
  <div id="board-list"></div>
  <div class="more-row"><button class="btn" id="board-more">Show more</button></div>`;
}

export function boardList(items) {
  if (!items.length) return '<p class="empty">No bounties match this filter.</p>';
  const rows = items
    .map(
      (b) => `
      <li class="card">
        <div class="card-title"><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></div>
        <div class="card-pot">
          <div class="pot-value">${pot(b)}</div>
          <div class="pot-label">live pot</div>
        </div>
        <div class="card-meta">
          ${statusBadge(b)}
          <span class="chip">${esc(b.category || 'Bounty')}</span>
          ${feeChip(b)}
          <span class="countdown" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
          <span>${count(b.submissionCount)} ${b.submissionCount === 1 ? 'entry' : 'entries'}</span>
          <span>closes ${shortDate(b.deadline)}</span>
        </div>
      </li>`,
    )
    .join('');
  return `<ul class="board">${rows}</ul>`;
}

/* ---------------- bounty page ---------------- */

function rewardsTable(b) {
  const now = Array.isArray(b.rewardsNow) && b.rewardsNow.length ? b.rewardsNow : null;
  if (now) {
    const rows = now
      .map(
        (r) => `<tr><td>${r.place}${r.place === 1 ? 'st' : r.place === 2 ? 'nd' : r.place === 3 ? 'rd' : 'th'}</td><td class="num">${money(r.baseUsd)}</td><td class="num">${money(r.feeShareUsd)}</td><td class="num"><strong>${money(r.amountUsd)}</strong></td></tr>`,
      )
      .join('');
    return `<table><thead><tr><th>Place</th><th class="num">Reward</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const map = b.rewards || {};
  const places = Object.keys(map).sort((a, c) => Number(a) - Number(c));
  if (!places.length) return '<p class="muted">No reward table published for this bounty yet.</p>';
  const rows = places
    .map(
      (p) => `<tr><td>${p}${p === '1' ? 'st' : p === '2' ? 'nd' : p === '3' ? 'rd' : 'th'}</td><td class="num"><strong>${money(map[p])}</strong></td></tr>`,
    )
    .join('');
  return `<table><thead><tr><th>Place</th><th class="num">Reward</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function bountyPage(b) {
  const skills = (b.skills || []).map((s) => `<span class="chip">${esc(s)}</span>`).join(' ');
  return `
  <div class="page-head">
    <p class="crumbs"><a href="#/">All bounties</a> &rsaquo; ${esc(b.category || 'Bounty')}</p>
    <h1>${esc(b.title)}</h1>
    ${b.summary ? `<p class="summary">${esc(b.summary)}</p>` : ''}
  </div>
  <div class="stats">
    <div class="stat"><div class="label">Live pot</div><div class="value amber">${pot(b)}</div><div class="sub">reward + entry fees paid</div></div>
    <div class="stat"><div class="label">Entry fee</div><div class="value">${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</div><div class="sub">${b.entryFeePayers ? `${count(b.entryFeePayers)} paid in` : 'no fee to enter'}</div></div>
    <div class="stat"><div class="label">Time left</div><div class="value countdown" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</div><div class="sub">closes ${stamp(b.deadline)}</div></div>
    <div class="stat"><div class="label">Entries</div><div class="value">${count(b.submissionCount)}</div><div class="sub">opened ${shortDate(b.publishedAt)}</div></div>
  </div>
  <div class="toolbar">
    <a class="btn primary" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a>
    <span class="muted small">${statusBadge(b)} &nbsp;Sponsor: ${esc(b.sponsor?.name || 'make.fun')}${b.sponsor?.isVerified ? ' ✓' : ''}</span>
    ${skills}
  </div>
  <h2>Rewards</h2>
  <div class="table-wrap">${rewardsTable(b)}</div>
  ${b.description ? `<h2>About this bounty</h2><div class="prose">${renderMd(b.description)}</div>` : ''}`;
}

/* ---------------- leaderboard ---------------- */

export function leaderboardPage(b, lb, view, page, perPage) {
  const entries = lb.entries || [];
  const total = entries.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const slice = entries.slice((page - 1) * perPage, page * perPage);
  const rows = slice
    .map((e) => {
      const rate = e.values ? percent(e.values.judge) : '—';
      const low = e.values ? percent(e.values.judge_low) : '';
      const high = e.values ? percent(e.values.judge_high) : '';
      const wdl = e.judge ? `${e.judge.wins}W ${e.judge.draws}D ${e.judge.losses}L` : '—';
      const frac = e.values ? Math.min(1, Math.max(0, Number(e.values.judge) / 1000000)) : 0;
      return `<tr>
        <td class="num"><strong>${e.rank}</strong></td>
        <td class="row-link">${avatar(e.handle, e.image)}<a href="#/profile/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a></td>
        <td>${esc(e.title || '—')}</td>
        <td class="num"><span class="rate">${rate}</span>${low ? `<span class="rate-bar"><i style="width:${Math.round(frac * 100)}%"></i></span><span class="small muted nowrap">${low} – ${high}</span>` : ''}</td>
        <td class="num nowrap">${wdl}</td>
        <td class="num">${e.values ? count(e.values.bytes) : '—'}</td>
      </tr>`;
    })
    .join('');
  const otherView = view === 'overall' ? 'performance' : 'overall';
  return `
  <div class="page-head">
    <p class="crumbs"><a href="#/">All bounties</a> &rsaquo; <a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a> &rsaquo; Leaderboard</p>
    <h1>${esc(b.title)} — leaderboard</h1>
    <p class="summary">${esc(lb.title || 'Results')} · phase: ${esc(lb.phase?.title || lb.phase?.key || '—')} · ${count(total)} ranked entries · view: ${esc(view)} (<a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard?view=${otherView}">switch to ${otherView}</a>)</p>
  </div>
  <div class="table-wrap"><table>
    <thead><tr><th class="num">#</th><th>Entrant</th><th>Entry</th><th class="num">Judge win rate</th><th class="num">Games</th><th class="num">Size (bytes)</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" class="muted">No ranked entries yet.</td></tr>'}</tbody>
  </table></div>
  <div class="pager">
    <span class="page-info">Page ${page} of ${pages}</span>
    <button class="btn" id="lb-prev" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
    <button class="btn" id="lb-next" ${page >= pages ? 'disabled' : ''}>Next →</button>
  </div>`;
}

/* ---------------- profile ---------------- */

export function profilePage(p) {
  const rec = p.record || {};
  const name = p.display_name || p.handle;
  const sols = (p.solutions || []).map((s) => {
    const c = s.competition || {};
    return `<li class="solution">
      <h3><a href="#/bounty/${encodeURIComponent(c.slug || '')}">${esc(s.title || c.title || 'Untitled entry')}</a></h3>
      <div class="meta">${esc(c.title || '')} · entered ${shortDate(s.entered_at)}${s.placement ? ` · placed #${s.placement}` : ''}${s.prize_usd ? ` · won ${money(s.prize_usd)}` : ''}${s.score?.display ? ` · score ${esc(s.score.display)}` : ''}</div>
    </li>`;
  }).join('');
  return `
  <div class="profile-head">
    ${avatar(p.handle, p.image || p.avatar)}
    <div>
      <h1>${esc(name)}</h1>
      <p class="muted" style="margin:0">@${esc(p.handle)} · joined ${shortDate(p.joined_at)}</p>
      ${p.bio ? `<p style="margin:6px 0 0">${esc(p.bio)}</p>` : ''}
    </div>
  </div>
  ${p.wallet?.address ? `<p class="wallet">Wallet <a href="${esc(p.wallet.explorer_url || '')}" target="_blank" rel="noopener">${shortAddr(p.wallet.address)}</a></p>` : ''}
  <div class="stats">
    <div class="stat"><div class="label">Entered</div><div class="value">${count(rec.competitions_entered)}</div></div>
    <div class="stat"><div class="label">Placed</div><div class="value">${count(rec.competitions_placed)}</div></div>
    <div class="stat"><div class="label">Won</div><div class="value">${count(rec.competitions_won)}</div></div>
    <div class="stat"><div class="label">Prize money</div><div class="value amber">${money(rec.prize_usd)}</div><div class="sub">${rec.best_placement ? `best place #${rec.best_placement}` : 'no placement yet'}</div></div>
  </div>
  <h2>Entries</h2>
  ${sols ? `<ul class="solutions">${sols}</ul>` : '<p class="muted">No entries yet.</p>'}`;
}
