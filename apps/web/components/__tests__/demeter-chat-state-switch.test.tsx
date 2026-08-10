// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { PackMeta } from "@civica/demeter-engine/packs";
import { DemeterChat } from "../DemeterChat";

// State-switch spec (T12 / T-C): switching scope mid-conversation must
// (1) insert a visible divider — earlier answers may no longer apply — and
// (2) thread the NEW state into the next request. No silent re-scoping.
//
// The interaction moved from a radio chip row to a searchable combobox
// (2026-08-09) — the CONTRACT under test is unchanged, so these assertions are
// the same; only the two lines that pick a state were rewritten.

const verification = {
  verified_on: "2026-08-05",
  method: "test fixture",
  gates: "n/a",
  sources: [],
};
const STATES: PackMeta[] = [
  {
    code: "CA",
    program: "CalFresh",
    agency: "California Department of Social Services",
    adminModel: "county",
    portal: { name: "BenefitsCal", url: "https://benefitscal.com" },
    verified: true,
    verification,
  },
  {
    code: "TX",
    program: "Texas SNAP",
    agency: "Texas Health and Human Services Commission",
    adminModel: "state",
    portal: undefined,
    verified: true,
    verification,
  },
];

function streamedResponse(text: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(text));
      c.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const fetchMock = vi.fn();

// jsdom implements neither element scrolling nor smooth-scroll options.
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async () => streamedResponse("an answer"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function sendQuestion(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/Ask anything about SNAP/), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getAllByText("an answer").length).toBeGreaterThan(0));
}

/** Open the picker and choose an option by visible name. */
function pickState(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: "Your state" }));
  fireEvent.click(screen.getByRole("option", { name }));
}

describe("DemeterChat state switching", () => {
  it("starts on the federal floor and sends state: null", async () => {
    render(<DemeterChat states={STATES} />);
    expect(screen.getByRole("button", { name: "Your state" }).textContent).toContain(
      "All states",
    );
    await sendQuestion("What is SNAP?");
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.state).toBeNull();
  });

  it("switching state mid-chat inserts a divider and re-scopes the next request", async () => {
    render(<DemeterChat states={STATES} />);
    await sendQuestion("What is SNAP?");
    // No divider yet.
    expect(screen.queryByRole("status")).toBeNull();

    pickState(/TX/);
    expect(screen.getByRole("status").textContent).toContain("Now answering for Texas SNAP");

    await sendQuestion("And in Texas?");
    const body = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(body.state).toBe("TX");
    // Divider turns never leak into the API message history.
    expect(
      (body.messages as Array<{ role: string }>).every((m) => m.role !== "divider"),
    ).toBe(true);
  });

  it("switching back to federal inserts the federal divider", async () => {
    render(<DemeterChat states={STATES} initialState="CA" />);
    await sendQuestion("What is CalFresh?");
    pickState(/All states/);
    expect(screen.getByRole("status").textContent).toContain("federal rules only");
  });

  it("does not insert a divider before any chat exists", () => {
    render(<DemeterChat states={STATES} />);
    pickState(/TX/);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("filters the list by state, program, or agency", () => {
    render(<DemeterChat states={STATES} />);
    fireEvent.click(screen.getByRole("button", { name: "Your state" }));
    // Agency text is searchable, not just the code — someone types what they
    // know ("Health and Human Services") and still finds their state.
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "health and human" },
    });
    expect(screen.queryByRole("option", { name: /CalFresh/ })).toBeNull();
    expect(screen.getByRole("option", { name: /Texas SNAP/ })).toBeTruthy();
  });
});
