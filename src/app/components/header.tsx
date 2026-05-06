export default function Header() {
  return (
    <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b-4 border-on-surface bg-background px-6 py-3 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
      <div className="flex items-center gap-4">
        <span className="material-symbols-outlined text-primary">menu</span>
        <h1 className="font-headline-lg text-headline-lg font-black uppercase tracking-tighter text-primary">
          IRON COMMAND
        </h1>
      </div>
      <span className="material-symbols-outlined text-primary">account_circle</span>
    </header>
  )
}
