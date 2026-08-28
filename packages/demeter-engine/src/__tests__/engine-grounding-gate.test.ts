// The engine-grounding gate (#1055, reopening #969; the enabling half of #960).
//
// THE BUG. shouldAttemptEngineGrounding required a digit-bearing money phrase,
// so "I have no income" — not one digit — kept the gate shut. The no-income
// cohort is the population this product exists for AND the case the engine is
// most certain about (benefit = the household maximum, exactly), yet their
// figures came from the model reading the COLA table instead of from the
// verified engine, and the prose could disagree with the worksheet.
import { describe, it, expect, vi } from "vitest";
import { shouldAttemptEngineGrounding, buildEngineGroundingBlock } from "../screening/engine-grounding";

const user = (content: string) => [{ role: "user" as const, content }];

describe("shouldAttemptEngineGrounding", () => {
  it("still opens on digit-bearing money talk", () => {
    expect(shouldAttemptEngineGrounding(user("I make $1,500 a month"), "CA")).toBe(true);
    expect(shouldAttemptEngineGrounding(user("about 74k a year"), "CA")).toBe(true);
  });

  it("REGRESSION: opens on stated absence — the exact #969 phrasings", () => {
    for (const phrase of [
      "I have no income",
      "no savings, no job",
      "I just lost my job",
      "I'm unemployed right now",
      "there's nothing coming in",
      "I don't have any income",
      "not working at the moment",
    ]) {
      expect(shouldAttemptEngineGrounding(user(phrase), "CA"), phrase).toBe(true);
    }
  });

  it("opens on stated absence in all four languages", () => {
    // The product ships four languages and "no income" is the one phrase
    // guaranteed to appear in each of them.
    for (const phrase of [
      "no tengo ingresos",
      "estoy desempleada",
      "perdí mi trabajo",
      "không có thu nhập",
      "tôi mất việc rồi",
      "我没有收入",
      "我失业了",
      "没工作也没存款",
    ]) {
      expect(shouldAttemptEngineGrounding(user(phrase), "CA"), phrase).toBe(true);
    }
  });

  it("stays shut without a state, and for non-money chat", () => {
    expect(shouldAttemptEngineGrounding(user("I have no income"), null)).toBe(false);
    expect(shouldAttemptEngineGrounding(user("what is snap?"), "CA")).toBe(false);
    expect(shouldAttemptEngineGrounding(user("how do I apply?"), "CA")).toBe(false);
  });

  it("only the USER's words open it", () => {
    // The assistant says "if you have no income…" in half its answers;
    // gating on assistant text would open the paid extraction on every turn.
    expect(
      shouldAttemptEngineGrounding(
        [{ role: "assistant", content: "Even with no income you may qualify." }],
        "CA",
      ),
    ).toBe(false);
  });
});

// ── #960: at $0 income, deductions cannot raise the figure ──────────────────
vi.mock("../screening/facts-extraction", () => ({
  extractFacts: vi.fn(),
}));
import { extractFacts } from "../screening/facts-extraction";

const usage = { inputTokens: 10, outputTokens: 5 };

async function blockFor(patch: unknown): Promise<string> {
  vi.mocked(extractFacts).mockResolvedValueOnce({
    patch: patch as never,
    empty: false,
    usage,
  } as never);
  const r = await buildEngineGroundingBlock(user("context irrelevant — extraction is mocked"), "CA", "key-unused");
  expect(r.text, "the engine produced no block").not.toBeNull();
  return r.text!;
}

describe("the grounding block at zero income (#960)", () => {
  // A COMPLETE zero-income household lands in EXPEDITED (7 CFR 273.2(i)) —
  // gross under the threshold with shelter costs — which is exactly where the
  // real #960 transcript's household lands. So the deduction guard has to
  // live in that branch, not only the benefit-bearing one.
  const zeroIncomeHousehold = {
    household: [{ member_id: "self", role: "self", age: 45, immigration: "citizen" }],
    income: [{ amount: 0, freq: "monthly", type: "wages" }],
    assets: 0,
    cat_elig: "none",
    shelter: { rent: 800 },
  };

  it("REGRESSION: the $0-income household is told deductions cannot raise the amount", async () => {
    const text = await blockFor(zeroIncomeHousehold);
    expect(text).toContain("VERIFIED ENGINE COMPUTATION");
    expect(text).toContain("EXPEDITED SERVICE");
    expect(text, "the 7-day lead survives").toMatch(/7-day/);
    expect(text).toMatch(/MAXIMUM for the household size/);
    expect(text).toMatch(/deductions[\s\S]*cannot raise/i);
    expect(text).toMatch(/Do not offer deductions/);
  });

  it("does not say it when there is real income", async () => {
    const text = await blockFor({
      ...zeroIncomeHousehold,
      income: [{ amount: 1200, freq: "monthly", type: "wages" }],
    });
    expect(text).toContain("VERIFIED ENGINE COMPUTATION");
    expect(text, "the max line leaked into an earning household").not.toContain(
      "MAXIMUM for the household size",
    );
  });
});
