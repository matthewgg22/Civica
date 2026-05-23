import { describe, it, expect } from 'vitest';

import depositCalendarRouter from './deposit-calendar.js';
import { TEST_ENV, APPLICANT, buildTestApp } from '../../test/helpers.js';

describe('GET /ebt/deposit-calendar', () => {
  it('returns 400 when case_suffix is missing', async () => {
    const app = buildTestApp(depositCalendarRouter, '/', APPLICANT);
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 when case_suffix is longer than 1 char', async () => {
    const app = buildTestApp(depositCalendarRouter, '/', APPLICANT);
    const res = await app.request('/?case_suffix=AB', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 when case_suffix is non-alphanumeric', async () => {
    const app = buildTestApp(depositCalendarRouter, '/', APPLICANT);
    const res = await app.request('/?case_suffix=!', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('INVALID_SUFFIX');
  });

  it('maps digit 0 → day 10', async () => {
    const app = buildTestApp(depositCalendarRouter, '/', APPLICANT);
    const res = await app.request('/?case_suffix=0', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { day_of_month: number };
    expect(body.day_of_month).toBe(10);
  });

  it('maps digits 1-9 → days 1-9', async () => {
    const app = buildTestApp(depositCalendarRouter, '/', APPLICANT);
    for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const res = await app.request(`/?case_suffix=${d}`, {}, TEST_ENV);
      const body = await res.json() as { day_of_month: number };
      expect(body.day_of_month).toBe(d);
    }
  });

  it('maps letter A → day 1, J → day 10, K → day 1, T → day 10', async () => {
    const app = buildTestApp(depositCalendarRouter, '/', APPLICANT);
    const checks: Array<[string, number]> = [
      ['A', 1],
      ['J', 10],
      ['K', 1],
      ['T', 10],
      ['Z', 6], // 25 % 10 + 1 = 6
    ];
    for (const [letter, day] of checks) {
      const res = await app.request(`/?case_suffix=${letter}`, {}, TEST_ENV);
      const body = await res.json() as { day_of_month: number };
      expect(body.day_of_month).toBe(day);
    }
  });

  it('upper-cases lowercase letters', async () => {
    const app = buildTestApp(depositCalendarRouter, '/', APPLICANT);
    const res = await app.request('/?case_suffix=a', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { day_of_month: number; case_suffix: string };
    expect(body.day_of_month).toBe(1);
    expect(body.case_suffix).toBe('A');
  });

  it('returns two upcoming ISO calendar dates', async () => {
    const app = buildTestApp(depositCalendarRouter, '/', APPLICANT);
    const res = await app.request('/?case_suffix=5', {}, TEST_ENV);
    const body = await res.json() as { upcoming_dates: string[] };
    expect(body.upcoming_dates).toHaveLength(2);
    for (const d of body.upcoming_dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-05$/);
    }
  });

  it('always returns state_code "CA"', async () => {
    const app = buildTestApp(depositCalendarRouter, '/', APPLICANT);
    const res = await app.request('/?case_suffix=1', {}, TEST_ENV);
    const body = await res.json() as { state_code: string };
    expect(body.state_code).toBe('CA');
  });
});
