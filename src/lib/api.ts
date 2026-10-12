export interface Pet { id: string; name: string; species: 'dog' | 'cat'; breed: string; birthDate: string | null; weight: string | null; notes: string; photo: string | null }
export interface CareTask { id: string; petId: string; title: string; category: string; dueAt: string; completedAt: string | null; notes: string }
export interface Content { id: string; ownerId: string; kind: 'article' | 'product' | 'place' | 'event'; title: string; description: string; category: string; species: string; city: string; address: string; image: string | null; url: string | null; linkType: string; priceCents: number | null; priceVerifiedAt: string | null; eventAt: string | null; status: string; feedback: string; author: string; createdAt: string }
export interface Supplier { id: string; businessName: string; phone: string; city: string; type: string; description: string; website: string | null; status: string; feedback: string }
export interface Settings { trialDays: number; priceCents: number; billingPeriod: string; billingEnabled: boolean; welcomeText: string; supportEmail: string }
export interface Account { profile: { id: string; name: string; email: string; city: string; communications: boolean; trialStart: string; trialEnd: string }; role: 'admin' | 'supplier' | 'tutor'; supplier: Supplier | null; settings: Settings }
export interface SupportRequest { id: string; type: string; message: string; status: string; createdAt: string }
export interface AuditRecord { id: string; action: string; actorId: string; entityId: string | null; createdAt: string }
export async function auth<Result = { authenticated: boolean; confirmationRequired?: boolean }>(action: string, data?: unknown): Promise<Result> {
  const response = await fetch(`/api/auth/${action}`, { method: data === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) })
  const result = await response.json().catch(() => ({ error: 'O serviço de acesso não respondeu.' }))
  if (!response.ok) throw new Error(result.error || 'Não foi possível acessar sua conta.')
  return result as Result
}
export const logout = () => auth('logout', {})
export function friendlyError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : ''
  if (/email.*confirm|confirm.*email/i.test(message)) return 'Confirme seu e-mail pelo link enviado antes de entrar.'
  if (/invalid.*credential|invalid.*password|user not found/i.test(message)) return 'E-mail ou senha não conferem. Revise os dados e tente novamente.'
  if (/signup.*disabled|signups.*not.*allowed/i.test(message)) return 'O cadastro não está disponível agora. Contate a administração.'
  if (/identity.*not|could not determine.*identity|MissingIdentity/i.test(message)) return 'O serviço de acesso ainda não está disponível. A administração precisa conferir a ativação do Netlify Identity.'
  if (/fetch|network|timeout/i.test(message)) return 'A conexão falhou. Confira sua internet e tente novamente.'
  return message || 'Não foi possível concluir agora. Tente novamente.'
}
export async function api<Result>(path: string, method = 'GET', data?: unknown, retry = true): Promise<Result> {
  const response = await fetch(`/api/muvpet/${path}`, { method, credentials: 'same-origin', headers: data instanceof FormData ? undefined : { 'Content-Type': 'application/json' }, body: data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data) })
  const result = await response.json().catch(() => ({ error: 'O serviço não respondeu. Tente novamente.' }))
  if (response.status === 401 && retry) { const session = await auth('session'); if (session.authenticated) return api<Result>(path, method, data, false) }
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a ação.')
  return result as Result
}
export async function upload(file: File | null): Promise<string | undefined> {
  if (!file?.size) return undefined
  const form = new FormData()
  form.set('file', file)
  return (await api<{ url: string }>('files', 'POST', form)).url
}
