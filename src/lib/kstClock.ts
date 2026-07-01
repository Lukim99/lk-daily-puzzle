const DAY_MS = 24 * 60 * 60 * 1000
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function getKstDayNumber(timestamp = Date.now()): number {
  return Math.floor((timestamp + KST_OFFSET_MS) / DAY_MS)
}

export function getMillisecondsUntilNextKstMidnight(timestamp = Date.now()): number {
  const kstTimestamp = timestamp + KST_OFFSET_MS
  const nextMidnight = (Math.floor(kstTimestamp / DAY_MS) + 1) * DAY_MS
  return nextMidnight - kstTimestamp
}
