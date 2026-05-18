import bannedPhrasesRaw from "../data/_banned-phrases.json";
import pendingRevisionsRaw from "../data/_pending-revisions.json";
import {
  BannedPhrasesFileSchema,
  PendingRevisionsFileSchema,
  type BannedPhrase,
  type PendingCopyRevision,
  type RevisionStatus,
} from "./schemas.js";

export type { BannedPhrase, PendingCopyRevision, RevisionStatus };
export {
  BannedPhraseSchema,
  PendingCopyRevisionSchema,
  RevisionStatusSchema,
  BannedPhrasesFileSchema,
  PendingRevisionsFileSchema,
} from "./schemas.js";

const bannedPhrasesFile = BannedPhrasesFileSchema.parse(bannedPhrasesRaw);
const pendingRevisionsFile = PendingRevisionsFileSchema.parse(pendingRevisionsRaw);

export const bannedPhrases: readonly BannedPhrase[] = Object.freeze(
  bannedPhrasesFile.entries.map((e) => Object.freeze({ ...e })),
);

export const pendingCopyRevisions: readonly PendingCopyRevision[] = Object.freeze(
  pendingRevisionsFile.entries.map((e) => Object.freeze({ ...e })),
);

export function approvedEnglish(id: string): string | null {
  const row = pendingCopyRevisions.find((r) => r.id === id);
  if (!row || row.status !== "approved") return null;
  return row.approved_english;
}

export function approvedSpanish(id: string): string | null {
  const row = pendingCopyRevisions.find((r) => r.id === id);
  if (!row || row.status !== "approved") return null;
  return row.approved_spanish;
}
