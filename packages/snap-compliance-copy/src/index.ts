import bannedPhrasesRaw from "../data/_banned-phrases.json";
import pendingRevisionsRaw from "../data/_pending-revisions.json";
import exemptionCopyRaw from "../data/exemption-copy.json";
import {
  BannedPhrasesFileSchema,
  PendingRevisionsFileSchema,
  ExemptionCopyFileSchema,
  type BannedPhrase,
  type PendingCopyRevision,
  type RevisionStatus,
  type ExemptionCopy,
} from "./schemas";

export type { BannedPhrase, PendingCopyRevision, RevisionStatus, ExemptionCopy };
export {
  BannedPhraseSchema,
  PendingCopyRevisionSchema,
  RevisionStatusSchema,
  BannedPhrasesFileSchema,
  PendingRevisionsFileSchema,
  ExemptionCopySchema,
  ExemptionCopyFileSchema,
} from "./schemas";

const bannedPhrasesFile = BannedPhrasesFileSchema.parse(bannedPhrasesRaw);
const pendingRevisionsFile = PendingRevisionsFileSchema.parse(pendingRevisionsRaw);
const exemptionCopyFile = ExemptionCopyFileSchema.parse(exemptionCopyRaw);

export const exemptionCopy: readonly ExemptionCopy[] = Object.freeze(
  exemptionCopyFile.entries.map((e) => Object.freeze({ ...e })),
);

/** Look up bilingual exemption copy by exemption-type id. */
export function exemptionCopyFor(id: string): ExemptionCopy | null {
  return exemptionCopy.find((e) => e.id === id) ?? null;
}

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
