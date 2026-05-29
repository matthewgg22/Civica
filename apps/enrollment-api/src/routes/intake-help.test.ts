// ---------------------------------------------------------------------------
// POST /v1/intake/help tests — Tier B universal explainer.
//
// Covers the demo-critical tier per design doc D7:
//   - Happy path EN — returns coherent response, was_filtered=false
//   - Happy path ES — returns Spanish response
//   - Safety filter trigger — "you qualify" replaced with SAFE_FALLBACK
//   - Missing question_title returns 400
//   - Missing x-anonymous-id returns 400
//   - Anthropic 5xx surfaces as 500
//   - applySafetyFilter unit tests (forbidden phrases EN + ES)
//
// Mocking strategy:
//   - Anthropic API is mocked via the route's __setFetchForTests seam (the
//     route reads from a module-local override; we install a fake fetch).
//   - rate-limit middleware: no mock needed. lib/rate-limit.ts no-ops when
//     RL_STRICT is absent, and TEST_ENV omits it (graceful degrade).
//   - vi.hoisted() is used for the fake fetch + its captured calls so the
//     mock factory and the assertions can both read the same handles (per
//     project memory feedback_vitest_dashboard_mock).
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import intakeHelpRouter, { __setFetchForTests, __testing } from './intake-help.js';
import { app as fullApp } from '../index.js';
import { TEST_ENV } from '../test/helpers.js';
import { Hono } from 'hono';
import type { Env } from '../types.js';

// ---------------------------------------------------------------------------
// Hoisted state — captures every fake-fetch call so test bodies can assert
// what the route sent to Anthropic. The hoisted block keeps these accessible
// from inside the mock factory below.
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
  capturedCalls: [] as Array<{ url: string; body: unknown; headers: Record<string, string> }>,
  nextResponse: null as null | {
    status: number;
    body: unknown;
  },
}));

function makeFakeFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = init.headers as Record<string, string>;
      for (const k of Object.keys(h)) headers[k] = h[k] as string;
    }
    const body = init?.body ? JSON.parse(init.body as string) : null;
    hoisted.capturedCalls.push({ url, body, headers });

    const next = hoisted.nextResponse ?? {
      status: 200,
      body: {
        content: [
          { type: 'text' as const, text: 'This question is asking about your situation. Your county navigator can help if you are unsure.' },
        ],
      },
    };
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ENV_WITH_API_KEY: Env = {
  ...TEST_ENV,
  ANTHROPIC_API_KEY: 'test-api-key',
};

const ANON_ID = 'anon-test-1234';
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'x-anonymous-id': ANON_ID,
};

/**
 * Mount the intake-help router on a bare Hono app at /v1/intake/help so the
 * tests can exercise the route with realistic paths. We do NOT use
 * buildTestApp() because intake-help is anonymous — there is no actor to
 * inject and the route's own requireAnonymousId middleware reads the header
 * directly.
 */
function buildIntakeHelpApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/v1/intake/help', intakeHelpRouter);
  return app;
}

beforeEach(() => {
  hoisted.capturedCalls.length = 0;
  hoisted.nextResponse = null;
  __setFetchForTests(makeFakeFetch());
});

afterEach(() => {
  __setFetchForTests(null);
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Mount verification — the route is wired up in src/index.ts
// ---------------------------------------------------------------------------

describe('route mounting', () => {
  it('rejects requests missing x-anonymous-id on the mounted path', async () => {
    const res = await fullApp.request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_title: 'Anything', locale: 'en' }),
      },
      TEST_ENV_WITH_API_KEY,
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Happy paths (EN + ES)
// ---------------------------------------------------------------------------

describe('POST /v1/intake/help — happy paths', () => {
  it('EN: returns a coherent explainer with was_filtered=false', async () => {
    hoisted.nextResponse = {
      status: 200,
      body: {
        content: [
          {
            type: 'text',
            text:
              'This question is asking about everyone who lives in your home and buys or makes food with you. Include adults and children. If someone moves in and out, your county navigator can help you decide whether to count them.',
          },
        ],
      },
    };

    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          question_title: 'Who lives in your household and buys or prepares food with you?',
          locale: 'en',
        }),
      },
      TEST_ENV_WITH_API_KEY,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { explainer_text: string; was_filtered: boolean };
    expect(body.was_filtered).toBe(false);
    expect(body.explainer_text).toContain('home');
    expect(body.explainer_text.length).toBeGreaterThan(40);

    // Verify the request to Anthropic included the EN system prompt + correct model.
    expect(hoisted.capturedCalls).toHaveLength(1);
    const call = hoisted.capturedCalls[0]!;
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.headers['x-api-key']).toBe('test-api-key');
    const reqBody = call.body as { model: string; system: string; messages: Array<{ content: string }> };
    expect(reqBody.model).toBe('claude-sonnet-4-6');
    expect(reqBody.system).toBe(__testing.TIER_B_SYSTEM_PROMPT_EN);
    expect(reqBody.messages[0]!.content).toContain('Who lives in your household');
  });

  it('ES: returns a Spanish explainer with the ES system prompt', async () => {
    hoisted.nextResponse = {
      status: 200,
      body: {
        content: [
          {
            type: 'text',
            text:
              'Esta pregunta es sobre las personas que viven con usted y comparten las comidas. Incluya adultos y niños. Si alguien entra y sale del hogar, un orientador del condado puede ayudarle a decidir si contarlo.',
          },
        ],
      },
    };

    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          question_title: '¿Quién vive en su hogar y compra o prepara la comida con usted?',
          locale: 'es',
        }),
      },
      TEST_ENV_WITH_API_KEY,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { explainer_text: string; was_filtered: boolean };
    expect(body.was_filtered).toBe(false);
    expect(body.explainer_text).toContain('hogar');

    const call = hoisted.capturedCalls[0]!;
    const reqBody = call.body as { system: string };
    expect(reqBody.system).toBe(__testing.TIER_B_SYSTEM_PROMPT_ES);
  });
});

// ---------------------------------------------------------------------------
// Safety filter — the load-bearing test for demo credibility
// ---------------------------------------------------------------------------

describe('POST /v1/intake/help — safety filter', () => {
  it('EN: replaces "you qualify" with SAFE_FALLBACK_EN and sets was_filtered=true', async () => {
    // Simulate the model going off-rails and committing to eligibility.
    hoisted.nextResponse = {
      status: 200,
      body: {
        content: [
          {
            type: 'text',
            text: 'Based on what you wrote, you qualify for SNAP benefits. You should report this income next month.',
          },
        ],
      },
    };

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          question_title: 'What is your monthly income from all sources?',
          locale: 'en',
        }),
      },
      TEST_ENV_WITH_API_KEY,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { explainer_text: string; was_filtered: boolean };
    expect(body.was_filtered).toBe(true);
    expect(body.explainer_text).toBe(__testing.SAFE_FALLBACK_EN);

    // Verify a structured violation event was logged server-side.
    expect(logSpy).toHaveBeenCalled();
    const logged = logSpy.mock.calls.map((c) => String(c[0])).find((s) => s.includes('intake_help_safety_filter_triggered'));
    expect(logged).toBeDefined();
    const parsed = JSON.parse(logged as string);
    expect(parsed.msg).toBe('intake_help_safety_filter_triggered');
    expect(parsed.locale).toBe('en');
    expect(parsed.matched_pattern).toBeDefined();
    expect(parsed.original_response).toContain('you qualify');

    logSpy.mockRestore();
  });

  it('ES: replaces "usted califica" with SAFE_FALLBACK_ES and sets was_filtered=true', async () => {
    hoisted.nextResponse = {
      status: 200,
      body: {
        content: [
          {
            type: 'text',
            text: 'Por lo que escribió, usted califica para los beneficios. Usted debe reportar este ingreso.',
          },
        ],
      },
    };

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          question_title: '¿Cuál es su ingreso mensual?',
          locale: 'es',
        }),
      },
      TEST_ENV_WITH_API_KEY,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { explainer_text: string; was_filtered: boolean };
    expect(body.was_filtered).toBe(true);
    expect(body.explainer_text).toBe(__testing.SAFE_FALLBACK_ES);

    logSpy.mockRestore();
  });

  it('does not filter benign responses', async () => {
    hoisted.nextResponse = {
      status: 200,
      body: {
        content: [
          {
            type: 'text',
            text: 'This question is asking about your monthly income. List any money you earn from a job, gig work, or other sources. Your county navigator can clarify if you are not sure how to count something.',
          },
        ],
      },
    };

    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          question_title: 'What is your monthly income from all sources?',
          locale: 'en',
        }),
      },
      TEST_ENV_WITH_API_KEY,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { explainer_text: string; was_filtered: boolean };
    expect(body.was_filtered).toBe(false);
    expect(body.explainer_text).toContain('income');
  });
});

// ---------------------------------------------------------------------------
// Validation — missing fields
// ---------------------------------------------------------------------------

describe('POST /v1/intake/help — input validation', () => {
  it('returns 400 when question_title is missing', async () => {
    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ locale: 'en' }),
      },
      TEST_ENV_WITH_API_KEY,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when question_title is an empty string', async () => {
    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ question_title: '', locale: 'en' }),
      },
      TEST_ENV_WITH_API_KEY,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when locale is unsupported', async () => {
    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ question_title: 'Hi', locale: 'fr' }),
      },
      TEST_ENV_WITH_API_KEY,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when x-anonymous-id header is missing', async () => {
    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_title: 'Hello', locale: 'en' }),
      },
      TEST_ENV_WITH_API_KEY,
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// LLM failure surface as 500
// ---------------------------------------------------------------------------

describe('POST /v1/intake/help — LLM failure modes', () => {
  it('returns 500 when Anthropic API returns 5xx', async () => {
    hoisted.nextResponse = {
      status: 503,
      body: { error: { type: 'overloaded_error', message: 'Overloaded' } },
    };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          question_title: 'What is your address?',
          locale: 'en',
        }),
      },
      TEST_ENV_WITH_API_KEY,
    );

    expect(res.status).toBe(500);
    logSpy.mockRestore();
  });

  it('returns 500 when ANTHROPIC_API_KEY is not configured', async () => {
    const res = await buildIntakeHelpApp().request(
      '/v1/intake/help',
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          question_title: 'What is your address?',
          locale: 'en',
        }),
      },
      TEST_ENV, // no ANTHROPIC_API_KEY
    );
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// applySafetyFilter unit tests — explicit phrase coverage
// ---------------------------------------------------------------------------

describe('applySafetyFilter — phrase coverage', () => {
  const ctx = { question_title: 'irrelevant', anonymous_id: null };

  // Quiet the per-match server log noise.
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('EN forbidden phrases', () => {
    const cases: Array<[string, string]> = [
      ['you qualify', 'Based on this, you qualify for benefits.'],
      ['you do not qualify', 'You do not qualify for SNAP.'],
      ['you are eligible', 'Yes, you are eligible.'],
      ['you are not eligible', 'No, you are not eligible.'],
      ['you should report', 'You should report this income.'],
      ['you must report', 'You must report any changes.'],
      ['you should select', 'You should select option A.'],
      ['you must select', 'You must select the second one.'],
      ['you will be approved', 'You will be approved next month.'],
      ['benefits will be approved', 'Your benefits will be approved.'],
    ];

    for (const [label, text] of cases) {
      it(`filters "${label}"`, () => {
        const out = __testing.applySafetyFilter(text, 'en', ctx);
        expect(out.was_filtered).toBe(true);
        expect(out.text).toBe(__testing.SAFE_FALLBACK_EN);
      });
    }
  });

  describe('ES forbidden phrases', () => {
    const cases: Array<[string, string]> = [
      ['usted califica', 'Usted califica para los beneficios.'],
      ['usted no califica', 'Usted no califica para SNAP.'],
      ['usted es elegible', 'Usted es elegible.'],
      ['usted no es elegible', 'Usted no es elegible.'],
      ['usted debe reportar', 'Usted debe reportar este cambio.'],
      ['usted tiene que reportar', 'Usted tiene que reportar este ingreso.'],
      ['usted debe seleccionar', 'Usted debe seleccionar la opción A.'],
      ['usted será aprobado', 'Usted será aprobado el próximo mes.'],
      ['sus beneficios serán aprobados', 'Sus beneficios serán aprobados.'],
    ];

    for (const [label, text] of cases) {
      it(`filters "${label}"`, () => {
        const out = __testing.applySafetyFilter(text, 'es', ctx);
        expect(out.was_filtered).toBe(true);
        expect(out.text).toBe(__testing.SAFE_FALLBACK_ES);
      });
    }
  });

  it('does not filter EN benign text', () => {
    const out = __testing.applySafetyFilter(
      'This question is asking about your income. Your county navigator can help if you are unsure.',
      'en',
      ctx,
    );
    expect(out.was_filtered).toBe(false);
  });

  it('does not filter ES benign text', () => {
    const out = __testing.applySafetyFilter(
      'Esta pregunta es sobre su ingreso. Un orientador del condado puede ayudarle si no está seguro.',
      'es',
      ctx,
    );
    expect(out.was_filtered).toBe(false);
  });
});
