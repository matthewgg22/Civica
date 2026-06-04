"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emptyDraft, draftSchema, type SNAPApplicationDraft } from "./draft";

// Client-side draft persistence. Mirrors the iOS approach of
// keeping draft answers session-only / on-device — we deliberately
// avoid server-side draft storage so the draft never lands in Supabase
// until the user submits (matching the EXPERIMENTAL SILOED MODULE rule
// in SNAPModels.swift).

const STORAGE_KEY = "civica.snap.draft";

function loadDraft(): SNAPApplicationDraft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDraft();
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyDraft();
  } catch {
    return emptyDraft();
  }
}

function saveDraft(draft: SNAPApplicationDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // quota / private-window — silently drop
  }
}

export function clearDraftStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Hook: yields the current draft + an updater. Draft is debounced into
// localStorage so we're not writing on every keystroke.
export function useDraft(): [SNAPApplicationDraft, (next: SNAPApplicationDraft) => void] {
  const [draft, setDraft] = useState<SNAPApplicationDraft>(() => emptyDraft());
  const hydrated = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(loadDraft());
    hydrated.current = true;
  }, []);

  const update = useCallback((next: SNAPApplicationDraft) => {
    setDraft(next);
    if (!hydrated.current) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => saveDraft(next), 200);
  }, []);

  return [draft, update];
}
