// The four surfaces, each a function from API data to HTML. Every value that
// came from the API is escaped by fmt.esc before it is placed, and every
// link is a real route the router understands.

import { esc, usd, whole, fullDate, left, isLive, winRate, bytes, shortAddr, shortDate } from './fmt.js';

// A tiny markdown reader for bounty descriptions and rules: headings,
// bold, code, links and lists. Text is escaped first, markup second.
export function md(text) {
  const safe = esc(text ?? '');
  const lines = safe.split('\n');
  let out = '';
  let list = false;
  for (const line of lines) {
    const h = line.match(/^#{1,3}\s+(.*)$/);
    const item = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      if (list) { out += '</ul>'; list = false; }
      out += `<h3>${inline(h[1])}</h3>`;
    } else if (item) {
      if (!list) { out += '<ul>'; list = true; }
      out += `<li>${inline(item[1])}</li>`;
    } else if (line.trim() === '') {
      if (list) { out += '</ul>'; list = false; }
    } else {
      if (list) { out += '</ul>'; list = false; }
      out += `<p>${inline(line)}</p>`;
    }
  }
  if (list) out += '</ul>';
  return out;
}

function inline(s) {
  return s
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function avatar(url, name, size) {
  // The API mixes absolute avatar URLs with paths rooted at make.fun.
  if (url && url.startsWith('/')) url = `https://make.fun${url}`;
  if (url) {
    return `<img class="avatar" crossorigin="anonymous" src="${esc(url)}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.outerHTML='<span class=\\'avatar fallback\\'>${esc((name || '?')[0].toUpperCase())}</span>'">`;
  }
  return `<span class="avatar fallback">${esc((name || '?')[0].toUpperCase())}</span>`;
}

// Consecutive places paying the same amount collapse into one row:
// {"1":100,"2":70,"3":50,"4":20,...} -> 1st $100, 2nd $70, 3rd $50, 4th-10th $20.
export function rewardRows(rewards) {
  const places = Object.keys(rewards || {})
    .map((k) => [Number(k), Number(rewards[k])])
    .filter(([p, v]) => Number.isFinite(p) && Number.isFinite(v))
    .sort((a, b) => a[0] - b[0]);
  const rows = [];
  for (const [place, amount] of places) {
    const last = rows[rows.length - 1];
    if (last && last.amount === amount && last.end === place - 1) last.end = place;
    else rows.push({ start: place, end: place, amount });
  }
  return rows
    .map((r) => {
      const label = r.start === r.end ? ordinal(r.start) : `${ordinal(r.start)}–${ordinal(r.end)}`;
      return `<tr><td>${label}</td><td class="num">${usd(r.amount)}</td></tr>`;
    })
    .join('');
}

function ordinal(n) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function statusBadge(b) {
  if (isLive(b)) {
    const soon = new Date(b.deadline).getTime() - Date.now() < 86400000;
    return `<span class="badge open${soon ? ' soon' : ''}">${soon ? 'Closing soon' : 'Open'}</span>`;
  }
  return '<span class="badge closed">Ended</span>';
}

function card(b) {
  const live = isLive(b);
  return `<article class="card">
    <div class="card-top"><span class="cat">${esc(b.category || 'Bounty')}</span>${statusBadge(b)}</div>
    <h2><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
    <p class="summary">${esc(b.summary || '')}</p>
    <dl class="stats">
      <div><dt>Live pot</dt><dd class="pot">${usd(b.potUsd ?? b.rewardAmount)}</dd></div>
      <div><dt>Entry fee</dt><dd>${b.entryFeeUsd ? usd(b.entryFeeUsd) : 'Free'}</dd></div>
      <div><dt>Entries</dt><dd>${whole(b.submissionCount)}</dd></div>
      <div><dt>Time left</dt><dd data-deadline="${esc(b.deadline)}" class="${live ? '' : 'ended'}">${left(b.deadline)}</dd></div>
    </dl>
  </article>`;
}

export function cardsHtml(list) {
  return list.map(card).join('') || '<p class="empty">No bounties match.</p>';
}

export function boardView(list, shown) {
  const total = list.reduce((s, b) => s + (Number(b.potUsd ?? b.rewardAmount) || 0), 0);
  const liveCount = list.filter(isLive).length;
  return `
    <section class="board-head">
      <h1>Open bounties</h1>
      <p class="lede">${liveCount} taking entries · ${usd(total)} in live pots</p>
    </section>
    <div class="board-tools">
      <label class="search">Search <input id="q" type="search" placeholder="Bounty title or slug…" autocomplete="off"></label>
      <div class="chips" id="filters">
        <button data-filter="open" class="chip on">Open</button>
        <button data-filter="soon" class="chip">Ending soon</button>
        <button data-filter="big" class="chip">Big pot $500+</button>
        <button data-filter="closed" class="chip">Ended</button>
      </div>
      <label class="sort">Sort
        <select id="sort">
          <option value="deadline">Ending soonest</option>
          <option value="pot">Biggest pot</option>
          <option value="entries">Most entries</option>
          <option value="new">Newest</option>
        </select>
      </label>
    </div>
    <div class="grid" id="cards">${cardsHtml(shown)}</div>
    <p class="more"><button id="more" class="btn">Show more</button></p>`;
}

export function bountyView(b) {
  const live = isLive(b);
  return `
    <p class="crumbs"><a href="#/">← All bounties</a></p>
    <header class="bounty-head">
      <div>
        <span class="cat">${esc(b.category || 'Bounty')}</span> ${statusBadge(b)}
        <h1>${esc(b.title)}</h1>
        <p class="lede">${esc(b.summary || '')}</p>
      </div>
    </header>
    <dl class="stats big">
      <div><dt>Live pot</dt><dd class="pot">${usd(b.potUsd ?? b.rewardAmount)}</dd></div>
      <div><dt>Entry fee</dt><dd>${b.entryFeeUsd ? usd(b.entryFeeUsd) : 'Free'}</dd></div>
      <div><dt>Entries</dt><dd>${whole(b.submissionCount)}</dd></div>
      <div><dt>${live ? 'Closes in' : 'Deadline'}</dt><dd data-deadline="${esc(b.deadline)}">${live ? left(b.deadline) : fullDate(b.deadline)}</dd></div>
      <div><dt>Opened</dt><dd>${shortDate(b.opensAt)}</dd></div>
    </dl>
    <p><a class="btn primary" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard →</a></p>
    <section>
      <h2>Rewards</h2>
      <table class="rewards"><thead><tr><th>Place</th><th>Prize</th></tr></thead>
      <tbody>${rewardRows(b.rewards || {})}</tbody></table>
      <p class="note">Entry fees paid join the pot, so the live pot above is what the places share.</p>
    </section>
    <section>
      <h2>About this bounty</h2>
      <div class="prose">${md(b.description || '')}</div>
    </section>
    ${b.rules ? `<section><details class="rules"><summary>Rules</summary><div class="prose">${md(b.rules)}</div></details></section>` : ''}`;
}

export function leaderboardView(slug, lb, rows, rankedTotal) {
  const comp = lb.competition || {};
  const phase = lb.phase || {};
  const total = rankedTotal ?? rows.length;
  const body = rows
    .map((e) => {
      const rate = e.values && e.values.judge != null ? winRate(e.values.judge) : '—';
      const low = e.values && e.values.judge_low != null ? winRate(e.values.judge_low) : '';
      const high = e.values && e.values.judge_high != null ? winRate(e.values.judge_high) : '';
      const range = low && high ? `${low} – ${high}` : '—';
      return `<tr>
        <td class="num rank">${e.rank}</td>
        <td><a class="entrant" href="#/profile/${encodeURIComponent(e.handle)}">${avatar(e.image, e.handle, 28)}<span>${esc(e.handle)}${e.house ? ' <em class="house">house</em>' : ''}</span></a>
          <div class="entry-title">${esc(e.title || '')}</div></td>
        <td class="num">${rate}</td>
        <td class="num">${range}</td>
        <td class="num">${e.values && e.values.valid != null ? e.values.valid : '—'}</td>
        <td class="num">${bytes(e.values && e.values.bytes)}</td>
        <td class="num">${e.prize_rank != null ? e.prize_rank : '—'}</td>
      </tr>`;
    })
    .join('');
  return `
    <p class="crumbs"><a href="#/bounty/${encodeURIComponent(slug)}">← ${esc(comp.title || slug)}</a></p>
    <header class="board-head">
      <h1>Leaderboard</h1>
      <p class="lede">${esc(comp.title || slug)} · ${esc(phase.title || 'Development')} phase · top ${rows.length} of ${whole(total)} ranked</p>
    </header>
    <div class="board-tools">
      <label class="sort">View
        <select id="lbview">
          <option value="performance">Performance</option>
          <option value="overall">Overall</option>
          <option value="cost">Cost</option>
          <option value="efficiency">Efficiency</option>
        </select>
      </label>
      <label class="search">Find an entrant <input id="lookup" type="search" placeholder="handle, e.g. golden-marten-16" autocomplete="off"></label>
    </div>
    ${rows.length ? `<table class="board-table">
      <thead><tr><th>#</th><th>Entrant</th><th>Win rate</th><th>90% interval</th><th>Valid</th><th>Size</th><th>Prize</th></tr></thead>
      <tbody>${body}</tbody></table>` : '<p class="empty">No ranked entries in this view yet.</p>'}
    <p class="note">Win rate is the judge's pairwise rate. Ranks are decided on it; ties break on dossier size, then on who submitted first.</p>`;
}

export function profileView(p) {
  const rec = p.record || {};
  const sols = (p.solutions || [])
    .map((s) => {
      const c = s.competition || {};
      return `<li class="solution">
        <a href="#/bounty/${encodeURIComponent(c.slug)}">${esc(s.title || c.title || s.submission_id)}</a>
        <span class="meta">${esc(c.title || '')} · entered ${shortDate(s.entered_at)}${s.placement ? ` · place ${s.placement}` : ''}${s.prize_usd ? ` · ${usd(s.prize_usd)}` : ''}</span>
      </li>`;
    })
    .join('');
  return `
    <section class="profile-head">
      ${avatar(p.image || p.avatar, p.handle, 72)}
      <div>
        <h1>${esc(p.display_name || p.handle)}</h1>
        <p class="handle">@${esc(p.handle)}</p>
        ${p.bio ? `<p class="lede">${esc(p.bio)}</p>` : ''}
        <p class="meta">Joined ${shortDate(p.joined_at)}${p.wallet ? ` · wallet <a href="${esc(p.wallet.explorer_url || '')}" target="_blank" rel="noopener">${shortAddr(p.wallet.address)}</a>` : ''}</p>
      </div>
    </section>
    <dl class="stats big">
      <div><dt>Entered</dt><dd>${whole(rec.competitions_entered)}</dd></div>
      <div><dt>Placed</dt><dd>${whole(rec.competitions_placed)}</dd></div>
      <div><dt>Won</dt><dd>${whole(rec.competitions_won)}</dd></div>
      <div><dt>Prize money</dt><dd>${usd(rec.prize_usd)}</dd></div>
    </dl>
    <section>
      <h2>Entries</h2>
      ${sols ? `<ul class="solutions">${sols}</ul>` : '<p class="empty">No entries yet.</p>'}
    </section>`;
}

export function errorView(message) {
  return `<p class="error">Could not load this page: ${esc(message)}</p>
    <p><a class="btn" href="#/">Back to the board</a></p>`;
}

export function notFoundView(what) {
  return `<h1>Not found</h1><p class="lede">No ${esc(what)} here.</p>
    <p><a class="btn" href="#/">Back to the board</a></p>`;
}
