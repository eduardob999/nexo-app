const TABS = [
  { id: 'today', label: 'Today', d: 'M4 4h16v16H4zM9 12l2 2 4-4' },
  { id: 'nexo', label: 'Nexo', d: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  { id: 'drafts', label: 'Drafts', d: 'M3 6h18v12H3zM4 8l8 6 8-6' },
  { id: 'more', label: 'More', d: 'M5 12h.01M12 12h.01M19 12h.01' },
] as const;

export function TabBar({ current }: { current: string }) {
  return (
    <nav className="tabs" aria-label="Sections">
      {TABS.map((t) => (
        <button key={t.id} aria-current={t.id === current ? 'page' : undefined}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.d} /></svg>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
