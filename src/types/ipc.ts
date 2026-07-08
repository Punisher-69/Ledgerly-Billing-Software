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

export type InvoiceItemRow = {
  id: number
  invoice_id: number
  product_id: number | null
  name_snapshot: string
  unit_price: number
  qty: number
  line_total: number
}

export type LedgerlyApi = {
  authLogin: (username: string, password: string) => Promise<{ ok: boolean }>
  authLogout: () => Promise<{ ok: boolean }>
  authStatus: () => Promise<{ authenticated: boolean }>
  settingsGet: () => Promise<{ shop_name: string; currency_symbol: string; tax_percent: number }>
  settingsUpdate: (partial: { shop_name?: string; currency_symbol?: string; tax_percent?: number }) => Promise<{
    shop_name: string
    currency_symbol: string
    tax_percent: number
  }>
  productsList: (search?: string) => Promise<ProductRow[]>
  productsSearch: (q: string) => Promise<ProductRow[]>
  productsGet: (id: number) => Promise<ProductRow | null>
  productsCreate: (input: { name: string; sku?: string | null; unit_price: number; cost?: number | null; stock?: number | null }) => Promise<number>
  productsUpdate: (payload: {
    id: number
    name?: string
    sku?: string | null
    unit_price?: number
    cost?: number | null
    stock?: number | null
    active?: number
  }) => Promise<{ ok: boolean }>
  invoicesCreate: (input: {
    items: { product_id: number; qty: number }[]
    discount?: number
    notes?: string | null
    payment_method?: string | null
  }) => Promise<{ invoice: InvoiceRow; items: InvoiceItemRow[] }>
  invoicesGet: (id: number) => Promise<{ invoice: InvoiceRow; items: InvoiceItemRow[] } | null>
  invoicesList: (opts: {
    limit?: number
    from?: string
    to?: string
    billId?: string
    amount?: number
  }) => Promise<InvoiceRow[]>
  invoicesSearch: (term: string) => Promise<InvoiceRow[]>
  invoicesUpdate: (payload: {
    id: number
    items: { product_id: number; qty: number; unit_price?: number }[]
    discount?: number
    notes?: string | null
    payment_method?: string | null
  }) => Promise<{ invoice: InvoiceRow; items: InvoiceItemRow[] }>
  invoicesDelete: (id: number) => Promise<{ ok: boolean }>
  reportsSummary: (range: { from: string; to: string }) => Promise<{
    invoice_count: number
    gross_sales: number
    tax_total: number
    lines: { name: string; qty_sold: number; revenue: number }[]
  }>
  reportsExportPdf: (range: { from: string; to: string }) => Promise<{ ok: true; path: string } | { ok: false; error: string }>
  printInvoice: (id: number) => Promise<{ ok: boolean }>
}
