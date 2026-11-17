// Small formatting helpers for API values. All of them take raw API data and
// return plain strings, so views stay free of formatting logic.

/** Escape text for safe insertion into HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** A dollar amount (number or numeric string) as "$1,000" or "$0.50". */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** An ISO date as "Nov 17, 2026, 12:30 PM UTC". */
export function stamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  })} UTC`;
}

/** A short date, "Nov 17, 2026". */
export function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
}

/**
 * Time left until an ISO deadline: "12d 3h", "4h 20m", "38m", "42s", or
 * "ended". Short on purpose: board rows show it at a glance.
 */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

/** True when a bounty still takes entries: judged by its deadline, because a
 *  bounty past its deadline may still read status "open" until results land. */
export function stillOpen(b) {
  return new Date(b.deadline).getTime() > Date.now();
}

/** The live pot: entry fees paid in on top of the house reward. */
export function pot(b) {
  return money(b.potUsd ?? b.rewardAmount);
}

/** A 0..1 fraction (the leaderboard's micro units) as a percent, "95.6%". */
export function percent(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 10000).toFixed(1)}%`;
}

/** Truncate a long wallet address to "CCgB…XX6Hy". */
export function shortAddr(addr) {
  const s = String(addr ?? '');
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-5)}` : s;
}

/** A count with thousands separators, "10,840". */
export function count(n) {
  return Number(n ?? 0).toLocaleString('en-US');
}
