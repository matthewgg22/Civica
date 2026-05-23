/**
 * GET /ebt/deposit-calendar?case_suffix=<digit-or-letter>
 *
 * California CalFresh issues benefits on days 1–10 of the month, staggered
 * by the LAST CHARACTER of the case number ("case suffix"). The mapping is
 * published by CDSS and is deterministic — no live state lookup needed.
 *
 * Reference: CDSS All-County Letter 19-43 (issuance schedule by case
 * number digit). The mapping below covers all 36 possible suffix values
 * (0-9 + A-Z); CalSAWS case numbers may include letters.
 *
 * Response includes the next two scheduled deposits so the iOS dashboard
 * can render both "your next deposit" and "the one after". All dates are
 * pure calendar dates (no zone) — the recipient cares about local
 * day-of-month, not UTC instants.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../types.js';

const app = new Hono<{ Bindings: Env }>();

// case-suffix → day-of-month mapping (CDSS staggered issuance).
// 0–9 map to days 1–10 in order. Letters fall in alphabetical order in the
// same 1–10 window (mod 10) — A=1, B=2, …, J=10, K=1, L=2, …
function dayOfMonthFor(suffix: string): number {
  const ch = suffix.toUpperCase();
  if (ch.length !== 1) {
    throw new Error('case_suffix must be a single character');
  }
  const digit = ch.charCodeAt(0);
  if (digit >= 48 && digit <= 57) {
    // '0'..'9' → 1..10
    return digit === 48 ? 10 : digit - 48;
  }
  if (digit >= 65 && digit <= 90) {
    // 'A'..'Z' → cycle 1..10
    const idx = digit - 65; // 0..25
    return (idx % 10) + 1;
  }
  throw new Error('case_suffix must be 0-9 or A-Z');
}

function isoDate(year: number, monthZero: number, day: number): string {
  // Construct a YYYY-MM-DD string without timezone shenanigans.
  const d = new Date(Date.UTC(year, monthZero, day));
  return d.toISOString().slice(0, 10);
}

function nextDeposits(suffix: string, fromNow: Date, count: number): string[] {
  const day = dayOfMonthFor(suffix);
  const out: string[] = [];
  let year = fromNow.getUTCFullYear();
  let month = fromNow.getUTCMonth();
  // If today's day-of-month is already past this card's day, start next month.
  if (fromNow.getUTCDate() > day) {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  while (out.length < count) {
    out.push(isoDate(year, month, day));
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return out;
}

const querySchema = z.object({
  case_suffix: z.string().min(1).max(1),
});

app.get('/', zValidator('query', querySchema), async (c) => {
  const { case_suffix } = c.req.valid('query');

  let day: number;
  try {
    day = dayOfMonthFor(case_suffix);
  } catch (err) {
    return c.json({ error: 'INVALID_SUFFIX', message: (err as Error).message }, 400);
  }

  const upcoming = nextDeposits(case_suffix, new Date(), 2);

  return c.json({
    state_code: 'CA',
    case_suffix: case_suffix.toUpperCase(),
    day_of_month: day,
    upcoming_dates: upcoming,
  });
});

export default app;
