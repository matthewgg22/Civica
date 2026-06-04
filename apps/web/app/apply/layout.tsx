export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="apply-shell">
      <header className="apply-shell__nav">
        <a className="brand" href="/">Civica</a>
      </header>
      <div className="apply-shell__content">{children}</div>
    </div>
  );
}
