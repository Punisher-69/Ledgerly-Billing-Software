import { useEffect, useState } from 'react'
import { getApi } from '@/lib/api'
import { addDaysISO, formatMoney, startOfYearISO, todayISODate } from '@/lib/format'

const card = 'rounded-2xl bg-white border border-amber-400/40 p-6 shadow-sm'
const btnGhost = 'rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-zinc-950 hover:bg-yellow-100'
const input = 'rounded-lg border border-amber-900/15 bg-white px-3 py-2 text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-400/50'

export function Reports() {
  const [symbol, setSymbol] = useState('Rs')
  const [from, setFrom] = useState(todayISODate())
  const [to, setTo] = useState(todayISODate())
  const [summary, setSummary] = useState<{
    invoice_count: number
    gross_sales: number
    tax_total: number
    lines: { name: string; qty_sold: number; revenue: number }[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pdfMsg, setPdfMsg] = useState('')

  useEffect(() => {
    let c = false
    ;(async () => {
      const s = await getApi().settingsGet()
      if (!c) setSymbol(s.currency_symbol)
    })()
    return () => {
      c = true
    }
  }, [])

  async function load() {
    setError('')
    setLoading(true)
    try {
      const rep = await getApi().reportsSummary({ from, to })
      setSummary(rep)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  function presetToday() {
    const t = todayISODate()
    setFrom(t)
    setTo(t)
  }
  function presetLastDays(n: number) {
    const end = todayISODate()
    const start = addDaysISO(end, -(n - 1))
    setFrom(start)
    setTo(end)
  }
  function presetYear() {
    setFrom(startOfYearISO())
    setTo(todayISODate())
  }

  useEffect(() => {
    const t = setTimeout(() => void load(), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  async function exportPdf() {
    setPdfMsg('')
    try {
      const r = await getApi().reportsExportPdf({ from, to })
      if (r.ok) setPdfMsg(`Saved: ${r.path}`)
      else if (r.error !== 'Canceled') setPdfMsg(r.error)
    } catch (e) {
      setPdfMsg(e instanceof Error ? e.message : 'Export failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Reports</h1>
        <p className="text-zinc-700 mt-1">Pick a date range and export a PDF summary</p>
      </div>

      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={presetToday} className={btnGhost}>
            Today
          </button>
          <button type="button" onClick={() => presetLastDays(5)} className={btnGhost}>
            Last 5 days
          </button>
          <button type="button" onClick={() => presetLastDays(10)} className={btnGhost}>
            Last 10 days
          </button>
          <button type="button" onClick={() => presetLastDays(30)} className={btnGhost}>
            Last 30 days
          </button>
          <button type="button" onClick={presetYear} className={btnGhost}>
            Year to date
          </button>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-zinc-700 mb-1">From</label>
            <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-zinc-700 mb-1">To</label>
            <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-yellow-100 px-4 py-2 text-sm font-medium text-zinc-950 border border-amber-500/40 hover:bg-yellow-200/80"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            className="rounded-lg bg-yellow-400 text-zinc-950 px-4 py-2 text-sm font-medium hover:bg-yellow-300"
          >
            Export PDF
          </button>
        </div>
        {pdfMsg ? <p className="text-sm text-amber-950 font-medium">{pdfMsg}</p> : null}
        {error ? <p className="text-sm text-zinc-950 bg-yellow-200/80 border border-amber-500/40 px-2 py-1 rounded">{error}</p> : null}
      </div>

      <div className={card}>
        {loading ? (
          <p className="text-zinc-600">Loading…</p>
        ) : !summary ? (
          <p className="text-zinc-600">No data.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-yellow-100/60 border border-amber-400/30 p-4">
                <p className="text-sm text-zinc-700">Invoices</p>
                <p className="text-xl font-semibold text-zinc-950">{summary.invoice_count}</p>
              </div>
              <div className="rounded-xl bg-yellow-100/60 border border-amber-400/30 p-4">
                <p className="text-sm text-zinc-700">Gross sales</p>
                <p className="text-xl font-semibold text-zinc-950">{formatMoney(summary.gross_sales, symbol)}</p>
              </div>
              <div className="rounded-xl bg-yellow-100/60 border border-amber-400/30 p-4">
                <p className="text-sm text-zinc-700">Tax</p>
                <p className="text-xl font-semibold text-zinc-950">{formatMoney(summary.tax_total, symbol)}</p>
              </div>
            </div>
            <div>
              <h2 className="font-medium text-zinc-950 mb-3">Top products (by revenue)</h2>
              {summary.lines.length === 0 ? (
                <p className="text-zinc-600 text-sm">No line items in this range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-700 border-b border-amber-900/15">
                        <th className="pb-2">Product</th>
                        <th className="pb-2">Qty</th>
                        <th className="pb-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.lines.map((row) => (
                        <tr key={row.name} className="border-b border-amber-900/8">
                          <td className="py-2 pr-2 text-zinc-950">{row.name}</td>
                          <td className="py-2 pr-2 text-zinc-700">{Number(row.qty_sold).toFixed(2)}</td>
                          <td className="py-2 text-zinc-950">{formatMoney(Number(row.revenue), symbol)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
