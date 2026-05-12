import { timingSafeEqual } from 'node:crypto'

export function verifyAuthHeader(header: string | undefined, expectedToken: string): boolean {
  if (!header) return false
  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false
  const provided = parts[1] ?? ''
  if (provided.length !== expectedToken.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expectedToken))
}
