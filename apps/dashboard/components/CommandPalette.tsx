"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";
import { decryptDemoName, firstNameLastInitial, shortId } from "../lib/format";

type CommandGroup = "Navigation" | "Packet actions" | "Account" | "Jump to packet";

export type Command = {
  id: string;
  label: string;
  hint?: string;          // shown right-aligned (e.g. "Coming soon")
  shortcut?: string;      // e.g. "G P"
  group: CommandGroup;
  enabled: boolean;
  execute: () => void | Promise<void>;
};

type PacketHit = {
  packet_id: string;
  status: string;
  county: string | null;
  state_code: string;
  applicants: { full_name_ciphertext: string | null } | null;
};

// Debounce hook — used for the packet-search query so we don't refetch every keystroke
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [packetHits, setPacketHits] = useState<PacketHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounced(query, 150);

  const onPacketPage = pathname.startsWith("/packets/") && pathname !== "/packets/";

  // ── Global keyboard listener: Cmd+K / Ctrl+K toggles, ESC closes ─────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isModK) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // ── Reset state on open/close ────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setPacketHits([]);
      // Auto-focus the input after the modal mounts
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // ── Packet search: fetch top results when query has 2+ chars ────────
  useEffect(() => {
    if (!open) return;
    if (debouncedQuery.trim().length < 2) {
      setPacketHits([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;
        // Query Supabase directly via the dashboard client — RLS already scopes
        // results to the navigator's org/assignments. We pull a small page and
        // filter client-side (same approach as /packets list page).
        const { data } = await supabase
          .schema("snap_enrollment")
          .from("snap_packets")
          .select("packet_id, status, county, state_code, applicants(full_name_ciphertext)")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(50);
        if (cancelled) return;
        const q = debouncedQuery.trim().toLowerCase();
        const filtered = ((data ?? []) as unknown as PacketHit[]).filter((p) => {
          const name = p.applicants?.full_name_ciphertext
            ? decryptDemoName(p.applicants.full_name_ciphertext).toLowerCase()
            : "";
          const id = shortId(p.packet_id).toLowerCase();
          const fullId = p.packet_id.toLowerCase();
          return (
            name.includes(q) ||
            id.includes(q) ||
            fullId.includes(q) ||
            (p.county ?? "").toLowerCase().includes(q)
          );
        });
        setPacketHits(filtered.slice(0, 5));
      } catch {
        // Swallow — palette stays usable for static commands
        setPacketHits([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery]);

  function close() {
    setOpen(false);
  }

  // ── Command catalog ─────────────────────────────────────────────────
  const commands: Command[] = useMemo(() => {
    const out: Command[] = [];

    // Navigation — always visible
    out.push({
      id: "nav-packets",
      label: "Go to packets",
      shortcut: "G P",
      group: "Navigation",
      enabled: true,
      execute: () => router.push("/packets"),
    });
    out.push({
      id: "nav-outreach",
      label: "Go to outreach",
      shortcut: "G O",
      group: "Navigation",
      enabled: true,
      execute: () => router.push("/outreach"),
    });
    out.push({
      id: "nav-dashboard",
      label: "Go to dashboard",
      shortcut: "G D",
      group: "Navigation",
      enabled: true,
      execute: () => router.push("/dashboard"),
    });

    // Packet actions — only useful on a packet detail page
    out.push({
      id: "packet-add-note",
      label: "Add note to current packet",
      hint: onPacketPage ? undefined : "Open a packet first",
      group: "Packet actions",
      enabled: onPacketPage,
      execute: () => {
        // Jump-link to the notes section anchor on the current packet page
        if (typeof window !== "undefined") {
          window.location.hash = "#notes";
          // Best-effort: focus the textarea after the scroll lands
          setTimeout(() => {
            const ta = document.querySelector<HTMLTextAreaElement>(
              "#notes textarea",
            );
            ta?.focus();
          }, 100);
        }
      },
    });
    out.push({
      id: "packet-resolve-missing",
      label: "Mark missing item resolved",
      hint: "Coming soon",
      group: "Packet actions",
      enabled: false,
      execute: () => {
        // Stubbed for V1 — surfaces the muscle memory
      },
    });
    out.push({
      id: "packet-send-review",
      label: "Send for navigator review",
      hint: "Coming soon",
      group: "Packet actions",
      enabled: false,
      execute: () => {
        // Stubbed for V1
      },
    });

    // Account — always visible
    out.push({
      id: "account-signout",
      label: "Sign out",
      group: "Account",
      enabled: true,
      execute: () => {
        // Existing /auth/signout route expects POST and 303-redirects to /login.
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/auth/signout";
        document.body.appendChild(form);
        form.submit();
      },
    });

    return out;
  }, [router, onPacketPage]);

  // Static commands filtered by the current query (lowercase substring match)
  const filteredStatic = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // Build dynamic packet commands from the fetched hits
  const packetCommands: Command[] = useMemo(
    () =>
      packetHits.map((p) => {
        const name = p.applicants?.full_name_ciphertext
          ? firstNameLastInitial(decryptDemoName(p.applicants.full_name_ciphertext))
          : "Unknown";
        return {
          id: `packet-${p.packet_id}`,
          label: `Open ${shortId(p.packet_id)} — ${name}`,
          hint: [p.county, p.state_code].filter(Boolean).join(", "),
          group: "Jump to packet" as const,
          enabled: true,
          execute: () => router.push(`/packets/${p.packet_id}`),
        };
      }),
    [packetHits, router],
  );

  // Final ordered list (packets first when query is non-empty, then static)
  const visible: Command[] = useMemo(() => {
    const combined = [...packetCommands, ...filteredStatic];
    return combined.slice(0, 8);
  }, [packetCommands, filteredStatic]);

  // Reset selection when the list shrinks
  useEffect(() => {
    if (selectedIndex >= visible.length) setSelectedIndex(0);
  }, [visible.length, selectedIndex]);

  // ── Keyboard navigation inside the modal ─────────────────────────────
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = visible[selectedIndex];
      if (cmd && cmd.enabled) {
        void cmd.execute();
        close();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;

  // Group the visible list for the header rendering
  const grouped: { group: CommandGroup; items: { cmd: Command; idx: number }[] }[] = [];
  visible.forEach((cmd, idx) => {
    const last = grouped[grouped.length - 1];
    if (last && last.group === cmd.group) {
      last.items.push({ cmd, idx });
    } else {
      grouped.push({ group: cmd.group, items: [{ cmd, idx }] });
    }
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/30 backdrop-blur-sm"
      onClick={close}
    >
      <div
        ref={listRef}
        className="w-full max-w-[560px] bg-surface border border-hairline rounded-[8px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
          <span className="text-muted text-[14px]">⌘K</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Type a command or packet ID / name…"
            aria-label="Command search"
            className="flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {visible.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-muted">No matches</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto py-1.5">
            {grouped.map((group) => (
              <div key={group.group} className="px-1.5 pb-1">
                <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider font-semibold text-muted">
                  {group.group}
                </p>
                {group.items.map(({ cmd, idx }) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      data-testid={`cmd-${cmd.id}`}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => {
                        if (cmd.enabled) {
                          void cmd.execute();
                          close();
                        }
                      }}
                      disabled={!cmd.enabled}
                      aria-disabled={!cmd.enabled}
                      className={[
                        "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[4px] text-left text-[14px] transition-colors",
                        isSelected ? "bg-paper" : "bg-transparent",
                        cmd.enabled
                          ? "text-ink hover:bg-paper cursor-pointer"
                          : "text-muted cursor-not-allowed",
                      ].join(" ")}
                    >
                      <span className="truncate">{cmd.label}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {cmd.hint && (
                          <span className="text-[11px] text-muted">{cmd.hint}</span>
                        )}
                        {cmd.shortcut && (
                          <kbd className="text-[10px] font-mono text-muted bg-paper border border-hairline rounded px-1.5 py-0.5">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-hairline px-4 py-2 flex items-center justify-between text-[11px] text-muted">
          <span>
            <kbd className="font-mono bg-paper border border-hairline rounded px-1 py-0.5">↑↓</kbd> navigate
            <span className="mx-2">·</span>
            <kbd className="font-mono bg-paper border border-hairline rounded px-1 py-0.5">↵</kbd> select
            <span className="mx-2">·</span>
            <kbd className="font-mono bg-paper border border-hairline rounded px-1 py-0.5">esc</kbd> close
          </span>
          <span>Press <kbd className="font-mono bg-paper border border-hairline rounded px-1 py-0.5">⌘K</kbd> to toggle</span>
        </div>
      </div>
    </div>
  );
}
