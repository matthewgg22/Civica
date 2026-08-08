// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { DemeterChat } from "../DemeterChat";

// State-switch spec (T12 / T-C): switching scope mid-conversation must
// (1) insert a visible divider — earlier answers may no longer apply — and
// (2) thread the NEW state into the next request. No silent re-scoping.

const STATES = [
  { code: "CA", program: "CalFresh", verified: true },
  { code: "TX", program: "Texas SNAP", verified: true },
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

describe("DemeterChat state switching", () => {
  it("starts on the federal floor and sends state: null", async () => {
    render(<DemeterChat states={STATES} />);
    expect(screen.getByRole("radio", { name: /All states/ })).toHaveProperty("ariaChecked", "true");
    await sendQuestion("What is SNAP?");
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.state).toBeNull();
  });

  it("switching state mid-chat inserts a divider and re-scopes the next request", async () => {
    render(<DemeterChat states={STATES} />);
    await sendQuestion("What is SNAP?");
    // No divider yet.
    expect(screen.queryByRole("status")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /TX/ }));
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
    fireEvent.click(screen.getByRole("radio", { name: /All states/ }));
    expect(screen.getByRole("status").textContent).toContain("federal rules only");
  });

  it("does not insert a divider before any chat exists", () => {
    render(<DemeterChat states={STATES} />);
    fireEvent.click(screen.getByRole("radio", { name: /TX/ }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
