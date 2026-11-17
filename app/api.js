// Live read-only access to make.fun's public API, with a small honest cache.
//
// The API's ETags are bound to the minute: a revalidation inside the same
// minute answers 304, and once the minute turns it answers 200 with a new tag
// even when nothing changed. So this cache keeps an answer in memory while it
// is fresh, revalidates with If-None-Match when it ages out, and never asks
// twice for the same thing at the same time.

const BASE = 'https://make.fun/api';
const FRESH_MS = 55000;

const kept = new Map(); // url -> { tag, body, stamp }
const flying = new Map(); // url -> Promise

async function request(path) {
  const url = BASE + path;
  const hit = kept.get(url);
  if (hit && Date.now() - hit.stamp < FRESH_MS) return hit.body;
  if (flying.has(url)) return flying.get(url);

  const job = (async () => {
    const headers = {};
    if (hit && hit.tag) headers['If-None-Match'] = hit.tag;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.status === 304 && hit) {
      hit.stamp = Date.now();
      return hit.body;
    }
    if (!res.ok) throw new Error(`make.fun answered ${res.status} for ${path}`);
    const body = await res.json();
    kept.set(url, { tag: res.headers.get('etag'), body, stamp: Date.now() });
    return body;
  })();

  flying.set(url, job);
  try {
    return await job;
  } finally {
    flying.delete(url);
  }
}

// The list endpoints answer either a bare array or an object with items.
function asList(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc && doc.items)) return doc.items;
  if (Array.isArray(doc && doc.competitions)) return doc.competitions;
  return [];
}

export function openBounties() {
  return request('/competitions?status=open&activity=times').then(asList);
}

export function allBounties() {
  return request('/competitions?activity=times').then(asList);
}

export function oneBounty(slug) {
  return request(`/competitions/${encodeURIComponent(slug)}`);
}

export function bountyBoard(slug, view) {
  // The leaderboard answers the whole ranking at once (thousands of rows),
  // so ask for the first page only: the top 10 by rank. One request, cached.
  const q = view ? `?rows=first&view=${encodeURIComponent(view)}` : '?rows=first';
  return request(`/competitions/${encodeURIComponent(slug)}/leaderboard${q}`);
}

// How many entries a bounty has ranked, from the submissions endpoint's
// own count (a limit=1 call, so the payload stays tiny).
export function rankedTotal(slug) {
  return request(`/competitions/${encodeURIComponent(slug)}/submissions?limit=1`).then(
    (d) => d.ranked ?? null,
  );
}

export function account(handle) {
  return request(`/profiles/${encodeURIComponent(handle)}`);
}
