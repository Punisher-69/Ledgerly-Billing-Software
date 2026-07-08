import { useEffect, useState } from 'react'
import { getApi } from '@/lib/api'

const card = 'rounded-2xl bg-white border border-amber-400/40 p-6 shadow-sm'
const label = 'block text-sm font-medium text-zinc-800 mb-1'
const input =
  'w-full rounded-lg border border-amber-900/15 bg-white px-3 py-2 text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-400/50'

export function Settings() {
  const [shopName, setShopName] = useState('')
  const [currency, setCurrency] = useState('Rs')
  const [tax, setTax] = useState('0')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const s = await getApi().settingsGet()
        if (c) return
        setShopName(s.shop_name)
        setCurrency(s.currency_symbol)
        setTax(String(s.tax_percent))
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    try {
      await getApi().settingsUpdate({
        shop_name: shopName,
        currency_symbol: currency,
        tax_percent: parseFloat(tax) || 0,
      })
      setMsg('Saved.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed')
    }
  }

  if (loading) return <p className="text-zinc-600">Loading…</p>

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Settings</h1>
        <p className="text-zinc-700 mt-1">Shop name, currency, and default tax for new bills</p>
      </div>
      <form onSubmit={save} className={`${card} space-y-4`}>
        <div>
          <label className={label}>Shop name</label>
          <input className={input} value={shopName} onChange={(e) => setShopName(e.target.value)} />
        </div>
        <div>
          <label className={label}>Currency symbol</label>
          <input className={input} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="Rs" />
        </div>
        <div>
          <label className={label}>Tax % (applied on new bills)</label>
          <input type="number" step="0.01" min="0" className={input} value={tax} onChange={(e) => setTax(e.target.value)} />
        </div>
        {msg ? <p className="text-sm text-amber-950 font-medium">{msg}</p> : null}
        <button type="submit" className="rounded-lg bg-yellow-400 text-zinc-950 px-4 py-2.5 font-medium hover:bg-yellow-300">
          Save
        </button>
      </form>
    </div>
  )
}
