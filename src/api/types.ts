export type User = {
	id: number
	email: string
	displayName: string
	createdAt?: string
	updatedAt?: string
}

export type ShareSummary = {
	id: number
	slug: string
	title: string
	hidden: boolean
	expiresAt: string | null
	createdAt: string
	updatedAt: string
	url: string
}

export type ShareDetail = {
	slug: string
	title: string
	leftContent: string
	rightContent: string
	ownerName: string
	expiresAt: string | null
	createdAt: string
	updatedAt: string
}

export class ApiError extends Error {
	status: number
	data: unknown

	constructor(message: string, status: number, data: unknown) {
		super(message)
		this.name = 'ApiError'
		this.status = status
		this.data = data
	}
}
