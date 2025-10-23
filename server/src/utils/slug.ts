import { customAlphabet } from 'nanoid'

const alphabet = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
const nanoid = customAlphabet(alphabet, 10)

export function createShareSlug(): string {
	return nanoid()
}
