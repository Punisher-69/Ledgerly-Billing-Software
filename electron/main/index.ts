import { app, BrowserWindow, shell, ipcMain, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import {
  initDatabase,
  getSettings,
  updateSettings,
  productsList,
  productsSearch,
  productCreate,
  productUpdate,
  productGet,
  invoiceCreate,
  invoiceGet,
  invoiceUpdate,
  invoiceDelete,
  invoicesList,
  invoicesSearch,
  reportSummary,
} from './db'
import { tryLogin, logout, isAuthenticated } from './auth'
import { printInvoice } from './print-invoice'
import { exportReportPdf } from './report-pdf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

function ensureAuth(): void {
  if (!isAuthenticated()) {
    throw new Error('Not authenticated')
  }
}

function registerIpc(): void {
  ipcMain.handle('auth:login', (_e, payload: { username: string; password: string }) => {
    const ok = tryLogin(String(payload?.username ?? ''), String(payload?.password ?? ''))
    return { ok }
  })

  ipcMain.handle('auth:logout', () => {
    logout()
    return { ok: true }
  })

  ipcMain.handle('auth:status', () => ({ authenticated: isAuthenticated() }))

  ipcMain.handle('settings:get', () => {
    ensureAuth()
    return getSettings()
  })

  ipcMain.handle('settings:update', (_e, partial: { shop_name?: string; currency_symbol?: string; tax_percent?: number }) => {
    ensureAuth()
    updateSettings(partial)
    return getSettings()
  })

  ipcMain.handle('products:list', (_e, search?: string) => {
    ensureAuth()
    return productsList(search)
  })

  ipcMain.handle('products:search', (_e, q: string) => {
    ensureAuth()
    return productsSearch(q, 25)
  })

  ipcMain.handle('products:get', (_e, id: number) => {
    ensureAuth()
    return productGet(id) ?? null
  })

  ipcMain.handle(
    'products:create',
    (_e, input: { name: string; sku?: string | null; unit_price: number; cost?: number | null; stock?: number | null }) => {
      ensureAuth()
      if (!input.name?.trim()) throw new Error('Name is required')
      if (input.unit_price < 0) throw new Error('Price cannot be negative')
      return productCreate(input)
    },
  )

  ipcMain.handle(
    'products:update',
    (
      _e,
      payload: {
        id: number
        name?: string
        sku?: string | null
        unit_price?: number
        cost?: number | null
        stock?: number | null
        active?: number
      },
    ) => {
      ensureAuth()
      productUpdate(payload.id, {
        name: payload.name,
        sku: payload.sku,
        unit_price: payload.unit_price,
        cost: payload.cost,
        stock: payload.stock,
        active: payload.active,
      })
      return { ok: true }
    },
  )

  ipcMain.handle(
    'invoices:create',
    (
      _e,
      input: {
        items: { product_id: number; qty: number }[]
        discount?: number
        notes?: string | null
        payment_method?: string | null
      },
    ) => {
      ensureAuth()
      const s = getSettings()
      return invoiceCreate({
        items: input.items,
        discount: input.discount,
        notes: input.notes,
        payment_method: input.payment_method,
        tax_percent: s.tax_percent,
      })
    },
  )

  ipcMain.handle('invoices:get', (_e, id: number) => {
    ensureAuth()
    return invoiceGet(id)
  })

  ipcMain.handle('invoices:list', (_e, opts: { limit?: number; from?: string; to?: string }) => {
    ensureAuth()
    return invoicesList(opts ?? {})
  })

  ipcMain.handle('invoices:search', (_e, term: string) => {
    ensureAuth()
    return invoicesSearch(String(term ?? ''))
  })

  ipcMain.handle(
    'invoices:update',
    (
      _e,
      payload: {
        id: number
        items: { product_id: number; qty: number; unit_price?: number }[]
        discount?: number
        notes?: string | null
        payment_method?: string | null
      },
    ) => {
      ensureAuth()
      const s = getSettings()
      return invoiceUpdate(payload.id, {
        items: payload.items,
        discount: payload.discount,
        notes: payload.notes,
        payment_method: payload.payment_method,
        tax_percent: s.tax_percent,
      })
    },
  )

  ipcMain.handle('invoices:delete', (_e, id: number) => {
    ensureAuth()
    invoiceDelete(id)
    return { ok: true }
  })

  ipcMain.handle('reports:summary', (_e, range: { from: string; to: string }) => {
    ensureAuth()
    return reportSummary(range.from, range.to)
  })

  ipcMain.handle('reports:exportPdf', async (_e, range: { from: string; to: string }) => {
    ensureAuth()
    return exportReportPdf(range.from, range.to, () => mainWindow)
  })

  ipcMain.handle('print:invoice', async (_e, id: number) => {
    ensureAuth()
    await printInvoice(id)
    return { ok: true }
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Ledgerly',
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(indexHtml)
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  update(mainWindow)
}

app.whenReady().then(() => {
  initDatabase(app)
  registerIpc()
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => {
  mainWindow = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
