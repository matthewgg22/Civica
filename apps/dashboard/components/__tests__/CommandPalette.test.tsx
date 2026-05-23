import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CommandPalette from "../CommandPalette";

// ── Mocks ────────────────────────────────────────────────────────────
const { mockPush, mockPathname, mockGetSession } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockPathname: vi.fn(() => "/dashboard" as string),
  mockGetSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}));

vi.mock("../../lib/supabase", () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
    // The from() chain is unused in these tests because we never trigger
    // the packet-search path (query stays empty or <2 chars), but stub it
    // so the chained .schema().from().select()… in CommandPalette doesn't blow up
    // if anyone extends the suite.
    schema: () => ({
      from: () => ({
        select: () => ({
          is: () => ({
            order: () => ({ limit: () => Promise.resolve({ data: [] }) }),
          }),
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  mockPathname.mockReturnValue("/dashboard");
  mockGetSession.mockResolvedValue({ data: { session: null } });
});

afterEach(() => {
  vi.clearAllMocks();
});

// Helper — fire a global Cmd+K to open the palette
function pressCmdK() {
  fireEvent.keyDown(window, { key: "k", metaKey: true });
}

describe("CommandPalette open / close", () => {
  it("does not render any dialog before Cmd+K is pressed", () => {
    const { container } = render(<CommandPalette />);
    expect(container.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it("opens the palette when Cmd+K is pressed", () => {
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it("opens the palette when Ctrl+K is pressed (Windows/Linux)", () => {
    const { container } = render(<CommandPalette />);
    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it("closes the palette when ESC is pressed", () => {
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(container.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it("Cmd+K acts as a toggle (open → close)", () => {
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    act(() => {
      pressCmdK();
    });
    expect(container.querySelector('[role="dialog"]')).toBeFalsy();
  });
});

describe("CommandPalette static commands", () => {
  it('always renders the "Go to outreach" command', () => {
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    const btn = container.querySelector('[data-testid="cmd-nav-outreach"]');
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toContain("Go to outreach");
  });

  it('always renders the "Go to packets" command', () => {
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    expect(container.querySelector('[data-testid="cmd-nav-packets"]')).toBeTruthy();
  });

  it('always renders the "Sign out" command', () => {
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    expect(container.querySelector('[data-testid="cmd-account-signout"]')).toBeTruthy();
  });
});

describe("CommandPalette filtering", () => {
  it("filters static commands as the user types", async () => {
    const user = userEvent.setup();
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });

    const input = container.querySelector(
      'input[aria-label="Command search"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    await user.type(input, "outreach");

    expect(container.querySelector('[data-testid="cmd-nav-outreach"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cmd-nav-packets"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="cmd-account-signout"]')).toBeFalsy();
  });

  it("shows a no-match state when nothing matches", async () => {
    const user = userEvent.setup();
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    const input = container.querySelector(
      'input[aria-label="Command search"]',
    ) as HTMLInputElement;
    await user.type(input, "zzzzzzz");
    expect(container.textContent).toContain("No matches");
  });
});

describe("CommandPalette keyboard navigation", () => {
  it("arrow-down + Enter executes the command at the new selection", () => {
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });

    const input = container.querySelector(
      'input[aria-label="Command search"]',
    ) as HTMLInputElement;

    // Order is: nav-packets, nav-outreach, nav-dashboard, packet-add-note,
    // packet-resolve-missing, packet-send-review, account-signout.
    // selectedIndex starts at 0 = nav-packets. ArrowDown once → nav-outreach.
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockPush).toHaveBeenCalledWith("/outreach");
  });

  it("Enter on the first selection executes the first command (Go to packets)", () => {
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    const input = container.querySelector(
      'input[aria-label="Command search"]',
    ) as HTMLInputElement;
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(mockPush).toHaveBeenCalledWith("/packets");
  });

  it("Enter is a no-op for a disabled command", async () => {
    const user = userEvent.setup();
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    const input = container.querySelector(
      'input[aria-label="Command search"]',
    ) as HTMLInputElement;

    // Filter down to the disabled "Mark missing item resolved" command,
    // then press Enter. Should not navigate.
    await user.type(input, "Mark missing");

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockPush).not.toHaveBeenCalled();
    // Palette stays open because no command executed
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
  });
});

describe("CommandPalette page-conditional commands", () => {
  it('shows "Add note to current packet" as enabled on a /packets/<id> page', () => {
    mockPathname.mockReturnValue("/packets/abc-123");
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    const btn = container.querySelector(
      '[data-testid="cmd-packet-add-note"]',
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
  });

  it('disables "Add note to current packet" when not on a packet detail page', () => {
    mockPathname.mockReturnValue("/dashboard");
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    const btn = container.querySelector(
      '[data-testid="cmd-packet-add-note"]',
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('disables "Add note to current packet" on the /packets/ index page', () => {
    mockPathname.mockReturnValue("/packets/");
    const { container } = render(<CommandPalette />);
    act(() => {
      pressCmdK();
    });
    const btn = container.querySelector(
      '[data-testid="cmd-packet-add-note"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
