// The router and the page lifecycle. Four hash routes:
//
//   #/                          the bounty board
//   #/bounty/<slug>             one bounty
//   #/bounty/<slug>/leaderboard that bounty's leaderboard
//   #/profile/<handle>          an account's public profile
//
// window.__shotReady is false while a route loads and true once its data is
// on screen, so a screenshot script knows when to capture.

import { openBounties, allBounties, oneBounty, bountyBoard, rankedTotal, account } from './api.js';
import { boardView, cardsHtml, bountyView, leaderboardView, profileView, errorView, notFoundView } from './views.js';
import { left, isLive } from './fmt.js';

const app = document.getElementById('app');
const PAGE = 12;

// Board state lives here, not in the URL: filtering, sorting and paging
// re-render only the card grid, never the whole page.
const boardState = { all: [], filter: 'open', sort: 'deadline', query: '', shown: PAGE };
let boardLoaded = false;

function route() {
  const hash = location.hash || '#/';
  const bounty = hash.match(/^#\/bounty\/([^/]+)(?:\/leaderboard)?\/?$/);
  const board = hash.match(/^#\/bounty\/([^/]+)\/leaderboard\/?$/);
  const profile = hash.match(/^#\/profile\/([^/]+)\/?$/);
  if (board) return { view: 'leaderboard', slug: decodeURIComponent(board[1]) };
  if (bounty) return { view: 'bounty', slug: decodeURIComponent(bounty[1]) };
  if (profile) return { view: 'profile', handle: decodeURIComponent(profile[1]) };
  return { view: 'board' };
}

async function render() {
  window.__shotReady = false;
  const r = route();
  try {
    if (r.view === 'board') await showBoard();
    else if (r.view === 'bounty') await showBounty(r.slug);
    else if (r.view === 'leaderboard') await showLeaderboard(r.slug);
    else await showProfile(r.handle);
  } catch (err) {
    app.innerHTML = errorView(err.message || 'something went wrong');
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

function visibleBoard() {
  const now = Date.now();
  let list = boardState.all.slice();
  if (boardState.filter === 'open') list = list.filter(isLive);
  else if (boardState.filter === 'soon') list = list.filter((b) => isLive(b) && new Date(b.deadline).getTime() - now < 86400000);
  else if (boardState.filter === 'big') list = list.filter((b) => Number(b.potUsd ?? b.rewardAmount) >= 500);
  else if (boardState.filter === 'closed') list = list.filter((b) => !isLive(b));
  if (boardState.query) {
    const q = boardState.query.toLowerCase();
    list = list.filter((b) => `${b.title} ${b.slug}`.toLowerCase().includes(q));
  }
  const by = boardState.sort;
  list.sort((a, b) => {
    if (by === 'pot') return (Number(b.potUsd ?? b.rewardAmount) || 0) - (Number(a.potUsd ?? a.rewardAmount) || 0);
    if (by === 'entries') return (b.submissionCount || 0) - (a.submissionCount || 0);
    if (by === 'new') return new Date(b.opensAt || 0) - new Date(a.opensAt || 0);
    return new Date(a.deadline || 0) - new Date(b.deadline || 0);
  });
  return list;
}

function paintCards() {
  const list = visibleBoard();
  const grid = document.getElementById('cards');
  const more = document.getElementById('more');
  if (!grid) return;
  // Only the grid is rebuilt; the tools, the search text and the page stay.
  grid.innerHTML = cardsHtml(list.slice(0, boardState.shown));
  if (more) more.style.display = list.length > boardState.shown ? '' : 'none';
}

async function showBoard() {
  document.title = 'make.fun bounties';
  if (!boardLoaded) {
    app.innerHTML = '<p class="loading">Loading bounties…</p>';
    boardState.all = await openBounties();
    boardLoaded = true;
  }
  app.innerHTML = boardView(boardState.all, visibleBoard().slice(0, boardState.shown));
  const more = document.getElementById('more');
  if (more) more.style.display = visibleBoard().length > boardState.shown ? '' : 'none';

  document.getElementById('q').addEventListener('input', (e) => {
    boardState.query = e.target.value.trim();
    boardState.shown = PAGE;
    paintCards();
  });
  document.getElementById('filters').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    document.querySelectorAll('#filters .chip').forEach((c) => c.classList.remove('on'));
    btn.classList.add('on');
    boardState.filter = btn.dataset.filter;
    boardState.shown = PAGE;
    if (boardState.filter === 'closed' && !boardState.all.some((b) => !isLive(b))) {
      boardState.all = await allBounties();
    }
    paintCards();
  });
  document.getElementById('sort').addEventListener('change', (e) => {
    boardState.sort = e.target.value;
    boardState.shown = PAGE;
    paintCards();
  });
  more.addEventListener('click', () => {
    boardState.shown += PAGE;
    paintCards();
  });
}

async function showBounty(slug) {
  app.innerHTML = '<p class="loading">Loading bounty…</p>';
  const b = await oneBounty(slug);
  if (!b || !b.slug) {
    app.innerHTML = notFoundView(`bounty “${slug}”`);
    return;
  }
  document.title = `${b.title} | make.fun bounties`;
  app.innerHTML = bountyView(b);
}

async function showLeaderboard(slug) {
  app.innerHTML = '<p class="loading">Loading leaderboard…</p>';
  const [lb, total] = await Promise.all([bountyBoard(slug), rankedTotal(slug)]);
  document.title = `Leaderboard · ${lb.competition?.title || slug} | make.fun bounties`;
  app.innerHTML = leaderboardView(slug, lb, lb.entries || [], total);
  const view = document.getElementById('lbview');
  if (view) {
    view.addEventListener('change', async () => {
      window.__shotReady = false;
      const next = await bountyBoard(slug, view.value);
      app.innerHTML = leaderboardView(slug, next, next.entries || [], total);
      document.getElementById('lbview').value = view.value;
      wireLookup();
      window.__shotReady = true;
    });
  }
  wireLookup();
}

function wireLookup() {
  const box = document.getElementById('lookup');
  if (!box) return;
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && box.value.trim()) {
      location.hash = `#/profile/${encodeURIComponent(box.value.trim())}`;
    }
  });
}

async function showProfile(handle) {
  app.innerHTML = '<p class="loading">Loading profile…</p>';
  const p = await account(handle);
  if (!p || !p.handle) {
    app.innerHTML = notFoundView(`profile “${handle}”`);
    return;
  }
  document.title = `@${p.handle} | make.fun bounties`;
  app.innerHTML = profileView(p);
}

// The countdowns tick in place every 30 seconds: the numbers move, the
// page is not rebuilt.
setInterval(() => {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    el.textContent = left(el.dataset.deadline);
  });
}, 30000);

window.addEventListener('hashchange', render);
render();
