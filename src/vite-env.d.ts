/// <reference types="vite/client" />

import type { LedgerlyApi } from './types/ipc'

declare global {
  interface Window {
    ledgerly: LedgerlyApi
  }
}

export {}
