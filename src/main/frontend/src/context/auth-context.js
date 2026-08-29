import { createContext } from 'react';

/* Lives apart from the provider component so the module exports only a value —
   a file mixing components and non-components breaks React Fast Refresh. */
export const AuthContext = createContext(null);
