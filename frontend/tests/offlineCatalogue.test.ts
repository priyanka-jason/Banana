import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OFFLINE_CACHE,
  type CacheStore,
  decodeSavedCatalogue,
  encodeSavedCatalogue,
  loadSavedCatalogue,
  saveCatalogue,
  savedAtLabel,
} from '../src/lib/offlineCatalogue.ts'
import type { Catalogue } from '../src/api/supabaseCatalogue.ts'

const catalogue = {
  stores: [{ id: 'walmart', name: 'Walmart', logo: '', website: '' }],
  offers: [
    {
      id: 'walmart:sim-milk',
      name: 'Milk',
      pack: '2 L',
      category: 'dairy-eggs',
      image: '',
      price: 4.49,
      unitPrice: '$2.25/L',
      storeId: 'walmart',
      distances: {
        'mount-pleasant': Infinity,
        kitsilano: Infinity,
        downtown: 2,
      },
    },
  ],
  branches: [],
  simulated: true,
} as unknown as Catalogue

/** A stand-in for the browser's Cache Storage. */
function fakeCaches() {
  const stores = new Map<string, Map<string, string>>()
  return {
    stores,
    async open(name: string) {
      const entries = stores.get(name) ?? new Map<string, string>()
      stores.set(name, entries)
      return {
        async put(key: string, response: Response) {
          entries.set(key, await response.text())
        },
        async match(key: string) {
          const body = entries.get(key)
          return body === undefined ? undefined : new Response(body)
        },
      }
    },
  } as unknown as CacheStore & { stores: Map<string, Map<string, string>> }
}

test('a saved catalogue reads back with its save time', async () => {
  const storage = fakeCaches()
  const now = new Date('2026-10-17T22:40:00Z')
  await saveCatalogue(catalogue, storage, now)
  assert.ok(storage.stores.has(OFFLINE_CACHE))
  const saved = await loadSavedCatalogue(storage)
  assert.equal(saved?.savedAt, '2026-10-17T22:40:00.000Z')
  assert.equal(saved?.catalogue.offers[0].price, 4.49)
  // JSON can't hold Infinity; unknown distances must come back as Infinity, not 0.
  assert.equal(saved?.catalogue.offers[0].distances['mount-pleasant'], Infinity)
  assert.equal(saved?.catalogue.offers[0].distances.downtown, 2)
})

test('nothing saved, or no storage at all, gives null', async () => {
  assert.equal(await loadSavedCatalogue(fakeCaches()), null)
  assert.equal(await loadSavedCatalogue(undefined), null)
  await saveCatalogue(catalogue, undefined) // must not throw
})

test('broken storage never breaks the app', async () => {
  const broken = {
    open: async () => {
      throw new Error('quota')
    },
  } as unknown as CacheStore
  await saveCatalogue(catalogue, broken)
  assert.equal(await loadSavedCatalogue(broken), null)
})

test('corrupt, wrong-shaped or older saves are ignored', () => {
  assert.equal(decodeSavedCatalogue('not json'), null)
  assert.equal(decodeSavedCatalogue('{}'), null)
  const good = JSON.parse(encodeSavedCatalogue(catalogue))
  assert.equal(
    decodeSavedCatalogue(JSON.stringify({ ...good, version: 0 })),
    null,
  )
  assert.equal(
    decodeSavedCatalogue(JSON.stringify({ ...good, savedAt: 'yesterday' })),
    null,
  )
  assert.equal(
    decodeSavedCatalogue(
      JSON.stringify({ ...good, catalogue: { ...catalogue, offers: null } }),
    ),
    null,
  )
})

test('the save time is shown in Vancouver time', () => {
  assert.match(savedAtLabel('2026-10-17T22:40:00Z'), /Oct 17.*3:40/)
})
