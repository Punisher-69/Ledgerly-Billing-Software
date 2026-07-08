import { BrowserWindow } from 'electron'
import { getSettings, invoiceGet } from './db'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function printInvoice(invoiceId: number): Promise<void> {
  const data = invoiceGet(invoiceId)
  if (!data) throw new Error('Invoice not found')
  const { invoice, items } = data
  const settings = getSettings()
  const sym = escapeHtml(settings.currency_symbol)

  const rows = items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.name_snapshot)}</td><td class="r">${i.qty}</td><td class="r">${sym}${i.unit_price.toFixed(2)}</td><td class="r">${sym}${i.line_total.toFixed(2)}</td></tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${escapeHtml(invoice.invoice_no)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: system-ui, Segoe UI, sans-serif; font-size: 12px; width: 72mm; margin: 0; padding: 0; color: #09090b; background: #fefce8; }
  h1 { font-size: 14px; margin: 0 0 4px; text-align: center; background: #09090b; color: #facc15; padding: 6px 4px; }
  .meta { text-align: center; font-size: 11px; color: #27272a; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 2px 0; vertical-align: top; }
  th { text-align: left; border-bottom: 2px solid #09090b; font-size: 11px; }
  .r { text-align: right; }
  .tot { margin-top: 8px; font-size: 12px; }
  .tot div { display: flex; justify-content: space-between; }
  .grand { font-weight: 700; margin-top: 4px; font-size: 13px; border-top: 1px solid #09090b; padding-top: 4px; }
</style></head><body>
  <h1>${escapeHtml(settings.shop_name)}</h1>
  <div class="meta">${escapeHtml(invoice.invoice_no)}<br>${escapeHtml(invoice.created_at)}</div>
  <table>
    <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amt</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="tot">
    <div><span>Subtotal</span><span>${sym}${invoice.subtotal.toFixed(2)}</span></div>
    <div><span>Tax</span><span>${sym}${invoice.tax_total.toFixed(2)}</span></div>
    <div><span>Discount</span><span>${sym}${invoice.discount.toFixed(2)}</span></div>
    <div class="grand"><span>Total</span><span>${sym}${invoice.grand_total.toFixed(2)}</span></div>
  </div>
  <p style="text-align:center;margin-top:10px;font-size:11px;color:#09090b;">Thank you</p>
</body></html>`

  const win = new BrowserWindow({
    width: 320,
    height: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  })

  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
  try {
    await win.loadURL(dataUrl)
  } catch (e) {
    win.close()
    throw e instanceof Error ? e : new Error(String(e))
  }

  // `did-finish-load` may already have fired before a listener is attached; print after load completes.
  await new Promise<void>((resolve, reject) => {
    win.webContents.print({ silent: false, printBackground: false }, (success, failureReason) => {
      win.close()
      if (!success && failureReason) reject(new Error(failureReason))
      else resolve()
    })
  })
}
