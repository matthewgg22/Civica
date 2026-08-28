// The distress gate in all four languages (launch audit 2026-08-28).
//
// The crisis gate (self-harm, abuse) covered vi/zh from the start; the
// food-crisis gate said "v1 — EN + ES" — so a Vietnamese or Chinese reader in
// acute food crisis got a normal policy answer, no expedited-7-day lead, no
// 211, and (because certainty.ts hedges are suppressed on distress) a
// less-warm framing than the same message in English. The two languages most
// likely to belong to LEP households were the two least protected.
import { describe, it, expect } from "vitest";
import { detectDistress } from "../distress";

describe("detectDistress across languages", () => {
  it("English and Spanish keep firing (the v1 set)", () => {
    for (const msg of [
      "I have no food for my kids tonight",
      "we're out of food and I can't buy any",
      "mis niños tienen hambre",
      "no tengo dinero para comida",
    ]) {
      expect(detectDistress(msg), msg).toBe(true);
    }
  });

  it("Vietnamese food crisis fires", () => {
    for (const msg of [
      "nhà tôi không có gì để ăn",
      "con tôi đang đói",
      "hết đồ ăn rồi, không có tiền mua thức ăn",
      "tôi vô gia cư, ngủ trong xe",
      "trợ cấp bị cắt",
    ]) {
      expect(detectDistress(msg), msg).toBe(true);
    }
  });

  it("Chinese food crisis fires", () => {
    for (const msg of [
      "我们没有东西吃",
      "孩子在挨饿",
      "没钱买吃的",
      "我无家可归，睡在车里",
      "我的福利被停了",
    ]) {
      expect(detectDistress(msg), msg).toBe(true);
    }
  });

  it("ordinary policy questions do not fire, in any language", () => {
    // High recall is the stance, but the gate must not fire on the everyday
    // questions that merely CONTAIN food words — or every answer leads with
    // crisis lines and the lead stops meaning anything.
    for (const msg of [
      "what food can I buy with SNAP?",
      "¿qué alimentos puedo comprar?",
      "SNAP có mua được đồ ăn nóng không?",
      "SNAP 可以买什么食物？",
      "how much are food benefits for a family of 3?",
    ]) {
      expect(detectDistress(msg), msg).toBe(false);
    }
  });
});
