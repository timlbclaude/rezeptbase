// Kleiner globaler Toast-Kanal: notify() kann aus jedem Modul aufgerufen
// werden, die Toast-Komponente (in App.tsx eingebunden) zeigt die Meldung an.
import type { ToastType } from './types.ts'

export interface ToastDetail {
  message: string
  type: ToastType
}

export const TOAST_EVENT = 'rezeptbase:toast'

export function notify(message: string, type: ToastType = 'error'): void {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, type } }))
}
