import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// globals: false → mocks must be hoisted to be referenced in vi.mock factories.
const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}));

import MaeChat from "../MaeChat";
import { MAE_DISCLAIMER as ENGINE_DISCLAIMER } from "@civica/demeter-engine/system-prompt";

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
    const launcher = await screen.findByRole("button", { name: /ask mae/i });
    // The launcher's decorative avatar badge is "M" for Mae — the dashboard's
    // staff assistant, deliberately a different name from the public
    // "Demeter AI" product (2026-08-09). Briefly said "D" during the
    // Mae->Demeter rebrand (#649/#665) before that overlap was caught and
    // reverted for this surface. Assert the avatar span's OWN content,
    // isolated from the button's full label text.
    const avatar = launcher.querySelector("span[aria-hidden]");
    expect(avatar?.textContent?.trim()).toBe("M");
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

    // The open panel's own header repeats the "M" avatar (a distinct DOM
    // node from the launcher's) — checked here for the panel header
    // specifically, same gap #665 caught the first time (then "D") in the
    // Mae->Demeter direction.
    const dialog = screen.getByRole("dialog", { name: /ask mae/i });
    const headerAvatar = dialog.querySelector("span[aria-hidden]");
    expect(headerAvatar?.textContent?.trim()).toBe("M");

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
    // A plain (non-case) query is logged as a generalist surface, with the clean question.
    expect(sentBody.meta).toEqual({ mode: "general", state: null, ref: null, question: "What is a shelter deduction?" });
  });

  it("#645: disclaimer is the engine's own MAE_DISCLAIMER (not a re-hardcoded copy), plus the PII reminder", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { app_metadata: { role: "navigator" } } },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamingResponse([]) as unknown as Response);

    render(<MaeChat />);
    const launcher = await screen.findByRole("button", { name: /ask mae/i });
    fireEvent.click(launcher);

    // The panel's disclaimer text starts with the exact string imported from
    // @civica/demeter-engine/system-prompt -- not a second, hand-maintained
    // copy that can drift (this is what #645 originally fixed). The engine's
    // own MAE_DISCLAIMER says "Mae can be wrong..." (2026-08-09: reverted
    // from "Demeter can be wrong..." — this constant's only consumer is the
    // dashboard's staff chat, which is named Mae, distinct from the public
    // Demeter AI product).
    const disclaimer = await screen.findByText((_, node) => node?.textContent === `${ENGINE_DISCLAIMER} Don't paste the applicant's PII (name, case number, etc.) — keep questions hypothetical.`);
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer.textContent).toContain("Mae can be wrong");
    expect(disclaimer.textContent).not.toContain("Demeter can be wrong");
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
    // …and the scope metadata marks it as an application-specific, CA-scoped query,
    // carrying the clean typed question (not the context block).
    expect(body.meta).toEqual({ mode: "case", state: "CA", ref: "demo-pkt-elena", question: "What needs to be done?" });
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
