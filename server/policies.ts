export function isHttpsUrl(value: string): boolean {
  if (!value) return true
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password } catch { return false }
}
export function canSubmitStatus(isAdmin: boolean, status: string): boolean { return isAdmin || ['draft', 'pending'].includes(status) }
export function canEditContent(actorId: string, isAdmin: boolean, ownerId: string, linkType: string): boolean { return isAdmin || (actorId === ownerId && linkType !== 'affiliate') }
export function trialEndFor(start: Date, days: number): Date { return new Date(start.getTime() + days * 86400000) }
export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') return 'image/png'
  if (new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}
