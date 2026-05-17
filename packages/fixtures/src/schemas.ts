import type { PacketStatus } from "@civica/snap-enums";
import type { DocumentType, DocumentStatus } from "@civica/snap-enums";

export type { PacketStatus, DocumentType, DocumentStatus };

export type SupportedState = "CA" | "MA";

export type OcrProvider = "on_device" | "textract" | "document_ai";

export interface Bbox {
  left: number;
  top: number;
  width: number;
  height: number;
  page: number;
}

export interface ExtractionField {
  name: string;
  value: string;
  confidence: number;
  bbox?: Bbox;
  provider: OcrProvider;
  raw?: unknown;
}

export interface OcrResult {
  document_id: string;
  provider: OcrProvider;
  fields: ExtractionField[];
  raw_response?: unknown;
  processing_ms?: number;
  created_at: string;
}

export type UserRole = "applicant" | "navigator" | "admin";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  state: SupportedState;
  created_at: string;
  updated_at: string;
}

export interface Navigator {
  id: string;
  user_id: string;
  organization: string;
  states: SupportedState[];
  created_at: string;
}

export interface Document {
  id: string;
  packet_id: string;
  type: DocumentType;
  status: DocumentStatus;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  extraction_fields?: ExtractionField[];
  created_at: string;
  updated_at: string;
}

export interface Packet {
  id: string;
  user_id: string;
  state: SupportedState;
  status: PacketStatus;
  readiness_score: number | null;
  documents?: Document[];
  navigator_id: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}
