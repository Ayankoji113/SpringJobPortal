import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/** A missing provider must not crash a page, so this degrades to a no-op. */
export function useToast() {
  return useContext(ToastContext) || { toast: () => {}, dismiss: () => {} };
}
