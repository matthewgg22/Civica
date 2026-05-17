import type { OcrResult } from "@civica/types";

export const FIXTURE_TEXTRACT_OCR_RESULT: OcrResult = {
  document_id: "00000000-0000-0000-0000-000000000020",
  provider: "textract",
  fields: [
    {
      name: "employer_name",
      value: "Acme Corp",
      confidence: 0.994,
      provider: "textract",
      bbox: { left: 0.101, top: 0.052, width: 0.398, height: 0.041, page: 0 },
    },
    {
      name: "gross_pay",
      value: "2500.00",
      confidence: 0.987,
      provider: "textract",
      bbox: { left: 0.601, top: 0.299, width: 0.198, height: 0.032, page: 0 },
    },
  ],
  raw_response: {
    JobId: "mock-textract-job-id",
    JobStatus: "SUCCEEDED",
  },
  processing_ms: 1840,
  created_at: "2026-01-10T10:04:00.000Z",
};

export const FIXTURE_ON_DEVICE_OCR_RESULT: OcrResult = {
  document_id: "00000000-0000-0000-0000-000000000020",
  provider: "on_device",
  fields: [
    { name: "employer_name", value: "Acme Corp", confidence: 0.97, provider: "on_device" },
    { name: "gross_pay", value: "2500.00", confidence: 0.95, provider: "on_device" },
  ],
  processing_ms: 320,
  created_at: "2026-01-10T10:02:00.000Z",
};
