# Civica brand voice

Source of truth for copy. Every user-facing string in the app, every
SMS, every email, every error message gets weighed against this doc.
Lifted from the canvas `VoiceBoard` so contributors don't have to
read the design surface to write a line.

> **Plain. Specific. Adult. Never sunny, never sorry, never
> bureaucratic.**

---

## Six rules

1. **Name the moment.** "Your application is with Massachusetts DTA"
   beats "We're processing it." Vagueness reads as evasion.
2. **Name the next action.** Every screen, every text, every email
   says what to do next — or explicitly says nothing is needed.
   Never leave a user wondering what they're supposed to do.
3. **Name the time horizon.** "Usually about 7 days" beats "soon."
   "We'll text within an hour" beats "we'll be in touch."
4. **Use the user's words, not the agency's.** SNAP in Massachusetts
   (not "food stamps"). "Pay stub" not "wage verification." "Rent"
   not "shelter expense."
5. **No exclamation points. No emoji.** One exception: a single
   middot ` · ` for typographic rhythm, never decorative.
6. **If we made the mistake, we own it.** "Our system, not yours."
   Never "An error occurred." Never blame the user for our bugs.

---

## Words we don't use

`recipient`, `beneficiary`, `client` (in user-facing copy),
`eligible household`, `congrats`, `oops`, `whoops`, `we're sorry`,
`unfortunately`, `simply`, `just`, `easy`, `a moment`, `rest
assured`, `kindly`.

The reason: they're either bureaucratic ("recipient"), saccharine
("congrats"), evasive ("unfortunately"), or condescending
("simply"). Every one of them makes the writer look smaller than
the moment deserves.

---

## How we name money

Always with the dollar sign. Always tabular-nums (handled by
`CivicaMoney`). Never as a teaser ("you may be eligible for $X"
before submission). Always with a denominator the user understands —
`$291/mo`, `$1.99/meal`, `$3,492/yr`. Never raw `$291`.

---

## Voice in 9 moments — paired examples

For each, the canvas board's "Not this" / "This" pair.

### Welcome

- **Not this:** "Welcome to Civica! 🎉 We're so excited you're here."
- **This:** "We help you apply for SNAP. Free. About 4 minutes."

### Form prompt

- **Not this:** "Please indicate the gross monthly income for all
  household members."
- **This:** "How much did you earn last month? Before taxes."

### Validation

- **Not this:** "Error: invalid input. Please try again."
- **This:** "That's more than a typical month — want to double-check,
  or use a 3-month average?"

### Submitted

- **Not this:** "Success! Your application has been received. We'll
  be in touch soon."
- **This:** "Sent to Massachusetts DTA. Decision usually in about 7
  days. We'll text when there's news."

### Document needed

- **Not this:** "Action required: Additional documentation
  requested."
- **This:** "The state needs one more thing — a recent pay stub.
  By Oct 23 keeps things moving."

### Approved

- **Not this:** "Congratulations! You've been approved for SNAP
  benefits."
- **This:** "Approved. $291/mo, starting this month."

### Denied

- **Not this:** "Unfortunately, your application has been denied at
  this time."
- **This:** "The state said no. We think this should be appealed.
  Here's why."

### Our error

- **Not this:** "An unexpected error occurred. Please try again
  later."
- **This:** "Our system, not yours. Your application is safe; we're
  trying every minute."

### Recertification

- **Not this:** "Reminder: Annual recertification required."
- **This:** "You'll need to recertify on May 4. Usually 4 minutes —
  mostly 'is this still right?'"

---

## How to use this doc

When writing a new string anywhere in the app:

1. Read the six rules above.
2. Find the closest "9 moments" pair. Use it as a template for
   pacing and tone.
3. Avoid the do-not-use word list.
4. If money appears, route it through `CivicaMoney`.
5. Run the result through the rules-of-thumb checklist below.

### Rules-of-thumb checklist (before merging copy)

- [ ] Does the string name the moment? (What is happening, in
      plain language.)
- [ ] Does it name the next action? (Or explicitly say none is
      needed.)
- [ ] Does it name a time horizon? (When the user can expect the
      next beat.)
- [ ] Does it use the user's words, not the agency's?
- [ ] Are there exclamation points or emoji? (If yes: remove.)
- [ ] If something failed: does the string own it on Civica's
      side, not blame the user?
- [ ] Money strings: has it gone through `CivicaMoney`?

If a string fails any of these, rewrite — don't ship it.

---

## When in doubt

The canvas spec calls this voice **"never sunny, never sorry, never
bureaucratic."** Sunniness reads as marketing. Sorriness reads as
weakness. Bureaucratic reads as the system the user is trying to
escape. Civica is the friend who actually knows how the form works
and tells you what's true — including when "I don't know" is the
honest answer.
