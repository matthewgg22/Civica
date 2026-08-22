// @vitest-environment jsdom
//
// showButton exists so the rail could drop its Save button (owner rec
// 2026-08-22) WITHOUT unmounting the component that owns saving. These pin
// both halves of that.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DemeterSave } from "../DemeterSave";
import { T } from "../../lib/i18n/demeter-chat-copy";

afterEach(cleanup);

const msgs = [
  { role: "user" as const, content: "hi" },
  { role: "assistant" as const, content: "an answer" },
];

function renderSave(showButton: boolean) {
  return render(
    <DemeterSave
      showButton={showButton}
      messages={msgs}
      state="CA"
      lang="en"
      busy={false}
      pendingSave={false}
      initialSavedId={null}
      onRestore={() => {}}
      onSavedChange={() => {}}
      copy={T.en.save}
    />,
  );
}

describe("DemeterSave showButton", () => {
  it("renders its button by default — the other callers still want one", () => {
    const { container } = renderSave(true);
    expect(container.querySelector("button.demeter__save")).toBeTruthy();
  });

  it("hides only the button, keeping the component and its status region", () => {
    const { container } = renderSave(false);
    expect(container.querySelector("button.demeter__save")).toBeNull();
    // Still mounted: the wrapper is there to carry save errors raised by a
    // save the transcript's nudge fired.
    expect(container.querySelector(".demeter__savewrap")).toBeTruthy();
  });
});
