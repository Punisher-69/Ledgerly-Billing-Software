import { dialog, type BrowserWindow, type FileFilter } from 'electron'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { getSettings, reportSummary } from './db'

const require = createRequire(import.meta.url)
const PDFDocument = require('pdfkit') as typeof import('pdfkit')

export async function exportReportPdf(
  from: string,
  to: string,
  getWindow: () => BrowserWindow | null,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const win = getWindow()
  const summary = reportSummary(from, to)
  const settings = getSettings()

  const opts = {
    title: 'Save sales report',
    defaultPath: `sales-${from}-to-${to}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }] as FileFilter[],
  }
  const { filePath, canceled } = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (canceled || !filePath) return { ok: false, error: 'Canceled' }

  const doc = new PDFDocument({ margin: 50 })
  const stream = fs.createWriteStream(filePath)
  doc.pipe(stream)

  doc.fontSize(18).text(`${settings.shop_name} — Sales report`, { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(11).text(`Period: ${from} to ${to}`, { align: 'center' })
  doc.moveDown(1.5)

  doc.fontSize(12).text('Summary', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(11)
  doc.text(`Invoices: ${summary.invoice_count}`)
  doc.text(`Gross sales: ${settings.currency_symbol} ${summary.gross_sales.toFixed(2)}`)
  doc.text(`Tax collected: ${settings.currency_symbol} ${summary.tax_total.toFixed(2)}`)
  doc.moveDown(1)

  doc.fontSize(12).text('Top lines (by revenue)', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(10)
  if (!summary.lines.length) {
    doc.text('No sales in this range.')
  } else {
    for (const row of summary.lines) {
      doc.text(
        `${row.name} — qty ${Number(row.qty_sold).toFixed(2)} — ${settings.currency_symbol} ${Number(row.revenue).toFixed(2)}`,
      )
    }
  }

  doc.end()

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve)
    stream.on('error', reject)
  })

  return { ok: true, path: filePath }
}
