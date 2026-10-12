import { getUser, logout } from '@netlify/identity'
import type { Config, Context } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db'
import { profiles, rateLimits, settings } from '../../db/schema'
import { trialEndFor } from '../../server/policies'

interface Tokens { access_token: string; refresh_token: string; expires_in: number }
interface IdentityUser { id: string; created_at: string; email: string; confirmed_at?: string; user_metadata?: { full_name?: string } }
class AuthFailure extends Error { constructor(message: string, public status = 400) { super(message) } }
export default async function handler(request: Request, context: Context) {
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  const url = new URL(request.url)
  const action = url.pathname.split('/').pop()
  const endpoint = new URL('/.netlify/identity', url.origin).href
  function cookies(tokens: Tokens) {
    context.cookies.set({ name: 'nf_jwt', value: tokens.access_token, httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: tokens.expires_in || 3600 })
    context.cookies.set({ name: 'nf_refresh', value: tokens.refresh_token, httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 30 * 86400 })
  }
  async function provider(path: string, body: unknown, form = false, accessToken?: string, method = 'POST') {
    const response = await fetch(`${endpoint}${path}`, { method, headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: method === 'GET' ? undefined : form ? body as string : JSON.stringify(body), signal: AbortSignal.timeout(12000) })
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { msg?: string; error_description?: string }
      if (response.status >= 500) throw new AuthFailure('O serviço de acesso não está disponível agora. Tente novamente.', 503)
      if (/not.*confirm|confirm.*email/i.test(data.msg || data.error_description || '')) throw new AuthFailure('Confirme seu e-mail pelo link enviado antes de entrar.')
      if (response.status === 429) throw new AuthFailure('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 429)
      if (path === '/token') throw new AuthFailure('E-mail ou senha não conferem. Revise os dados e tente novamente.', 401)
      if (path === '/verify') throw new AuthFailure('Este link expirou ou já foi usado. Solicite um novo link de acesso.')
      throw new AuthFailure('O serviço de acesso não concluiu a solicitação. Confira a ativação do Identity e tente novamente.')
    }
    return response.json()
  }
  async function enroll(user: IdentityUser, name?: string) {
    await db.insert(settings).values({ id: 'global' }).onConflictDoNothing()
    const [configuration] = await db.select().from(settings).where(eq(settings.id, 'global'))
    const start = new Date(user.created_at)
    await db.insert(profiles).values({ id: user.id, name: name || user.user_metadata?.full_name || 'Tutor', email: user.email, trialStart: start, trialEnd: trialEndFor(start, configuration.trialDays), termsAcceptedAt: new Date(), termsVersion: '2026-10-12-inicial' }).onConflictDoNothing()
  }
  try {
    if (action === 'session' && request.method === 'GET') {
      const user = await getUser()
      if (user) return reply({ authenticated: true })
      const refreshToken = context.cookies.get('nf_refresh')
      if (!refreshToken) return reply({ authenticated: false })
      try {
        const tokens = await provider('/token', new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(), true) as Tokens
        cookies(tokens)
        return reply({ authenticated: true })
      } catch (error) { if (!(error instanceof AuthFailure) || error.status !== 401) throw error; context.cookies.delete('nf_jwt'); context.cookies.delete('nf_refresh'); return reply({ authenticated: false }) }
    }
    if (request.method !== 'POST') return reply({ error: 'Ação não disponível.' }, 405)
    if (request.headers.get('origin') !== url.origin) return reply({ error: 'Origem não autorizada.' }, 403)
    if (action === 'logout') { await logout(); context.cookies.delete('nf_jwt'); context.cookies.delete('nf_refresh'); return reply({ ok: true }) }
    const bucket = Math.floor(Date.now() / 600000)
    const key = `auth:${createHash('sha256').update(context.ip || 'unknown').digest('hex')}:${bucket}`
    const [limit] = await db.insert(rateLimits).values({ key, expiresAt: new Date((bucket + 2) * 600000) }).onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } }).returning()
    if (limit.count > 30) return reply({ error: 'Muitas tentativas. Aguarde alguns minutos para tentar novamente.' }, 429)
    const raw = await request.text()
    if (raw.length > 10000) return reply({ error: 'Formulário muito grande.' }, 413)
    const input = JSON.parse(raw) as unknown
    if (action === 'login' || action === 'signup') {
      const values = z.object({ email: z.email().max(254), password: z.string().min(action === 'signup' ? 10 : 1).max(128), name: z.string().trim().min(2).max(100).optional(), terms: z.boolean().optional() }).parse(input)
      if (action === 'signup') {
        if (!values.name) return reply({ error: 'Informe seu nome.' }, 400)
        if (!values.terms) return reply({ error: 'Leia e aceite os termos e a política de privacidade.' }, 400)
        const user = await provider('/signup', { email: values.email, password: values.password, data: { full_name: values.name } }) as IdentityUser
        await enroll(user, values.name)
        if (!user.confirmed_at) return reply({ confirmationRequired: true })
      }
      const tokens = await provider('/token', new URLSearchParams({ grant_type: 'password', username: values.email, password: values.password }).toString(), true) as Tokens
      cookies(tokens)
      return reply({ authenticated: true, confirmationRequired: false })
    }
    if (action === 'recover') {
      const values = z.object({ email: z.email() }).parse(input)
      await provider('/recover', { email: values.email })
      return reply({ ok: true })
    }
    if (action === 'verify') {
      const values = z.object({ type: z.enum(['confirmation', 'recovery', 'invite']), token: z.string().min(1).max(4096), password: z.string().min(10).max(128).optional(), terms: z.boolean().optional() }).parse(input)
      if (values.type !== 'confirmation' && !values.password) return reply({ error: 'Informe uma nova senha.' }, 400)
      if (values.type === 'invite' && !values.terms) return reply({ error: 'Leia e aceite os termos e a política de privacidade.' }, 400)
      const tokens = await provider('/verify', { type: values.type === 'recovery' ? 'recovery' : 'signup', token: values.token, ...(values.type === 'invite' ? { password: values.password } : {}) }) as Tokens
      if (values.type === 'recovery') await provider('/user', { password: values.password }, false, tokens.access_token, 'PUT')
      if (values.type === 'invite') { const user = await provider('/user', undefined, false, tokens.access_token, 'GET') as IdentityUser; await enroll(user) }
      cookies(tokens)
      return reply({ authenticated: true })
    }
    return reply({ error: 'Ação não encontrada.' }, 404)
  } catch (error) {
    if (error instanceof z.ZodError) return reply({ error: 'Revise o e-mail, a senha e os campos obrigatórios.' }, 400)
    if (error instanceof SyntaxError) return reply({ error: 'Formulário inválido.' }, 400)
    if (error instanceof AuthFailure) return reply({ error: error.message }, error.status)
    return reply({ error: 'O serviço de acesso não respondeu. Tente novamente.' }, 503)
  }
}
export const config: Config = { path: '/api/auth/*' }
