import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@primer/react'
import './index.scss'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider colorMode="dark" dayScheme="dark" nightScheme="dark">
      <App />
    </ThemeProvider>
  </StrictMode>,
)
