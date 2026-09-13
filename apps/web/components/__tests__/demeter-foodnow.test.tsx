// @vitest-environment jsdom
//
// "Need food this week?" in the chat's top bar (owner, 2026-09-13).
//
// Two things are pinned here, and they fail for different reasons.
//
// PLACEMENT. The affordance used to be a section partway down /screen/ask,
// which put it behind a scroll for the one person who cannot wait for one and
// out of reach entirely from /chat. If it ever drifts back out of the chrome,
// these fail.
//
// THE CLAIM. The copy it replaced said SNAP "takes at least seven days even
// when it is urgent", which inverts 7 CFR 273.2(i)(3)(i): seven days is the
// DEADLINE for expedited service, not the floor, and many states are faster.
// Read the wrong way round it tells a household with no food that SNAP cannot
// help them this week — the exact household expedited service exists for. The
// locale sweep below fails on any translation that reintroduces it.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

vi.mock("../../lib/supabase-browser", () => ({
  supabaseBrowser: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));

import { DemeterChat } from "../DemeterChat";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { FOODNOW_T, FOOD_BANK_URL, URL_211 } from "../../lib/i18n/demeter-foodnow-copy";

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

function chat(lang: "en" | "es" | "vi" | "zh" = "en") {
  return render(
    <DemeterChat
      states={VERIFIED_STATES}
      initialState={null}
      initialQuestion={null}
      initialMessages={[]}
      initialWorksheet={null}
      savedConversationId={null}
      pendingSave={false}
      geoHint={null}
      initialLang={lang}
    />,
  ).container;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("food-now affordance in the chat chrome", () => {
  it("renders in the top bar, beside sign-in rather than behind a scroll", () => {
    const c = chat();
    const right = c.querySelector(".demeter__headright");
    expect(right, "header right cluster did not render").not.toBeNull();
    const button = right!.querySelector("button.demeter__foodnow");
    expect(button, "food-now button is not in the chrome").not.toBeNull();
    expect(button!.getAttribute("aria-label")).toBe(FOODNOW_T.en.label);
  });

  it("sits before sign-in in the DOM, so the crisis route comes first in tab order", () => {
    const c = chat();
    const right = c.querySelector(".demeter__headright")!;
    const order = [...right.querySelectorAll("button.demeter__foodnow, a.demeter__signin")].map(
      (el) => el.className.split(" ")[0],
    );
    expect(order[0]).toBe("demeter__foodnow");
  });

  it("opens a dialog offering a food bank and 211, both reachable without qualifying", () => {
    const c = chat();
    fireEvent.click(c.querySelector("button.demeter__foodnow")!);
    const dialog = document.querySelector('.dmfn [role="dialog"], .dmfn__card[role="dialog"]');
    expect(dialog, "dialog did not open").not.toBeNull();
    const hrefs = [...document.querySelectorAll(".dmfn__card a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(FOOD_BANK_URL);
    expect(hrefs).toContain(URL_211);
  });

  it("closes on Escape", () => {
    const c = chat();
    fireEvent.click(c.querySelector("button.demeter__foodnow")!);
    expect(document.querySelector(".dmfn__card")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".dmfn__card")).toBeNull();
  });

  it("never tells anyone SNAP takes AT LEAST seven days, in any locale", () => {
    // The inverted claim, in each language it was shipped in.
    const inversions = [
      /at least seven days/i,
      /at least 7 days/i,
      /al menos siete d[ií]as/i,
      /ít nhất bảy ngày/i,
      /至少需要七天/,
      /至少七天/,
    ];
    for (const [lang, copy] of Object.entries(FOODNOW_T)) {
      const all = Object.values(copy).join(" ");
      for (const bad of inversions) {
        expect(bad.test(all), `${lang} copy reintroduces the inverted deadline`).toBe(false);
      }
    }
  });

  it("never promises food the same day, in any locale", () => {
    // Pantries keep their own hours, run weekly distributions, and some take
    // appointments. "A food bank can give you food today" sends someone to a
    // locked door — the seven-day error's mirror image: a timing claim we
    // cannot stand behind, made to a person who cannot afford to be wrong.
    const sameDay = [
      /food today/i,
      /give you food today/i,
      /comida hoy/i,
      /ngay hôm nay/,
      /今天就能/,
    ];
    for (const [lang, copy] of Object.entries(FOODNOW_T)) {
      const all = Object.values(copy).join(" ");
      for (const bad of sameDay) {
        expect(bad.test(all), `${lang} copy promises same-day food`).toBe(false);
      }
    }
  });

  it("does not promise what a third party will do for the reader", () => {
    // Owner, 2026-09-13: stop making determinations about things outside our
    // control. Three drafts each asserted someone else's behaviour — a pantry
    // handing out food today, a pantry asking nothing of you, 211 producing
    // the nearest address and its hours. We control none of it, and a person
    // who acts on it and finds otherwise is worse off than one we simply told
    // what these resources are.
    const overclaims = [
      /will find/i,
      /no application and no qualifying/i,
      /and its hours/i,
      /encuentra la despensa/i,
      /su horario/i,
      /tìm điểm gần nhất/,
      /giờ mở cửa/,
      /找到最近的/,
      /开放时间/,
    ];
    for (const [lang, copy] of Object.entries(FOODNOW_T)) {
      const all = Object.values(copy).join(" ");
      for (const bad of overclaims) {
        expect(bad.test(all), `${lang} copy promises third-party behaviour`).toBe(false);
      }
    }
  });

  it("attributes the 7-day standard to the rule rather than promising it", () => {
    // The one number left in this copy. It stays because it is a federal
    // requirement we can cite (7 CFR 273.2(i)(3)(i)), and it is phrased as
    // what the rules give the agency rather than as benefits that will arrive
    // — the product's own thesis, applied to its interface copy.
    for (const [lang, copy] of Object.entries(FOODNOW_T)) {
      expect(copy.expedited, `${lang} is missing the expedited line`).toBeTruthy();
      expect(/7/.test(copy.expedited), `${lang} does not name the 7-day standard`).toBe(true);
    }
  });

  it("carries a full label and a short one for narrow screens, in every locale", () => {
    for (const [lang, copy] of Object.entries(FOODNOW_T)) {
      expect(copy.label.length, `${lang} label missing`).toBeGreaterThan(0);
      expect(copy.labelShort.length, `${lang} short label missing`).toBeGreaterThan(0);
      expect(copy.labelShort.length).toBeLessThanOrEqual(copy.label.length);
    }
  });
});
