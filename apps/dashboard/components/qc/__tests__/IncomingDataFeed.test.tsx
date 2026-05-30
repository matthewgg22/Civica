// T-test-4 (eng review 2026-05-25): IncomingDataFeed render + filter chip behavior.

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import IncomingDataFeed, {
  type FeedPacket,
} from "../IncomingDataFeed";

function pkt(
  id: string,
  initials: string,
  daysPending: number,
  engagement: FeedPacket["engagement"],
): FeedPacket {
  return { packetId: id, applicantInitials: initials, daysPending, engagement };
}

const FIXTURE: FeedPacket[] = [
  // Stack-engaged packet — projection holds
  pkt("packet1a", "JD", 3, {
    income: true,
    shelter: true,
    suaFlags: true,
    obbbaImpactTagged: true,
  }),
  // Missing income (gap widens)
  pkt("packet2b", "AS", 12, {
    income: false,
    shelter: true,
    suaFlags: true,
    obbbaImpactTagged: true,
  }),
  // Missing shelter
  pkt("packet3c", "MR", 7, {
    income: true,
    shelter: false,
    suaFlags: true,
    obbbaImpactTagged: true,
  }),
  // Missing OBBBA tag
  pkt("packet4d", "PT", 5, {
    income: true,
    shelter: true,
    suaFlags: true,
    obbbaImpactTagged: false,
  }),
  // Nothing engaged
  pkt("packet5e", "KW", 21, {
    income: false,
    shelter: false,
    suaFlags: false,
    obbbaImpactTagged: false,
  }),
];

describe("IncomingDataFeed — render with fixture", () => {
  it("renders the eyebrow + dynamic title", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    expect(
      screen.getByText(/Incoming data feed · per-applicant signal/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Last 5 packets · engagement vector/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders all 5 fixture packets as <li> rows", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBe(5);
  });

  it("renders the n=X counter", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    expect(screen.getByText(/n = 5 packets/i)).toBeInTheDocument();
  });

  it("renders engagement pills for each pillar (Inc/Shl/SUA/OBB) per packet", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    // 5 packets × 4 pills = 20 pills minimum.
    expect(screen.getAllByText("Inc").length).toBe(5);
    expect(screen.getAllByText("Shl").length).toBe(5);
    expect(screen.getAllByText("SUA").length).toBe(5);
    expect(screen.getAllByText("OBB").length).toBe(5);
  });

  it("packet ID truncated to first 8 chars + applicant initials shown", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    expect(screen.getByText("packet1a")).toBeInTheDocument();
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("renders 'Stack engaged · projection holds' hint for fully-engaged packet", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    expect(screen.getByText(/Stack engaged · projection holds/)).toBeInTheDocument();
  });

  it("renders 'Connect Argyle' hint for income-missing packet", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    expect(screen.getByText(/^Connect Argyle$/)).toBeInTheDocument();
  });

  it("renders 'Upload lease document' hint for shelter-missing packet", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    expect(screen.getByText(/^Upload lease document$/)).toBeInTheDocument();
  });

  it("renders 'Connect Argyle + upload lease' for fully-missing packet", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    expect(
      screen.getByText(/Connect Argyle \+ upload lease/),
    ).toBeInTheDocument();
  });
});

describe("IncomingDataFeed — filter chip behavior", () => {
  it("filter chips render as a radiogroup with the documented filters", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    const group = screen.getByRole("radiogroup", {
      name: /Filter packets by engagement/i,
    });
    const chips = within(group).getAllByRole("radio");
    expect(chips.length).toBe(5);
  });

  it("'All packets' filter shows all 5 packets", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    const allChip = screen.getByRole("radio", { name: /All packets \(5\)/i });
    fireEvent.click(allChip);
    expect(screen.getAllByRole("listitem").length).toBe(5);
  });

  it("'Missing income wire' filter shows only income-missing packets", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    const chip = screen.getByRole("radio", {
      name: /Missing income wire \(2\)/i,
    });
    fireEvent.click(chip);
    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBe(2);
    // packet2b (income=false) and packet5e (income=false) match.
    expect(screen.getByText("packet2b")).toBeInTheDocument();
    expect(screen.getByText("packet5e")).toBeInTheDocument();
  });

  it("'Missing shelter doc' filter shows only shelter-missing packets", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    const chip = screen.getByRole("radio", {
      name: /Missing shelter doc \(2\)/i,
    });
    fireEvent.click(chip);
    expect(screen.getAllByRole("listitem").length).toBe(2);
  });

  it("'Stack engaged' filter shows only fully-engaged packets", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    const chip = screen.getByRole("radio", {
      name: /Stack engaged · verify projection \(2\)/i,
    });
    fireEvent.click(chip);
    const rows = screen.getAllByRole("listitem");
    // packet1a + packet4d (both have income+shelter+suaFlags).
    expect(rows.length).toBe(2);
    expect(screen.getByText("packet1a")).toBeInTheDocument();
    expect(screen.getByText("packet4d")).toBeInTheDocument();
  });

  it("active filter chip has aria-checked=true and themed styling", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    const chip = screen.getByRole("radio", {
      name: /Missing shelter doc/i,
    });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-checked", "true");
  });
});

describe("IncomingDataFeed — empty state + filter empty state", () => {
  it("renders the empty-packet hint when n=0", () => {
    render(<IncomingDataFeed packets={[]} />);
    expect(screen.getByText(/n = 0 packets/i)).toBeInTheDocument();
    expect(screen.getByText(/No packets match this filter/i)).toBeInTheDocument();
  });

  it("renders the empty-filter hint when filter yields 0", () => {
    // Fixture with all stack-engaged packets, then filter by missing-income.
    const allEngaged: FeedPacket[] = [
      pkt("a", "A", 1, {
        income: true,
        shelter: true,
        suaFlags: true,
        obbbaImpactTagged: true,
      }),
    ];
    render(<IncomingDataFeed packets={allEngaged} />);
    const chip = screen.getByRole("radio", {
      name: /Missing income wire \(0\)/i,
    });
    fireEvent.click(chip);
    expect(
      screen.getByText(/No packets match this filter/i),
    ).toBeInTheDocument();
  });
});

describe("IncomingDataFeed — drill-in link to /packets/[id]", () => {
  it("each row has an aria-labeled link to its packet detail page", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    for (const p of FIXTURE) {
      const link = screen.getByRole("link", {
        name: new RegExp(`Open packet ${p.packetId}`, "i"),
      });
      expect(link).toHaveAttribute("href", `/packets/${p.packetId}`);
    }
  });
});

describe("IncomingDataFeed — accessibility contract", () => {
  it("engagement pills have aria-labels distinguishing engaged vs missing", () => {
    const { container } = render(<IncomingDataFeed packets={FIXTURE} />);
    const labels = Array.from(
      container.querySelectorAll("[aria-label]"),
    ).map((el) => el.getAttribute("aria-label"));
    expect(labels.some((l) => l && /Inc: engaged/.test(l))).toBe(true);
    expect(labels.some((l) => l && /Inc: missing/.test(l))).toBe(true);
  });

  it("filter chips are role=radio inside role=radiogroup with aria-label", () => {
    render(<IncomingDataFeed packets={FIXTURE} />);
    const group = screen.getByRole("radiogroup", {
      name: /Filter packets by engagement/i,
    });
    expect(group).toBeInTheDocument();
  });
});
