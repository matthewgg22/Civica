# Proposal: training Demeter on user conversations

**Date:** 2026-08-27
**Status:** PROPOSAL. Not shipped, not adopted, and not legal advice.
**For:** the counsel review already tracked in #1013, #1022 and #928.

The owner intends to train models on user conversations. This memo sets out
what that requires, because it is not one edit. Three documents and one live
production job currently say or do the opposite, and they have to move
together or the package contradicts itself.

Written so counsel can rule on it, not so it can be pasted in.

---

## 1. What the product says today

| where | text |
|---|---|
| Privacy, "The short version" | "We do not use your conversations to train AI models." |
| Terms §5 | "This license does not permit us to train AI models on your conversations, to sell what you type, or to share it for advertising. **We do not do any of those things.**" |
| Privacy, retention | "Deleted automatically: the text of questions and answers in our accuracy record, after **7 days**… flagged rows kept **30 days**." |

Terms §1 makes the Privacy Policy part of the Terms, so these are one
instrument. Deleting the promise from one half does not create the right in
the other: **Terms §5 affirmatively withholds it.** Training while §5 stands
would breach our own agreement with the user, which is a worse position than
having no clause at all.

## 2. The blocker nobody has costed: there is no corpus

Verified in production, 2026-08-27:

```
snap_enrollment.mae_query_log
  rows total ................. 13
  tombstoned ................. 12
  still holding text .......... 1   (inside its 30-day flagged window)
  overdue beyond any window ... 0
```

`purge_mae_query_log_retention()` runs daily at 04:10 UTC and does not delete
rows — it **tombstones** them, setting `question_redacted` to
`'[expired per retention policy]'` and `answer` to null. Retention is working
exactly as promised.

Which means the constraint on training is not primarily the promises. **It is
that the data does not exist.** Question and answer text lives 7 days, then is
destroyed. Any training plan needs one of:

- **(i) train on a rolling 7-day window** — no policy change to retention, but
  a very small and non-reproducible corpus, and each sweep is unrecoverable;
- **(ii) extend retention** — which changes the retention table users are shown,
  the `RETENTION_DAYS` constants, and the purge function; or
- **(iii) collect a separate, consented training set** — opt-in, stored apart
  from the accuracy record, under its own retention.

(iii) is the only one that does not weaken a promise the product currently
keeps. It is also the most work.

## 3. The aggravating fact

`redactPii` strips structured identifiers and **deliberately does not attempt
names** — the Privacy Policy says so, because a filter that guessed would
mangle real questions. So the candidate training data is:

- unstructured free text, **not name-redacted**, from
- people describing household composition, income and sometimes immigration
  status, in order to
- work out whether they qualify for food assistance.

That is the fact pattern regulators are most attentive to at the moment. It is
very likely workable with the right notice-and-consent structure. It is not
workable by deleting a sentence, and the order of operations matters: consent
has to exist **before** the data is collected for that purpose, not after.

## 4. What would have to change, together

1. **Terms §5** — the license grant. Today it enumerates three permitted
   purposes and excludes training. Training must become a stated purpose, or
   sit under a separate opt-in licence.
2. **Privacy, "The short version"** — the promise must go or become accurate.
   Silence is not neutral here: it is a conspicuous deletion from a list the
   page itself calls "the ones that matter most".
3. **Privacy, retention** — if option (ii), the stated windows and the purge
   function change together. The function's own comment says
   *"Keep in step with RETENTION_DAYS in apps/web/lib/legal/types.ts"* and a
   test enforces the claim.
4. **The consent moment** — Terms §1 says agreement happens when someone sends
   a message or creates an account. Whether that is sufficient consent for
   training is the question counsel should answer first, because it determines
   whether 1–3 are even the right shape.

## 5. Draft language, for review only

**Not adopted.** Offered so counsel has something concrete to correct.

> **Privacy, replacing the current promise**
>
> We use questions and answers to improve Demeter, including to train and
> evaluate the models that write the answers. We do this with the filtered
> record described below, never with anything you have asked us to delete.
> We do not sell what you type, and we do not share it for advertising.

> **Terms §5, replacing the third bullet and the closing sentence**
>
> To improve Demeter, including training and evaluating the models that write
> answers, using the filtered record described in the Privacy Policy.
>
> This license does not permit us to sell what you type or to share it for
> advertising. We do not do either of those things.

## 6. What is already corrected, separately

The immigration paragraph in "The short version" said *"we do not store your
name or your status, and the chat is anonymous by design."* That contradicted
this same document's own statement that the filter does not remove names, and
it has been corrected — see the PR that adds this memo. It is not part of the
training question and did not wait for it.

## 7. Recommendation

Do not ship 1–3 ahead of §4. The sequence that fails is editing the documents
first and discovering afterwards that the consent basis does not support them,
because by then the collection has happened under the new text.
