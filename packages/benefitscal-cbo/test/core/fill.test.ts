// @vitest-environment jsdom
//
// Tests for the React-safe DOM fill primitive (`src/core/fill.ts`, V1-1b #311).
//
// Why no real React fixture
// --------------------------
// `react`/`react-dom` are NOT dependencies anywhere in this monorepo (verified:
// they don't resolve from this package or the workspace root), and pulling them
// in just for one package's unit tests is disproportionate. Instead we test
// against the exact mechanism React keys on internally: the input *value
// tracker* (`el._valueTracker`).
//
// React (`react-dom`'s `inputValueTracking.js`) installs a tracker on every
// controlled input by REDEFINING the element's *instance-level* `value`
// property with a getter/setter that proxies a private `currentValue` cache.
// On every native `input`/`change` event React calls `tracker.getValue()`
// (which reads the live DOM value) and compares it to that cache; it only runs
// its `onChange` (and adopts the new value as state) when they DIFFER, then
// re-syncs the cache.
//
// The consequence — and the whole bug this primitive fixes:
//   * A plain `el.value = x` goes through React's *instance* setter, which
//     updates `currentValue` too. The cache stays in sync ⇒ React sees NO
//     change ⇒ onChange never fires ⇒ on the next render React overwrites the
//     field back to its state and the value is dropped.
//   * Writing through the element *prototype's* native `value` setter (what
//     `reactSetValue` does) bypasses React's instance setter, so `currentValue`
//     goes stale ⇒ `tracker.getValue()` differs ⇒ React fires onChange and
//     adopts the value.
//
// `installReactValueTracker` below is a faithful, minimal port of React's
// tracker. Asserting against it proves the primitive works precisely where a
// naive set fails, with no React runtime required.

import { describe, it, expect, beforeEach } from "vitest";
import {
  reactSetValue,
  fillElement,
  fillText,
  fillDatePassword,
  fillSelect,
  fillRadio,
  fillCheckbox,
  formatDateForPortal,
  coerceBoolean,
} from "../../src/core/fill";

// ---------------------------------------------------------------------------
// Faithful port of React's input value tracker (react-dom
// inputValueTracking.js). Redefines the INSTANCE `value` descriptor so plain
// assignments update the cache (React would miss them) while the prototype's
// native setter does not (React detects the change).
// ---------------------------------------------------------------------------

interface ValueTracker {
  getValue(): string;
  setValue(v: string): void;
  stopTracking(): void;
}

interface Tracked {
  _valueTracker?: ValueTracker;
}

function installReactValueTracker(
  node: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): void {
  const tracked = node as unknown as Tracked;
  if (tracked._valueTracker) return;
  // The original (prototype) descriptor — React reads/writes the *real* value
  // through this, never seeing its own instance-level override.
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(node) as object,
    "value",
  )!;
  let currentValue = String(node.value);
  const get = descriptor.get!;
  const set = descriptor.set!;
  Object.defineProperty(node, "value", {
    configurable: true,
    enumerable: true,
    get() {
      return get.call(this);
    },
    set(value: string) {
      // Plain `el.value = x` lands here and keeps the cache in sync, which is
      // exactly why React would NOT detect the change.
      currentValue = String(value);
      set.call(this, value);
    },
  });
  tracked._valueTracker = {
    // React returns the CACHED value here, not a live DOM read. The cache only
    // advances through the instance setter (plain `el.value =`) or an explicit
    // setValue() re-sync — never through the prototype's native setter. That
    // asymmetry is the whole detection mechanism.
    getValue() {
      return currentValue;
    },
    setValue(v: string) {
      currentValue = String(v);
    },
    stopTracking() {
      delete tracked._valueTracker;
      Object.defineProperty(node, "value", descriptor);
    },
  };
}

/**
 * Simulate React's change-detection on a native input/change event: returns
 * true (and re-syncs the cache, as React does) iff the live DOM value differs
 * from the tracker's cached value. This is the precise gate React uses to
 * decide whether to fire `onChange`.
 */
function reactWouldFireOnChange(
  node: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): boolean {
  const tracker = (node as unknown as Tracked)._valueTracker;
  if (!tracker) return false;
  const live = node.value;
  if (live !== tracker.getValue()) {
    tracker.setValue(live);
    return true;
  }
  return false;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

function mount(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

// ===========================================================================
// THE ACCEPTANCE CRUX: native setter updates React state where a plain set
// does not.
// ===========================================================================

describe("reactSetValue — proves the React fix (vs naive el.value=)", () => {
  it("native-setter path makes React detect the change and fire onChange", () => {
    const root = mount(`<input id="ctrl" type="text" />`);
    const input = root.querySelector<HTMLInputElement>("#ctrl")!;
    installReactValueTracker(input);

    // A real controlled component: an onChange that mirrors the DOM value back
    // into "React state". It only runs when React's tracker detects a change.
    let reactState = "";
    let onChangeCalls = 0;
    input.addEventListener("input", () => {
      if (reactWouldFireOnChange(input)) {
        onChangeCalls++;
        reactState = input.value; // React adopts the value as its state
      }
    });

    reactSetValue(input, "Maria");

    // React saw the change, onChange fired with the value, and state updated.
    expect(onChangeCalls).toBe(1);
    expect(reactState).toBe("Maria");
    expect(input.value).toBe("Maria");
  });

  it("naive el.value= + dispatch does NOT update tracked React state (the bug)", () => {
    const root = mount(`<input id="ctrl" type="text" />`);
    const input = root.querySelector<HTMLInputElement>("#ctrl")!;
    installReactValueTracker(input);

    let reactState = "";
    let onChangeCalls = 0;
    input.addEventListener("input", () => {
      if (reactWouldFireOnChange(input)) {
        onChangeCalls++;
        reactState = input.value;
      }
    });

    // The buggy path content.ts currently uses: plain assignment + events.
    input.value = "Maria";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // React's tracker stayed in sync ⇒ no change detected ⇒ state stays empty.
    // This is precisely why the value is dropped on the next render/submit.
    expect(onChangeCalls).toBe(0);
    expect(reactState).toBe("");
  });

  it("fillText (the primitive) drives React state just like reactSetValue", () => {
    const root = mount(`<input id="ctrl" type="text" />`);
    const input = root.querySelector<HTMLInputElement>("#ctrl")!;
    installReactValueTracker(input);

    let reactState = "";
    input.addEventListener("input", () => {
      if (reactWouldFireOnChange(input)) reactState = input.value;
    });

    expect(fillText(input, "Jorge")).toBe(true);
    expect(reactState).toBe("Jorge");
  });

  it("works on a controlled <textarea> too", () => {
    const root = mount(`<textarea id="ta"></textarea>`);
    const ta = root.querySelector<HTMLTextAreaElement>("#ta")!;
    installReactValueTracker(ta);

    let reactState = "";
    ta.addEventListener("input", () => {
      if (reactWouldFireOnChange(ta)) reactState = ta.value;
    });

    expect(fillText(ta, "a long note")).toBe(true);
    expect(reactState).toBe("a long note");
  });
});

// ===========================================================================
// Event dispatch: input + change both fire and bubble.
// ===========================================================================

describe("reactSetValue — event dispatch", () => {
  it("dispatches bubbling input and change events", () => {
    const root = mount(`<input id="ctrl" type="text" />`);
    const input = root.querySelector<HTMLInputElement>("#ctrl")!;
    let inputFired = 0;
    let changeFired = 0;
    let inputBubbled = false;
    // Listen on an ancestor to confirm bubbling.
    root.addEventListener("input", () => {
      inputBubbled = true;
    });
    input.addEventListener("input", () => inputFired++);
    input.addEventListener("change", () => changeFired++);

    reactSetValue(input, "x");

    expect(inputFired).toBe(1);
    expect(changeFired).toBe(1);
    expect(inputBubbled).toBe(true);
    expect(input.value).toBe("x");
  });
});

// ===========================================================================
// fillText / fillDatePassword
// ===========================================================================

describe("fillText", () => {
  it("writes the value into an <input> and returns true", () => {
    const root = mount(`<input id="t" type="text" />`);
    const el = root.querySelector("#t")!;
    expect(fillText(el, "hello")).toBe(true);
    expect((el as HTMLInputElement).value).toBe("hello");
  });

  it("writes into a type=password input (FieldType reuse) and returns true", () => {
    const root = mount(`<input id="pw" type="password" />`);
    const el = root.querySelector("#pw")!;
    expect(fillText(el, "secret")).toBe(true);
    expect((el as HTMLInputElement).value).toBe("secret");
  });

  it("returns false (no write) for non-input/textarea elements", () => {
    const root = mount(`<select id="s"><option value="a">a</option></select>`);
    const el = root.querySelector("#s")!;
    expect(fillText(el, "a")).toBe(false);
  });

  it("is idempotent — filling the same value twice does not break the field", () => {
    const root = mount(`<input id="t" type="text" />`);
    const el = root.querySelector<HTMLInputElement>("#t")!;
    let changeCount = 0;
    el.addEventListener("change", () => changeCount++);
    expect(fillText(el, "same")).toBe(true);
    expect(fillText(el, "same")).toBe(true);
    expect(el.value).toBe("same");
    expect(changeCount).toBe(2); // both calls dispatch; value stays correct
  });
});

describe("fillDatePassword", () => {
  it("formats ISO YYYY-MM-DD to MM/DD/YYYY", () => {
    const root = mount(`<input id="dob" type="password" />`);
    const el = root.querySelector<HTMLInputElement>("#dob")!;
    expect(fillDatePassword(el, "1985-03-12")).toBe(true);
    expect(el.value).toBe("03/12/1985");
  });

  it("formats ISO datetimes (drops the time component)", () => {
    const root = mount(`<input id="dob" type="password" />`);
    const el = root.querySelector<HTMLInputElement>("#dob")!;
    expect(fillDatePassword(el, "2000-12-31T00:00:00Z")).toBe(true);
    expect(el.value).toBe("12/31/2000");
  });

  it("passes through an already-MM/DD/YYYY value (idempotent)", () => {
    const root = mount(`<input id="dob" type="password" />`);
    const el = root.querySelector<HTMLInputElement>("#dob")!;
    expect(fillDatePassword(el, "03/12/1985")).toBe(true);
    expect(el.value).toBe("03/12/1985");
  });

  it("returns false for non-input elements", () => {
    const root = mount(`<div id="d"></div>`);
    expect(fillDatePassword(root.querySelector("#d")!, "1985-03-12")).toBe(false);
  });
});

describe("formatDateForPortal (unit)", () => {
  it("reformats ISO dates", () => {
    expect(formatDateForPortal("1990-01-02")).toBe("01/02/1990");
  });
  it("passes non-ISO through unchanged", () => {
    expect(formatDateForPortal("01/02/1990")).toBe("01/02/1990");
    expect(formatDateForPortal("not a date")).toBe("not a date");
  });
});

// ===========================================================================
// fillSelect
// ===========================================================================

describe("fillSelect", () => {
  it("selects an existing option and returns true", () => {
    const root = mount(`
      <select id="state">
        <option value="CA">California</option>
        <option value="MA">Massachusetts</option>
      </select>
    `);
    const el = root.querySelector<HTMLSelectElement>("#state")!;
    expect(fillSelect(el, "CA")).toBe(true);
    expect(el.value).toBe("CA");
  });

  it("returns false (and leaves the value) when the option does not exist", () => {
    const root = mount(`
      <select id="state">
        <option value="CA">California</option>
      </select>
    `);
    const el = root.querySelector<HTMLSelectElement>("#state")!;
    expect(fillSelect(el, "NY")).toBe(false);
    expect(el.value).toBe("CA"); // unchanged — first option remains selected
  });

  it("dispatches change and drives React state for selects", () => {
    const root = mount(`
      <select id="county">
        <option value="01">Alameda</option>
        <option value="34">Sacramento</option>
      </select>
    `);
    const el = root.querySelector<HTMLSelectElement>("#county")!;
    installReactValueTracker(el);
    let reactState = "";
    el.addEventListener("change", () => {
      if (reactWouldFireOnChange(el)) reactState = el.value;
    });
    expect(fillSelect(el, "34")).toBe(true);
    expect(reactState).toBe("34");
  });

  it("returns false for non-select elements", () => {
    const root = mount(`<input id="t" type="text" />`);
    expect(fillSelect(root.querySelector("#t")!, "CA")).toBe(false);
  });

  it("is idempotent — selecting the same option twice keeps the value", () => {
    const root = mount(`
      <select id="state"><option value="CA">California</option></select>
    `);
    const el = root.querySelector<HTMLSelectElement>("#state")!;
    expect(fillSelect(el, "CA")).toBe(true);
    expect(fillSelect(el, "CA")).toBe(true);
    expect(el.value).toBe("CA");
  });
});

// ===========================================================================
// fillRadio
// ===========================================================================

describe("fillRadio", () => {
  it("clicks the resolved radio when unchecked and returns true", () => {
    const root = mount(`
      <input type="radio" name="g" id="yes" value="yes" />
      <input type="radio" name="g" id="no" value="no" />
    `);
    const yes = root.querySelector<HTMLInputElement>("#yes")!;
    expect(yes.checked).toBe(false);
    expect(fillRadio(yes)).toBe(true);
    expect(yes.checked).toBe(true);
  });

  it("is idempotent — an already-checked radio is left checked, no extra click", () => {
    const root = mount(`<input type="radio" name="g" id="yes" value="yes" />`);
    const yes = root.querySelector<HTMLInputElement>("#yes")!;
    let clicks = 0;
    yes.addEventListener("click", () => clicks++);
    expect(fillRadio(yes)).toBe(true);
    expect(fillRadio(yes)).toBe(true); // already checked
    expect(yes.checked).toBe(true);
    expect(clicks).toBe(1); // only the first call actually clicked
  });

  it("respects an optional value gate (matches content.ts writeRadio)", () => {
    const root = mount(`<input type="radio" name="g" id="yes" value="yes" />`);
    const yes = root.querySelector<HTMLInputElement>("#yes")!;
    expect(fillRadio(yes, "no")).toBe(false); // value mismatch → no click
    expect(yes.checked).toBe(false);
    expect(fillRadio(yes, "yes")).toBe(true); // value match → click
    expect(yes.checked).toBe(true);
  });

  it("returns false for non-radio elements", () => {
    const root = mount(`<input type="checkbox" id="c" />`);
    expect(fillRadio(root.querySelector("#c")!)).toBe(false);
  });
});

// ===========================================================================
// fillCheckbox
// ===========================================================================

describe("fillCheckbox", () => {
  it("clicks to check an unchecked box", () => {
    const root = mount(`<input type="checkbox" id="c" />`);
    const cb = root.querySelector<HTMLInputElement>("#c")!;
    expect(cb.checked).toBe(false);
    expect(fillCheckbox(cb, true)).toBe(true);
    expect(cb.checked).toBe(true);
  });

  it("clicks to uncheck a checked box", () => {
    const root = mount(`<input type="checkbox" id="c" checked />`);
    const cb = root.querySelector<HTMLInputElement>("#c")!;
    expect(cb.checked).toBe(true);
    expect(fillCheckbox(cb, false)).toBe(true);
    expect(cb.checked).toBe(false);
  });

  it("is idempotent — no click when already in the desired state", () => {
    const root = mount(`<input type="checkbox" id="c" />`);
    const cb = root.querySelector<HTMLInputElement>("#c")!;
    let clicks = 0;
    cb.addEventListener("click", () => clicks++);
    expect(fillCheckbox(cb, false)).toBe(true); // already unchecked
    expect(clicks).toBe(0);
    expect(fillCheckbox(cb, true)).toBe(true); // flips
    expect(fillCheckbox(cb, true)).toBe(true); // already checked now
    expect(clicks).toBe(1);
    expect(cb.checked).toBe(true);
  });

  it("returns false for non-checkbox elements (incl. radios)", () => {
    const root = mount(`<input type="radio" id="r" />`);
    expect(fillCheckbox(root.querySelector("#r")!, true)).toBe(false);
  });
});

// ===========================================================================
// coerceBoolean
// ===========================================================================

describe("coerceBoolean", () => {
  it("passes booleans through", () => {
    expect(coerceBoolean(true)).toBe(true);
    expect(coerceBoolean(false)).toBe(false);
  });
  it("treats true/yes/1 strings (any case) as true", () => {
    expect(coerceBoolean("true")).toBe(true);
    expect(coerceBoolean("YES")).toBe(true);
    expect(coerceBoolean(" 1 ")).toBe(true);
    expect(coerceBoolean("no")).toBe(false);
    expect(coerceBoolean("")).toBe(false);
  });
  it("treats non-zero numbers as true", () => {
    expect(coerceBoolean(1)).toBe(true);
    expect(coerceBoolean(0)).toBe(false);
  });
  it("treats null/undefined/objects as false", () => {
    expect(coerceBoolean(null)).toBe(false);
    expect(coerceBoolean(undefined)).toBe(false);
    expect(coerceBoolean({})).toBe(false);
  });
});

// ===========================================================================
// fillElement — the FieldType dispatcher
// ===========================================================================

describe("fillElement — dispatch by FieldType", () => {
  it('"text" fills an input', () => {
    const root = mount(`<input id="t" type="text" />`);
    expect(fillElement(root.querySelector("#t")!, "text", "abc")).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#t")!.value).toBe("abc");
  });

  it('"date-password" formats to MM/DD/YYYY', () => {
    const root = mount(`<input id="dob" type="password" />`);
    expect(fillElement(root.querySelector("#dob")!, "date-password", "1985-03-12")).toBe(
      true,
    );
    expect(root.querySelector<HTMLInputElement>("#dob")!.value).toBe("03/12/1985");
  });

  it('"select" picks an existing option, false when missing', () => {
    const root = mount(`
      <select id="s"><option value="CA">California</option></select>
    `);
    const el = root.querySelector("#s")!;
    expect(fillElement(el, "select", "CA")).toBe(true);
    expect(fillElement(el, "select", "NY")).toBe(false);
  });

  it('"radio" clicks the matching radio by value', () => {
    const root = mount(`<input type="radio" name="g" id="yes" value="yes" />`);
    const el = root.querySelector<HTMLInputElement>("#yes")!;
    expect(fillElement(el, "radio", "yes")).toBe(true);
    expect(el.checked).toBe(true);
  });

  it('"checkbox" toggles via a coerced boolean value', () => {
    const root = mount(`<input type="checkbox" id="c" />`);
    const el = root.querySelector<HTMLInputElement>("#c")!;
    expect(fillElement(el, "checkbox", "yes")).toBe(true);
    expect(el.checked).toBe(true);
    // "false"-ish value unchecks it.
    expect(fillElement(el, "checkbox", "")).toBe(true);
    expect(el.checked).toBe(false);
  });

  it('"button" is never a fill target (returns false)', () => {
    const root = mount(`<button id="b">Next</button>`);
    expect(fillElement(root.querySelector("#b")!, "button", "Next")).toBe(false);
  });

  it("returns false when the element type mismatches the kind", () => {
    const root = mount(`<input id="t" type="text" />`);
    // Asking to "select" a plain input → wrong element type → false.
    expect(fillElement(root.querySelector("#t")!, "select", "CA")).toBe(false);
  });
});
