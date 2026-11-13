import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
/* Self-hosted fonts (Fontsource). wdth.css is the Archivo entry that carries the width axis
   (62-125%) as well as weight; wght.css alone would drop font-stretch. */
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/base.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
