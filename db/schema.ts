import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, index, uniqueIndex, check, foreignKey } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull(), city: text('city').notNull().default(''),
  communications: boolean('communications').notNull().default(false), suspended: boolean('suspended').notNull().default(false),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }), termsVersion: text('terms_version'),
  trialStart: timestamp('trial_start', { withTimezone: true }).notNull(), trialEnd: timestamp('trial_end', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [check('profiles_trial_dates_check', sql`${table.trialEnd} >= ${table.trialStart}`)])
export const pets = pgTable('pets', {
  id: uuid('id').primaryKey().defaultRandom(), ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), species: text('species').notNull(), breed: text('breed').notNull().default(''),
  birthDate: text('birth_date'), weight: text('weight'), notes: text('notes').notNull().default(''), photo: text('photo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('pets_owner_idx').on(table.ownerId), uniqueIndex('pets_id_owner_idx').on(table.id, table.ownerId), check('pets_species_check', sql`${table.species} in ('dog', 'cat')`)])
export const tasks = pgTable('care_tasks', {
  id: uuid('id').primaryKey().defaultRandom(), ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  petId: uuid('pet_id').notNull().references(() => pets.id, { onDelete: 'cascade' }), title: text('title').notNull(), category: text('category').notNull(),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(), notes: text('notes').notNull().default(''),
  completedAt: timestamp('completed_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('tasks_owner_due_idx').on(table.ownerId, table.dueAt), foreignKey({ columns: [table.petId, table.ownerId], foreignColumns: [pets.id, pets.ownerId], name: 'tasks_pet_owner_fk' }).onDelete('cascade')])
export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }), businessName: text('business_name').notNull(),
  phone: text('phone').notNull(), city: text('city').notNull(), type: text('type').notNull(), description: text('description').notNull(),
  website: text('website'), status: text('status').notNull().default('pending'), feedback: text('feedback').notNull().default(''),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [check('supplier_status_check', sql`${table.status} in ('pending', 'review', 'approved', 'rejected', 'corrections', 'suspended')`)])
export const content = pgTable('content', {
  id: uuid('id').primaryKey().defaultRandom(), ownerId: text('owner_id').notNull().references(() => profiles.id),
  kind: text('kind').notNull(), title: text('title').notNull(), description: text('description').notNull(), category: text('category').notNull(),
  species: text('species').notNull().default('all'), city: text('city').notNull().default(''), address: text('address').notNull().default(''),
  image: text('image'), url: text('url'), linkType: text('link_type').notNull().default('official'),
  priceCents: integer('price_cents'), priceVerifiedAt: timestamp('price_verified_at', { withTimezone: true }),
  eventAt: timestamp('event_at', { withTimezone: true }), status: text('status').notNull().default('draft'),
  feedback: text('feedback').notNull().default(''), author: text('author').notNull().default('Curadoria Muvpet'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('content_public_idx').on(table.status, table.kind), index('content_owner_idx').on(table.ownerId), check('content_kind_check', sql`${table.kind} in ('article', 'product', 'place', 'event')`), check('content_status_check', sql`${table.status} in ('draft', 'pending', 'published', 'rejected', 'corrections', 'archived')`), check('content_price_check', sql`${table.priceCents} is null or (${table.priceCents} >= 0 and ${table.priceVerifiedAt} is not null)`), check('content_event_date_check', sql`${table.kind} <> 'event' or ${table.eventAt} is not null`)])
export const favorites = pgTable('favorites', {
  id: uuid('id').primaryKey().defaultRandom(), ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  contentId: uuid('content_id').notNull().references(() => content.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('favorites_owner_content_idx').on(table.ownerId, table.contentId)])
export const settings = pgTable('settings', {
  id: text('id').primaryKey(), trialDays: integer('trial_days').notNull().default(30), priceCents: integer('price_cents').notNull().default(590),
  billingPeriod: text('billing_period').notNull().default('undefined'), billingEnabled: boolean('billing_enabled').notNull().default(false),
  welcomeText: text('welcome_text').notNull().default('Uma vida mais feliz, juntos.'), supportEmail: text('support_email').notNull().default(''),
}, table => [check('settings_trial_check', sql`${table.trialDays} between 1 and 365`), check('settings_price_check', sql`${table.priceCents} >= 0`), check('settings_billing_disabled_check', sql`${table.billingEnabled} = false`)])
export const audit = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(), actorId: text('actor_id').notNull(), action: text('action').notNull(), entityId: text('entity_id'),
  details: jsonb('details').$type<Record<string, unknown>>(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const files = pgTable('files', {
  id: uuid('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  mime: text('mime').notNull(), size: integer('size').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const requests = pgTable('support_requests', {
  id: uuid('id').primaryKey().defaultRandom(), ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), message: text('message').notNull(), status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull().default(1),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
