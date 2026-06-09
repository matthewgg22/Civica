import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// globals: false → mocks must be hoisted to be referenced in vi.mock factories.
const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}));

import MaeChat from "../MaeChat";

/** A streaming Response stub: yields `chunks` then done. */
function streamingResponse(chunks: string[]) {
  const enc = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () =>
          i < chunks.length
            ? Promise.resolve({ done: false, value: enc.encode(chunks[i++]) })
            : Promise.resolve({ done: true, value: undefined }),
      }),
    },
  };
}

describe("MaeChat", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders nothing for a non-staff / anonymous user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { container } = render(<MaeChat />);
    // Give the gating effect a tick to resolve.
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    expect(container.querySelector("button")).toBeNull();
  });

  it("opens a sign-in panel (no chat) for a non-staff user when prefilled", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    render(<MaeChat />);
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    // Another surface (e.g. the public CBO preview) opens Mae with a case question.
    fireEvent(window, new CustomEvent("mae:prefill", { detail: { text: "What does the work rule require?" } }));
    // Panel opens with the question + a staff sign-in state — but no composer/Send
    // (the LLM endpoint stays staff-gated).
    await screen.findByText(/previewing a navigator tool/i);
    expect(screen.getByText(/What does the work rule require\?/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
    const portalLink = screen.getByRole("link", { name: /navigator portal/i });
    expect(portalLink.getAttribute("href")).toBe("/login");
  });

  it("shows the launcher for a staff user", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { app_metadata: { role: "navigator" } } },
    });
    render(<MaeChat />);
    await screen.findByRole("button", { name: /ask mae/i });
  });

  it("opens the panel, streams an answer, and shows the disclaimer", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { app_metadata: { role: "navigator" } } },
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamingResponse(["Shelter ", "costs count."]) as unknown as Response);

    render(<MaeChat />);
    const launcher = await screen.findByRole("button", { name: /ask mae/i });
    fireEvent.click(launcher);

    // Disclaimer is always visible in the open panel.
    expect(screen.getByText(/not an eligibility determination/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/ask a snap policy question/i);
    fireEvent.change(textarea, { target: { value: "What is a shelter deduction?" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    // The streamed answer is assembled and rendered.
    await screen.findByText(/Shelter costs count\./i);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/mae",
      expect.objectContaining({ method: "POST" }),
    );
    const sentBody = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.messages[0]).toEqual({
      role: "user",
      content: "What is a shelter deduction?",
    });
    // A plain (non-case) query is logged as a generalist surface.
    expect(sentBody.meta).toEqual({ mode: "general", state: null, ref: null });
  });

  it("injects case context into the payload (not the visible transcript) when opened from a case", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "navigator" } } } });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamingResponse(["File the docs."]) as unknown as Response);

    render(<MaeChat />);
    await screen.findByRole("button", { name: /ask mae/i });

    // Another surface ("Ask Mae about this case") loads a case as context.
    fireEvent(
      window,
      new CustomEvent("mae:prefill", {
        detail: {
          caseContext: "CASE: CF-2026-0184 · Elena V.\nOutstanding to cure before filing (2): ...",
          caseLabel: "CF-2026-0184 · Elena V.",
          caseState: "CA",
          caseRef: "demo-pkt-elena",
        },
      }),
    );

    // The header shows the case-calibration chip; the composer is case-scoped.
    await screen.findByText(/Calibrated to CF-2026-0184 · Elena V\./);
    const textarea = await screen.findByPlaceholderText(/ask what to do on this case/i);
    fireEvent.change(textarea, { target: { value: "What needs to be done?" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    await screen.findByText(/File the docs\./i);

    // The API payload's first turn carries BOTH the case context and the question…
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages[0].content).toContain("CF-2026-0184");
    expect(body.messages[0].content).toContain("What needs to be done?");
    // …but the visible transcript shows only the question, not the context dump.
    expect(screen.queryByText(/Outstanding to cure before filing/)).toBeNull();
    // …and the scope metadata marks it as an application-specific, CA-scoped query.
    expect(body.meta).toEqual({ mode: "case", state: "CA", ref: "demo-pkt-elena" });
  });

  it("shows per-answer feedback and posts a thumbs-up to /api/mae/feedback", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "navigator" } } } });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamingResponse(["Shelter costs count."]) as unknown as Response);

    render(<MaeChat />);
    fireEvent.click(await screen.findByRole("button", { name: /ask mae/i }));
    const textarea = screen.getByPlaceholderText(/ask a snap policy question/i);
    fireEvent.change(textarea, { target: { value: "What is a shelter deduction?" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    await screen.findByText(/Shelter costs count\./i);

    // Feedback affordance appears under the completed answer.
    fireEvent.click(await screen.findByRole("button", { name: /^helpful$/i }));
    await screen.findByText(/feedback recorded/i);

    const fb = fetchSpy.mock.calls.find((c) => c[0] === "/api/mae/feedback");
    expect(fb).toBeTruthy();
    const body = JSON.parse((fb![1] as RequestInit).body as string);
    expect(body.rating).toBe("up");
    expect(body.question).toBe("What is a shelter deduction?");
    expect(body.answer).toContain("Shelter costs count.");
  });

  it("surfaces a friendly message when the endpoint is unconfigured (503)", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { app_metadata: { role: "admin" } } },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
    } as unknown as Response);

    render(<MaeChat />);
    fireEvent.click(await screen.findByRole("button", { name: /ask mae/i }));
    const textarea = screen.getByPlaceholderText(/ask a snap policy question/i);
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    await screen.findByText(/isn.t available yet/i);
  });
});
