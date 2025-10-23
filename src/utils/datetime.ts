export function formatLocalDateTime(value: string | null): string {
	if (!value) return 'Never'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Invalid date'
	return formatDate(date)
}

export function toDatePickerString(value: string | null): string | null {
	if (!value) return null
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return null
	return formatDate(date, true)
}

export function parseDatePickerString(value: string | null): Date | null {
	if (!value) return null
	const [datePart, timePart] = value.split(' ')
	if (!datePart || !timePart) return null
	const [yearStr, monthStr, dayStr] = datePart.split('-')
	const [hourStr, minuteStr, secondStr] = timePart.split(':')
	if (!yearStr || !monthStr || !dayStr || !hourStr || !minuteStr || !secondStr) return null
	const year = Number.parseInt(yearStr, 10)
	const month = Number.parseInt(monthStr, 10)
	const day = Number.parseInt(dayStr, 10)
	const hours = Number.parseInt(hourStr, 10)
	const minutes = Number.parseInt(minuteStr, 10)
	const seconds = Number.parseInt(secondStr, 10)
	const date = new Date(year, month - 1, day, hours, minutes, seconds)
	return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(date: Date, asPicker = false): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')
	const seconds = String(date.getSeconds()).padStart(2, '0')
	const separator = asPicker ? ' ' : ' '
	return `${year}-${month}-${day}${separator}${hours}:${minutes}:${seconds}`
}
