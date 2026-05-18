"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { cn } from "@/lib/utils";

type NavItem = { labelKey: string; href: string };

type Props = {
  children: React.ReactNode;
  locale: string;
  disclaimer: string;
  signOutLabel: string;
  inboxUnreadCount: number;
  navLabels: { questions: string; documents: string; inbox: string; packet: string };
};

export function AppShell({
  children,
  locale,
  disclaimer,
  signOutLabel,
  inboxUnreadCount,
  navLabels,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      router.push(`/${locale}/sign-in`);
    });
  }

  const navItems: Array<{ label: string; href: string; badge?: number }> = [
    { label: navLabels.questions, href: `/${locale}/app/questions` },
    { label: navLabels.documents, href: `/${locale}/app/documents` },
    {
      label: navLabels.inbox,
      href: `/${locale}/app/inbox`,
      badge: inboxUnreadCount || undefined,
    },
    { label: navLabels.packet, href: `/${locale}/app/packet` },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brick focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="font-semibold">Civica SNAP</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={isPending}
            aria-label={signOutLabel}
          >
            {signOutLabel}
          </Button>
        </div>

        {/* Bottom nav */}
        <nav
          aria-label="Main navigation"
          className="mx-auto max-w-3xl px-1"
        >
          <ul className="flex" role="list">
            {navItems.map(({ label, href, badge }) => {
              const active = pathname.startsWith(href);
              return (
                <li key={href} className="flex-1">
                  <a
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex flex-col items-center gap-0.5 px-1 py-2 text-xs font-medium motion-safe:transition-colors",
                      active
                        ? "text-brick border-b-2 border-brick"
                        : "text-graphite hover:text-ink"
                    )}
                  >
                    {label}
                    {badge !== undefined && badge > 0 && (
                      <span
                        className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
                        aria-label={`${badge} unread`}
                      >
                        {badge}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <DisclaimerBanner message={disclaimer} />

      <main
        id="main-content"
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-6"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
