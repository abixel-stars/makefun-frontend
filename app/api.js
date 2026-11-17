// Read-only client for make.fun's public API.
//
// Every answer is cached in memory with the ETag the API sent. The API binds
// its ETags to the minute, so a revalidation inside the same minute answers
// 304 and costs almost nothing; once the minute turns we get a fresh 200.
// Requests already in flight for the same path share one promise.

const BASE = 'https://make.fun/api';

const cache = new Map();
const inflight = new Map();

async function request(path) {
  const pending = inflight.get(path);
  if (pending) return pending;
  const job = (async () => {
    const slot = cache.get(path);
    const headers = {};
    if (slot && slot.etag) headers['If-None-Match'] = slot.etag;
    const res = await fetch(BASE + path, { headers });
    if (res.status === 304 && slot) return slot.data;
    if (!res.ok) {
      const err = new Error(`make.fun API ${res.status} for ${path}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    cache.set(path, { etag: res.headers.get('ETag'), data });
    return data;
  })();
  inflight.set(path, job);
  try {
    return await job;
  } finally {
    inflight.delete(path);
  }
}

/** The live bounty board (open bounties with their activity times). */
export function listOpen() {
  return request('/competitions?status=open&activity=times');
}

/** Every bounty, open or finished, for the board's "All" filter. */
export function listAll() {
  return request('/competitions?activity=times');
}

/** One bounty, by slug. */
export function bounty(slug) {
  return request(`/competitions/${encodeURIComponent(slug)}`);
}

/** A bounty's leaderboard. view is "performance" or "overall". */
export function leaderboard(slug, view) {
  const v = view === 'overall' ? 'overall' : 'performance';
  return request(`/competitions/${encodeURIComponent(slug)}/leaderboard?view=${v}`);
}

/** An account's public profile, by handle. */
export function profile(handle) {
  return request(`/profiles/${encodeURIComponent(handle)}`);
}
