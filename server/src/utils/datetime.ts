export function toEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

export function normalizeEpochSeconds(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const epoch = typeof value === 'string' ? Number.parseInt(value, 10) : value
  if (!Number.isFinite(epoch)) return null
  return Math.floor(epoch)
}

export function epochSecondsToIsoString(value: number | string | null | undefined): string | null {
  const epoch = normalizeEpochSeconds(value)
  if (epoch === null) return null
  return new Date(epoch * 1000).toISOString()
}

export function isoStringToEpochSeconds(value: string | null | undefined): number | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return toEpochSeconds(date)
}
