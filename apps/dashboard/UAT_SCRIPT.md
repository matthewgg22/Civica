# Navigator UAT Script — Civica Dashboard

**Version:** 1.0  
**Audience:** Navigator UAT participants  
**Env:** Staging (`https://dashboard.staging.civica.app` — substitute your actual URL)  
**Prerequisites:** A navigator account provisioned by the UAT coordinator. At least one test applicant packet in "Submitted for Review" status, seeded by the coordinator.

---

## Before You Start

1. Open the dashboard in an incognito/private window.
2. Log in with the credentials the UAT coordinator gave you.
3. Keep this script open alongside the app — work through each scenario in order.
4. After each scenario, use the **Send UAT Feedback** button in the page footer to log any issues, confusion, or suggestions before moving to the next step.

---

## Scenario 1 — Receive a Packet

**Goal:** Confirm a newly submitted packet appears in the queue and can be opened.

1. Click **Queue** in the top navigation.
2. Verify the test packet (applicant name given by coordinator) appears with status **Submitted for Review**.
3. Click the packet row to open the detail page.
4. Confirm the header shows: applicant name (or masked ID), status pill, and submitted date.
5. Scroll to the **Lifecycle** strip — confirm it shows a single "Submitted for Review" event.

**Pass criteria:** Packet opens without error; all header fields are populated.

---

## Scenario 2 — Review Applicant Answers

**Goal:** Read through the applicant's self-reported answers and flag any that need follow-up.

1. Scroll to the **Application Answers** section on the packet detail page.
2. Review each question–answer pair.
3. If any answer looks incomplete or inconsistent, note the question key (shown in small text) — you'll use it in the feedback form.
4. Scroll to **Extracted Fields** (if documents were pre-uploaded by coordinator). Confirm auto-extracted values match the answers where applicable.
5. If any extraction field is flagged **Needs Review**, click **Review →** next to the field. Enter the confirmed value in the text box (pre-filled from the OCR or applicant correction column), add an optional note, then click **Confirm**.

**Pass criteria:** All answers are visible; extraction fields can be marked reviewed without page reload errors.

---

## Scenario 3 — Upload a Missing Document on Behalf of an Applicant

**Goal:** Simulate a navigator uploading a document the applicant couldn't attach themselves.

1. Scroll to the **Required Documents** section.
2. Confirm at least one item shows as outstanding / not yet resolved (coordinator pre-configured this).
3. Click **Upload on behalf** next to the missing item.
4. Select the test file provided by the coordinator (`test_paystub.pdf`) from the file picker that opens.
5. Wait for the upload to complete — the item should disappear from the Outstanding list and appear in the Cleared list as **resolved**.
6. Refresh the page and confirm the uploaded document persists in both the checklist and the **Uploaded Documents** section.

**Pass criteria:** File uploads without error; checklist item moves to resolved state; document appears in the document list after refresh.

---

## Scenario 4 — Resolve a Missing-Item Request

**Goal:** Mark the uploaded document as satisfying the open missing-item request so the packet can progress.

1. Scroll to the **Missing-Item Requests** section (below Required Documents).
2. Confirm the open request created by the coordinator is visible (e.g., "Proof of income required").
3. If the request shows status **uploaded** (the applicant already uploaded something), click **Mark resolved** next to it. If it still shows **pending**, click **Cancel** to close it (both actions mark the request resolved).
4. The request status should update to **resolved** in the list.
5. Refresh the page and verify the request still shows as resolved.

**Pass criteria:** Request resolves without error; resolved state persists on refresh; no other requests are accidentally closed.

---

## Scenario 5 — Advance to Ready for Handoff

**Goal:** Verify the status transition guard works correctly and advance the packet.

**5a — Preflight check (blocker validation)**

1. From the packet detail page, click the status dropdown or **Advance Status** button.
2. Attempt to select **Ready for Handoff**.
3. If there are any unresolved required document items or unreviewed extraction fields, the system should block the transition and list the blockers. Confirm the blocker list is accurate.
4. Resolve any remaining blockers flagged by the system (mark fields reviewed, upload/resolve documents as needed).

**5b — Advance status**

5. Once no blockers remain, select **Ready for Handoff** and confirm.
6. Verify the status pill on the packet header changes to **Ready for Handoff**.
7. Scroll to the Lifecycle strip — confirm a new event row appears for this transition, attributed to your navigator account.

**Pass criteria:** Blocked transition shows a meaningful error; clean transition succeeds; lifecycle strip reflects the event.

---

## Scenario 6 — Export JSON + PDF

**Goal:** Confirm both export formats download correctly and contain the expected data.

1. With the packet on **Ready for Handoff**, locate the **Handoff Panel** (bottom of packet detail page).
2. Click **Export JSON**.
   - Confirm a `.json` file downloads.
   - Open it and verify it contains `packet_id`, `applicant`, `answers`, `documents`, and `status`.
3. Click **Export PDF** (or **Download Handoff PDF**).
   - Confirm a `.pdf` file downloads.
   - Open it and verify it shows applicant name (or masked ID), status, answers summary, and document list.

**Pass criteria:** Both files download within 10 seconds; JSON is valid and parseable; PDF is human-readable.

---

## Scenario 7 — Verify Downloads

**Goal:** Cross-check the downloaded exports against what the screen showed.

1. Compare the `status` field in the JSON export against the status pill you saw in Scenario 5b — they should match.
2. Compare the answers in the PDF against the answers you reviewed in Scenario 2 — all questions should be present.
3. Confirm the PDF does **not** contain any raw ciphertext or garbled text where applicant names should appear.
4. Note any discrepancy in the feedback form.

**Pass criteria:** JSON and PDF are internally consistent with the UI; no encoding artifacts.

---

## After All Scenarios

1. Click **Send UAT Feedback** in the page footer.
2. Write a brief overall summary: what worked well, what felt confusing, any bugs you hit.
3. Submit.
4. Notify the UAT coordinator that you've completed the script.

---

## Quick Reference — Status Flow

```
Draft → Submitted for Review → In Navigator Review
      → Needs Documents / Needs Applicant Clarification (blockers)
      → Ready for Handoff → Handed Off → Closed
```

## Common Issues

| Symptom | First thing to check |
|---|---|
| Packet not visible in queue | Status filter — make sure "Submitted for Review" is included |
| Upload fails immediately | File size > 10 MB or unsupported type (only PDF/JPG/PNG accepted) |
| "Ready for Handoff" blocked | Open missing-item requests or unreviewed extraction fields |
| PDF download is blank | Try a hard-refresh (Cmd+Shift+R / Ctrl+Shift+R) and retry |
| Can't sign in | Confirm you're using incognito; contact UAT coordinator for a fresh magic link |
