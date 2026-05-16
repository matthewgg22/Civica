"use client";

import { useEffect } from "react";

// Loads @axe-core/react in development only.
// Logs violations to the browser console — no production bundle impact.
export function DevA11yAudit() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    let cancelled = false;
    Promise.all([
      import("@axe-core/react"),
      import("react"),
      import("react-dom"),
    ]).then(([axe, React, ReactDOM]) => {
      if (!cancelled) {
        axe.default(React.default, ReactDOM.default, 1000);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return null;
}
