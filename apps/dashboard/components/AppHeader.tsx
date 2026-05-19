import Link from "next/link";

export default function AppHeader({ email, active }: { email?: string; active: "dashboard" | "queue" | "enrollments" | "county" }) {
  return (
    <header className="bg-surface border-b border-hairline px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-[7px] overflow-hidden shrink-0 ring-1 ring-black/5 group-hover:ring-black/20 transition-all">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/civica-mark.png" alt="Civica" width={36} height={36} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-[16px] font-semibold tracking-tight text-ink leading-none">Civica</p>
            <p className="text-[11px] text-muted mt-0.5 uppercase tracking-wider font-medium">Navigator</p>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          <NavTab href="/dashboard"    label="Dashboard"   active={active === "dashboard"} />
          <NavTab href="/packets"      label="Queue"       active={active === "queue"} />
          <NavTab href="/enrollments"  label="Enrollments" active={active === "enrollments"} />
          <NavTab href="/county"       label="§10106"      active={active === "county"} />
        </nav>
      </div>
      <div className="flex items-center gap-5">
        {email && <span className="text-[13px] text-graphite">{email}</span>}
        <form action="/auth/signout" method="post">
          <button className="text-[13px] font-medium text-brick hover:underline">Sign out</button>
        </form>
      </div>
    </header>
  );
}

function NavTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-[4px] text-[13px] font-semibold transition-colors ${
        active
          ? "bg-paper text-ink"
          : "text-graphite hover:bg-paper/50 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
