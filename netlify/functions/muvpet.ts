import { getUser } from '@netlify/identity'
import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { and, eq, desc, asc, sql, count, or, isNull, gte, lt } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db'
import * as tables from '../../db/schema'
import { canEditContent, canSubmitStatus, imageMime, isHttpsUrl, trialEndFor } from '../../server/policies'

const uuid = z.string().uuid()
const safeUrl = z.string().max(2048).refine(isHttpsUrl, 'Use um endereço HTTPS válido, sem credenciais.')
const imageUrl = z.string().max(2048).refine(value => /^\/api\/muvpet\/files\/[a-f0-9-]{36}$/.test(value) || isHttpsUrl(value), 'Imagem inválida.')
const taskInput = z.object({ petId: uuid, title: z.string().trim().min(1).max(150), category: z.enum(['Alimentação', 'Passeio', 'Higiene', 'Medicação', 'Vacina', 'Consulta', 'Brincadeira', 'Outro']), dueAt: z.iso.datetime(), notes: z.string().max(2000).default('') })
const petInput = z.object({ name: z.string().trim().min(1).max(80), species: z.enum(['dog', 'cat']), breed: z.string().max(100).default(''), birthDate: z.iso.date().refine(value => value <= new Date().toISOString().slice(0, 10), 'O nascimento não pode ser uma data futura.').nullish(), weight: z.string().max(20).refine(value => Number(value) > 0 && Number(value) <= 200, 'Informe um peso válido, em quilogramas.').nullish(), notes: z.string().max(2000).default(''), photo: imageUrl.nullish() })
const contentInput = z.object({ kind: z.enum(['article', 'product', 'place', 'event']), title: z.string().trim().min(3).max(160), description: z.string().trim().min(10).max(20000), category: z.string().trim().min(1).max(100), species: z.enum(['all', 'dog', 'cat']).default('all'), city: z.string().max(100).default(''), address: z.string().max(300).default(''), image: imageUrl.nullish(), url: safeUrl.nullish(), linkType: z.enum(['official', 'partner', 'affiliate']).default('official'), priceCents: z.number().int().min(0).max(100000000).nullish(), priceVerifiedAt: z.iso.datetime().nullish(), eventAt: z.iso.datetime().nullish(), status: z.enum(['draft', 'pending', 'published', 'rejected', 'corrections', 'archived']).default('draft'), feedback: z.string().max(2000).default('') })
class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }
function fail(status: number, message: string): never { throw new ApiError(status, message) }
const publicFilter = () => and(eq(tables.content.status, 'published'), or(isNull(tables.content.eventAt), gte(tables.content.eventAt, new Date())), sql`not exists (select 1 from ${tables.suppliers} where ${tables.suppliers.id} = ${tables.content.ownerId} and ${tables.suppliers.status} <> 'approved')`)
const publicItem = (item: typeof tables.content.$inferSelect) => ({ id: item.id, kind: item.kind, title: item.title, description: item.description, category: item.category, species: item.species, city: item.city, address: item.address, image: item.image, url: item.url, linkType: item.linkType, priceCents: item.priceCents, priceVerifiedAt: item.priceVerifiedAt, eventAt: item.eventAt, author: item.author, createdAt: item.createdAt })
async function configuration() {
  await db.insert(tables.settings).values({ id: 'global' }).onConflictDoNothing()
  const [config] = await db.select().from(tables.settings).where(eq(tables.settings.id, 'global'))
  return config
}
export default async function handler(request: Request) {
  try {
    const url = new URL(request.url)
    const parts = url.pathname.replace(/^\/api\/muvpet\/?/, '').split('/').filter(Boolean)
    const [resource, itemId] = parts
    const method = request.method
    const mutation = !['GET', 'HEAD'].includes(method)
    if (mutation) {
      if (request.headers.get('origin') !== url.origin) fail(403, 'Origem da solicitação não autorizada.')
      if (Number(request.headers.get('content-length') ?? 0) > 6 * 1024 * 1024) fail(413, 'Arquivo ou formulário muito grande.')
    }
    const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
    if (resource === 'public' && method === 'GET') {
      const items = await db.select().from(tables.content).where(publicFilter()).orderBy(desc(tables.content.createdAt)).limit(200)
      const config = await configuration()
      const publicItems = items.map(publicItem)
      return reply({ items: publicItems, settings: { trialDays: config.trialDays, welcomeText: config.welcomeText, supportEmail: config.supportEmail } })
    }
    if (resource === 'files' && itemId && method === 'GET') {
      uuid.parse(itemId)
      const [published] = await db.select({ id: tables.content.id }).from(tables.content).where(and(eq(tables.content.image, `/api/muvpet/files/${itemId}`), publicFilter())).limit(1)
      if (published) {
        const [file] = await db.select().from(tables.files).where(eq(tables.files.id, itemId))
        const data = file && await getStore('muvpet-images').get(itemId, { type: 'arrayBuffer' })
        if (!file || !data) fail(404, 'Imagem não encontrada.')
        return new Response(data, { headers: { 'Content-Type': file.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
      }
    }
    const identity = await getUser()
    if (!identity) fail(401, 'Entre na sua conta para continuar.')
    const isAdmin = identity.roles?.includes('admin') === true
    const config = await configuration()
    const started = new Date(identity.createdAt || Date.now())
    const ended = trialEndFor(started, config.trialDays)
    await db.insert(tables.profiles).values({ id: identity.id, name: identity.name || 'Tutor', email: identity.email || '', trialStart: started, trialEnd: ended }).onConflictDoNothing()
    const [profile] = await db.select().from(tables.profiles).where(eq(tables.profiles.id, identity.id))
    if (profile.suspended) fail(403, 'Sua conta está suspensa. Entre em contato com o suporte.')
    if (mutation) {
      const bucket = Math.floor(Date.now() / 60000)
      const [limit] = await db.insert(tables.rateLimits).values({ key: `${identity.id}:${bucket}`, expiresAt: new Date((bucket + 2) * 60000) }).onConflictDoUpdate({ target: tables.rateLimits.key, set: { count: sql`${tables.rateLimits.count} + 1` } }).returning()
      if (limit.count > 40) fail(429, 'Muitas ações em pouco tempo. Aguarde um minuto e tente novamente.')
      await db.delete(tables.rateLimits).where(lt(tables.rateLimits.expiresAt, new Date()))
    }
    const body = async () => {
      const raw = await request.text()
      if (raw.length > 60000) fail(413, 'O formulário ultrapassou o tamanho permitido.')
      try { return JSON.parse(raw) as unknown } catch { return fail(400, 'Formulário inválido.') }
    }
    const requireAdmin = () => { if (!isAdmin) fail(403, 'Esta área é exclusiva da administração.') }
    const ownPet = async (id: string) => {
      uuid.parse(id)
      const [pet] = await db.select().from(tables.pets).where(and(eq(tables.pets.id, id), eq(tables.pets.ownerId, identity.id)))
      if (!pet) fail(404, 'Pet não encontrado.')
      return pet
    }
    const ownedImage = async (image?: string | null, allowedExisting?: string | null) => {
      if (!image?.startsWith('/api/muvpet/files/')) return
      if (isAdmin && image === allowedExisting) return
      const [file] = await db.select().from(tables.files).where(eq(tables.files.id, image.split('/').pop()!))
      if (!file || file.ownerId !== identity.id) fail(403, 'Esta imagem não pertence à sua conta.')
    }
    if (resource === 'me' && method === 'GET') {
      const [supplier] = await db.select().from(tables.suppliers).where(eq(tables.suppliers.id, identity.id))
      return reply({ profile, role: isAdmin ? 'admin' : supplier ? 'supplier' : 'tutor', supplier: supplier ?? null, settings: { ...config, billingEnabled: false } })
    }
    if (resource === 'profile' && method === 'PATCH') {
      const values = z.object({ name: z.string().trim().min(1).max(100), city: z.string().max(100), communications: z.boolean() }).parse(await body())
      const [updated] = await db.update(tables.profiles).set(values).where(eq(tables.profiles.id, identity.id)).returning()
      return reply(updated)
    }
    if (resource === 'pets') {
      if (method === 'GET') return reply(await db.select().from(tables.pets).where(eq(tables.pets.ownerId, identity.id)).orderBy(asc(tables.pets.createdAt)))
      if (method === 'POST') { const values = petInput.parse(await body()); await ownedImage(values.photo); const [pet] = await db.insert(tables.pets).values({ ...values, ownerId: identity.id }).returning(); return reply(pet, 201) }
      if (itemId && method === 'PATCH') { await ownPet(itemId); const values = petInput.parse(await body()); await ownedImage(values.photo); const [pet] = await db.update(tables.pets).set(values).where(and(eq(tables.pets.id, itemId), eq(tables.pets.ownerId, identity.id))).returning(); return reply(pet) }
      if (itemId && method === 'DELETE') { await ownPet(itemId); await db.transaction(async transaction => { await transaction.delete(tables.pets).where(and(eq(tables.pets.id, itemId), eq(tables.pets.ownerId, identity.id))); await transaction.insert(tables.audit).values({ actorId: identity.id, action: 'pet.deleted', entityId: itemId }) }); return reply({ ok: true }) }
    }
    if (resource === 'tasks') {
      if (method === 'GET') return reply(await db.select().from(tables.tasks).where(eq(tables.tasks.ownerId, identity.id)).orderBy(asc(tables.tasks.dueAt)))
      if (method === 'POST') {
        const values = taskInput.parse(await body())
        await ownPet(values.petId)
        const [task] = await db.insert(tables.tasks).values({ ...values, ownerId: identity.id, dueAt: new Date(values.dueAt) }).returning()
        return reply(task, 201)
      }
      if (itemId) {
        uuid.parse(itemId)
        const predicate = and(eq(tables.tasks.id, itemId), eq(tables.tasks.ownerId, identity.id))
        const [task] = await db.select().from(tables.tasks).where(predicate)
        if (!task) fail(404, 'Cuidado não encontrado.')
        if (method === 'PATCH') {
          const values = z.union([z.object({ completed: z.boolean() }).strict(), taskInput]).parse(await body())
          if ('completed' in values) { const [updated] = await db.update(tables.tasks).set({ completedAt: values.completed ? new Date() : null }).where(predicate).returning(); return reply(updated) }
          await ownPet(values.petId)
          const [updated] = await db.update(tables.tasks).set({ ...values, dueAt: new Date(values.dueAt) }).where(predicate).returning()
          return reply(updated)
        }
        if (method === 'DELETE') { await db.delete(tables.tasks).where(predicate); return reply({ ok: true }) }
      }
    }
    if (resource === 'favorites') {
      if (method === 'GET') { const rows = await db.select({ item: tables.content }).from(tables.favorites).innerJoin(tables.content, eq(tables.favorites.contentId, tables.content.id)).where(and(eq(tables.favorites.ownerId, identity.id), publicFilter())); return reply(rows.map(row => ({ item: publicItem(row.item) }))) }
      if (itemId) {
        uuid.parse(itemId)
        if (method === 'POST') {
          const [item] = await db.select().from(tables.content).where(and(eq(tables.content.id, itemId), publicFilter()))
          if (!item) fail(404, 'Conteúdo indisponível.')
          await db.insert(tables.favorites).values({ ownerId: identity.id, contentId: itemId }).onConflictDoNothing()
          return reply({ ok: true })
        }
        if (method === 'DELETE') { await db.delete(tables.favorites).where(and(eq(tables.favorites.ownerId, identity.id), eq(tables.favorites.contentId, itemId))); return reply({ ok: true }) }
      }
    }
    if (resource === 'supplier') {
      if (method === 'POST' || method === 'PATCH') {
        if (isAdmin) fail(403, 'Use uma conta comercial separada da conta administrativa.')
        const values = z.object({ businessName: z.string().trim().min(2).max(150), phone: z.string().min(8).max(30), city: z.string().min(2).max(100), type: z.string().min(2).max(100), description: z.string().min(10).max(3000), website: safeUrl.nullish(), terms: z.literal(true) }).parse(await body())
        const { terms: acceptedTerms, ...data } = values
        void acceptedTerms
        const [existing] = await db.select().from(tables.suppliers).where(eq(tables.suppliers.id, identity.id))
        if (existing?.status === 'suspended') fail(403, 'Cadastro comercial suspenso. Contate o suporte.')
        const supplier = await db.transaction(async transaction => {
          const [result] = await transaction.insert(tables.suppliers).values({ ...data, id: identity.id, status: 'pending' }).onConflictDoUpdate({ target: tables.suppliers.id, set: { ...data, status: 'pending', feedback: '' } }).returning()
          await transaction.update(tables.content).set({ status: 'pending', updatedAt: new Date() }).where(and(eq(tables.content.ownerId, identity.id), eq(tables.content.status, 'published')))
          await transaction.insert(tables.audit).values({ actorId: identity.id, action: 'supplier.submitted', entityId: result.id })
          return result
        })
        return reply(supplier)
      }
    }
    if (resource === 'content') {
      const [supplier] = await db.select().from(tables.suppliers).where(eq(tables.suppliers.id, identity.id))
      if (!isAdmin && !supplier) fail(403, 'Crie seu perfil de fornecedor primeiro.')
      if (!isAdmin && supplier?.status === 'suspended') fail(403, 'Cadastro comercial suspenso.')
      if (method === 'GET') return reply(await db.select().from(tables.content).where(isAdmin ? undefined : eq(tables.content.ownerId, identity.id)).orderBy(desc(tables.content.updatedAt)))
      if (method === 'POST' || method === 'PATCH') {
        const parsed = contentInput.parse(await body())
        if (parsed.kind === 'event' && !parsed.eventAt) fail(400, 'Informe a data e o horário do evento.')
        if (parsed.priceCents != null && !parsed.priceVerifiedAt) fail(400, 'Informe a data de verificação do preço.')
        if (!canSubmitStatus(isAdmin, parsed.status)) fail(403, 'Somente a administração pode publicar ou aprovar conteúdo.')
        if (!isAdmin && parsed.linkType === 'affiliate') fail(403, 'Links de afiliados são gerenciados pela Muvpet.')
        const values = { ...parsed, priceVerifiedAt: parsed.priceVerifiedAt ? new Date(parsed.priceVerifiedAt) : null, eventAt: parsed.eventAt ? new Date(parsed.eventAt) : null, updatedAt: new Date() }
        if (itemId && method === 'PATCH') {
          uuid.parse(itemId)
          const [existing] = await db.select().from(tables.content).where(eq(tables.content.id, itemId))
          if (!existing || (!isAdmin && existing.ownerId !== identity.id)) fail(404, 'Conteúdo não encontrado.')
          await ownedImage(parsed.image, existing.image)
          if (!canEditContent(identity.id, isAdmin, existing.ownerId, existing.linkType)) fail(403, 'Este conteúdo contém um link gerenciado pela Muvpet.')
          if (isAdmin && parsed.status === 'published' && existing.ownerId !== identity.id) {
            const [ownerSupplier] = await db.select().from(tables.suppliers).where(eq(tables.suppliers.id, existing.ownerId))
            if (ownerSupplier && ownerSupplier.status !== 'approved') fail(400, 'Aprove o fornecedor antes de publicar seu conteúdo.')
          }
          const updated = await db.transaction(async transaction => {
            const [result] = await transaction.update(tables.content).set({ ...values, feedback: isAdmin ? values.feedback : '' }).where(eq(tables.content.id, itemId)).returning()
            await transaction.insert(tables.audit).values({ actorId: identity.id, action: 'content.updated', entityId: itemId, details: { previousStatus: existing.status, status: values.status } })
            return result
          })
          return reply(updated)
        }
        if (method === 'POST') {
          await ownedImage(parsed.image)
          const created = await db.transaction(async transaction => {
            const [result] = await transaction.insert(tables.content).values({ ...values, ownerId: identity.id, feedback: '', author: isAdmin ? 'Curadoria Muvpet' : supplier!.businessName }).returning()
            await transaction.insert(tables.audit).values({ actorId: identity.id, action: 'content.created', entityId: result.id })
            return result
          })
          return reply(created, 201)
        }
      }
    }
    if (resource === 'admin') {
      requireAdmin()
      if (itemId === 'overview' && method === 'GET') {
        const [usersCount] = await db.select({ total: count() }).from(tables.profiles)
        const [petsCount] = await db.select({ total: count() }).from(tables.pets)
        const [pendingCount] = await db.select({ total: count() }).from(tables.suppliers).where(eq(tables.suppliers.status, 'pending'))
        const [publishedCount] = await db.select({ total: count() }).from(tables.content).where(publicFilter())
        return reply({ tutors: usersCount.total, pets: petsCount.total, pendingSuppliers: pendingCount.total, published: publishedCount.total })
      }
      if (itemId === 'suppliers' && method === 'GET') return reply(await db.select().from(tables.suppliers).orderBy(desc(tables.suppliers.createdAt)))
      if (itemId === 'suppliers' && parts[2] && method === 'PATCH') {
        const values = z.object({ status: z.enum(['pending', 'review', 'approved', 'rejected', 'corrections', 'suspended']), feedback: z.string().max(2000).default('') }).parse(await body())
        const supplier = await db.transaction(async transaction => {
          const [result] = await transaction.update(tables.suppliers).set(values).where(eq(tables.suppliers.id, parts[2])).returning()
          if (!result) fail(404, 'Fornecedor não encontrado.')
          if (values.status !== 'approved') await transaction.update(tables.content).set({ status: 'pending', updatedAt: new Date() }).where(and(eq(tables.content.ownerId, result.id), eq(tables.content.status, 'published')))
          await transaction.insert(tables.audit).values({ actorId: identity.id, action: `supplier.${values.status}`, entityId: result.id })
          return result
        })
        return reply(supplier)
      }
      if (itemId === 'audit' && method === 'GET') return reply(await db.select().from(tables.audit).orderBy(desc(tables.audit.createdAt)).limit(100))
      if (itemId === 'requests' && method === 'GET') return reply(await db.select().from(tables.requests).orderBy(desc(tables.requests.createdAt)).limit(100))
      if (itemId === 'requests' && parts[2] && method === 'PATCH') {
        const values = z.object({ status: z.enum(['pending', 'review', 'resolved']) }).parse(await body())
        const [result] = await db.update(tables.requests).set(values).where(eq(tables.requests.id, uuid.parse(parts[2]))).returning()
        if (!result) fail(404, 'Solicitação não encontrada.')
        await db.insert(tables.audit).values({ actorId: identity.id, action: 'request.updated', entityId: result.id })
        return reply(result)
      }
      if (itemId === 'settings' && method === 'PATCH') {
        const values = z.object({ trialDays: z.number().int().min(1).max(365), priceCents: z.number().int().min(0).max(100000), billingPeriod: z.enum(['undefined', 'monthly', 'yearly']), welcomeText: z.string().min(3).max(200), supportEmail: z.union([z.email(), z.literal('')]) }).parse(await body())
        const updated = await db.transaction(async transaction => {
          const [result] = await transaction.update(tables.settings).set({ ...values, billingEnabled: false }).where(eq(tables.settings.id, 'global')).returning()
          await transaction.insert(tables.audit).values({ actorId: identity.id, action: 'settings.updated', entityId: 'global' })
          return result
        })
        return reply(updated)
      }
    }
    if (resource === 'files' && method === 'POST') {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || file.size === 0) fail(400, 'Escolha uma imagem de até 5 MB.')
      const bytes = new Uint8Array(await file.arrayBuffer())
      const mime = imageMime(bytes)
      if (!mime || file.type !== mime) fail(400, 'Envie uma imagem JPG, PNG ou WebP válida.')
      const id = crypto.randomUUID()
      await getStore('muvpet-images').set(id, bytes.buffer)
      await db.insert(tables.files).values({ id, ownerId: identity.id, mime, size: file.size })
      return reply({ url: `/api/muvpet/files/${id}` }, 201)
    }
    if (resource === 'files' && itemId && method === 'GET') {
      uuid.parse(itemId)
      const [file] = await db.select().from(tables.files).where(eq(tables.files.id, itemId))
      if (!file) fail(404, 'Imagem não encontrada.')
      if (file.ownerId !== identity.id) {
        const [businessContent] = isAdmin ? await db.select({ id: tables.content.id }).from(tables.content).where(eq(tables.content.image, `/api/muvpet/files/${itemId}`)).limit(1) : []
        if (!businessContent) fail(403, 'Imagem privada.')
      }
      const data = await getStore('muvpet-images').get(itemId, { type: 'arrayBuffer' })
      if (!data) fail(404, 'Imagem não encontrada.')
      return new Response(data, { headers: { 'Content-Type': file.mime, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } })
    }
    if (resource === 'export' && method === 'GET') {
      const ownPets = await db.select().from(tables.pets).where(eq(tables.pets.ownerId, identity.id))
      const ownTasks = await db.select().from(tables.tasks).where(eq(tables.tasks.ownerId, identity.id))
      const ownFavorites = await db.select().from(tables.favorites).where(eq(tables.favorites.ownerId, identity.id))
      const ownRequests = await db.select().from(tables.requests).where(eq(tables.requests.ownerId, identity.id))
      const ownFiles = await db.select().from(tables.files).where(eq(tables.files.ownerId, identity.id))
      const ownSuppliers = await db.select().from(tables.suppliers).where(eq(tables.suppliers.id, identity.id))
      const ownContent = await db.select().from(tables.content).where(eq(tables.content.ownerId, identity.id))
      return reply({ exportedAt: new Date(), profile, pets: ownPets, tasks: ownTasks, favorites: ownFavorites, requests: ownRequests, files: ownFiles, suppliers: ownSuppliers, content: ownContent })
    }
    if (resource === 'requests') {
      if (method === 'GET') return reply(await db.select().from(tables.requests).where(eq(tables.requests.ownerId, identity.id)).orderBy(desc(tables.requests.createdAt)))
      if (method === 'POST') { const values = z.object({ type: z.enum(['support', 'deletion', 'report']), message: z.string().trim().min(10).max(3000) }).parse(await body()); const [created] = await db.insert(tables.requests).values({ ...values, ownerId: identity.id }).returning(); return reply(created, 201) }
    }
    return reply({ error: 'Ação não encontrada.' }, 404)
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || 'Revise os dados do formulário.' }, { status: 400 })
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status })
    console.error('Muvpet API request failed', { kind: error instanceof Error ? error.name : 'UnknownError' })
    return Response.json({ error: 'Não foi possível concluir agora. Tente novamente. Se o problema continuar, contate o suporte.' }, { status: 503 })
  }
}
export const config: Config = { path: ['/api/muvpet', '/api/muvpet/*'] }
