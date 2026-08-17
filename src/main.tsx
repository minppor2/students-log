import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { StudentSessionProvider } from './contexts/StudentSessionContext'
import { TeacherAuthProvider } from './contexts/TeacherAuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TeacherAuthProvider>
        <StudentSessionProvider>
          <App />
        </StudentSessionProvider>
      </TeacherAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
