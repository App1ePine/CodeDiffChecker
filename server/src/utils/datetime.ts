export function toMySqlDateTime(date: Date): string {
	const iso = date.toISOString()
	return iso.slice(0, 19).replace('T', ' ')
}

export function mysqlDateToIsoString(value: Date | null): string | null {
	if (!value) return null
	return value.toISOString()
}
