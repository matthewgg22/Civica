"use client";

// The landing page's way in. NOT a second chat.
//
// The landing card used to be a full DemeterChat, and that is why it did not
// read as a chatbot: in its empty state a chat shows a brand header, a state
// picker and three outlined buttons, with the composer below the fold. It looks
// like a form with three links, because in that state it is one. A card inside
// a scrolling document can only look so much like a chat app.
//
// So the chat moved to /chat, where it owns the viewport, and this is what
// stays: a state picker, one input, three real questions. Ask anything here and
// you arrive at /chat with the question already in flight. One chat
// implementation, reachable two ways.
//
// It also means the landing page — the one that has to be fast and indexable —
// no longer ships the streaming client, the worksheet, the save flow or the
// feedback widget just to render a text box.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PackMeta, AnswerLang } from "@civica/demeter-engine/packs";
import { DemeterStatePicker, type StatePickerCopy } from "./DemeterStatePicker";

export interface EntryCopy {
  placeholder: string;
  send: string;
  suggestions: string[];
  picker: StatePickerCopy;
  statesLink: string;
}

export function DemeterEntry({
  states,
  initialState = null,
  lang = "en",
  hint = null,
  copy,
}: {
  states: PackMeta[];
  initialState?: string | null;
  lang?: AnswerLang;
  /** IP-derived state suggestion from the edge. Offered, never applied. */
  hint?: string | null;
  copy: EntryCopy;
}) {
  const router = useRouter();
  const [state, setState] = useState<string | null>(initialState);
  const [input, setInput] = useState("");

  const chatPath = lang === "en" ? "/chat" : `/${lang}/chat`;

  const go = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const params = new URLSearchParams({ q });
    if (state) params.set("state", state);
    router.push(`${chatPath}?${params.toString()}`);
  };

  return (
    <div className="dment">
      <div className="dment__scope">
        <DemeterStatePicker
          states={states}
          value={state}
          onChange={setState}
          copy={copy.picker}
          hint={hint}
        />
        <a className="dment__verify" href={lang === "en" ? "/states" : `/${lang}/states`}>
          {copy.statesLink}
        </a>
      </div>

      <form
        className="dment__form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          go(input);
        }}
      >
        <input
          className="dment__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={copy.placeholder}
          aria-label={copy.placeholder}
        />
        <button type="submit" className="dment__send" disabled={input.trim() === ""}>
          {copy.send}
        </button>
      </form>

      {/* Real questions, not feature bullets. These are the three most common
          things people actually arrive wanting to know, and each one is a
          working query rather than a topic label. */}
      <ul className="dment__suggest">
        {copy.suggestions.map((q) => (
          <li key={q}>
            <button type="button" className="dment__chip" onClick={() => go(q)}>
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
