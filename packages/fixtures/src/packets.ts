import type { Packet, Document } from "@civica/types";
import { FIXTURE_APPLICANT, FIXTURE_NAVIGATOR } from "./users.js";

export const FIXTURE_DOCUMENT_PAYSTUB: Document = {
  id: "00000000-0000-0000-0000-000000000020",
  packet_id: "00000000-0000-0000-0000-000000000001",
  type: "paystub",
  status: "extracted",
  storage_path: "documents/00000000-0000-0000-0000-000000000020/paystub.pdf",
  file_name: "paystub.pdf",
  file_size_bytes: 102400,
  mime_type: "application/pdf",
  extraction_fields: [
    {
      name: "employer_name",
      value: "Acme Corp",
      confidence: 0.97,
      provider: "on_device",
      bbox: { left: 0.1, top: 0.05, width: 0.4, height: 0.04, page: 0 },
    },
    {
      name: "gross_pay",
      value: "2500.00",
      confidence: 0.95,
      provider: "on_device",
      bbox: { left: 0.6, top: 0.3, width: 0.2, height: 0.03, page: 0 },
    },
    {
      name: "pay_period_start",
      value: "2026-01-01",
      confidence: 0.99,
      provider: "on_device",
      bbox: { left: 0.1, top: 0.15, width: 0.25, height: 0.03, page: 0 },
    },
    {
      name: "pay_period_end",
      value: "2026-01-15",
      confidence: 0.99,
      provider: "on_device",
      bbox: { left: 0.4, top: 0.15, width: 0.25, height: 0.03, page: 0 },
    },
  ],
  created_at: "2026-01-10T10:00:00.000Z",
  updated_at: "2026-01-10T10:05:00.000Z",
};

export const FIXTURE_DOCUMENT_PHOTO_ID: Document = {
  id: "00000000-0000-0000-0000-000000000021",
  packet_id: "00000000-0000-0000-0000-000000000001",
  type: "photo_id",
  status: "extracted",
  storage_path: "documents/00000000-0000-0000-0000-000000000021/id.jpg",
  file_name: "id.jpg",
  file_size_bytes: 512000,
  mime_type: "image/jpeg",
  extraction_fields: [
    { name: "full_name", value: "Jane Smith", confidence: 0.98, provider: "on_device" },
    { name: "date_of_birth", value: "1990-05-15", confidence: 0.97, provider: "on_device" },
  ],
  created_at: "2026-01-10T10:01:00.000Z",
  updated_at: "2026-01-10T10:06:00.000Z",
};

export const FIXTURE_PACKET_IN_PROGRESS: Packet = {
  id: "00000000-0000-0000-0000-000000000001",
  user_id: FIXTURE_APPLICANT.id,
  state: "CA",
  status: "in_progress",
  readiness_score: 60,
  navigator_id: FIXTURE_NAVIGATOR.id,
  submitted_at: null,
  documents: [FIXTURE_DOCUMENT_PAYSTUB, FIXTURE_DOCUMENT_PHOTO_ID],
  created_at: "2026-01-10T09:00:00.000Z",
  updated_at: "2026-01-10T10:06:00.000Z",
};

export const FIXTURE_PACKET_READY: Packet = {
  id: "00000000-0000-0000-0000-000000000002",
  user_id: FIXTURE_APPLICANT.id,
  state: "CA",
  status: "ready_for_review",
  readiness_score: 95,
  navigator_id: FIXTURE_NAVIGATOR.id,
  submitted_at: null,
  documents: [FIXTURE_DOCUMENT_PAYSTUB, FIXTURE_DOCUMENT_PHOTO_ID],
  created_at: "2026-01-11T09:00:00.000Z",
  updated_at: "2026-01-11T12:00:00.000Z",
};

export const FIXTURE_PACKET_SUBMITTED: Packet = {
  id: "00000000-0000-0000-0000-000000000003",
  user_id: FIXTURE_APPLICANT.id,
  state: "MA",
  status: "submitted",
  readiness_score: 100,
  navigator_id: null,
  submitted_at: "2026-01-12T09:00:00.000Z",
  documents: [],
  created_at: "2026-01-11T09:00:00.000Z",
  updated_at: "2026-01-12T09:00:00.000Z",
};

export const FIXTURE_PACKET_DRAFT: Packet = {
  id: "00000000-0000-0000-0000-000000000004",
  user_id: FIXTURE_APPLICANT.id,
  state: "CA",
  status: "draft",
  readiness_score: null,
  navigator_id: null,
  submitted_at: null,
  documents: [],
  created_at: "2026-01-13T09:00:00.000Z",
  updated_at: "2026-01-13T09:00:00.000Z",
};
