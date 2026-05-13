const NY_TZ = 'America/New_York'

function nyParts(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date)
}

function get(parts: Intl.DateTimeFormatPart[], type: string) {
  return Number(parts.find((p) => p.type === type)?.value ?? 0)
}

export function isMarketOpen(now = new Date()): boolean {
  const parts = nyParts(now)
  const day = parts.find((p) => p.type === 'weekday')?.value ?? ''
  if (day === 'Sat' || day === 'Sun') return false
  const totalMin = get(parts, 'hour') * 60 + get(parts, 'minute')
  return totalMin >= 9 * 60 + 30 && totalMin < 16 * 60
}

export function isOrbWindow(now = new Date()): boolean {
  const parts = nyParts(now)
  const totalMin = get(parts, 'hour') * 60 + get(parts, 'minute')
  return totalMin >= 9 * 60 + 30 && totalMin < 9 * 60 + 45
}

export function getTradeDateNY(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: NY_TZ }).format(now)
}

export function getNextResetMs(now = new Date()): number {
  const parts = nyParts(now)
  const day = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const h = get(parts, 'hour')
  const m = get(parts, 'minute')
  const s = get(parts, 'second')
  const totalMin = h * 60 + m
  const openMin = 9 * 60 + 30

  // Skip weekends: count forward to next weekday open
  let daysUntilOpen = 0
  if (day === 'Fri' && totalMin >= openMin) daysUntilOpen = 3
  else if (day === 'Sat') daysUntilOpen = 2
  else if (day === 'Sun') daysUntilOpen = 1
  else if (totalMin >= openMin) daysUntilOpen = 1

  if (daysUntilOpen > 0) {
    return (daysUntilOpen * 24 * 60 - totalMin + openMin) * 60 * 1000 - s * 1000
  }
  return (openMin - totalMin) * 60 * 1000 - s * 1000
}

export function getNextSweepMs(now = new Date()): number {
  const parts = nyParts(now)
  const h = get(parts, 'hour')
  const m = get(parts, 'minute')
  const s = get(parts, 'second')
  const totalMin = h * 60 + m
  const sweepMin = 15 * 60 + 55

  if (totalMin < sweepMin) {
    return (sweepMin - totalMin) * 60 * 1000 - s * 1000
  }
  return getNextResetMs(now) + (sweepMin - 9 * 60 - 30) * 60 * 1000
}
