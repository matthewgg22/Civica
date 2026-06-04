import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RequestAccessPage from "../page";

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

describe("RequestAccessPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("renders all required form fields", () => {
    render(<RequestAccessPage />);
    expect(screen.getByLabelText(/full name/i)).toBeDefined();
    expect(screen.getByLabelText(/organization/i)).toBeDefined();
    expect(screen.getByLabelText(/work email/i)).toBeDefined();
    expect(screen.getByLabelText(/how do you plan/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /request access/i })).toBeDefined();
  });

  it("shows success state after successful submission", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    render(<RequestAccessPage />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Smith" } });
    fireEvent.change(screen.getByLabelText(/organization/i), { target: { value: "Project Bread" } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "jane@projectbread.org" } });
    fireEvent.submit(screen.getByRole("button", { name: /request access/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/request received/i)).toBeDefined();
      expect(screen.getByText(/jane@projectbread.org/)).toBeDefined();
    });
  });

  it("shows error state when API returns an error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to save request" }),
    });

    render(<RequestAccessPage />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText(/organization/i), { target: { value: "Org" } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "jane@org.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /request access/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/failed to save request/i)).toBeDefined();
    });
  });

  it("shows generic error when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<RequestAccessPage />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText(/organization/i), { target: { value: "Org" } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "jane@org.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /request access/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeDefined();
    });
  });

  it("has a 'Back to sign in' link pointing to /login", () => {
    render(<RequestAccessPage />);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect((link as HTMLAnchorElement).href).toContain("/login");
  });
});
