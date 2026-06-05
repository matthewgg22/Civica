"use client";

import { useState, type ReactNode, type ButtonHTMLAttributes } from "react";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  onClick: () => Promise<unknown>;
  children: ReactNode;
}

export function Button({ onClick, children, disabled, className, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  async function handle() {
    if (pending) return;
    setPending(true);
    try {
      await onClick();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      {...rest}
      type="button"
      onClick={handle}
      disabled={disabled || pending}
      className={className}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Sending…
        </span>
      ) : children}
    </button>
  );
}
