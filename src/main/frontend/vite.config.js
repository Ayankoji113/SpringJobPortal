import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* Fontsource names the variable family "Archivo Variable"; styles/tokens.css asks for "Archivo".
   Rename it at build time so the stylesheet keeps working. Delete this plugin if tokens.css ever
   lists "Archivo Variable" itself. */
const archivoFamily = {
  name: 'archivo-family',
  enforce: 'pre',
  transform(code, id) {
    if (id.includes('@fontsource-variable/archivo')) {
      return code.replaceAll("'Archivo Variable'", "'Archivo'")
    }
  },
}

// No dev proxy: services/api.js falls back to http://localhost:8080/api and the backend's
// default CORS origins already allow :5173, so `npm run dev` works with no .env file.
export default defineConfig({
  plugins: [archivoFamily, react()],
})
