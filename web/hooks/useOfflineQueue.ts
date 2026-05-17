"use client";

import { useEffect, useCallback, useState } from "react";
import { enqueue, dequeueAll, hasQueued } from "@/lib/storage/draftQueue";
import { saveAnswer } from "@/lib/api/actions";

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    setHasPending(hasQueued());
  }, []);

  const drainQueue = useCallback(async () => {
    const items = dequeueAll();
    if (items.length === 0) {
      setHasPending(false);
      return;
    }
    // Fire in sequence to avoid overwhelming the API
    for (const item of items) {
      try {
        await saveAnswer(item.packetId, item.questionId, item.value);
      } catch {
        // Put the item back so the next online event retries it.
        enqueue({ packetId: item.packetId, questionId: item.questionId, value: item.value });
      }
    }
    setHasPending(hasQueued());
  }, []);

  useEffect(() => {
    function onOnline() {
      setIsOnline(true);
      drainQueue();
    }
    function onOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [drainQueue]);

  return { isOnline, hasPending };
}
