import { useCallback, useEffect, useState } from 'react'
import { getApi } from '@/lib/api'
import type { ProductRow } from '@/types/ipc'
import { formatMoney } from '@/lib/format'

const card = 'rounded-2xl bg-white border border-amber-400/40 p-6 shadow-sm'
const label = 'block text-sm font-medium text-zinc-800 mb-1'
const input =
  'w-full rounded-lg border border-amber-900/15 bg-white px-3 py-2 text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-400/50'

export function Products() {
  const [symbol, setSymbol] = useState('Rs')
  const [search, setSearch] = useState('')
  const [list, setList] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ProductRow | null>(null)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const s = await getApi().settingsGet()
      setSymbol(s.currency_symbol)
      const rows = await getApi().productsList(search.trim() || undefined)
      setList(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  function openNew() {
    setEditing(null)
    setName('')
    setSku('')
    setPrice('')
    setStock('')
    setFormError('')
  }

  function openEdit(p: ProductRow) {
    setEditing(p)
    setName(p.name)
    setSku(p.sku ?? '')
    setPrice(String(p.unit_price))
    setStock(p.stock != null ? String(p.stock) : '')
    setFormError('')
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const unit = parseFloat(price)
    if (!name.trim()) {
      setFormError('Name is required')
      return
    }
    if (Number.isNaN(unit) || unit < 0) {
      setFormError('Valid price is required')
      return
    }
    try {
      if (editing) {
        await getApi().productsUpdate({
          id: editing.id,
          name: name.trim(),
          sku: sku.trim() || null,
          unit_price: unit,
          stock: stock === '' ? null : parseFloat(stock),
        })
      } else {
        await getApi().productsCreate({
          name: name.trim(),
          sku: sku.trim() || null,
          unit_price: unit,
          stock: stock === '' ? null : parseFloat(stock),
        })
      }
      openNew()
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function archive(p: ProductRow) {
    if (!confirm(`Archive “${p.name}”? It will be hidden from new bills.`)) return
    try {
      await getApi().productsUpdate({ id: p.id, active: 0 })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Products</h1>
        <p className="text-zinc-700 mt-1">Add items you sell; search by name, ID, or SKU</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className={card}>
          <h2 className="font-medium text-zinc-950 mb-4">{editing ? 'Edit product' : 'Add product'}</h2>
          <form onSubmit={submitForm} className="space-y-3">
            <div>
              <label className={label}>Name</label>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={label}>SKU / code (optional)</label>
              <input className={input} value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div>
              <label className={label}>Unit price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={input}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Stock note (optional)</label>
              <input className={input} value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            {formError ? (
              <p className="text-sm text-zinc-950 bg-yellow-200/80 border border-amber-500/40 px-2 py-1 rounded">{formError}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" className="rounded-lg bg-yellow-400 text-zinc-950 px-4 py-2 font-medium hover:bg-yellow-300">
                {editing ? 'Update' : 'Add product'}
              </button>
              {editing ? (
                <button type="button" onClick={openNew} className="rounded-lg border border-amber-500/50 px-4 py-2 hover:bg-yellow-50 text-zinc-950">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className={card}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <input
              placeholder="Search…"
              className={`flex-1 ${input}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {error ? <p className="text-zinc-950 text-sm mb-2 bg-yellow-200/80 border border-amber-500/40 px-2 py-1 rounded">{error}</p> : null}
          {loading ? (
            <p className="text-zinc-600">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-zinc-600">No products yet. Add one on the left.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-700 border-b border-amber-900/15">
                    <th className="pb-2 pr-2">ID</th>
                    <th className="pb-2 pr-2">Name</th>
                    <th className="pb-2 pr-2">Price</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} className="border-b border-amber-900/8">
                      <td className="py-2 pr-2 text-zinc-600">{p.id}</td>
                      <td className="py-2 pr-2 font-medium text-zinc-950">{p.name}</td>
                      <td className="py-2 pr-2 text-zinc-800">{formatMoney(p.unit_price, symbol)}</td>
                      <td className="py-2 text-right space-x-2 whitespace-nowrap">
                        <button type="button" className="text-amber-950 font-medium hover:underline" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                        <button type="button" className="text-zinc-700 hover:underline" onClick={() => archive(p)}>
                          Archive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
