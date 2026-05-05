import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@primer/primitives/dist/css/functional/themes/dark.css'
import { BaseStyles, ThemeProvider } from '@primer/react'
import './index.scss'
import App from './App.tsx'
import { initFirebaseServices } from './services/firestore'

// Initialize Firebase and Firestore services
initFirebaseServices();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider colorMode="dark" dayScheme="dark" nightScheme="dark">
      <BaseStyles>
        <App />
      </BaseStyles>
    </ThemeProvider>
  </StrictMode>,
)
