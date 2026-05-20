import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Hoist mocks — vitest.config has globals: false, so we must define the mock
// functions inside vi.hoisted() to reference them from vi.mock factories.
const mocks = vi.hoisted(() => ({
  getDocumentSignedUrl: vi.fn(),
  fieldsReview: vi.fn(),
  routerRefresh: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("../app/packets/[packetId]/actions", () => ({
  getDocumentSignedUrl: mocks.getDocumentSignedUrl,
}));

vi.mock("../lib/api", () => ({
  api: {
    fields: {
      review: mocks.fieldsReview,
    },
  },
}));

vi.mock("../lib/supabase", () => ({
  createClient: () => ({
    auth: { getSession: mocks.getSession },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));

import DocumentGrid from "../components/DocumentGrid";
import DocumentViewer, { type UploadedDoc, type ExtractionFieldRow } from "../components/DocumentViewer";

const baseDoc = (overrides: Partial<UploadedDoc> = {}): UploadedDoc => ({
  document_id: "doc-1",
  document_kind: "paystub",
  original_filename: "paystub_apr.jpg",
  processing_status: "confirmed",
  uploaded_at: "2026-05-01T12:00:00Z",
  ...overrides,
});

const baseField = (overrides: Partial<ExtractionFieldRow> = {}): ExtractionFieldRow => ({
  field_id: "field-1",
  extraction_id: "ext-1",
  field_key: "employer_name",
  field_label: "Employer name",
  original_ocr_value: "Trader Joe's #205",
  applicant_answer: null,
  navigator_confirmed_value: null,
  confidence: 0.92,
  needs_review: false,
  reviewed_at: null,
  review_note: null,
  ...overrides,
});

describe("DocumentGrid", () => {
  beforeEach(() => {
    mocks.getDocumentSignedUrl.mockReset();
    mocks.fieldsReview.mockReset();
    mocks.routerRefresh.mockReset();
    mocks.getSession.mockReset();
    mocks.getDocumentSignedUrl.mockResolvedValue({
      url: "https://example.test/signed/doc-1.jpg",
      expiresAt: Date.now() + 5 * 60_000,
      contentType: "image/jpeg",
    });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a card per document", () => {
    const docs = [
      baseDoc({ document_id: "doc-1", original_filename: "stub-1.jpg" }),
      baseDoc({ document_id: "doc-2", original_filename: "stub-2.jpg" }),
      baseDoc({ document_id: "doc-3", original_filename: "stub-3.jpg" }),
    ];
    render(<DocumentGrid docs={docs} fields={[]} extractionsByDoc={{}} />);

    expect(screen.getByTestId("doc-card-doc-1")).toBeInTheDocument();
    expect(screen.getByTestId("doc-card-doc-2")).toBeInTheDocument();
    expect(screen.getByTestId("doc-card-doc-3")).toBeInTheDocument();
  });

  it("opens the viewer pinned to the clicked document", async () => {
    const docs = [
      baseDoc({ document_id: "doc-1", original_filename: "stub-1.jpg" }),
      baseDoc({ document_id: "doc-2", original_filename: "stub-2.jpg" }),
    ];
    render(<DocumentGrid docs={docs} fields={[]} extractionsByDoc={{}} />);

    fireEvent.click(screen.getByTestId("doc-card-doc-2"));

    await waitFor(() => {
      expect(screen.getByTestId("document-viewer-modal")).toBeInTheDocument();
    });
    // "stub-2.jpg" appears in both the card's caption and the modal's header.
    expect(screen.getAllByText("stub-2.jpg").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("stub-1.jpg")).not.toBeNull(); // card still visible
  });
});

describe("DocumentViewer", () => {
  beforeEach(() => {
    mocks.getDocumentSignedUrl.mockReset();
    mocks.fieldsReview.mockReset();
    mocks.routerRefresh.mockReset();
    mocks.getSession.mockReset();
    mocks.getDocumentSignedUrl.mockResolvedValue({
      url: "https://example.test/signed/doc-1.jpg",
      expiresAt: Date.now() + 5 * 60_000,
      contentType: "image/jpeg",
    });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  });

  afterEach(() => {
    cleanup();
  });

  it("fetches a signed URL on mount and renders the image", async () => {
    render(
      <DocumentViewer
        doc={baseDoc()}
        fields={[]}
        extractionsByDoc={{}}
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(mocks.getDocumentSignedUrl).toHaveBeenCalledWith("doc-1");
    });
    const img = await screen.findByAltText(/paystub_apr\.jpg/i);
    expect(img).toHaveAttribute("src", "https://example.test/signed/doc-1.jpg");
  });

  it("filters extraction fields to the doc's extraction(s)", async () => {
    const fields = [
      baseField({ field_id: "f-mine", extraction_id: "ext-1", field_label: "Employer name" }),
      baseField({ field_id: "f-other", extraction_id: "ext-99", field_label: "Other doc field" }),
    ];
    render(
      <DocumentViewer
        doc={baseDoc()}
        fields={fields}
        extractionsByDoc={{ "doc-1": ["ext-1"] }}
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("field-row-f-mine")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("field-row-f-other")).not.toBeInTheDocument();
  });

  it("shows REVIEW badge for low-confidence fields", async () => {
    const fields = [
      baseField({ field_id: "f-low", confidence: 0.71, needs_review: true }),
    ];
    render(
      <DocumentViewer
        doc={baseDoc()}
        fields={fields}
        extractionsByDoc={{ "doc-1": ["ext-1"] }}
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("field-row-f-low")).toBeInTheDocument();
    });
    expect(screen.getByText("REVIEW")).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
  });

  it("confirms a field via the review API", async () => {
    mocks.fieldsReview.mockResolvedValue({});
    const fields = [baseField({ field_id: "f-1", original_ocr_value: "Trader Joe's" })];
    render(
      <DocumentViewer
        doc={baseDoc()}
        fields={fields}
        extractionsByDoc={{ "doc-1": ["ext-1"] }}
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("field-row-f-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Confirm Employer name"));
    fireEvent.click(screen.getByLabelText("Save Employer name"));

    await waitFor(() => {
      expect(mocks.fieldsReview).toHaveBeenCalledWith("tok", "f-1", {
        navigator_confirmed_value: "Trader Joe's",
      });
    });
  });

  it("shows the 'still processing' state for uploaded/extracting docs", async () => {
    render(
      <DocumentViewer
        doc={baseDoc({ processing_status: "extracting" })}
        fields={[]}
        extractionsByDoc={{}}
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Still processing/i)).toBeInTheDocument();
    });
  });

  it("ESC key closes the modal", async () => {
    const onClose = vi.fn();
    render(
      <DocumentViewer
        doc={baseDoc()}
        fields={[]}
        extractionsByDoc={{}}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
