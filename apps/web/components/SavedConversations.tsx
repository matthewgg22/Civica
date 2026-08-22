"use client";

// The saved-conversations list. Client-side only because of Delete — everything
// else here is static markup the server could have produced.
//
// Delete is immediate and permanent, with a confirm in front of it. This is the
// one table on the surface holding a person's own words verbatim, so "delete"
// has to mean deleted; a soft-delete flag would leave the transcript sitting in
// the table after they asked us to drop it. The row goes from the list only
// once the server has confirmed — an optimistic removal that silently failed
// would tell someone their conversation was gone when it was not, which is the
// worst possible thing to be wrong about here.

import { useState } from "react";
import { askPath } from "../lib/i18n/routes";
import type { AnswerLang } from "@civica/demeter-engine/packs";

export type SavedRow = {
  id: string;
  title: string;
  state_code: string | null;
  lang: string;
  updated_at: string;
};

export interface SavedCopy {
  open: string;
  remove: string;
  removing: string;
  confirm: string;
  removeError: string;
  federal: string;
  updated: (when: string) => string;
}

export function SavedConversations({
  rows,
  lang,
  langTag,
  copy,
}: {
  rows: SavedRow[];
  lang: AnswerLang;
  langTag: string;
  copy: SavedCopy;
}) {
  const [items, setItems] = useState(rows);
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (!window.confirm(copy.confirm)) return;
    setPending(id);
    setFailed(null);
    try {
      const res = await fetch(`/api/demeter/conversations/${id}`, { method: "DELETE" });
      // 404 means it is already gone — someone deleted it in another tab. That
      // is the outcome they asked for, so drop the row rather than showing an
      // error for a state they wanted.
      if (res.ok || res.status === 404) {
        setItems((current) => current.filter((row) => row.id !== id));
      } else {
        setFailed(id);
      }
    } catch {
      setFailed(id);
    } finally {
      setPending(null);
    }
  };

  return (
    <ul className="saved__list">
      {items.map((row) => (
        <li key={row.id} className="saved__item">
          <div className="saved__main">
            {/* Resume in the language of the page they are on, not the language
                the conversation was had in: they navigated here in this one. */}
            <a className="saved__title" href={`${askPath(lang)}?c=${encodeURIComponent(row.id)}`}>
              {row.title}
            </a>
            <p className="saved__meta">
              <span className="saved__scope">{row.state_code ?? copy.federal}</span>
              <span aria-hidden> · </span>
              <time dateTime={row.updated_at}>
                {copy.updated(
                  new Intl.DateTimeFormat(langTag, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }).format(new Date(row.updated_at)),
                )}
              </time>
            </p>
            {failed === row.id && (
              <p className="saved__error" role="alert">{copy.removeError}</p>
            )}
          </div>
          <div className="saved__actions">
            <a className="saved__open" href={`${askPath(lang)}?c=${encodeURIComponent(row.id)}`}>
              {copy.open}
            </a>
            <button
              type="button"
              className="saved__delete"
              onClick={() => void remove(row.id)}
              disabled={pending === row.id}
            >
              {pending === row.id ? copy.removing : copy.remove}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
