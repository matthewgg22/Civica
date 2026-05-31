#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/intake-help-eval.mjs — LLM eval script for POST /v1/intake/help.
//
// Validates Tier B prompt quality before Monday TestFlight demo. Sends 50
// representative SNAP-intake question titles (35 EN + 15 ES) at the deployed
// (or wrangler dev) endpoint, then runs the same forbidden-phrase regex pass
// that the route's safety filter runs — but client-side, against the
// final explainer_text, so we catch (a) prompt regressions where the model
// drifts toward eligibility commitments, and (b) any phrase the server-side
// filter missed.
//
// A subset of the samples also send an optional `question_helper` value (a
// plausible on-screen helper paragraph) to exercise the route's helper-text
// grounding path.
//
// OPTIONAL LLM GRADER: when ANTHROPIC_API_KEY is set in the environment, each
// explainer is additionally graded by a second Claude call (claude-sonnet-4-6)
// on clarity, accuracy, and plain-language helpfulness (1-5 each), plus a
// boolean fail flag if the explainer commits to an eligibility outcome or
// refuses to help. Grades are advisory: a low grade is a SOFT WARNING, never a
// hard fail — the hard-fail gate stays the forbidden-phrase + non-empty +
// status-200 checks so gate semantics never regress. If the key is absent,
// grading is skipped (a one-line note is printed) and only the existing
// assertions run.
//
// Per design doc T11: run Saturday EOD before TestFlight ship. See the
// companion README (tools/intake-help-eval.README.md).
//
// CLI:
//   node tools/intake-help-eval.mjs --base-url=http://localhost:8787
//   node tools/intake-help-eval.mjs --base-url=https://civica-enrollment-api.workers.dev --anonymous-id=eval-2026-05-30
//   ANTHROPIC_API_KEY=sk-ant-... node tools/intake-help-eval.mjs --base-url=http://localhost:8787
//
// Exit code: 0 if all 50 samples pass the HARD assertions, 1 if any hard-fail,
// 2 on usage error. `was_filtered: true` responses and low LLM grades are
// reported as soft notes (the safety net / quality nudge doing its job) and do
// NOT contribute to the failure count.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Sample question titles — 50 total (35 EN + 15 ES), spanning all the design
// doc's intake categories: income (paystub / gig / self-employment), household
// composition, work-hours / ABAWD, asset disclosure, citizenship & immigration,
// deductions & expenses (rent / utilities / medical / childcare), child
// support, address & residency, student / LPIE, expedited service, and change
// reporting. Titles are realistic CalFresh intake-form phrasings, not made-up
// cases. The Spanish titles are written natively, not translated word-for-word
// from the English samples.
//
// A subset carries an optional `question_helper` — a plausible on-screen helper
// paragraph that the iOS form shows beneath the question. When present it is
// forwarded to the route to exercise the helper-text grounding path. ~10
// samples (a mix of EN and ES) carry one.
// ---------------------------------------------------------------------------

const SAMPLES = [
  // === 1. Income reporting — paystub / wage (EN) ===
  {
    locale: 'en',
    category: 'income_reporting',
    question_title: 'How much did you earn from your paystubs in the last 30 days?',
    question_helper:
      'Enter your gross pay (before taxes and deductions) for each job. Add up every paycheck dated in the last 30 days. If your hours change week to week, include all of them.',
  },
  {
    locale: 'en',
    category: 'income_reporting',
    question_title: 'List each employer and the gross wages you received from each one.',
  },
  {
    locale: 'en',
    category: 'income_reporting',
    question_title: 'How often are you paid — weekly, every two weeks, twice a month, or monthly?',
  },
  // === 2. Gig / 1099 income (EN) ===
  {
    locale: 'en',
    category: 'gig_income',
    question_title: 'Did you receive any 1099 income from gig work in the last 12 months?',
  },
  {
    locale: 'en',
    category: 'gig_income',
    question_title: 'List any income from rideshare, delivery, or other gig platforms.',
    question_helper:
      'This includes apps like Uber, Lyft, DoorDash, Instacart, and Amazon Flex. Report what you were paid, not your take-home after gas or fees — you can list business expenses separately.',
  },
  // === 3. Self-employment income (EN) ===
  {
    locale: 'en',
    category: 'self_employment',
    question_title: 'Report gross self-employment income and allowable business expenses for the last month.',
  },
  {
    locale: 'en',
    category: 'self_employment',
    question_title: 'What business expenses do you want to deduct from your self-employment income?',
  },
  // === 4. Household composition (EN) ===
  {
    locale: 'en',
    category: 'household_composition',
    question_title: 'Who lives with you and buys or prepares food together?',
    question_helper:
      'A SNAP household is everyone who lives together and buys and prepares meals together. People can live with you but be in a separate household if they buy and cook their food on their own.',
  },
  {
    locale: 'en',
    category: 'household_composition',
    question_title: 'Is anyone in your household a boarder or roommate who buys their own food?',
  },
  {
    locale: 'en',
    category: 'household_composition',
    question_title: 'List everyone who lives in your home, including children and any elderly parents.',
  },
  // === 5. Work hours / ABAWD (EN) ===
  {
    locale: 'en',
    category: 'work_hours_abawd',
    question_title: 'How many hours per week do you work, train, or volunteer?',
  },
  {
    locale: 'en',
    category: 'work_hours_abawd',
    question_title: 'Are you between 18 and 54 and able to work?',
  },
  {
    locale: 'en',
    category: 'work_hours_abawd',
    question_title: 'Are you caring for a child under 6 or for someone who cannot care for themselves?',
  },
  // === 6. Asset disclosure (EN) ===
  {
    locale: 'en',
    category: 'asset_disclosure',
    question_title: 'List all bank accounts, savings, and vehicles owned by household members.',
  },
  {
    locale: 'en',
    category: 'asset_disclosure',
    question_title: 'How much money do you currently have in checking and savings accounts?',
  },
  // === 7. Citizenship and immigration status (EN) ===
  {
    locale: 'en',
    category: 'citizenship_immigration',
    question_title: 'What is your U.S. citizenship or immigration status?',
    question_helper:
      'You only need to give the immigration status of household members applying for benefits. Members who are not applying do not have to share their status, and it will not be reported.',
  },
  {
    locale: 'en',
    category: 'citizenship_immigration',
    question_title: 'Do you have an alien registration number (A-Number) or other immigration document?',
  },
  // === 8. Deductions and expenses — rent / utilities / medical / childcare (EN) ===
  {
    locale: 'en',
    category: 'deductions_expenses',
    question_title: 'How much do you pay each month for rent or mortgage?',
  },
  {
    locale: 'en',
    category: 'deductions_expenses',
    question_title: 'Which utilities do you pay for — heating, cooling, electricity, gas, water, or phone?',
    question_helper:
      'Check every utility you are billed for separately from rent. If you pay for heating or cooling, you may get a larger standard utility allowance.',
  },
  {
    locale: 'en',
    category: 'deductions_expenses',
    question_title: 'Do you have out-of-pocket medical expenses over $35 per month? (Elderly or disabled household members.)',
  },
  {
    locale: 'en',
    category: 'deductions_expenses',
    question_title: 'How much do you pay for childcare or dependent care so you can work or attend school?',
  },
  // === 9. Child support paid or received (EN) ===
  {
    locale: 'en',
    category: 'child_support',
    question_title: 'Do you pay court-ordered child support to someone outside your household?',
  },
  {
    locale: 'en',
    category: 'child_support',
    question_title: 'How much child support did you actually pay in the last month?',
  },
  // === 10. Address and residency (EN) ===
  {
    locale: 'en',
    category: 'address_residency',
    question_title: 'What is your current California mailing address?',
  },
  {
    locale: 'en',
    category: 'address_residency',
    question_title: 'Do you have a permanent address, or are you currently without stable housing?',
    question_helper:
      'You can still apply for CalFresh if you do not have a permanent address. List where you are staying now, or a place where you can receive mail.',
  },
  // === 11. Student / LPIE (EN) ===
  {
    locale: 'en',
    category: 'student_lpie',
    question_title: 'Is anyone in the household enrolled at least half-time in college or a training program?',
  },
  {
    locale: 'en',
    category: 'student_lpie',
    question_title: 'Are you in a Local Program of Increased Employability (LPIE) or other approved education program?',
  },
  // === 12. Expedited service (EN) ===
  {
    locale: 'en',
    category: 'expedited',
    question_title: 'Is your monthly income less than $150 and do you have $100 or less in cash and accounts?',
    question_helper:
      'These questions help check whether you qualify for expedited service, which can issue benefits within a few days. Answer based on your situation right now.',
  },
  {
    locale: 'en',
    category: 'expedited',
    question_title: 'Are your housing and utility costs more than the money your household has coming in?',
  },
  // === 13. Change reporting (EN) ===
  {
    locale: 'en',
    category: 'change_reporting',
    question_title: 'Has your income, household size, or address changed since your last report?',
  },
  {
    locale: 'en',
    category: 'change_reporting',
    question_title: 'Did anyone move in or out of your home in the last month?',
  },
  // === Extra EN to round out 35 ===
  {
    locale: 'en',
    category: 'income_reporting',
    question_title: 'Did you receive unemployment, disability, or other benefit payments this month?',
  },
  {
    locale: 'en',
    category: 'deductions_expenses',
    question_title: 'Do you pay for health insurance premiums out of your own pocket?',
  },
  {
    locale: 'en',
    category: 'household_composition',
    question_title: 'Is anyone in your household pregnant?',
  },
  {
    locale: 'en',
    category: 'change_reporting',
    question_title: 'Did anyone in your household start or stop a job recently?',
  },

  // ===== Spanish (15 samples, written natively, spanning the categories) =====
  // Income — paystub / wage (ES)
  {
    locale: 'es',
    category: 'income_reporting',
    question_title: '¿Cuánto ganó en sus talones de pago en los últimos 30 días?',
    question_helper:
      'Anote su pago bruto (antes de impuestos y descuentos) de cada empleo. Sume todos los cheques de pago de los últimos 30 días. Si sus horas cambian de una semana a otra, inclúyalas todas.',
  },
  {
    locale: 'es',
    category: 'income_reporting',
    question_title: '¿Con qué frecuencia le pagan: por semana, cada dos semanas, dos veces al mes o una vez al mes?',
  },
  // Gig income (ES)
  {
    locale: 'es',
    category: 'gig_income',
    question_title: 'Anote cualquier ingreso de aplicaciones de transporte, entregas u otras plataformas.',
    question_helper:
      'Esto incluye aplicaciones como Uber, Lyft, DoorDash e Instacart. Reporte lo que le pagaron, no lo que le quedó después de la gasolina o las comisiones; los gastos del negocio se anotan aparte.',
  },
  // Self-employment (ES)
  {
    locale: 'es',
    category: 'self_employment',
    question_title: 'Reporte el ingreso bruto de trabajo por cuenta propia y los gastos de negocio del último mes.',
  },
  // Household composition (ES)
  {
    locale: 'es',
    category: 'household_composition',
    question_title: '¿Quién vive con usted y compra o prepara los alimentos en conjunto?',
  },
  {
    locale: 'es',
    category: 'household_composition',
    question_title: 'Anote a todas las personas que viven en su hogar, incluyendo niños y adultos mayores.',
  },
  // Work hours / ABAWD (ES)
  {
    locale: 'es',
    category: 'work_hours_abawd',
    question_title: '¿Cuántas horas por semana trabaja, se capacita o hace voluntariado?',
  },
  {
    locale: 'es',
    category: 'work_hours_abawd',
    question_title: '¿Cuida usted a un niño menor de 6 años o a una persona que no puede cuidarse sola?',
  },
  // Asset disclosure (ES)
  {
    locale: 'es',
    category: 'asset_disclosure',
    question_title: '¿Cuánto dinero tiene actualmente en sus cuentas de cheques y de ahorros?',
  },
  // Citizenship / immigration (ES)
  {
    locale: 'es',
    category: 'citizenship_immigration',
    question_title: '¿Cuál es su estado de ciudadanía estadounidense o estatus migratorio?',
    question_helper:
      'Solo necesita dar el estatus migratorio de los integrantes que solicitan beneficios. Quienes no solicitan no tienen que compartir su estatus, y no se reportará.',
  },
  // Deductions / expenses (ES)
  {
    locale: 'es',
    category: 'deductions_expenses',
    question_title: '¿Cuánto paga cada mes por renta o hipoteca?',
  },
  {
    locale: 'es',
    category: 'deductions_expenses',
    question_title: '¿Cuánto paga por el cuidado de niños o dependientes para poder trabajar o estudiar?',
  },
  // Child support (ES)
  {
    locale: 'es',
    category: 'child_support',
    question_title: '¿Paga usted manutención de menores ordenada por la corte a alguien fuera de su hogar?',
  },
  // Address / residency (ES)
  {
    locale: 'es',
    category: 'address_residency',
    question_title: '¿Tiene una dirección permanente o actualmente se encuentra sin vivienda estable?',
    question_helper:
      'Aún puede solicitar CalFresh si no tiene una dirección permanente. Indique dónde se está quedando ahora, o un lugar donde pueda recibir correo.',
  },
  // Expedited (ES)
  {
    locale: 'es',
    category: 'expedited',
    question_title: '¿Su ingreso mensual es menor de $150 y tiene $100 o menos en efectivo y en sus cuentas?',
  },
];

// Sanity-check the sample mix at startup so a future edit that drops Spanish
// coverage fails loudly rather than silently regressing the bilingual path.
const ES_COUNT = SAMPLES.filter((s) => s.locale === 'es').length;
const EN_COUNT = SAMPLES.filter((s) => s.locale === 'en').length;
const HELPER_COUNT = SAMPLES.filter(
  (s) => typeof s.question_helper === 'string' && s.question_helper.trim().length > 0,
).length;
if (SAMPLES.length !== 50) {
  console.error(`[eval] Expected 50 samples, got ${SAMPLES.length}.`);
  process.exit(2);
}
if (ES_COUNT < 15) {
  console.error(`[eval] Expected at least 15 Spanish samples, got ${ES_COUNT}.`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Forbidden-phrase patterns. Client-side mirror of the route's safety filter,
// kept intentionally simple (substring, case-insensitive) so a regression in
// the route's regex doesn't silently pass here. We assert the FINAL response
// — if was_filtered=true the response will be the SAFE_FALLBACK, which by
// construction contains no forbidden phrase.
// ---------------------------------------------------------------------------

const FORBIDDEN_EN = [
  'you qualify',
  'you do not qualify',
  'you are eligible',
  'you are not eligible',
  'you should report',
  'you should select',
  'you should enter',
  'you should answer',
  'you can get snap',
  'you cannot get snap',
  'you can get calfresh',
  'you will be approved',
  'you will be denied',
];

const FORBIDDEN_ES = [
  'calificas',
  'no calificas',
  'eres elegible',
  'no eres elegible',
  'deberias reportar',
  'deberias seleccionar',
  'puedes obtener snap',
  'puedes obtener calfresh',
];

function findForbiddenMatch(text, locale) {
  const haystack = text.toLowerCase();
  const list = locale === 'es' ? FORBIDDEN_ES : FORBIDDEN_EN;
  for (const phrase of list) {
    if (haystack.includes(phrase)) return phrase;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Optional LLM grader. Gated on ANTHROPIC_API_KEY. When set, each explainer is
// scored 1-5 on clarity, accuracy, and plain-language helpfulness for a SNAP
// applicant, plus a boolean `fail` flag the grader raises if the explainer
// commits to an eligibility outcome ("you qualify") or refuses to help.
//
// IMPORTANT: grades are ADVISORY. A low grade (or grader-raised fail) is a SOFT
// WARNING that gets listed in the summary — it never affects the process exit
// code. The hard-fail gate stays the forbidden-phrase + non-empty + status-200
// checks, so enabling the grader can never make a previously-passing run fail.
// ---------------------------------------------------------------------------

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GRADER_ENABLED = ANTHROPIC_API_KEY.length > 0;
const GRADER_MODEL = 'claude-sonnet-4-6';
const GRADER_MIN_SCORE = 3; // average below this = soft warning
const GRADER_TIMEOUT_MS = 30_000;

function buildGraderPrompt(sample, explainer) {
  const lang = sample.locale === 'es' ? 'Spanish' : 'English';
  const helperLine = sample.question_helper
    ? `\nOn-screen helper text shown to the applicant:\n"""${sample.question_helper}"""\n`
    : '';
  return [
    'You are grading a short contextual-help explainer shown to a person filling out a',
    'CalFresh (California SNAP) benefits application. The explainer should plainly explain',
    `what the form question is asking and why, in ${lang}, WITHOUT telling the applicant`,
    'whether they qualify, what to answer, or making any eligibility promise.',
    '',
    `Form question (locale=${sample.locale}, category=${sample.category}):`,
    `"""${sample.question_title}"""`,
    helperLine,
    'The explainer that was generated:',
    `"""${explainer}"""`,
    '',
    'Rate the explainer on three axes, each an integer 1-5 (5 = best):',
    '  clarity      — is it easy to understand?',
    '  accuracy     — is it factually correct about SNAP/CalFresh and the question?',
    '  helpfulness  — is it plain-language and genuinely useful to this applicant?',
    '',
    'Also set "fail" to true ONLY if the explainer commits to an eligibility outcome',
    '(e.g. tells them they do/do not qualify or are/are not eligible) OR refuses to help.',
    'Otherwise set "fail" to false.',
    '',
    'Respond with ONLY a compact JSON object, no prose, no code fence, exactly:',
    '{"clarity":N,"accuracy":N,"helpfulness":N,"fail":true|false,"note":"<=12 word reason"}',
  ].join('\n');
}

function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(1, Math.min(5, Math.round(v)));
}

function parseGraderJson(rawText) {
  // The model is asked for bare JSON, but defensively strip a code fence and
  // pull the first {...} block so a stray wrapper doesn't break the run.
  let s = String(rawText || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  let obj;
  try {
    obj = JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
  const clarity = clampScore(obj.clarity);
  const accuracy = clampScore(obj.accuracy);
  const helpfulness = clampScore(obj.helpfulness);
  if (clarity === null || accuracy === null || helpfulness === null) return null;
  const average = (clarity + accuracy + helpfulness) / 3;
  return {
    clarity,
    accuracy,
    helpfulness,
    average,
    fail: obj.fail === true,
    note: typeof obj.note === 'string' ? obj.note.slice(0, 120) : '',
  };
}

// Returns { graded, grade, error }.
//   graded=false + error set — grading attempt failed (soft note, not a fail)
//   graded=true  + grade set — parsed { clarity, accuracy, helpfulness, average, fail, note }
async function gradeExplainer(sample, explainer) {
  if (!GRADER_ENABLED) return { graded: false, grade: null, error: 'grader disabled' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRADER_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: GRADER_MODEL,
        max_tokens: 256,
        messages: [{ role: 'user', content: buildGraderPrompt(sample, explainer) }],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 160);
      return { graded: false, grade: null, error: `grader HTTP ${res.status}: ${detail}` };
    }
    const data = await res.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b) => b?.type === 'text').map((b) => b.text).join('')
      : '';
    const grade = parseGraderJson(text);
    if (!grade) {
      return { graded: false, grade: null, error: `grader returned unparseable output: ${text.slice(0, 120)}` };
    }
    return { graded: true, grade, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { graded: false, grade: null, error: `grader call failed: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing — small, dependency-free.
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    if (eq === -1) {
      out[raw.slice(2)] = true;
    } else {
      out[raw.slice(2, eq)] = raw.slice(eq + 1);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const baseUrl = (args['base-url'] || '').replace(/\/+$/, '');
const anonymousId = args['anonymous-id'] || randomUUID();

if (!baseUrl) {
  console.error('Usage: node tools/intake-help-eval.mjs --base-url=URL [--anonymous-id=ID]');
  console.error('');
  console.error('  --base-url      Required. e.g. http://localhost:8787 or the deployed worker URL.');
  console.error('  --anonymous-id  Optional. Defaults to a generated UUID.');
  process.exit(2);
}

const endpoint = `${baseUrl}/v1/intake/help`;

// ---------------------------------------------------------------------------
// Per-sample assertion. Returns { ok, reasons[], filtered, response }.
//   ok=true        — all assertions passed (or was_filtered=true with safe body)
//   ok=false       — at least one hard assertion failed
//   filtered=true  — was_filtered came back true (soft note, not a failure)
// ---------------------------------------------------------------------------

const MAX_EXPLAINER_CHARS = 1500;

async function evaluateOne(sample, idx) {
  const reasons = [];

  let httpStatus = 0;
  let body = null;
  let errorMessage = null;

  const requestBody = {
    question_title: sample.question_title,
    locale: sample.locale,
  };
  // Optional helper-text grounding path: only sent for samples that carry one.
  if (typeof sample.question_helper === 'string' && sample.question_helper.trim().length > 0) {
    requestBody.question_helper = sample.question_helper;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-anonymous-id': anonymousId,
      },
      body: JSON.stringify(requestBody),
    });
    httpStatus = res.status;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      errorMessage = `non-JSON response (${text.slice(0, 120)})`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  if (errorMessage) {
    reasons.push(`fetch failed: ${errorMessage}`);
    return { ok: false, reasons, filtered: false, response: null };
  }

  if (httpStatus !== 200) {
    reasons.push(`expected status 200, got ${httpStatus} (body: ${JSON.stringify(body).slice(0, 200)})`);
    return { ok: false, reasons, filtered: false, response: body };
  }

  if (!body || typeof body !== 'object') {
    reasons.push('response body is not an object');
    return { ok: false, reasons, filtered: false, response: body };
  }

  const explainer = body.explainer_text;
  const wasFiltered = body.was_filtered === true;

  if (typeof explainer !== 'string' || explainer.trim().length === 0) {
    reasons.push('explainer_text missing or empty');
    return { ok: false, reasons, filtered: wasFiltered, response: body };
  }

  if (explainer.length > MAX_EXPLAINER_CHARS) {
    reasons.push(
      `explainer_text is ${explainer.length} chars (> ${MAX_EXPLAINER_CHARS} proxy for ~200 words)`,
    );
  }

  const match = findForbiddenMatch(explainer, sample.locale);
  if (match) {
    reasons.push(`forbidden phrase matched: "${match}"`);
  }

  // Optional, advisory LLM grade — never contributes to `ok`/exit code.
  // We grade the actual explainer text (including the SAFE_FALLBACK when the
  // server-side filter fired) so the grade reflects what the user would see.
  const graded = await gradeExplainer(sample, explainer);

  return {
    ok: reasons.length === 0,
    reasons,
    filtered: wasFiltered,
    response: body,
    grade: graded.grade,
    gradeError: graded.error,
  };
}

// ---------------------------------------------------------------------------
// Main loop — sequential to keep server-side rate-limiting (strict tier
// = 10/min per anonymous-id) from rejecting us mid-run. 50 calls at ~6.5s pace
// finishes in about 5.5 minutes (a little longer with the grader enabled,
// since each sample adds one extra Claude round-trip before pacing).
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[eval] POST ${endpoint}`);
  console.log(`[eval] anonymous-id: ${anonymousId}`);
  console.log(`[eval] samples: ${SAMPLES.length} (${EN_COUNT} EN + ${ES_COUNT} ES, ${HELPER_COUNT} with question_helper)`);
  if (GRADER_ENABLED) {
    console.log(`[eval] LLM grader: ENABLED (model ${GRADER_MODEL}) — grades are advisory soft warnings, not hard fails`);
  } else {
    console.log('[eval] LLM grader: SKIPPED (set ANTHROPIC_API_KEY to enable) — running forbidden-phrase + length checks only');
  }
  console.log('');

  let pass = 0;
  let fail = 0;
  let filtered = 0;
  const failures = [];
  const filteredNotes = [];

  // Grade accounting (advisory only — never affects exit code).
  const gradeRecords = []; // { idx, locale, category, question_title, grade }
  const lowGradeWarnings = []; // grade.average < GRADER_MIN_SCORE OR grade.fail
  const gradeErrors = []; // { idx, error } — grading attempt that failed

  for (let i = 0; i < SAMPLES.length; i += 1) {
    const sample = SAMPLES[i];
    const hasHelper =
      typeof sample.question_helper === 'string' && sample.question_helper.trim().length > 0;
    const label = `${String(i + 1).padStart(2, '0')}/${SAMPLES.length} [${sample.locale}] (${sample.category})${hasHelper ? ' +helper' : ''}`;
    process.stdout.write(`${label} ...`);

    const result = await evaluateOne(sample, i);

    if (result.filtered) {
      filtered += 1;
      filteredNotes.push({
        idx: i + 1,
        locale: sample.locale,
        category: sample.category,
        question_title: sample.question_title,
        explainer_text: result.response?.explainer_text ?? '',
      });
    }

    if (result.ok) {
      pass += 1;
      process.stdout.write(result.filtered ? ' PASS (filtered)' : ' PASS');
    } else {
      fail += 1;
      failures.push({
        idx: i + 1,
        locale: sample.locale,
        category: sample.category,
        question_title: sample.question_title,
        reasons: result.reasons,
        response: result.response,
      });
      process.stdout.write(' FAIL');
    }

    // Append the advisory grade (or grading error) to the same status line.
    if (GRADER_ENABLED) {
      if (result.grade) {
        const g = result.grade;
        gradeRecords.push({
          idx: i + 1,
          locale: sample.locale,
          category: sample.category,
          question_title: sample.question_title,
          grade: g,
        });
        const low = g.average < GRADER_MIN_SCORE || g.fail;
        if (low) {
          lowGradeWarnings.push({
            idx: i + 1,
            locale: sample.locale,
            category: sample.category,
            question_title: sample.question_title,
            grade: g,
          });
        }
        process.stdout.write(
          ` [grade ${g.average.toFixed(1)} c${g.clarity}/a${g.accuracy}/h${g.helpfulness}${g.fail ? ' GRADER-FAIL' : ''}${low ? ' (warn)' : ''}]`,
        );
      } else if (result.gradeError) {
        gradeErrors.push({ idx: i + 1, error: result.gradeError });
        process.stdout.write(' [grade: n/a]');
      }
    }
    process.stdout.write('\n');

    if (!result.ok) {
      for (const r of result.reasons) console.log(`     - ${r}`);
    }

    // Gentle pacing to stay below the 10/min strict rate-limit bucket.
    // 6.5s between requests = ~9.2/min worst case.
    if (i < SAMPLES.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 6500));
    }
  }

  console.log('');
  console.log('==========================================================');
  console.log('Summary');
  console.log('==========================================================');
  console.log(`  pass:     ${pass}/${SAMPLES.length}`);
  console.log(`  fail:     ${fail}/${SAMPLES.length}`);
  console.log(`  filtered: ${filtered}/${SAMPLES.length}  (soft note — safety net firing)`);

  if (GRADER_ENABLED) {
    if (gradeRecords.length > 0) {
      const avg =
        gradeRecords.reduce((acc, r) => acc + r.grade.average, 0) / gradeRecords.length;
      const avgClarity =
        gradeRecords.reduce((acc, r) => acc + r.grade.clarity, 0) / gradeRecords.length;
      const avgAccuracy =
        gradeRecords.reduce((acc, r) => acc + r.grade.accuracy, 0) / gradeRecords.length;
      const avgHelp =
        gradeRecords.reduce((acc, r) => acc + r.grade.helpfulness, 0) / gradeRecords.length;
      console.log(
        `  grade:    avg ${avg.toFixed(2)}/5 over ${gradeRecords.length} graded  (clarity ${avgClarity.toFixed(2)} / accuracy ${avgAccuracy.toFixed(2)} / helpfulness ${avgHelp.toFixed(2)})`,
      );
      console.log(
        `  warnings: ${lowGradeWarnings.length}  (grade < ${GRADER_MIN_SCORE} or grader-fail — SOFT, does not affect exit code)`,
      );
    } else {
      console.log('  grade:    no samples graded (all grading attempts failed — see notes)');
    }
    if (gradeErrors.length > 0) {
      console.log(`  grade-errors: ${gradeErrors.length}  (grading attempt failed — soft note)`);
    }
  } else {
    console.log('  grade:    skipped (ANTHROPIC_API_KEY not set)');
  }
  console.log('');

  if (filteredNotes.length > 0) {
    console.log('Filtered responses (was_filtered=true) — review for prompt drift:');
    for (const f of filteredNotes) {
      console.log(`  ${String(f.idx).padStart(2, '0')}. [${f.locale}] (${f.category}) ${f.question_title}`);
      console.log(`      -> ${f.explainer_text.slice(0, 160)}${f.explainer_text.length > 160 ? '...' : ''}`);
    }
    console.log('');
  }

  if (GRADER_ENABLED && lowGradeWarnings.length > 0) {
    console.log('Low-grade warnings (SOFT — tune the prompt, but not a launch blocker):');
    for (const w of lowGradeWarnings) {
      const g = w.grade;
      console.log(`  ${String(w.idx).padStart(2, '0')}. [${w.locale}] (${w.category}) ${w.question_title}`);
      console.log(
        `      -> avg ${g.average.toFixed(1)} (clarity ${g.clarity} / accuracy ${g.accuracy} / helpfulness ${g.helpfulness})${g.fail ? ' — GRADER-FAIL' : ''}${g.note ? ` — "${g.note}"` : ''}`,
      );
    }
    console.log('');
  }

  if (GRADER_ENABLED && gradeErrors.length > 0) {
    console.log('Grading errors (SOFT — grade unavailable for these samples):');
    for (const e of gradeErrors) {
      console.log(`  ${String(e.idx).padStart(2, '0')}. ${e.error}`);
    }
    console.log('');
  }

  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) {
      console.log(`  ${String(f.idx).padStart(2, '0')}. [${f.locale}] (${f.category}) ${f.question_title}`);
      for (const r of f.reasons) console.log(`      - ${r}`);
    }
    console.log('');
  }

  // HARD gate stays exactly as before: only the status-200 / non-empty /
  // length / forbidden-phrase assertions can fail the run. Grades never do.
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[eval] unexpected error:', err);
  process.exit(2);
});
