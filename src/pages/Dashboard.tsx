import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApi } from '@/lib/api'
import { formatMoney, todayISODate } from '@/lib/format'

const card = 'rounded-2xl bg-white border border-amber-400/40 p-6 shadow-sm'

export function Dashboard() {
  const [symbol, setSymbol] = useState('Rs')
  const [todayTotal, setTodayTotal] = useState<number | null>(null)
  const [todayCount, setTodayCount] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await getApi().settingsGet()
        if (cancelled) return
        setSymbol(s.currency_symbol)
        const t = todayISODate()
        const rep = await getApi().reportsSummary({ from: t, to: t })
        if (cancelled) return
        setTodayTotal(rep.gross_sales)
        setTodayCount(rep.invoice_count)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Welcome</h1>
        <p className="text-zinc-700 mt-1">Quick overview and shortcuts</p>
      </div>
      {error ? <p className="text-zinc-950 text-sm bg-yellow-200/80 border border-amber-500/40 px-2 py-1 rounded">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={card}>
          <p className="text-sm text-zinc-700">Today&apos;s sales</p>
          <p className="text-2xl font-semibold text-zinc-950 mt-1">
            {todayTotal === null ? '…' : formatMoney(todayTotal, symbol)}
          </p>
          <p className="text-sm text-zinc-600 mt-2">{todayCount === null ? '…' : `${todayCount} invoice(s)`}</p>
        </div>
        <div className={`${card} flex flex-col justify-center gap-3`}>
          <Link
            to="/invoice"
            className="inline-flex justify-center rounded-xl bg-yellow-400 text-zinc-950 px-4 py-3 font-medium hover:bg-yellow-300 transition-colors"
          >
            New bill
          </Link>
          <Link
            to="/products"
            className="inline-flex justify-center rounded-xl border border-amber-500/50 bg-yellow-50 text-zinc-950 px-4 py-3 font-medium hover:bg-yellow-100 transition-colors"
          >
            Manage products
          </Link>
        </div>
      </div>
    </div>
  )
}
