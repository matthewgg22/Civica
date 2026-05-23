/**
 * Receipt match job — per plan D6.
 *
 * For a newly uploaded receipt (match_status='pending_match') this job:
 *  1. Looks up candidate ebt_transactions WHERE:
 *       - amount_cents within ±50 cents of ocr_total_cents
 *       - posted_at within 72 hours of captured_at
 *  2. Scores each candidate's merchant against ocr_merchant using
 *     Jaro-Winkler similarity (written inline, no dep).
 *  3. Filters candidates to those with fuzzyScore >= 0.7 (or ocr_merchant
 *     is null, in which case amount+time alone qualify).
 *  4. Resolves:
 *       - Exactly 1 → match_status='matched', sets transaction_id
 *       - Multiple   → match_status='ambiguous'
 *       - 0 + captured_at > 7d ago → match_status='standalone'
 *       - 0 + captured_at <= 7d ago → leave as 'pending_match' (will retry)
 *
 * Exported as a named function so receipts.ts can call it fire-and-forget,
 * and tests can call it directly with a mock db client.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

const AMOUNT_TOLERANCE_CENTS = 50;  // ±$0.50
const MERCHANT_FUZZY_THRESHOLD = 0.7;
const WINDOW_HOURS = 72;
const STANDALONE_DAYS = 7;

// MARK: - Public API

export interface ReceiptInput {
  id: string;
  ocr_total_cents: number | null;
  ocr_merchant: string | null;
  captured_at: string;
  match_status: string;
  user_id: string;
}

interface TransactionCandidate {
  id: string;
  amount_cents: number;
  merchant: string;
  posted_at: string;
}

export async function matchReceipt(db: DbClient, receipt: ReceiptInput): Promise<void> {
  // Only process pending_match receipts
  if (receipt.match_status !== 'pending_match') return;

  const capturedAt = new Date(receipt.captured_at);
  const windowStart = new Date(capturedAt.getTime() - WINDOW_HOURS * 3_600_000).toISOString();
  const windowEnd   = new Date(capturedAt.getTime() + WINDOW_HOURS * 3_600_000).toISOString();

  // Fetch candidate transactions for the user within the time window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: txRows, error: txError } = await (db.schema('snap_enrollment').from('ebt_transactions' as any) as any)
    .select('id, amount_cents, merchant, posted_at')
    .eq('user_id', receipt.user_id)
    .gte('posted_at', windowStart)
    .lte('posted_at', windowEnd) as {
      data: TransactionCandidate[] | null;
      error: { message: string } | null;
    };

  if (txError) {
    // Non-fatal: job logs and exits; receipt stays pending_match
    console.error('[match-receipt] DB error fetching transactions:', txError.message);
    return;
  }

  const candidates = (txRows ?? []).filter((tx) => {
    // Amount filter (skip if OCR total unknown)
    if (receipt.ocr_total_cents !== null) {
      const diff = Math.abs(tx.amount_cents - receipt.ocr_total_cents);
      // Transactions are stored as negative amounts for purchases
      const diffAbs = Math.min(
        Math.abs(tx.amount_cents - receipt.ocr_total_cents),
        Math.abs(Math.abs(tx.amount_cents) - receipt.ocr_total_cents),
      );
      if (diff > AMOUNT_TOLERANCE_CENTS && diffAbs > AMOUNT_TOLERANCE_CENTS) return false;
    }

    // Merchant fuzzy filter (skip if OCR merchant unknown)
    if (receipt.ocr_merchant) {
      const score = jaroWinkler(
        receipt.ocr_merchant.toLowerCase(),
        tx.merchant.toLowerCase(),
      );
      if (score < MERCHANT_FUZZY_THRESHOLD) return false;
    }

    return true;
  });

  let newStatus: string;
  let transactionId: string | null = null;

  if (candidates.length === 1 && candidates[0]) {
    newStatus = 'matched';
    transactionId = candidates[0].id;
  } else if (candidates.length > 1) {
    newStatus = 'ambiguous';
  } else {
    // No candidates found
    const nowMs = Date.now();
    const capturedMs = capturedAt.getTime();
    const elapsedDays = (nowMs - capturedMs) / (1000 * 60 * 60 * 24);
    newStatus = elapsedDays >= STANDALONE_DAYS ? 'standalone' : 'pending_match';
  }

  // Only write if status changed
  if (newStatus === receipt.match_status && transactionId === null) return;

  const updatePayload: Record<string, unknown> = { match_status: newStatus };
  if (transactionId) updatePayload.transaction_id = transactionId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (db.schema('snap_enrollment').from('ebt_receipts' as any) as any)
    .update(updatePayload)
    .eq('id', receipt.id) as { error: { message: string } | null };

  if (updateError) {
    console.error('[match-receipt] Failed to update match status:', updateError.message);
  }
}

// MARK: - Jaro-Winkler (inline, ~30 lines, no dep)

/**
 * Jaro-Winkler similarity between two strings.
 * Returns a value in [0.0, 1.0] where 1.0 is identical.
 *
 * Implementation based on the canonical algorithm:
 * Winkler, W.E. (1990). String Comparator Metrics and Enhanced Decision
 * Rules in the Fellegi-Sunter Model of Record Linkage.
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchWindow = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0);

  const s1Matches = new Array<boolean>(s1.length).fill(false);
  const s2Matches = new Array<boolean>(s2.length).fill(false);

  let matchCount = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matchCount++;
      break;
    }
  }

  if (matchCount === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matchCount / s1.length +
      matchCount / s2.length +
      (matchCount - transpositions / 2) / matchCount) /
    3;

  // Winkler prefix bonus (up to 4 chars, scaling factor 0.1)
  let prefixLen = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefixLen++;
    else break;
  }

  return jaro + prefixLen * 0.1 * (1 - jaro);
}
