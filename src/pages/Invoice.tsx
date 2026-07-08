import { useCallback, useEffect, useState } from 'react'
import { getApi } from '@/lib/api'
import type { ProductRow } from '@/types/ipc'
import { formatMoney } from '@/lib/format'
import { PrintIcon } from '@/components/PrintIcon'

type Line = { product: ProductRow; qty: string }

const card = 'rounded-2xl bg-white border border-amber-400/40 p-6 shadow-sm'
const label = 'block text-sm font-medium text-zinc-800 mb-1'
const input =
  'w-full rounded-lg border border-amber-900/15 bg-white px-3 py-2 text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-400/50'
const btnPrimary = 'w-full rounded-lg bg-yellow-400 text-zinc-950 py-2.5 font-medium hover:bg-yellow-300'

export function Invoice() {
  const [symbol, setSymbol] = useState('Rs')
  const [taxPercent, setTaxPercent] = useState(0)
  const [query, setQuery] = useState('')
  const [idInput, setIdInput] = useState('')
  const [suggestions, setSuggestions] = useState<ProductRow[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [payment, setPayment] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [lastInvoiceId, setLastInvoiceId] = useState<number | null>(null)
  const [printPrompt, setPrintPrompt] = useState<{ id: number; invoiceNo: string } | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const s = await getApi().settingsGet()
        if (c) return
        setSymbol(s.currency_symbol)
        setTaxPercent(s.tax_percent)
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([])
      return
    }
    try {
      const rows = await getApi().productsSearch(q)
      setSuggestions(rows)
    } catch {
      setSuggestions([])
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 250)
    return () => clearTimeout(t)
  }, [query, runSearch])

  function addProduct(p: ProductRow) {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id)
      if (i >= 0) {
        const next = [...prev]
        const n = parseFloat(next[i].qty)
        const base = Number.isFinite(n) && n > 0 ? n : 1
        next[i] = { ...next[i], qty: String(base + 1) }
        return next
      }
      return [...prev, { product: p, qty: '1' }]
    })
    setQuery('')
    setSuggestions([])
    setMsg('')
  }

  function addById() {
    const id = parseInt(idInput, 10)
    if (Number.isNaN(id)) {
      setError('Enter a numeric product ID')
      return
    }
    setError('')
    void (async () => {
      try {
        const p = await getApi().productsGet(id)
        if (!p || !p.active) {
          setError('No active product with that ID')
          return
        }
        addProduct(p)
        setIdInput('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lookup failed')
      }
    })()
  }

  function setQtyString(pid: number, qty: string) {
    setLines((prev) => prev.map((l) => (l.product.id === pid ? { ...l, qty } : l)))
  }

  function removeLine(pid: number) {
    setLines((prev) => prev.filter((l) => l.product.id !== pid))
  }

  function lineQtyNumber(l: Line): number {
    const n = parseFloat(l.qty)
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  const subtotal = lines.reduce((s, l) => s + l.product.unit_price * lineQtyNumber(l), 0)
  const disc = parseFloat(discount) || 0
  const tax = Math.round(subtotal * (taxPercent / 100) * 100) / 100
  const grand = Math.round((subtotal + tax - disc) * 100) / 100

  async function saveInvoice() {
    setMsg('')
    setError('')
    if (!lines.length) {
      setError('Add at least one product')
      return
    }
    const bad = lines.find((l) => lineQtyNumber(l) <= 0)
    if (bad) {
      setError(`Enter a valid quantity (greater than 0) for ${bad.product.name}`)
      return
    }
    try {
      const res = await getApi().invoicesCreate({
        items: lines.map((l) => ({ product_id: l.product.id, qty: lineQtyNumber(l) })),
        discount: disc,
        notes: notes || null,
        payment_method: payment || null,
      })
      setLastInvoiceId(res.invoice.id)
      setPrintPrompt({ id: res.invoice.id, invoiceNo: res.invoice.invoice_no })
      setLines([])
      setDiscount('0')
      setNotes('')
      setPayment('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function doPrint() {
    if (!lastInvoiceId) return
    try {
      await getApi().printInvoice(lastInvoiceId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Print failed')
    }
  }

  async function printFromPrompt() {
    if (!printPrompt) return
    const { id, invoiceNo } = printPrompt
    setError('')
    try {
      await getApi().printInvoice(id)
      setPrintPrompt(null)
      setMsg(`Printed ${invoiceNo}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Print failed')
    }
  }

  function skipPrintPrompt() {
    const no = printPrompt?.invoiceNo
    setPrintPrompt(null)
    setMsg(no ? `Saved ${no}.` : 'Saved.')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">New bill</h1>
        <p className="text-zinc-700 mt-1">Search by name or add by product ID, set quantities, then save</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className={`${card} space-y-4`}>
            <h2 className="font-medium text-zinc-950">Add items</h2>
            <div>
              <label className={label}>Search name / SKU</label>
              <input
                className={input}
                placeholder="Type to search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {suggestions.length > 0 ? (
                <ul className="mt-2 rounded-lg border border-amber-900/10 bg-yellow-50/80 max-h-48 overflow-auto">
                  {suggestions.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white flex justify-between gap-2 text-zinc-900"
                        onClick={() => addProduct(p)}
                      >
                        <span>{p.name}</span>
                        <span className="text-zinc-600">
                          #{p.id} · {formatMoney(p.unit_price, symbol)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className={label}>Product ID</label>
                <input
                  className={input}
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addById()
                    }
                  }}
                  placeholder="e.g. 3"
                />
              </div>
              <button
                type="button"
                onClick={addById}
                className="rounded-lg border border-amber-500/50 bg-yellow-50 px-4 py-2 font-medium text-zinc-950 hover:bg-yellow-100"
              >
                Add by ID
              </button>
            </div>
          </div>

          <div className={card}>
            <h2 className="font-medium text-zinc-950 mb-4">Cart</h2>
            {lines.length === 0 ? (
              <p className="text-zinc-600">No items yet.</p>
            ) : (
              <ul className="space-y-3 max-h-[min(50vh,24rem)] overflow-y-auto pr-1 -mr-1">
                {lines.map((l) => (
                  <li
                    key={l.product.id}
                    className="flex flex-wrap items-center gap-3 justify-between border-b border-amber-900/8 pb-3"
                  >
                    <div>
                      <p className="font-medium text-zinc-950">{l.product.name}</p>
                      <p className="text-sm text-zinc-600">
                        {formatMoney(l.product.unit_price, symbol)} × {lineQtyNumber(l) || '…'} ={' '}
                        {formatMoney(l.product.unit_price * (lineQtyNumber(l) || 0), symbol)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-zinc-600">Qty</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="w-20 rounded-lg border border-amber-900/15 px-2 py-1"
                        value={l.qty}
                        onChange={(e) => setQtyString(l.product.id, e.target.value)}
                      />
                      <button
                        type="button"
                        className="text-sm text-zinc-800 hover:text-zinc-950 underline px-1"
                        onClick={() => removeLine(l.product.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${card} space-y-3`}>
            <h2 className="font-medium text-zinc-950">Totals</h2>
            <p className="text-sm text-zinc-700 flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, symbol)}</span>
            </p>
            <p className="text-sm text-zinc-700 flex justify-between">
              <span>Tax ({taxPercent}%)</span>
              <span>{formatMoney(tax, symbol)}</span>
            </p>
            <div>
              <label className={label}>Discount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={input}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <p className="text-base font-semibold text-zinc-950 flex justify-between pt-2 border-t border-amber-900/10">
              <span>Total</span>
              <span>{formatMoney(grand, symbol)}</span>
            </p>
            <div>
              <label className={label}>Payment (note)</label>
              <input className={input} value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="Cash / card" />
            </div>
            <div>
              <label className={label}>Notes</label>
              <textarea className={`${input} min-h-[72px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-zinc-950 bg-yellow-200/80 border border-amber-500/40 px-2 py-1 rounded">{error}</p> : null}
            {msg ? <p className="text-sm text-amber-950 font-medium">{msg}</p> : null}
            <button type="button" onClick={() => void saveInvoice()} className={btnPrimary}>
              Save bill
            </button>
            {lastInvoiceId ? (
              <button
                type="button"
                onClick={() => void doPrint()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/50 bg-yellow-50 py-2.5 font-medium text-zinc-950 hover:bg-yellow-100"
              >
                <PrintIcon className="shrink-0" />
                Print last saved bill
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {printPrompt ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/55"
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-prompt-title"
        >
          <div className="bg-yellow-50 border-2 border-amber-400/60 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 id="print-prompt-title" className="text-lg font-semibold text-zinc-950">
              Print this bill?
            </h2>
            <p className="text-zinc-700 text-sm">
              <span className="font-medium text-zinc-950">{printPrompt.invoiceNo}</span> was saved successfully. Send it to the printer now?
            </p>
            <div className="flex flex-wrap gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={skipPrintPrompt}
                className="rounded-lg border border-amber-500/50 px-4 py-2 font-medium text-zinc-950 hover:bg-yellow-100"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => void printFromPrompt()}
                className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 text-zinc-950 px-4 py-2 font-medium hover:bg-yellow-300"
              >
                <PrintIcon className="shrink-0" />
                Yes, print
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
