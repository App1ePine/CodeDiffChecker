const UNIT_IN_SECONDS: Record<string, number> = {
	s: 1,
	m: 60,
	h: 60 * 60,
	d: 60 * 60 * 24,
	w: 60 * 60 * 24 * 7,
}

export function durationToSeconds(input: string): number {
	const trimmed = input.trim()
	const match = /^(\d+)([smhdw])$/.exec(trimmed)
	if (!match) {
		throw new Error(`Unsupported duration format: ${input}`)
	}

	const valuePart = match[1]
	const unitPart = match[2]

	if (!valuePart || !unitPart) {
		throw new Error(`Unsupported duration format: ${input}`)
	}

	const unit = unitPart as keyof typeof UNIT_IN_SECONDS
	const multiplier = UNIT_IN_SECONDS[unit]
	if (!multiplier) {
		throw new Error(`Unsupported duration unit: ${unitPart}`)
	}

	const value = Number.parseInt(valuePart, 10)
	return value * multiplier
}
