import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { QuestionField, type FieldValue } from "@/components/snap/QuestionField";
import type { components } from "@/lib/api/types";

type Question = components["schemas"]["Question"];

type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

// Controlled wrapper so the field actually responds to interaction
function Controlled({ question, saveState = "idle", error }: { question: Question; saveState?: SaveState; error?: string }) {
  const [value, setValue] = useState<FieldValue>(null);
  return (
    <div className="max-w-md p-4">
      <QuestionField
        question={question}
        value={value}
        onChange={setValue}
        saveState={saveState}
        error={error}
      />
    </div>
  );
}

const q = (overrides: Partial<Question> & { type: Question["type"]; label: string }): Question => ({
  id: "q-placeholder",
  section_key: "household",
  required: true,
  order: 0,
  options: [],
  ...overrides,
});

const meta: Meta = {
  title: "SNAP/QuestionField",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

export const TextInput: Story = {
  name: "text — plain text",
  render: () => (
    <Controlled question={q({ id: "q1", type: "text", label: "Full legal name", hint: "As it appears on your ID" })} />
  ),
};

export const NumberInput: Story = {
  name: "number",
  render: () => (
    <Controlled question={q({ id: "q2", type: "number", label: "Number of people in your household" })} />
  ),
};

export const CurrencyInput: Story = {
  name: "currency — monthly income",
  render: () => (
    <Controlled question={q({ id: "q3", section_key: "income", type: "currency", label: "Monthly gross income", hint: "Total income before taxes" })} />
  ),
};

export const DateInput: Story = {
  name: "date — date of birth",
  render: () => (
    <Controlled question={q({ id: "q4", section_key: "identity", type: "date", label: "Date of birth" })} />
  ),
};

export const SingleChoice: Story = {
  name: "single — radio group",
  render: () => (
    <Controlled
      question={q({
        id: "q5",
        section_key: "residency",
        type: "single",
        label: "Are you a US citizen?",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "other", label: "Other immigration status" },
        ],
      })}
    />
  ),
};

export const MultiChoice: Story = {
  name: "multi — checkboxes",
  render: () => (
    <Controlled
      question={q({
        id: "q6",
        section_key: "expenses",
        type: "multi",
        label: "Which expenses do you have?",
        hint: "Select all that apply",
        required: false,
        options: [
          { value: "rent", label: "Rent or mortgage" },
          { value: "utilities", label: "Utilities" },
          { value: "childcare", label: "Childcare" },
          { value: "medical", label: "Medical costs" },
        ],
      })}
    />
  ),
};

export const AddressInput: Story = {
  name: "address — composite 4-field",
  render: () => (
    <Controlled question={q({ id: "q7", section_key: "residency", type: "address", label: "Home address" })} />
  ),
};

export const SaveStateSaving: Story = {
  name: "save state — saving",
  render: () => (
    <div className="max-w-md p-4">
      <QuestionField
        question={q({ id: "q-ss", type: "text", label: "Full legal name" })}
        value="Jane Doe"
        onChange={() => undefined}
        saveState="saving"
      />
    </div>
  ),
};

export const SaveStateSaved: Story = {
  name: "save state — saved",
  render: () => (
    <div className="max-w-md p-4">
      <QuestionField
        question={q({ id: "q-sv", type: "text", label: "Full legal name" })}
        value="Jane Doe"
        onChange={() => undefined}
        saveState="saved"
      />
    </div>
  ),
};

export const SaveStateOffline: Story = {
  name: "save state — offline",
  render: () => (
    <div className="max-w-md p-4">
      <QuestionField
        question={q({ id: "q-of", type: "text", label: "Full legal name" })}
        value="Jane Doe"
        onChange={() => undefined}
        saveState="offline"
      />
    </div>
  ),
};

export const SaveStateError: Story = {
  name: "save state — error",
  render: () => (
    <div className="max-w-md p-4">
      <QuestionField
        question={q({ id: "q-er", type: "text", label: "Full legal name" })}
        value="Jane Doe"
        onChange={() => undefined}
        saveState="error"
        error="Connection error — retrying"
      />
    </div>
  ),
};
