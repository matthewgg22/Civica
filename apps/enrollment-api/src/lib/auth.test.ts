import { describe, it, expect } from "vitest";
import { HTTPException } from "hono/http-exception";
import {
  requireApplicant,
  requireBuddy,
  requireNavigator,
  requireOperator,
} from "./auth.js";
import type { ActorKind } from "../types.js";

const ALL_KINDS: ActorKind[] = [
  "applicant",
  "navigator",
  "admin",
  "system",
  "api_key",
  "buddy",
  "operator",
];

function expectAllow(fn: () => void) {
  expect(fn).not.toThrow();
}

function expectDeny(fn: () => void, expectedMessage: RegExp) {
  try {
    fn();
    throw new Error("expected throw");
  } catch (err) {
    expect(err).toBeInstanceOf(HTTPException);
    expect((err as HTTPException).status).toBe(403);
    expect((err as HTTPException).message).toMatch(expectedMessage);
  }
}

describe("requireNavigator", () => {
  it("allows navigator and admin", () => {
    expectAllow(() => requireNavigator("navigator"));
    expectAllow(() => requireNavigator("admin"));
  });
  it("rejects everything else", () => {
    for (const k of ALL_KINDS) {
      if (k === "navigator" || k === "admin") continue;
      expectDeny(() => requireNavigator(k), /Navigator role required/);
    }
  });
});

describe("requireApplicant", () => {
  it("allows applicant only", () => {
    expectAllow(() => requireApplicant("applicant"));
    for (const k of ALL_KINDS) {
      if (k === "applicant") continue;
      expectDeny(() => requireApplicant(k), /applicants only/);
    }
  });
});

describe("requireBuddy", () => {
  it("allows buddy only", () => {
    expectAllow(() => requireBuddy("buddy"));
    for (const k of ALL_KINDS) {
      if (k === "buddy") continue;
      expectDeny(() => requireBuddy(k), /Buddy role required/);
    }
  });
});

describe("requireOperator", () => {
  it("allows operator only", () => {
    expectAllow(() => requireOperator("operator"));
  });
  it("rejects every other actor kind", () => {
    for (const k of ALL_KINDS) {
      if (k === "operator") continue;
      expectDeny(() => requireOperator(k), /Operator role required/);
    }
  });
});
