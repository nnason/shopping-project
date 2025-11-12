
'use client'
import React, { useEffect, useMemo, useState } from 'react'

// Load Skimlinks monetization script on the client
if (typeof window !== 'undefined' && !document.getElementById('skimlinks-lib')) {
  const skim = document.createElement('script')
  skim.id = 'skimlinks-lib'
  skim.type = 'text/javascript'
  skim.src = 'https://s.skimresources.com/js/294227X1781504.skimlinks.js'
  document.head.appendChild(skim)
}

type Product = {
  id?: string
  name?: string
  brand?: string
  price?: number
  gender?: string
  sizes?: string[]
  palette?: string
  body?: string[]
  materials?: string[]
  type?: string
  image?: string
  url?: string
  rating?: number
  inStock?: boolean
  _score?: number
}

const COLORS = [
  { id: 'soft-summer', label: 'Soft Summer' },
  { id: 'warm-autumn', label: 'Warm Autumn' },
  { id: 'cool-winter', label: 'Cool Winter' },
  { id: 'light-spring', label: 'Light Spring' },
]

const BODY_TYPES = [
  { id: 'hourglass', label: 'Hourglass' },
  { id: 'pear', label: 'Pear' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'inverted-triangle', label: 'Inverted Triangle' },
]

const MATERIALS = ['Cotton', 'Silk', 'Denim', 'Linen', 'Wool', 'Cashmere', 'Viscose', 'Polyester']
const GENDERS = ['Female', 'Male', 'Unisex']

const SAMPLE_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Silk Button Down Blouse', brand: 'Éclat', price: 145, gender: 'Female', sizes: ['XS','S','M','L'], palette: 'cool-winter', body: ['hourglass','rectangle'], materials: ['Silk'], type: 'Tops', image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=1200&auto=format&fit=crop', url: 'https://example.com/product/silk-button-down', rating: 4.6, inStock: true },
  { id: 'p2', name: 'High-Rise Wide-Leg Trousers', brand: 'Forma', price: 98, gender: 'Female', sizes: ['24','25','26','27','28','29','30'], palette: 'soft-summer', body: ['pear','hourglass'], materials: ['Linen','Cotton'], type: 'Pants', image: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=1200&auto=format&fit=crop', url: 'https://example.com/product/wide-leg-trousers', rating: 4.7, inStock: true },
  { id: 'p3', name: 'Halter Top Knit Tank', brand: 'Arcadia', price: 48, gender: 'Female', sizes: ['XS','S','M'], palette: 'light-spring', body: ['rectangle','inverted-triangle'], materials: ['Cotton','Viscose'], type: 'Tops', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop', url: 'https://example.com/product/halter-top', rating: 4.2, inStock: true },
]

const DEFAULT_PREFS = { palette: '', body: '', materials: [] as string[], gender: '', clothingSize: '', bottomsSize: '', shoeSize: '' }

function normalize(str?: string) { return (str || '').toLowerCase() }
function matchesQuery(p: Product, q: string) {
  if (!q) return 1
  const hay = [p.name, p.brand, p.type].map(normalize).join(' ')
  const terms = normalize(q).split(/\s+/).filter(Boolean)
  let score = 0; for (const t of terms) { if (hay.includes(t)) score += 1 }
  return score
}
function scoreProduct(p: Product, { q, locationBoost = 0.2 }: { q: string, locationBoost?: number }) {
  let score = 0
  score += matchesQuery(p, q) * 3
  score += p.inStock ? 1 : -2
  score += (p.rating || 0) / 5
  score += locationBoost
  return score
}

export default function Page() {
  const [query, setQuery] = useState('')
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(5000)
  const [sort, setSort] = useState<'relevance'|'price-asc'|'price-desc'|'rating'>('relevance')
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [liveItems, setLiveItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('fashion-prefs')
    const fav = localStorage.getItem('fashion-favs')
    if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) })
    if (fav) setFavorites(JSON.parse(fav))
  }, [])
  useEffect(() => { localStorage.setItem('fashion-prefs', JSON.stringify(prefs)) }, [prefs])
  useEffect(() => { localStorage.setItem('fashion-favs', JSON.stringify(favorites)) }, [favorites])

  async function fetchJSON(url: string) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  async function loadFeeds(q: string): Promise<Product[]> {
    const tasks: Promise<any>[] = []
    const RAK = '/api/rakuten'
    const SK = '/api/skimlinks'
    const AMZ = '/api/amazon'
    tasks.push(fetchJSON(`${RAK}?query=${encodeURIComponent(q)}`))
    tasks.push(fetchJSON(`${SK}?query=${encodeURIComponent(q)}`))
    tasks.push(fetchJSON(`${AMZ}?query=${encodeURIComponent(q)}`))
    const arrays = await Promise.allSettled(tasks)
    const items = arrays.flatMap(r => (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [])) as Product[]
    const seen = new Set<string>()
    const dedup: Product[] = []
    for (const it of items) {
      const key = it.id || it.url || Math.random().toString(36).slice(2)
      if (seen.has(key)) continue
      seen.add(key)
      dedup.push(it)
    }
    return dedup
  }

  useEffect(() => {
    const t = setTimeout(async () => {
      setError(''); setLoading(true)
      try {
        const merged = await loadFeeds(query)
        setLiveItems(merged)
      } catch (e: any) {
        setError(e?.message || String(e))
        setLiveItems([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const sourceItems = liveItems.length ? liveItems : SAMPLE_PRODUCTS

  const filtered = useMemo(() => {
    const price: [number, number] = [Math.min(minPrice, maxPrice), Math.max(minPrice, maxPrice)]
    return sourceItems
      .filter((p) => {
        const inPrice = typeof p.price === 'number' ? (p.price >= price[0] && p.price <= price[1]) : true
        const byGender = !prefs.gender || p.gender === prefs.gender || p.gender === 'Unisex'
        const byPalette = !prefs.palette || p.palette === prefs.palette
        const byBody = !prefs.body || (p.body || []).includes(prefs.body)
        const byMaterials = !prefs.materials.length || prefs.materials.every(m => (p.materials || []).includes(m))
        const sizePass = true
        const queryScore = matchesQuery(p, query)
        return inPrice && byGender && byPalette && byBody && byMaterials && sizePass && queryScore >= 0
      })
      .map(p => ({ ...p, _score: scoreProduct(p, { q: query }) }))
      .sort((a, b) => {
        if (sort === 'price-asc') return (a.price||0) - (b.price||0)
        if (sort === 'price-desc') return (b.price||0) - (a.price||0)
        if (sort === 'rating') return (b.rating||0) - (a.rating||0)
        return (b._score||0) - (a._score||0)
      })
  }, [query, prefs, minPrice, maxPrice, sort, sourceItems])

  const toggleFav = (id: string) => setFavorites(f => (f.includes(id) ? f.filter(x => x !== id) : [...f, id]))
  const clearAll = () => { setPrefs(DEFAULT_PREFS); setMinPrice(0); setMaxPrice(5000); setQuery(''); setSort('relevance') }

  return (
    <div className="min-h-screen">
      <section className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-3">
            <h1 className="text-2xl font-semibold tracking-tight flex-1">Find your style</h1>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button className="px-3 py-2 rounded-xl border" onClick={() => setShowFilters(v => !v)}>Filters</button>
              <button className="px-3 py-2 rounded-xl border" onClick={clearAll}>Clear</button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <div className="relative">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items (e.g., 'women\\'s trousers', 'halter top')" className="h-12 w-full rounded-xl border px-3" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <select value={prefs.palette} onChange={(e) => setPrefs((p) => ({ ...p, palette: e.target.value }))} className="h-12 w-full rounded-xl border px-3">
                <option value="">Color palette</option>
                {COLORS.map(c => (<option key={c.id} value={c.id}>{c.label}</option>))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <select value={prefs.body} onChange={(e) => setPrefs((p) => ({ ...p, body: e.target.value }))} className="h-12 w-full rounded-xl border px-3">
                <option value="">Body type</option>
                {BODY_TYPES.map(b => (<option key={b.id} value={b.id}>{b.label}</option>))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <select value={prefs.materials[0] || ''} onChange={(e) => setPrefs((p) => ({ ...p, materials: e.target.value ? [e.target.value] : [] }))} className="h-12 w-full rounded-xl border px-3">
                <option value="">Material</option>
                {MATERIALS.map(m => (<option key={m} value={m}>{m}</option>))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-6 py-6 lg:grid-cols-12">
          {showFilters && (
            <aside className="lg:col-span-3 space-y-6">
              <div className="rounded-2xl border p-4 shadow-sm">
                <div className="text-lg font-semibold mb-3">Filters</div>
                <div className="mb-4">
                  <div className="mb-2 text-sm font-medium">Price</div>
                  <div className="flex items-center gap-3 text-sm">
                    <input type="number" className="w-24 rounded-lg border px-2 py-1" value={minPrice} onChange={(e)=>setMinPrice(Number(e.target.value)||0)} />
                    <span>to</span>
                    <input type="number" className="w-24 rounded-lg border px-2 py-1" value={maxPrice} onChange={(e)=>setMaxPrice(Number(e.target.value)||0)} />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-2 text-sm font-medium">Gender</div>
                  <div className="flex flex-wrap gap-2">
                    {GENDERS.map((g) => (
                      <button key={g} className={`rounded-full border px-3 py-1 text-sm ${prefs.gender===g?'bg-black text-white':'bg-white'}`} onClick={()=>setPrefs((p)=>({...p, gender: p.gender===g?'':g}))}>{g}</button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          )}

          <section className={showFilters ? 'lg:col-span-9' : 'lg:col-span-12'}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="text-sm opacity-70">{loading ? 'Loading…' : `${filtered.length} item(s) found`}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {query && <span className="rounded-full border px-2 py-1">Query: {query}</span>}
                {prefs.palette && <span className="rounded-full border px-2 py-1">Palette: {COLORS.find(c=>c.id===prefs.palette)?.label}</span>}
                {prefs.body && <span className="rounded-full border px-2 py-1">Body: {BODY_TYPES.find(b=>b.id===prefs.body)?.label}</span>}
                {!!prefs.materials.length && <span className="rounded-full border px-2 py-1">Material: {prefs.materials.join(', ')}</span>}
              </div>
            </div>

            {error && (<div className="mb-3 rounded-xl border bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>)}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((p) => (
                <div key={p.id || p.url} className="overflow-hidden rounded-2xl border shadow-sm">
                  <div className="relative aspect-[3/4] overflow-hidden">
                    {p.image && <img src={p.image} alt={p.name || ''} className="h-full w-full object-cover" />}
                    <button aria-label="Save to favorites" className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs shadow" onClick={()=>toggleFav(String(p.id || p.url))}>
                      {favorites.includes(String(p.id || p.url)) ? '♥ Saved' : '♡ Save'}
                    </button>
                  </div>
                  <div className="space-y-1 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium leading-tight line-clamp-1">{p.name}</div>
                      {typeof p.price === 'number' && <div className="text-sm font-semibold">${p.price}</div>}
                    </div>
                    <div className="text-xs opacity-70 line-clamp-1">{p.brand} • {p.type}</div>
                    {p.rating && <div className="text-xs">★ {p.rating}</div>}
                    {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline underline-offset-4">View on retailer ↗</a>}
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && !loading && (<div className="py-20 text-center opacity-60">No items match your filters. Try clearing some filters or broadening your search.</div>)}
          </section>
        </div>

        <footer className="border-t py-8 text-center text-sm opacity-70">
          Live results via Skimlinks/Rakuten/Amazon proxies. Outbound links are monetized by the Skimlinks script.
        </footer>
      </main>
    </div>
  )
}
