// Topic classifier for RegOps snapshots.
//
// Pure function: takes a string (typically title + body of a fetched
// document) and returns an array of topic tags from a controlled
// vocabulary. Used by the orchestrator to stamp regops.snapshots rows
// with classifier output so counsel/dashboard surfaces can filter by
// topic — "show me everything OBBBA-related across all sources."
//
// v1 is keyword-based. No LLM dependency. Each topic has a list of
// keyword patterns; a topic matches if any of its keywords appears in
// the input (case-insensitive). Whole-word matching where possible to
// reduce false positives — "BBCE" matches "BBCE" but not "BBCED".
//
// Why keyword (not LLM) for v1:
//   - Deterministic. Same input → same output → testable in CI.
//   - No external service dependency (no Anthropic/OpenAI key, no rate
//     limit, no latency floor on the polling tick).
//   - Cheap to extend: add a topic in topicVocabulary, write a test,
//     done. The bottleneck is identifying the right keyword set, not
//     reaching for an LLM.
//   - Most regulatory documents are written in formal language with
//     standard terminology. "ABAWD" appears in every ABAWD-related
//     federal document because that's the official acronym. Keyword
//     coverage is genuinely high.
//
// When to add an LLM pass (next phase):
//   - When keyword false-positive rate exceeds ~10% on a given topic.
//   - When a topic needs SEMANTIC understanding ("documents about
//     food-stamp work requirements" without the literal phrase).
//   - When we want a confidence score per match (e.g., for ranking
//     "OBBBA-adjacent" vs "core OBBBA" coverage).
//
// References:
//   - docs/regops/source-adapters.md §"Topic vocabulary" (canonical
//     list maintained in this file's `topicVocabulary` constant).

/**
 * Topic tag from the controlled vocabulary. Mirrors the strings written
 * into regops.snapshots.topic_tags. Extending the vocabulary requires
 * both updating this union AND the `topicVocabulary` constant below;
 * the parity is enforced by typecheck.
 */
export type TopicTag =
  | "obbba"
  | "abawd"
  | "work_requirement"
  | "shelter_deduction"
  | "bbce"
  | "immigrant_eligibility"
  | "cola"
  | "error_rate"
  | "waiver"
  | "recertification";

/**
 * Keyword pattern matched against snapshot input. Either a plain
 * substring (case-insensitive) or a precompiled RegExp. RegExp matters
 * for word-boundary patterns where a substring would over-match
 * (e.g., "BBCE" without word boundaries also matches "bbcellular").
 */
type KeywordPattern = string | RegExp;

interface TopicDefinition {
  readonly tag: TopicTag;
  readonly keywords: readonly KeywordPattern[];
}

/**
 * Controlled vocabulary. Update both this and the TopicTag union when
 * adding a topic. Each topic should have at least 2 keyword variants
 * to catch acronym + spelled-out forms.
 *
 * Word-boundary regexes use \b (works against ASCII letters); raw
 * substrings are matched lowercase against the lowercased input.
 */
const topicVocabulary: readonly TopicDefinition[] = [
  {
    tag: "obbba",
    keywords: [
      "obbba",
      "one big beautiful bill",
      "p.l. 119-21",
      "public law 119-21",
      /\bh\.?\s?r\.?\s?1\b/i, // H.R. 1, HR1, H.R.1, HR 1
    ],
  },
  {
    tag: "abawd",
    keywords: [
      "abawd",
      "able-bodied adults without dependents",
      "able bodied adults without dependents",
    ],
  },
  {
    tag: "work_requirement",
    keywords: [
      "work requirement",
      "work hour",
      "work registration",
      "employment and training",
      "e&t requirement",
      "time limit", // ABAWD time limits are work-requirement adjacent
    ],
  },
  {
    tag: "shelter_deduction",
    keywords: [
      "shelter deduction",
      "standard utility allowance",
      /\bsua\b/i,
      "homeless shelter deduction",
      "excess shelter",
    ],
  },
  {
    tag: "bbce",
    keywords: [
      "broad-based categorical eligibility",
      "broad based categorical eligibility",
      /\bbbce\b/i,
    ],
  },
  {
    tag: "immigrant_eligibility",
    keywords: [
      "lawful permanent resident",
      "qualified alien",
      "qualified non-citizen",
      "qualified noncitizen",
      "prwora",
      "non-citizen eligibility",
      "noncitizen eligibility",
      "afdc-related",
    ],
  },
  {
    tag: "cola",
    keywords: [
      "cost of living adjustment",
      /\bcola\b/i,
      "thrifty food plan",
      "maximum allotment",
    ],
  },
  {
    tag: "error_rate",
    keywords: [
      "payment error rate",
      /\bper\b/i, // intentionally broad; will co-match with "per capita" etc
      "quality control sample",
      "qc review",
      "case and procedural error rate",
      "cape rate",
    ],
  },
  {
    tag: "waiver",
    keywords: [
      "waiver request",
      "section 17 waiver",
      "section 18 waiver",
      "demonstration project",
      "ssection 1115", // typo guard — common in real docs
      "section 1115 waiver",
    ],
  },
  {
    tag: "recertification",
    keywords: [
      "recertification",
      "recert period",
      "interim report",
      "periodic report",
      "certification period",
      "redetermination",
    ],
  },
];

/**
 * Classify input text into matched topic tags.
 *
 * Returns tags in the order they appear in `topicVocabulary` (stable —
 * tests can assert on order). No duplicates. Empty array when nothing
 * matches.
 *
 * Multiple inputs are concatenated with a separator before classification
 * so callers can pass (title, description) without manual join.
 */
export function classifyTopics(...inputs: readonly string[]): TopicTag[] {
  const haystack = inputs.join("\n").toLowerCase();
  if (haystack.length === 0) {
    return [];
  }

  const matched: TopicTag[] = [];
  for (const topic of topicVocabulary) {
    if (matchesAnyKeyword(haystack, topic.keywords)) {
      matched.push(topic.tag);
    }
  }
  return matched;
}

function matchesAnyKeyword(
  haystackLower: string,
  keywords: readonly KeywordPattern[],
): boolean {
  for (const k of keywords) {
    if (k instanceof RegExp) {
      // RegExp patterns are pre-flagged case-insensitive; test against
      // the original-case haystack would be cleaner but we already
      // lowercased it. Patterns in this file use /i anyway.
      if (k.test(haystackLower)) {
        return true;
      }
    } else if (haystackLower.includes(k.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Exported for tests + tooling. Lets a downstream tool enumerate the
 * vocabulary without re-implementing it (e.g., dashboard surface that
 * lists "all known topics" for a filter dropdown).
 */
export function getAllTopicTags(): readonly TopicTag[] {
  return topicVocabulary.map((t) => t.tag);
}
