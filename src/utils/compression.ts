import { gzip, ungzip } from 'pako'

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const subarray = bytes.subarray(i, i + chunkSize)
    chunks.push(String.fromCharCode(...subarray))
  }
  return btoa(chunks.join(''))
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64)
  const length = binary.length
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function encodeContent(text: string): string {
  const compressed = gzip(text)
  return uint8ToBase64(compressed)
}

export function decodeContent(payload: string): string {
  const buffer = base64ToUint8(payload)
  return ungzip(buffer, { to: 'string' })
}
