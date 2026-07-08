import { ipcRenderer, contextBridge } from 'electron'
import type { LedgerlyApi } from '../../src/types/ipc'

const api: LedgerlyApi = {
  authLogin: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authStatus: () => ipcRenderer.invoke('auth:status'),

  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsUpdate: (partial) => ipcRenderer.invoke('settings:update', partial),

  productsList: (search) => ipcRenderer.invoke('products:list', search),
  productsSearch: (q) => ipcRenderer.invoke('products:search', q),
  productsGet: (id) => ipcRenderer.invoke('products:get', id),
  productsCreate: (input) => ipcRenderer.invoke('products:create', input),
  productsUpdate: (payload) => ipcRenderer.invoke('products:update', payload),

  invoicesCreate: (input) => ipcRenderer.invoke('invoices:create', input),
  invoicesGet: (id) => ipcRenderer.invoke('invoices:get', id),
  invoicesList: (opts) => ipcRenderer.invoke('invoices:list', opts),
  invoicesSearch: (term) => ipcRenderer.invoke('invoices:search', term),
  invoicesUpdate: (payload) => ipcRenderer.invoke('invoices:update', payload),
  invoicesDelete: (id) => ipcRenderer.invoke('invoices:delete', id),

  reportsSummary: (range) => ipcRenderer.invoke('reports:summary', range),
  reportsExportPdf: (range) => ipcRenderer.invoke('reports:exportPdf', range),

  printInvoice: (id) => ipcRenderer.invoke('print:invoice', id),
}

contextBridge.exposeInMainWorld('ledgerly', api)
