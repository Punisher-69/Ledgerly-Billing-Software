import { useCallback, useEffect, useState } from 'react'
import { getApi } from '@/lib/api'
import type { InvoiceItemRow, InvoiceRow, ProductRow } from '@/types/ipc'
import { formatMoney, todayISODate } from '@/lib/format'
import { PrintIcon } from '@/components/PrintIcon'

type EditLine = {
  key: string
  productId: number | null
  name: string
  unitPrice: number
  qty: string
}

function newLineKey(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

function lineQtyNumber(l: EditLine): number {
  const n = parseFloat(l.qty)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function itemsToLines(items: InvoiceItemRow[]): EditLine[] {
  return items.map((it) => ({
    key: `it-${it.id}`,
    productId: it.product_id,
    name: it.name_snapshot,
    unitPrice: it.unit_price,
    qty: String(it.qty),
  }))
}

const card = 'rounded-2xl bg-white border border-amber-400/40 p-6 shadow-sm'
const label = 'block text-sm font-medium text-zinc-800 mb-1'
const input =
  'w-full rounded-lg border border-amber-900/15 bg-white px-3 py-2 text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-400/50'
const btnPrimary = 'rounded-lg bg-yellow-400 text-zinc-950 px-4 py-2 font-medium hover:bg-yellow-300'
const btnSecondary =
  'rounded-lg border border-amber-500/50 bg-yellow-50 text-zinc-950 px-3 py-2 text-sm font-medium hover:bg-yellow-100'

export function Bills() {
  const [symbol, setSymbol] = useState('Rs')
  const [taxPercent, setTaxPercent] = useState(0)
  const [listDate, setListDate] = useState(todayISODate())
  const [billIdFilter, setBillIdFilter] = useState('')
  const [amountFilter, setAmountFilter] = useState('')
  const [debouncedBillId, setDebouncedBillId] = useState('')
  const [debouncedAmount, setDebouncedAmount] = useState('')
  const [billList, setBillList] = useState<InvoiceRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [selected, setSelected] = useState<{ invoice: InvoiceRow; items: InvoiceItemRow[] } | null>(null)
  const [lines, setLines] = useState<EditLine[]>([])
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [payment, setPayment] = useState('')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ProductRow[]>([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBillId(billIdFilter.trim()), 300)
    return () => clearTimeout(t)
  }, [billIdFilter])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amountFilter.trim()), 300)
    return () => clearTimeout(t)
  }, [amountFilter])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const s = await getApi().settingsGet()
        if (!c) {
          setSymbol(s.currency_symbol)
          setTaxPercent(s.tax_percent)
        }
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : 'Failed to load settings')
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const loadBills = useCallback(async () => {
    setListLoading(true)
    try {
      const amountNum =
        debouncedAmount === ''
          ? undefined
          : (() => {
              const n = parseFloat(debouncedAmount)
              return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined
            })()
      const rows = await getApi().invoicesList({
        from: listDate,
        to: listDate,
        limit: 500,
        ...(debouncedBillId ? { billId: debouncedBillId } : {}),
        ...(amountNum !== undefined ? { amount: amountNum } : {}),
      })
      setBillList(rows)
    } catch (e) {
      setBillList([])
      setError(e instanceof Error ? e.message : 'Failed to load bills')
    } finally {
      setListLoading(false)
    }
  }, [listDate, debouncedBillId, debouncedAmount])

  useEffect(() => {
    void loadBills()
  }, [loadBills])

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
    const t = setTimeout(() => void runSearch(query), 250)
    return () => clearTimeout(t)
  }, [query, runSearch])

  async function openInvoice(row: InvoiceRow) {
    setError('')
    setMsg('')
    setQuery('')
    setSuggestions([])
    try {
      const data = await getApi().invoicesGet(row.id)
      if (!data) {
        setError('Bill not found')
        return
      }
      setSelected(data)
      setLines(itemsToLines(data.items))
      setDiscount(String(data.invoice.discount))
      setNotes(data.invoice.notes ?? '')
      setPayment(data.invoice.payment_method ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open bill')
    }
  }

  function clearSelection() {
    setSelected(null)
    setLines([])
    setDiscount('0')
    setNotes('')
    setPayment('')
    setError('')
    setMsg('')
  }

  function addProduct(p: ProductRow) {
    setLines((prev) => [
      ...prev,
      { key: newLineKey(), productId: p.id, name: p.name, unitPrice: p.unit_price, qty: '1' },
    ])
    setQuery('')
    setSuggestions([])
    setMsg('')
  }

  function setQty(key: string, qty: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty } : l)))
  }

  function setUnitPrice(key: string, price: number) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, unitPrice: Math.max(0, price) } : l)))
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * lineQtyNumber(l), 0)
  const disc = parseFloat(discount) || 0
  const tax = Math.round(subtotal * (taxPercent / 100) * 100) / 100
  const grand = Math.round((subtotal + tax - disc) * 100) / 100

  async function saveChanges() {
    if (!selected) return
    setError('')
    setMsg('')
    if (!lines.length) {
      setError('Add at least one line')
      return
    }
    const missingProduct = lines.find((l) => l.productId === null)
    if (missingProduct) {
      setError(`Line "${missingProduct.name}" has no product link. Remove it and add an active product from the catalog.`)
      return
    }
    const bad = lines.find((l) => lineQtyNumber(l) <= 0)
    if (bad) {
      setError(`Enter a valid quantity for "${bad.name}"`)
      return
    }
    try {
      await getApi().invoicesUpdate({
        id: selected.invoice.id,
        items: lines.map((l) => ({
          product_id: l.productId!,
          qty: lineQtyNumber(l),
          unit_price: l.unitPrice,
        })),
        discount: disc,
        notes: notes || null,
        payment_method: payment || null,
      })
      setMsg('Bill updated.')
      const data = await getApi().invoicesGet(selected.invoice.id)
      if (data) {
        setSelected(data)
        setLines(itemsToLines(data.items))
        setDiscount(String(data.invoice.discount))
      }
      void loadBills()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function deleteBill() {
    if (!selected) return
    if (!window.confirm(`Delete bill ${selected.invoice.invoice_no}? This cannot be undone.`)) return
    setError('')
    setMsg('')
    try {
      await getApi().invoicesDelete(selected.invoice.id)
      setMsg('Bill deleted.')
      clearSelection()
      void loadBills()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function printBill() {
    if (!selected) return
    setError('')
    try {
      await getApi().printInvoice(selected.invoice.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Print failed')
    }
  }

  async function quickPrintById(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    setError('')
    try {
      await getApi().printInvoice(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Print failed')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Bills</h1>
        <p className="text-zinc-700 mt-1">
          Shows every bill for the selected day. Change the date for another day (e.g. yesterday). Optionally narrow by bill # / ID or exact
          total amount.
        </p>
      </div>

      <div className={`${card} space-y-4`}>
        <h2 className="font-medium text-zinc-950">Filters</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={label}>Date</label>
            <input type="date" className={input} value={listDate} onChange={(e) => setListDate(e.target.value)} />
          </div>
          <div>
            <label className={label}>Bill # or ID</label>
            <input
              className={input}
              value={billIdFilter}
              onChange={(e) => setBillIdFilter(e.target.value)}
              placeholder="e.g. 12 or LL-000012"
            />
          </div>
          <div>
            <label className={label}>Total amount</label>
            <input
              type="number"
              step="0.01"
              className={input}
              value={amountFilter}
              onChange={(e) => setAmountFilter(e.target.value)}
              placeholder="Exact grand total"
            />
          </div>
          <div className="flex items-end">
            <button type="button" onClick={() => void loadBills()} className={`${btnPrimary} w-full sm:w-auto`}>
              Refresh
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-amber-900/10 overflow-hidden">
          <div className="max-h-[min(70vh,32rem)] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-yellow-100/80 text-zinc-800 border-b border-amber-900/15">
                  <th className="px-3 py-2 font-medium">Bill #</th>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Date &amp; time</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                  <th className="px-3 py-2 text-right font-medium min-w-[7.5rem]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-zinc-600">
                      Loading…
                    </td>
                  </tr>
                ) : billList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-zinc-600">
                      No bills for this day with the current filters.
                    </td>
                  </tr>
                ) : (
                  billList.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-amber-900/8 hover:bg-yellow-50/80 ${
                        selected?.invoice.id === r.id ? 'bg-yellow-100/60' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-zinc-950">{r.invoice_no}</td>
                      <td className="px-3 py-2 text-zinc-700">{r.id}</td>
                      <td className="px-3 py-2 text-zinc-700">{r.created_at}</td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-950">{formatMoney(r.grand_total, symbol)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1 flex-wrap">
                          <button type="button" className={`${btnSecondary} py-1.5 px-2 text-xs`} onClick={() => void openInvoice(r)}>
                            Open
                          </button>
                          <button
                            type="button"
                            className={`${btnSecondary} p-2 inline-flex items-center justify-center text-zinc-950`}
                            title="Print bill"
                            aria-label={`Print bill ${r.invoice_no}`}
                            onClick={(e) => void quickPrintById(r.id, e)}
                          >
                            <PrintIcon className="shrink-0" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className={`${card} flex flex-wrap justify-between gap-3 items-start`}>
              <div>
                <h2 className="font-medium text-zinc-950 text-lg">{selected.invoice.invoice_no}</h2>
                <p className="text-sm text-zinc-700 mt-1">
                  ID {selected.invoice.id} · {selected.invoice.created_at}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void printBill()} className={`${btnSecondary} inline-flex items-center gap-2`}>
                  <PrintIcon className="shrink-0" />
                  Print
                </button>
                <button type="button" onClick={clearSelection} className={`${btnSecondary} border-zinc-900/20`}>
                  Close
                </button>
              </div>
            </div>

            <div className={`${card} space-y-4`}>
              <h3 className="font-medium text-zinc-950">Add catalog item</h3>
              <input
                className={input}
                placeholder="Search product name / SKU…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {suggestions.length > 0 ? (
                <ul className="rounded-lg border border-amber-900/10 bg-yellow-50/80 max-h-40 overflow-auto">
                  {suggestions.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white flex justify-between gap-2 text-zinc-900"
                        onClick={() => addProduct(p)}
                      >
                        <span>{p.name}</span>
                        <span className="text-zinc-600">#{p.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className={card}>
              <h3 className="font-medium text-zinc-950 mb-4">Lines</h3>
              {lines.length === 0 ? (
                <p className="text-zinc-600 text-sm">No lines — add products above.</p>
              ) : (
                <ul className="space-y-4">
                  {lines.map((l) => (
                    <li key={l.key} className="border-b border-amber-900/8 pb-4 last:border-0 last:pb-0 space-y-2">
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-medium text-zinc-950">{l.name}</p>
                        <button type="button" className="text-sm text-zinc-900 underline hover:text-zinc-700" onClick={() => removeLine(l.key)}>
                          Remove
                        </button>
                      </div>
                      {l.productId === null ? (
                        <p className="text-sm text-zinc-900 bg-yellow-100 px-2 py-1 rounded border border-amber-400/50">
                          No product ID on file — remove this line and add the product again from search.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-4 items-end">
                        <div>
                          <label className="block text-xs text-zinc-700 mb-1">Qty</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="w-24 rounded-lg border border-amber-900/15 px-2 py-1"
                            value={l.qty}
                            onChange={(e) => setQty(l.key, e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-700 mb-1">Unit price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-28 rounded-lg border border-amber-900/15 px-2 py-1"
                            value={l.unitPrice}
                            onChange={(e) => setUnitPrice(l.key, parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <p className="text-sm text-zinc-700 pb-1">Line: {formatMoney(l.unitPrice * (lineQtyNumber(l) || 0), symbol)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className={`${card} space-y-3`}>
              <h3 className="font-medium text-zinc-950">Totals</h3>
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
                <input className={input} value={payment} onChange={(e) => setPayment(e.target.value)} />
              </div>
              <div>
                <label className={label}>Notes</label>
                <textarea className={`${input} min-h-[72px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {error ? <p className="text-sm text-zinc-950 bg-yellow-200/80 border border-amber-500/40 px-2 py-1 rounded">{error}</p> : null}
              {msg ? <p className="text-sm text-amber-950 font-medium">{msg}</p> : null}
              <button type="button" onClick={() => void saveChanges()} className={`w-full ${btnPrimary} py-2.5`}>
                Save changes
              </button>
              <button
                type="button"
                onClick={() => void deleteBill()}
                className="w-full rounded-lg border-2 border-zinc-950 text-zinc-950 py-2.5 font-medium hover:bg-yellow-200/50"
              >
                Delete bill
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
