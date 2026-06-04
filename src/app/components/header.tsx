import Link from 'next/link'

export default function Header() {
  return (
    <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b-4 border-on-surface bg-background px-6 py-3 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]" id="app-header">
      <div className="flex items-center gap-4" id="header-branding">
        <span className="material-symbols-outlined text-primary">menu</span>
        <h1 className="font-headline-lg text-headline-lg font-black uppercase tracking-tighter text-primary">
          Kachalka
        </h1>
      </div>
      <Link href="/" className="transition-all active:scale-95" id="header-account-link">
        <span className="material-symbols-outlined text-primary">account_circle</span>
      </Link>
    </header>
  )
}
