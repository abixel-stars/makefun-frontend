// Router and boot for the make.fun frontend.
//
// Hash routes (each is a link and its own address):
//   #/                              the bounty board
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard (?view=overall)
//   #/profile/<handle>              an account's public profile
//
// window.__shotReady is false while a route loads and true once its data is
// on screen, so a screenshot script knows when to capture.

import * as api from './api.js';
import { stillOpen, timeLeft } from './format.js';
import { boardList, boardShell, bountyPage, leaderboardPage, profilePage } from './views.js';

const view = document.getElementById('view');
let ticker = null;
let boardCache = null;
let boardAllCache = null;

function loading() {
  view.innerHTML = '<div class="loading">Loading live data from make.fun…</div>';
}

function failed(err) {
  view.innerHTML = `<div class="error-box"><strong>Could not load this page.</strong><br>${err.message}<br><button class="btn" onclick="location.reload()">Retry</button></div>`;
}

/** Tick every countdown on screen once a second, by text only: the page is
 *  never rebuilt for a ticking clock. */
function startTicker() {
  stopTicker();
  ticker = setInterval(() => {
    for (const el of view.querySelectorAll('[data-deadline]')) {
      el.textContent = timeLeft(el.dataset.deadline);
    }
  }, 1000);
}

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

function setActiveNav(route) {
  for (const a of document.querySelectorAll('[data-nav]')) {
    a.classList.toggle('active', a.dataset.nav === route);
  }
}

/* ---------------- board ---------------- */

const boardState = { filter: 'open', query: '', sort: 'pot', shown: 12 };
const PAGE_SIZE = 12;

function sortItems(items, sort) {
  const arr = [...items];
  if (sort === 'pot') arr.sort((a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount));
  if (sort === 'deadline') arr.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  if (sort === 'entries') arr.sort((a, b) => (b.submissionCount || 0) - (a.submissionCount || 0));
  if (sort === 'newest') arr.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  return arr;
}

function applyBoard() {
  const all = boardState.filter === 'all' || boardState.filter === 'ended' ? boardAllCache : boardCache;
  let items = (all || []).filter((b) => {
    if (boardState.filter === 'open') return stillOpen(b);
    if (boardState.filter === 'soon') return stillOpen(b) && new Date(b.deadline).getTime() - Date.now() < 48 * 3600000;
    if (boardState.filter === 'ended') return !stillOpen(b);
    return true;
  });
  const q = boardState.query.trim().toLowerCase();
  if (q) items = items.filter((b) => `${b.title} ${b.slug} ${b.category || ''}`.toLowerCase().includes(q));
  items = sortItems(items, boardState.sort);
  const list = document.getElementById('board-list');
  if (list) list.innerHTML = boardList(items.slice(0, boardState.shown));
  const more = document.getElementById('board-more');
  if (more) more.style.display = items.length > boardState.shown ? '' : 'none';
}

async function showBoard() {
  setActiveNav('board');
  document.title = 'make.fun bounties';
  view.innerHTML = boardShell();
  if (!boardCache) {
    try {
      const data = await api.listOpen();
      boardCache = data.items || [];
    } catch (err) {
      failed(err);
      window.__shotReady = true;
      return;
    }
  }
  for (const tab of view.querySelectorAll('.tab')) {
    tab.addEventListener('click', async () => {
      boardState.filter = tab.dataset.filter;
      boardState.shown = PAGE_SIZE;
      for (const t of view.querySelectorAll('.tab')) t.setAttribute('aria-pressed', String(t === tab));
      if ((boardState.filter === 'all' || boardState.filter === 'ended') && !boardAllCache) {
        try {
          boardAllCache = (await api.listAll()).items || [];
        } catch (err) {
          failed(err);
          return;
        }
      }
      applyBoard();
    });
  }
  view.querySelector('#board-search').addEventListener('input', (e) => {
    boardState.query = e.target.value;
    boardState.shown = PAGE_SIZE;
    applyBoard();
  });
  view.querySelector('#board-sort').addEventListener('change', (e) => {
    boardState.sort = e.target.value;
    applyBoard();
  });
  view.querySelector('#board-more').addEventListener('click', () => {
    boardState.shown += PAGE_SIZE;
    applyBoard();
  });
  applyBoard();
  startTicker();
  window.__shotReady = true;
}

/* ---------------- bounty + leaderboard + profile ---------------- */

async function showBounty(slug) {
  setActiveNav('bounty');
  loading();
  try {
    const b = await api.bounty(slug);
    document.title = `${b.title} | make.fun bounties`;
    view.innerHTML = bountyPage(b);
    startTicker();
  } catch (err) {
    failed(err);
  }
  window.__shotReady = true;
}

async function showLeaderboard(slug, query) {
  setActiveNav('bounty');
  loading();
  const params = new URLSearchParams(query);
  const lbView = params.get('view') === 'overall' ? 'overall' : 'performance';
  let page = Number(params.get('page') || 1);
  if (!Number.isInteger(page) || page < 1) page = 1;
  const perPage = 25;
  try {
    const [b, lb] = await Promise.all([api.bounty(slug), api.leaderboard(slug, lbView)]);
    document.title = `${b.title} leaderboard | make.fun bounties`;
    view.innerHTML = leaderboardPage(b, lb, lbView, page, perPage);
    const go = (p) => {
      location.hash = `#/bounty/${encodeURIComponent(slug)}/leaderboard?view=${lbView}&page=${p}`;
    };
    view.querySelector('#lb-prev')?.addEventListener('click', () => go(page - 1));
    view.querySelector('#lb-next')?.addEventListener('click', () => go(page + 1));
  } catch (err) {
    failed(err);
  }
  window.__shotReady = true;
}

async function showProfile(handle) {
  setActiveNav('');
  loading();
  try {
    const p = await api.profile(handle);
    document.title = `@${p.handle} | make.fun bounties`;
    view.innerHTML = profilePage(p);
  } catch (err) {
    failed(err);
  }
  window.__shotReady = true;
}

/* ---------------- route ---------------- */

async function render() {
  window.__shotReady = false;
  stopTicker();
  const hash = location.hash || '#/';
  const [path, query = ''] = hash.slice(2).split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') {
    await showLeaderboard(decodeURIComponent(parts[1]), query);
  } else if (parts[0] === 'bounty' && parts[1]) {
    await showBounty(decodeURIComponent(parts[1]));
  } else if (parts[0] === 'profile' && parts[1]) {
    await showProfile(decodeURIComponent(parts[1]));
  } else {
    await showBoard();
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();
