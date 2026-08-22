"use client";

// The hero's mini chat (owner redesign 2026-08-21; FeelBetterBot-inspired).
// It REPLACED the cycling example card: the real way in beats a demo of it.
//
// WHAT THIS IS NOT: a second chat. Nothing here answers — this is a plain
// GET form aimed at /chat, so the question and state arrive there as query
// params and the one chat takes over. Because it is a native form, the
// handoff works with JavaScript disabled; only the starter chips (which
// populate the composer) need hydration.
//
// ONBOARDING IS STATE-ONLY, decided against the Pi inspiration's name-first
// open: the retention line says "avoid names", and a name we invited is a
// name we keep. The select asks for the one thing answers depend on, and
// the geo hint preselects it the same way /chat does.
//
// The starters populate rather than send — a suggestion you can edit is a
// suggestion; one that fires on touch is a decision made for you (same rule
// as the chat's own suggested follow-ups).

import { useState } from "react";
import type { PackMeta } from "@civica/demeter-engine/packs";
import { stateName } from "../lib/state-names";

export interface MiniChatCopy {
  greeting: string;
  stateLabel: string;
  federal: string;
  placeholder: string;
  send: string;
  startersLabel: string;
}

export function SnapMiniChat({
  chatPath,
  states,
  initialState,
  starters,
  copy,
}: {
  chatPath: string;
  states: PackMeta[];
  initialState: string | null;
  starters: string[];
  copy: MiniChatCopy;
}) {
  const [q, setQ] = useState("");
  return (
    <form className="dmc" action={chatPath} method="get">
      <p className="dmc__greeting">{copy.greeting}</p>
      <label className="dmc__statelabel">
        <span>{copy.stateLabel}</span>
        {/* Empty value = the federal floor — /chat validates and treats a
            missing/unknown state as null, so no hidden coupling here. */}
        <select name="state" className="dmc__state" defaultValue={initialState ?? ""}>
          <option value="">{copy.federal}</option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>
              {stateName(s.code)}
            </option>
          ))}
        </select>
      </label>
      <div className="dmc__row">
        <input
          className="dmc__input"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={copy.placeholder}
          aria-label={copy.placeholder}
        />
        <button type="submit" className="dmc__send">
          {copy.send}
        </button>
      </div>
      <p className="dmc__starterslabel">{copy.startersLabel}</p>
      <ul className="dmc__starters">
        {starters.map((s) => (
          <li key={s}>
            <button type="button" className="dmc__starter" onClick={() => setQ(s)}>
              {s}
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}
