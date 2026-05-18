"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/types";

type Question = components["schemas"]["Question"];

export type AddressValue = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type FieldValue = string | string[] | AddressValue | null;

type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

type Props = {
  question: Question;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  saveState: SaveState;
  error?: string;
};

const SAVE_LABELS: Record<SaveState, string | null> = {
  idle: null,
  saving: "Saving…",
  saved: "Saved",
  offline: "Saved offline",
  error: "Save failed",
};

export function QuestionField({ question, value, onChange, saveState, error }: Props) {
  const fieldId = `q-${question.id}`;
  const hintId = question.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const saveLabel = SAVE_LABELS[saveState];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={fieldId} className="text-base font-medium">
          {question.label}
          {question.required && (
            <span className="ml-1 text-red-600" aria-hidden="true">*</span>
          )}
        </Label>
        {saveLabel && (
          <span
            aria-live="polite"
            className={cn(
              "text-xs",
              saveState === "saved" && "text-green-700",
              saveState === "saving" && "text-graphite",
              saveState === "offline" && "text-amber-700",
              saveState === "error" && "text-red-600"
            )}
          >
            {saveLabel}
          </span>
        )}
      </div>

      {question.hint && (
        <p id={hintId} className="text-sm text-graphite">{question.hint}</p>
      )}

      <FieldInput
        question={question}
        value={value}
        onChange={onChange}
        fieldId={fieldId}
        hintId={hintId}
        errorId={errorId}
      />

      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

// ── Per-type renderers ────────────────────────────────────────────────────────

function FieldInput({
  question,
  value,
  onChange,
  fieldId,
  hintId,
  errorId,
}: {
  question: Question;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  fieldId: string;
  hintId?: string;
  errorId?: string;
}) {
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const str = typeof value === "string" ? value : "";

  switch (question.type) {
    case "text":
      return (
        <Input
          id={fieldId}
          type="text"
          value={str}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-required={question.required}
        />
      );

    case "number":
      return (
        <Input
          id={fieldId}
          type="number"
          inputMode="numeric"
          value={str}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-required={question.required}
        />
      );

    case "currency":
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite">$</span>
          <Input
            id={fieldId}
            type="text"
            inputMode="decimal"
            className="pl-7"
            placeholder="0.00"
            value={str}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
            aria-describedby={describedBy}
            aria-required={question.required}
          />
        </div>
      );

    case "date":
      return (
        <Input
          id={fieldId}
          type="date"
          value={str}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-required={question.required}
        />
      );

    case "single":
      return (
        <RadioGroup
          value={str}
          onValueChange={(v) => onChange(v)}
          aria-labelledby={fieldId}
          aria-describedby={describedBy}
          aria-required={question.required}
        >
          {(question.options ?? []).map((opt) => (
            <label
              key={opt.value}
              htmlFor={`${fieldId}-${opt.value}`}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 motion-safe:transition-colors",
                str === opt.value ? "border-brick bg-brick/8" : "border-hairline hover:border-brick/40"
              )}
            >
              <RadioGroupItem id={`${fieldId}-${opt.value}`} value={opt.value} />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </RadioGroup>
      );

    case "multi": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div
          role="group"
          aria-labelledby={fieldId}
          aria-describedby={describedBy}
          className="space-y-2"
        >
          {(question.options ?? []).map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                htmlFor={`${fieldId}-${opt.value}`}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 motion-safe:transition-colors",
                  checked ? "border-brick bg-brick/8" : "border-hairline hover:border-brick/40"
                )}
              >
                <Checkbox
                  id={`${fieldId}-${opt.value}`}
                  checked={checked}
                  onCheckedChange={(c) => {
                    if (c) onChange([...selected, opt.value]);
                    else onChange(selected.filter((v) => v !== opt.value));
                  }}
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case "address": {
      const addr = (value as AddressValue | null) ?? { street: "", city: "", state: "", zip: "" };
      function updateAddr(field: keyof AddressValue, v: string) {
        onChange({ ...addr, [field]: v });
      }
      return (
        <div className="space-y-3" aria-describedby={describedBy}>
          <div>
            <Label htmlFor={`${fieldId}-street`} className="mb-1 block text-sm">Street address</Label>
            <Input id={`${fieldId}-street`} value={addr.street} onChange={(e) => updateAddr("street", e.target.value)} autoComplete="street-address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`${fieldId}-city`} className="mb-1 block text-sm">City</Label>
              <Input id={`${fieldId}-city`} value={addr.city} onChange={(e) => updateAddr("city", e.target.value)} autoComplete="address-level2" />
            </div>
            <div>
              <Label htmlFor={`${fieldId}-state`} className="mb-1 block text-sm">State</Label>
              <Input id={`${fieldId}-state`} value={addr.state} maxLength={2} onChange={(e) => updateAddr("state", e.target.value.toUpperCase())} autoComplete="address-level1" />
            </div>
          </div>
          <div className="w-32">
            <Label htmlFor={`${fieldId}-zip`} className="mb-1 block text-sm">ZIP code</Label>
            <Input id={`${fieldId}-zip`} value={addr.zip} inputMode="numeric" maxLength={5} onChange={(e) => updateAddr("zip", e.target.value.replace(/\D/g, ""))} autoComplete="postal-code" />
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
