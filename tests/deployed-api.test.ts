import { test } from 'node:test'
import assert from 'node:assert/strict'

const site = process.env.MUVPET_TEST_URL
test('deployed API rejects unauthenticated private access', { skip: !site }, async () => {
  for (const resource of ['me', 'pets', 'tasks', 'favorites', 'content', 'admin/overview', 'admin/audit', 'export', 'requests']) {
    const response = await fetch(`${site}/api/muvpet/${resource}`)
    assert.equal(response.status, 401, `Private resource ${resource} must reject access`)
  }
})
test('deployed API rejects cross-origin writes', { skip: !site }, async () => {
  const response = await fetch(`${site}/api/muvpet/pets`, { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Permission test', species: 'dog' }) })
  assert.equal(response.status, 403)
  const authResponse = await fetch(`${site}/api/auth/login`, { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}' })
  assert.equal(authResponse.status, 403)
})
test('public catalog never exposes moderation or owner identity', { skip: !site }, async () => {
  const response = await fetch(`${site}/api/muvpet/public`)
  assert.equal(response.status, 200)
  const result = await response.json() as { items: Record<string, unknown>[] }
  for (const item of result.items) {
    assert.equal('ownerId' in item, false)
    assert.equal('feedback' in item, false)
    assert.equal('status' in item, false)
  }
})
