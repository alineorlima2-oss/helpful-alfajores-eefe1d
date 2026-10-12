import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canEditContent, canSubmitStatus, imageMime, isHttpsUrl, trialEndFor } from '../server/policies.ts'

test('supplier cannot publish, reject or approve its own submission', () => {
  for (const status of ['published', 'approved', 'rejected', 'corrections']) assert.equal(canSubmitStatus(false, status), false)
  assert.equal(canSubmitStatus(false, 'draft'), true)
  assert.equal(canSubmitStatus(false, 'pending'), true)
  assert.equal(canSubmitStatus(true, 'published'), true)
})
test('supplier cannot edit another account or Muvpet affiliate links', () => {
  assert.equal(canEditContent('supplier-a', false, 'supplier-b', 'partner'), false)
  assert.equal(canEditContent('supplier-a', false, 'supplier-a', 'affiliate'), false)
  assert.equal(canEditContent('supplier-a', false, 'supplier-a', 'partner'), true)
  assert.equal(canEditContent('admin', true, 'supplier-a', 'affiliate'), true)
})
test('external links only allow HTTPS without embedded credentials', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'https://user:password@example.com', '/relative', 'not a link']) assert.equal(isHttpsUrl(value), false)
  assert.equal(isHttpsUrl('https://example.com/product?ref=muvpet'), true)
  assert.equal(isHttpsUrl(''), true)
})
test('trial uses creation date rather than login date', () => {
  const createdAt = new Date('2026-10-12T15:00:00Z')
  assert.equal(trialEndFor(createdAt, 30).toISOString(), '2026-11-11T15:00:00.000Z')
  assert.equal(createdAt.toISOString(), '2026-10-12T15:00:00.000Z')
})
test('upload signatures accept raster images and reject executable markup', () => {
  assert.equal(imageMime(new Uint8Array([255, 216, 255, 0])), 'image/jpeg')
  assert.equal(imageMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png')
  assert.equal(imageMime(new TextEncoder().encode('RIFF1234WEBP')), 'image/webp')
  assert.equal(imageMime(new TextEncoder().encode('<svg onload="alert(1)">')), null)
  assert.equal(imageMime(new TextEncoder().encode('<script>alert(1)</script>')), null)
})
