import { Outlet } from 'react-router-dom'
import { ConfigBanner } from './ConfigBanner'

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50">
      <ConfigBanner />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
