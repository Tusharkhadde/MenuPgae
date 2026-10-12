/** Timestamps relative to now (kept out of components so render stays pure). */
export function hoursAgo(h: number, now = Date.now()): Date {
  return new Date(now - h * 3_600_000);
}
