// Notice-validity checker (#586).
//
// Given what a county notice SAYS and what the household's own record SHOWS,
// flag the defects that make a denial or termination procedurally invalid, each
// mapped to the rule it violates and a concrete next step.
//
// WHY THIS IS THE PRODUCT, NOT "INTERVIEW PREP":
// In CDSS's own Management Evaluation reviews (38 county reports, FFY2024-25),
// the modal "missed interview" is an AGENCY failure, not an applicant no-show —
// the county never called (19 reports), sent the NOMI AFTER the household had
// completed its interview (19), sent no NOMI at all (~17), or denied before day
// 30 (7). Missed interview is also the #1 CalFresh denial reason in LA County
// (~27% of all denials, and the only major reason still growing). Preparation
// alone cannot fix a failure the applicant did not cause; asserting the rule
// can. Hence: detect the defect, cite the rule, hand the household a remedy.
//
// SCOPE / HONESTY BOUNDARY (load-bearing, mirrors Mae's posture):
// This is NOT a legal determination and NOT an adjudication. It flags a
// *possible* defect for a human — a navigator, an advocate, or the household —
// to verify against the county record before acting. Severity `invalidating`
// means "the cited rule says an action taken this way does not stand," not "you
// have won." Nothing here should be surfaced as a guaranteed outcome.

/** Notices this checker understands. */
export type NoticeKind =
  | "nomi" // Notice of Missed Interview
  | "denial_noa" // Notice of Action — denial
  | "termination_noa" // Notice of Action — termination/discontinuance
  | "approval_noa";

export type DefectSeverity =
  /** The cited rule says an action taken this way does not stand. */
  | "invalidating"
  /** A real violation that supports an appeal but may not alone void the action. */
  | "procedural"
  /** Worth raising; not itself a violation. */
  | "advisory";

export type DefectCode =
  | "nomi_after_completed_interview"
  | "nomi_missing_before_negative_action"
  | "nomi_and_denial_same_day"
  | "denial_before_day_30"
  | "compliance_date_after_day_30"
  | "reason_does_not_match_record"
  | "conflicting_reasons_across_notices"
  | "notice_never_sent"
  | "language_mismatch"
  | "interview_method_not_honored"
  | "no_documented_contact_attempt"
  | "expedited_interview_late"
  | "processing_exceeded_30_days";

export interface NoticeDefect {
  code: DefectCode;
  severity: DefectSeverity;
  /** One line a caseworker or applicant can read. */
  title: string;
  /** Why this is a defect, in plain language. */
  explanation: string;
  /** The rule violated. Verified against the ME corrective-action language. */
  authority: string;
  /** What the household or navigator should do next. */
  remedy: string;
}

/** What the notice itself says. */
export interface NoticeFacts {
  kind: NoticeKind;
  /** ISO date the notice was sent. */
  sentDate: string;
  /** Reasons printed on the notice (free text or codes). */
  statedReasons?: string[];
  /** Compliance / cure date printed on a NOMI. */
  complianceDate?: string;
  /** Language the notice was written in (e.g. "en", "es"). */
  language?: string;
}

/** What the household's own record shows. Supplied by the app, not the county. */
export interface CaseFacts {
  /** ISO date the application was filed. */
  applicationDate: string;
  /** ISO date the household actually completed an interview, if they did. */
  interviewCompletedDate?: string;
  /** Scheduled interview date, if one was set. */
  interviewScheduledDate?: string;
  /** TRUE if the county documented a contact attempt for the scheduled interview. */
  contactAttemptDocumented?: boolean;
  /** Whether a Notice of Missed Interview was issued at all before a negative action. */
  nomiSent?: boolean;
  /** ISO date the NOMI was sent, when one was. */
  nomiSentDate?: string;
  /** Interview method the household asked for. */
  interviewMethodRequested?: "phone" | "in_person";
  /** Interview method the county actually scheduled. */
  interviewMethodScheduled?: "phone" | "in_person";
  /** Household's preferred written language. */
  preferredLanguage?: string;
  /** What the case record gives as the real reason for the action. */
  recordReason?: string;
  /** TRUE when the household met expedited-service screening criteria. */
  expeditedEntitled?: boolean;
  /** Whether a required notice was ever received at all. */
  noticeReceived?: boolean;
  /** Reasons from any OTHER notice issued for the same action. */
  otherNoticeReasons?: string[];
  /** ISO date of the disposition, if one occurred. */
  decisionDate?: string;
}

const DAY_MS = 86_400_000;

/** Whole days from a to b. Negative when b precedes a. */
function daysBetween(a: string, b: string): number {
  return Math.floor((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

/** Loose comparison for free-text reasons — normalises case and punctuation. */
function reasonsAgree(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const x = norm(a);
  const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}

export interface NoticeReview {
  defects: NoticeDefect[];
  /** TRUE when at least one defect is severity `invalidating`. */
  likelyInvalid: boolean;
  /** Plain-language summary for the household. Always safe to display. */
  summary: string;
}

/**
 * Review one notice against the household's record.
 *
 * Deterministic and side-effect free: same inputs always give the same defects,
 * which is what makes it unit-testable against the real ME case narratives.
 */
export function reviewNotice(notice: NoticeFacts, facts: CaseFacts): NoticeReview {
  const defects: NoticeDefect[] = [];
  const isNegative = notice.kind === "denial_noa" || notice.kind === "termination_noa";

  // --- NOMI defects -------------------------------------------------------
  // Fresno D#2, Alameda R#21, Solano R#17/#19, Santa Clara A#28/#30, Yolo D#3/R#15,
  // Stanislaus R#16: "the NOMI was sent to the household after they completed
  // their scheduled interview."
  if (
    notice.kind === "nomi" &&
    facts.interviewCompletedDate &&
    Date.parse(notice.sentDate) >= Date.parse(facts.interviewCompletedDate)
  ) {
    defects.push({
      code: "nomi_after_completed_interview",
      severity: "invalidating",
      title: "You were sent a missed-interview notice after you completed your interview",
      explanation:
        "A Notice of Missed Interview may only be issued when an interview was actually missed. The record shows the interview was completed before this notice was sent.",
      authority: "FNS Handbook 310 §1320; MPP 63-300.46",
      remedy:
        "Tell the county the interview was completed on the recorded date and ask them to rescind the notice. If a denial follows, this is grounds for a fair hearing.",
    });
  }

  // San Benito D#1, Alameda D#2, Sacramento A#29, San Bernardino A#24, Riverside A#28:
  // "contact was not attempted ... which resulted in the NOMI inappropriately sent."
  if (
    notice.kind === "nomi" &&
    facts.contactAttemptDocumented === false &&
    !facts.interviewCompletedDate
  ) {
    defects.push({
      code: "no_documented_contact_attempt",
      severity: "invalidating",
      title: "The county did not document that it tried to reach you",
      explanation:
        "The county must attempt the interview at the number in your case file and document that attempt. On quality-control review, a negative action with no documented attempt is coded invalid.",
      authority: "7 CFR 273.2(e)(3); MPP 63-300.46; ACL 14-20; FNS Handbook 310 §1320",
      remedy:
        "Ask the county to show the documented contact attempt. If there is none, ask for the interview to be rescheduled and the notice withdrawn.",
    });
  }

  // Sacramento D#2 ("the NOMI was not sent ... and the denial NOA was incorrectly
  // sent on the same day"), Butte D#7, Humboldt D#6, Siskiyou D#5: the NOMI and
  // the denial land together, so the cure window the NOMI is supposed to open
  // never actually exists.
  if (isNegative && facts.nomiSentDate && sameDay(facts.nomiSentDate, notice.sentDate)) {
    defects.push({
      code: "nomi_and_denial_same_day",
      severity: "invalidating",
      title: "Your missed-interview notice and your denial were sent the same day",
      explanation:
        "A Notice of Missed Interview exists to give you a chance to reschedule before any action is taken. Issued the same day as the denial, it gave you no opportunity to act.",
      authority: "7 CFR 273.2(e)(3); MPP 63-300.461; FNS Handbook 310 §1320",
      remedy:
        "Point out that both notices carry the same date and ask the county to rescind the denial and reschedule the interview.",
    });
  }

  // SF D#7 ("the NOMI was not sent to the household, and the eligibility
  // determination was made without conducting the interview"), Butte D#4,
  // Riverside D#7, Glenn D#3, Marin D#2, Humboldt D#2/D#3, Orange D#6.
  if (
    isNegative &&
    facts.nomiSent === false &&
    (notice.statedReasons ?? []).some((r) => /miss|interview|failed to complete/i.test(r))
  ) {
    defects.push({
      code: "nomi_missing_before_negative_action",
      severity: "invalidating",
      title: "You were denied for a missed interview without ever being sent the required notice",
      explanation:
        "A Notice of Missed Interview is required before any negative action based on a missed interview. Without it you were never given the chance to reschedule.",
      authority: "FNS Handbook 310 §1320; MPP 63-300.46",
      remedy:
        "State that no NOMI was issued and request rescission of the denial plus a rescheduled interview.",
    });
  }

  // --- The day-30 floor ---------------------------------------------------
  // Butte D#3/D#7, Humboldt D#2, Riverside D#7, SLO D#3/D#4/D#7, Santa Barbara D#2/D#8:
  // denial issued before the 30th day for a missed interview.
  if (isNegative) {
    const age = daysBetween(facts.applicationDate, notice.sentDate);
    const missedInterviewReason = (notice.statedReasons ?? []).some((r) =>
      /miss|interview|complete the application|failed to complete/i.test(r),
    );
    if (missedInterviewReason && age < 30) {
      defects.push({
        code: "denial_before_day_30",
        severity: "invalidating",
        title: `Your application was denied on day ${age} — before the 30-day deadline`,
        explanation:
          "For a missed interview, the county must first send a Notice of Missed Interview and give you the chance to reschedule. A denial may only be issued on the 30th day from the application date.",
        authority: "7 CFR 273.2(e)(3); MPP 63-300.461, 63-301.32",
        remedy:
          "You are still inside your window. Call the county to complete or reschedule the interview — do NOT file a new application, which would restart your benefit start date.",
      });
    }
    if (age > 30) {
      defects.push({
        code: "processing_exceeded_30_days",
        severity: "procedural",
        title: `The county took ${age} days to decide — past the 30-day limit`,
        explanation:
          "The county must process an application within 30 days of the filing date. Exceeding it is a processing violation, and your benefits should still date from your original application.",
        authority: "7 CFR 273.2(g); MPP 63-504.23",
        remedy:
          "Ask the county to confirm your benefit start date runs from the original application date, not the late decision date.",
      });
    }
  }

  // Ventura D#7 ("NOMI sent 30 days from application when the interview was
  // missed 3 days from application"), Humboldt D#2/D#3, Inyo D#4, Glenn D#1.
  if (notice.kind === "nomi" && notice.complianceDate) {
    const complianceAge = daysBetween(facts.applicationDate, notice.complianceDate);
    if (complianceAge > 30) {
      defects.push({
        code: "compliance_date_after_day_30",
        severity: "procedural",
        title: "The deadline printed on your notice is wrong",
        explanation: `The notice gives you until day ${complianceAge}, but the county's own decision deadline is day 30. A compliance date past that is inconsistent with the rule the county is applying.`,
        authority: "MPP 63-300.46; ACL 21-24",
        remedy: "Ask the county to confirm the correct deadline in writing before relying on it.",
      });
    }
  }

  // --- Reason accuracy ----------------------------------------------------
  // Sierra D#1 (two NOAs, two different reasons, neither matching the file),
  // Tuolumne D#1, Siskiyou D#4, Ventura D#2, Sonoma D#4, Glenn D#3, Lake D#1.
  if (isNegative && facts.recordReason && (notice.statedReasons?.length ?? 0) > 0) {
    const matches = (notice.statedReasons as string[]).some((r) =>
      reasonsAgree(r, facts.recordReason as string),
    );
    if (!matches) {
      defects.push({
        code: "reason_does_not_match_record",
        severity: "invalidating",
        title: "The reason on your notice does not match your case record",
        explanation: `The notice says "${(notice.statedReasons as string[])[0]}", but the record shows "${facts.recordReason}". Every reason listed on a notice must be accurate; if one is wrong, the action does not stand.`,
        authority: "FNS Handbook 310 §1350.2; ACIN I-33-21",
        remedy:
          "Raise the discrepancy with the county and request a corrected notice or rescission. This is strong grounds for a fair hearing.",
      });
    }
  }

  if (isNegative && facts.otherNoticeReasons && facts.otherNoticeReasons.length > 0) {
    const stated = notice.statedReasons ?? [];
    const conflicting = facts.otherNoticeReasons.some(
      (other) => !stated.some((r) => reasonsAgree(r, other)),
    );
    if (conflicting) {
      defects.push({
        code: "conflicting_reasons_across_notices",
        severity: "invalidating",
        title: "You received notices giving different reasons for the same action",
        explanation:
          "More than one notice was issued for this action with reasons that disagree. All reasons stated must be accurate, so conflicting notices cannot both be correct.",
        authority: "FNS Handbook 310 §1350.2",
        remedy: "Keep both notices — they are evidence. Ask the county which reason it is standing on.",
      });
    }
  }

  // Fresno D#7, Siskiyou D#1, Kern T#14, Merced T#10, Tulare T#10, Yuba T#11:
  // "the denial NOA was not sent to the household."
  if (isNegative && facts.noticeReceived === false) {
    defects.push({
      code: "notice_never_sent",
      severity: "invalidating",
      title: "Action was taken without sending you the required notice",
      explanation:
        "The county must send a written notice of any denial or termination. Without it, you were never told why — and your appeal clock never started.",
      authority: "7 CFR 273.10(g); MPP 63-504.2; FNS Handbook 310 §1310",
      remedy:
        "Request the notice in writing and state that your appeal period has not begun. Ask for the action to be rescinded pending proper notice.",
    });
  }

  // --- Access defects -----------------------------------------------------
  // Alameda D#1/D#2 (both directions), Contra Costa D#3 (Korean), Marin R#14
  // (Russian), Sacramento A#23 (Vietnamese), Stanislaus A#26 (Arabic).
  if (
    notice.language &&
    facts.preferredLanguage &&
    notice.language !== facts.preferredLanguage
  ) {
    defects.push({
      code: "language_mismatch",
      severity: "procedural",
      title: "Your notice was not sent in your preferred language",
      explanation: `The notice was written in "${notice.language}" but your recorded preference is "${facts.preferredLanguage}". A notice you cannot read is not adequate notice.`,
      authority: "MPP 21-115.2; MPP 63-202.21",
      remedy: "Request a translated notice and ask that any deadline run from the date you receive it.",
    });
  }

  // San Bernardino D#2-#5 (4 of 8 sampled denials), Sierra D#4, Riverside D#2/D#3,
  // SLO D#7, Tuolumne A#20: preferred interview method not provided.
  if (
    facts.interviewMethodRequested &&
    facts.interviewMethodScheduled &&
    facts.interviewMethodRequested !== facts.interviewMethodScheduled
  ) {
    defects.push({
      code: "interview_method_not_honored",
      severity: "procedural",
      title: "The county did not give you the interview type you asked for",
      explanation: `You asked for a ${facts.interviewMethodRequested.replace("_", "-")} interview and the county scheduled ${facts.interviewMethodScheduled.replace("_", "-")}. Your stated preference must be provided, or the file must document why it could not be.`,
      authority: "7 CFR 273.2(e); MPP 63-300.42–.44; ACL 17-80",
      remedy: "Ask the county to reschedule in your requested format.",
    });
  }

  // Humboldt D#6, Fresno D#1, Marin D#2, Contra Costa D#1/D#2, Sacramento A#25-#29,
  // Yolo D#3/D#5/D#7: ES-entitled household not interviewed within 3 days.
  if (facts.expeditedEntitled && facts.interviewScheduledDate) {
    const wait = daysBetween(facts.applicationDate, facts.interviewScheduledDate);
    if (wait > 3) {
      defects.push({
        code: "expedited_interview_late",
        severity: "procedural",
        title: `Your expedited interview was set for day ${wait} — past the 3-day rule`,
        explanation:
          "Households that qualify for expedited service must be interviewed and issued benefits within 3 calendar days of applying.",
        authority: "7 CFR 273.2(i); ACL 16-14; ACIN I-14-11",
        remedy: "Tell the county you screened as expedited-eligible and ask for immediate processing.",
      });
    }
  }

  const invalidating = defects.filter((d) => d.severity === "invalidating");
  const likelyInvalid = invalidating.length > 0;
  const summary = likelyInvalid
    ? `This notice may not be valid — ${invalidating.length} issue${invalidating.length === 1 ? "" : "s"} found that the rules say should void an action taken this way. Verify against the county record before relying on it.`
    : defects.length > 0
      ? `${defects.length} procedural issue${defects.length === 1 ? "" : "s"} found. These support an appeal but may not by themselves void the action.`
      : "No defects detected in the information provided.";

  return { defects, likelyInvalid, summary };
}

// ---------------------------------------------------------------------------
// Missed-interview recovery window
// ---------------------------------------------------------------------------

export interface RecoveryWindow {
  /** Days elapsed since the application was filed. */
  dayOfApplication: number;
  /** Whether the household can still cure without reapplying. */
  stillOpen: boolean;
  /** Days remaining in the cure window (0 when closed). */
  daysRemaining: number;
  /** The single instruction to show. */
  guidance: string;
  /** TRUE when the household is being told to reapply and should NOT. */
  reapplyWarning: boolean;
}

/**
 * The cure window after a missed interview.
 *
 * Counties have been documented telling households inside the window to reapply
 * (Butte D#3: the household "was informed to reapply when they called to
 * complete the application process within 30 days"). Reapplying resets the
 * benefit start date and costs the household money, so the guidance is explicit
 * about not doing it.
 */
export function recoveryWindow(applicationDate: string, today: string): RecoveryWindow {
  const day = daysBetween(applicationDate, today);
  const stillOpen = day < 30;
  const daysRemaining = stillOpen ? 30 - day : 0;
  return {
    dayOfApplication: day,
    stillOpen,
    daysRemaining,
    reapplyWarning: stillOpen,
    guidance: stillOpen
      ? `You are on day ${day} of 30. You can still complete or reschedule your interview — call the county now. Do NOT file a new application: it would restart your benefit start date and you could lose benefits you are owed.`
      : `Day ${day}: the 30-day window has passed. If your application was denied, you can request a fair hearing (generally within 90 days) — and if the county never sent a proper notice, your appeal clock may not have started at all.`,
  };
}
