import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import type { App } from 'electron'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function initDatabase(app: App): Database.Database {
  const userData = app.getPath('userData')
  const ledgerlyPath = path.join(userData, 'ledgerly.db')
  const legacyPath = path.join(userData, 'chaikhana.db')
  if (!fs.existsSync(ledgerlyPath) && fs.existsSync(legacyPath)) {
    fs.renameSync(legacyPath, ledgerlyPath)
  }
  const file = ledgerlyPath
  const database = new Database(file)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  migrate(database)
  const shopRow = database.prepare("SELECT value FROM app_meta WHERE key = 'shop_name'").get() as { value: string } | undefined
  if (shopRow?.value === 'ChaiKhana') {
    database.prepare("UPDATE app_meta SET value = 'Ledgerly' WHERE key = 'shop_name'").run()
  }
  db = database
  return database
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT,
      unit_price REAL NOT NULL,
      cost REAL,
      stock REAL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      subtotal REAL NOT NULL,
      tax_total REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL,
      payment_method TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER,
      name_snapshot TEXT NOT NULL,
      unit_price REAL NOT NULL,
      qty REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
    CREATE INDEX IF NOT EXISTS idx_products_active_name ON products(active, name);
  `)

  const row = database.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null }
  let version = row?.v ?? 0
  if (version < 1) {
    const ins = database.prepare(
      "INSERT OR IGNORE INTO app_meta (key, value) VALUES ('invoice_counter', '0'), ('shop_name', 'Ledgerly'), ('currency_symbol', 'Rs'), ('tax_percent', '0')",
    )
    ins.run()
    database.prepare('INSERT INTO schema_version (version) VALUES (1)').run()
    version = 1
  }
}

export function metaGet(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function metaSet(key: string, value: string): void {
  getDb().prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

/** Local wall time so `date(created_at)` matches the app’s local date pickers (SQLite `datetime('now')` is UTC). */
function localSqlDateTime(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function nextInvoiceNo(): string {
  const database = getDb()
  const row = database.prepare("SELECT value FROM app_meta WHERE key = 'invoice_counter'").get() as { value: string } | undefined
  const n = (row ? parseInt(row.value, 10) : 0) + 1
  database.prepare("UPDATE app_meta SET value = ? WHERE key = 'invoice_counter'").run(String(n))
  return `LL-${String(n).padStart(6, '0')}`
}

export type ProductRow = {
  id: number
  name: string
  sku: string | null
  unit_price: number
  cost: number | null
  stock: number | null
  active: number
  created_at: string
}

export function productsList(search?: string): ProductRow[] {
  const q = (search ?? '').trim()
  if (!q) {
    return getDb().prepare('SELECT * FROM products WHERE active = 1 ORDER BY name COLLATE NOCASE').all() as ProductRow[]
  }
  const like = `%${q}%`
  return getDb()
    .prepare(
      `SELECT * FROM products WHERE active = 1 AND (
        name LIKE ? ESCAPE '\\' OR CAST(id AS TEXT) = ? OR IFNULL(sku,'') LIKE ? ESCAPE '\\'
      ) ORDER BY name COLLATE NOCASE`,
    )
    .all(like, q, like) as ProductRow[]
}

export function productsSearch(q: string, limit = 20): ProductRow[] {
  const term = q.trim()
  if (!term) return []
  const like = `%${term}%`
  return getDb()
    .prepare(
      `SELECT * FROM products WHERE active = 1 AND (
        name LIKE ? OR CAST(id AS TEXT) = ? OR IFNULL(sku,'') LIKE ?
      ) ORDER BY name COLLATE NOCASE LIMIT ?`,
    )
    .all(like, term, like, limit) as ProductRow[]
}

export function productGet(id: number): ProductRow | undefined {
  return getDb().prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined
}

export function productCreate(input: {
  name: string
  sku?: string | null
  unit_price: number
  cost?: number | null
  stock?: number | null
}): number {
  const r = getDb()
    .prepare(
      'INSERT INTO products (name, sku, unit_price, cost, stock, active) VALUES (@name, @sku, @unit_price, @cost, @stock, 1)',
    )
    .run({
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      unit_price: input.unit_price,
      cost: input.cost ?? null,
      stock: input.stock ?? null,
    })
  return Number(r.lastInsertRowid)
}

export function productUpdate(
  id: number,
  input: Partial<{ name: string; sku: string | null; unit_price: number; cost: number | null; stock: number | null; active: number }>,
): void {
  const cur = productGet(id)
  if (!cur) throw new Error('Product not found')
  getDb()
    .prepare(
      `UPDATE products SET
        name = COALESCE(?, name),
        sku = COALESCE(?, sku),
        unit_price = COALESCE(?, unit_price),
        cost = COALESCE(?, cost),
        stock = COALESCE(?, stock),
        active = COALESCE(?, active)
      WHERE id = ?`,
    )
    .run(
      input.name !== undefined ? input.name.trim() : null,
      input.sku !== undefined ? (input.sku?.trim() || null) : null,
      input.unit_price ?? null,
      input.cost !== undefined ? input.cost : null,
      input.stock !== undefined ? input.stock : null,
      input.active ?? null,
      id,
    )
}

export type InvoiceItemRow = {
  id: number
  invoice_id: number
  product_id: number | null
  name_snapshot: string
  unit_price: number
  qty: number
  line_total: number
}

export type InvoiceRow = {
  id: number
  invoice_no: string
  created_at: string
  subtotal: number
  tax_total: number
  discount: number
  grand_total: number
  payment_method: string | null
  notes: string | null
}

type ComputedLine = { product_id: number; name: string; unit_price: number; qty: number; line_total: number }

function computeInvoiceLines(items: { product_id: number; qty: number; unit_price?: number }[]): ComputedLine[] {
  const lines: ComputedLine[] = []
  for (const line of items) {
    if (line.qty <= 0) throw new Error('Quantity must be positive')
    const p = productGet(line.product_id)
    if (!p || !p.active) throw new Error(`Invalid product id ${line.product_id}`)
    const unit = line.unit_price !== undefined ? line.unit_price : p.unit_price
    if (unit < 0) throw new Error('Price cannot be negative')
    const lineTotal = Math.round(unit * line.qty * 100) / 100
    lines.push({
      product_id: p.id,
      name: p.name,
      unit_price: unit,
      qty: line.qty,
      line_total: lineTotal,
    })
  }
  return lines
}

function totalsFromLines(lines: ComputedLine[], taxPercent: number, discount: number): { subtotal: number; tax_total: number; grand_total: number } {
  const taxRate = taxPercent / 100
  const subtotal = Math.round(lines.reduce((s, l) => s + l.line_total, 0) * 100) / 100
  const tax_total = Math.round(subtotal * taxRate * 100) / 100
  const grand_total = Math.round((subtotal + tax_total - discount) * 100) / 100
  if (grand_total < 0) throw new Error('Total cannot be negative')
  return { subtotal, tax_total, grand_total }
}

export function invoiceCreate(input: {
  items: { product_id: number; qty: number }[]
  discount?: number
  notes?: string | null
  payment_method?: string | null
  tax_percent: number
}): { invoice: InvoiceRow; items: InvoiceItemRow[] } {
  if (!input.items.length) throw new Error('Add at least one line item')
  const database = getDb()
  const discount = input.discount ?? 0
  const lines = computeInvoiceLines(input.items)
  const { subtotal, tax_total, grand_total } = totalsFromLines(lines, input.tax_percent, discount)

  const invoice_no = nextInvoiceNo()
  const createdAt = localSqlDateTime()
  const tx = database.transaction(() => {
    const inv = database
      .prepare(
        `INSERT INTO invoices (invoice_no, created_at, subtotal, tax_total, discount, grand_total, payment_method, notes)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        invoice_no,
        createdAt,
        subtotal,
        tax_total,
        discount,
        grand_total,
        input.payment_method?.trim() || null,
        input.notes?.trim() || null,
      )
    const invoiceId = Number(inv.lastInsertRowid)
    const insItem = database.prepare(
      `INSERT INTO invoice_items (invoice_id, product_id, name_snapshot, unit_price, qty, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const l of lines) {
      insItem.run(invoiceId, l.product_id, l.name, l.unit_price, l.qty, l.line_total)
    }
  })
  tx()

  const invoice = database.prepare('SELECT * FROM invoices WHERE invoice_no = ?').get(invoice_no) as InvoiceRow
  const items = database.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(invoice.id) as InvoiceItemRow[]
  return { invoice, items }
}

export function invoiceUpdate(
  invoiceId: number,
  input: {
    items: { product_id: number; qty: number; unit_price?: number }[]
    discount?: number
    notes?: string | null
    payment_method?: string | null
    tax_percent: number
  },
): { invoice: InvoiceRow; items: InvoiceItemRow[] } {
  if (!input.items.length) throw new Error('Add at least one line item')
  if (!invoiceGet(invoiceId)) throw new Error('Invoice not found')

  const database = getDb()
  const discount = input.discount ?? 0
  const lines = computeInvoiceLines(input.items)
  const { subtotal, tax_total, grand_total } = totalsFromLines(lines, input.tax_percent, discount)

  const tx = database.transaction(() => {
    database.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId)
    database
      .prepare(
        `UPDATE invoices SET subtotal = ?, tax_total = ?, discount = ?, grand_total = ?, payment_method = ?, notes = ?
         WHERE id = ?`,
      )
      .run(
        subtotal,
        tax_total,
        discount,
        grand_total,
        input.payment_method?.trim() || null,
        input.notes?.trim() || null,
        invoiceId,
      )
    const insItem = database.prepare(
      `INSERT INTO invoice_items (invoice_id, product_id, name_snapshot, unit_price, qty, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const l of lines) {
      insItem.run(invoiceId, l.product_id, l.name, l.unit_price, l.qty, l.line_total)
    }
  })
  tx()

  const invoice = database.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as InvoiceRow
  const items = database.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(invoiceId) as InvoiceItemRow[]
  return { invoice, items }
}

export function invoiceDelete(id: number): void {
  const r = getDb().prepare('DELETE FROM invoices WHERE id = ?').run(id)
  if (r.changes === 0) throw new Error('Invoice not found')
}

export function invoicesSearch(term: string): InvoiceRow[] {
  const t = term.trim()
  if (!t) return []
  const like = `%${t}%`
  return getDb()
    .prepare(
      `SELECT * FROM invoices
       WHERE CAST(id AS TEXT) = ? OR invoice_no LIKE ?
       ORDER BY created_at DESC LIMIT 80`,
    )
    .all(t, like) as InvoiceRow[]
}

export function invoiceGet(id: number): { invoice: InvoiceRow; items: InvoiceItemRow[] } | null {
  const invoice = getDb().prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow | undefined
  if (!invoice) return null
  const items = getDb().prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id) as InvoiceItemRow[]
  return { invoice, items }
}

export function invoicesList(opts: {
  limit?: number
  from?: string
  to?: string
  billId?: string
  amount?: number
}): InvoiceRow[] {
  const limit = Math.min(opts.limit ?? 100, 500)
  const database = getDb()
  const parts: string[] = ['SELECT * FROM invoices WHERE 1=1']
  const params: (string | number)[] = []

  if (opts.from && opts.to) {
    parts.push('AND date(created_at) >= date(?) AND date(created_at) <= date(?)')
    params.push(opts.from, opts.to)
  }

  const billId = opts.billId?.trim()
  if (billId) {
    parts.push("AND (CAST(id AS TEXT) = ? OR invoice_no LIKE ? ESCAPE '\\')")
    const esc = billId.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
    params.push(billId, `%${esc}%`)
  }

  if (opts.amount !== undefined && Number.isFinite(opts.amount)) {
    parts.push('AND ROUND(grand_total, 2) = ROUND(?, 2)')
    params.push(opts.amount)
  }

  parts.push('ORDER BY created_at DESC LIMIT ?')
  params.push(limit)
  return database.prepare(parts.join(' ')).all(...params) as InvoiceRow[]
}

export function reportSummary(from: string, to: string): {
  invoice_count: number
  gross_sales: number
  tax_total: number
  lines: { name: string; qty_sold: number; revenue: number }[]
} {
  const database = getDb()
  const agg = database
    .prepare(
      `SELECT COUNT(*) as c, COALESCE(SUM(grand_total),0) as g, COALESCE(SUM(tax_total),0) as t
       FROM invoices WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)`,
    )
    .get(from, to) as { c: number; g: number; t: number }

  const lines = database
    .prepare(
      `SELECT ii.name_snapshot as name,
 SUM(ii.qty) as qty_sold,
              SUM(ii.line_total) as revenue
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE date(i.created_at) >= date(?) AND date(i.created_at) <= date(?)
       GROUP BY ii.name_snapshot
       ORDER BY revenue DESC
       LIMIT 25`,
    )
    .all(from, to) as { name: string; qty_sold: number; revenue: number }[]

  return {
    invoice_count: agg.c,
    gross_sales: agg.g,
    tax_total: agg.t,
    lines,
  }
}

export function getSettings(): { shop_name: string; currency_symbol: string; tax_percent: number } {
  return {
    shop_name: metaGet('shop_name') || 'Ledgerly',
    currency_symbol: metaGet('currency_symbol') || 'Rs',
    tax_percent: parseFloat(metaGet('tax_percent') || '0') || 0,
  }
}

export function updateSettings(partial: { shop_name?: string; currency_symbol?: string; tax_percent?: number }): void {
  if (partial.shop_name !== undefined) metaSet('shop_name', partial.shop_name.trim() || 'Ledgerly')
  if (partial.currency_symbol !== undefined) metaSet('currency_symbol', partial.currency_symbol.trim() || 'Rs')
  if (partial.tax_percent !== undefined) metaSet('tax_percent', String(partial.tax_percent))
}
