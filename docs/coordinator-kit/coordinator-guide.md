# Coordinator guide: getting started with the Civica navigator dashboard

Welcome. This guide gets you from zero to functional in under 15 minutes. Read it once end-to-end, then keep it open in a second tab while you log in.

## What Civica is

Civica is a CalFresh enrollment platform built for California Community College and CSU students. It is an iOS-native app for students plus a web dashboard for navigators and campus partners. Civica operates as a community-based organization (CBO) under BenefitsCal CBO Manager credentials — meaning Civica's credentialed navigators submit applications on the student's behalf through the official county portal.

## Your role as coordinator

You are the warm referral. You meet students at the basic needs center, the food pantry, financial aid, or a class visit, and you hand them the path into the app. After that, you can watch their progress in your dashboard, and step in if they get stuck.

You are **not** a substitute for a credentialed navigator. You don't review packets, request documents from the student, or submit to BenefitsCal — Civica's navigator team does that. Your job is to refer, monitor, and unstick.

## How students get the app

Until the App Store launch, the only distribution channel is TestFlight (Apple's beta program).

- TestFlight invite link: `[TestFlight link — Matthew to provide]`
- You receive 50 invite slots to start. Ask Matthew for more when you run out.
- Students need an iPhone running iOS 17 or newer. An Android version is on the roadmap but not available yet.

When you hand a student the [student-overview](./student-overview.md) one-pager, the TestFlight link on that page is the same one above.

## Dashboard login walkthrough

1. Open `https://civica-dashboard.vercel.app/cbo-preview` in any browser.
2. Sign in with the credentials Matthew sent you separately. For staging practice, you can also use `cbo@civica.test` / `civica`. Production credentials are different and arrive in a separate email.
3. You'll land on the **CBO preview** page. The header reads "Civica · CBO preview" with a "Read-only" badge in the top-right.

If you see a 404 or get redirected to the login page repeatedly, your account role hasn't been provisioned yet — email Matthew.

## What you can do in the dashboard

The CBO preview page is **read-only**. You can see:

- **Impact at a glance** — three KPI cards showing applications per navigator per month, current error rate, and average time to handoff for your cohort.
- **Enrollment funnel** — a 5-step view of the cohort moving from Intake → Screened → Draft complete → Navigator review → Handoff. Counts and conversion percentages update as students progress.
- **Value props panel** — context you can share with campus leadership.

You **cannot** edit packets, change a student's status, upload documents on their behalf, or submit to BenefitsCal. Those are credentialed-navigator actions and are intentionally gated.

## How to refer a student

1. Hand the student the [student-overview](./student-overview.md) one-pager — printed, AirDropped, or as a PDF in a text message. All three work.
2. They install TestFlight using the link on the page, then open the Civica app.
3. The first screen in the app asks: *"Did your campus refer you?"* — they pick your campus from the dropdown. That attribution is what makes them show up in your dashboard.
4. Within ~2 minutes, that lead appears in your CBO preview funnel under **Intake**.

If you'd rather not print, just text them the TestFlight link and walk them through the campus-picker question — that's the only step that ties the lead to your dashboard.

## What happens after they apply

```
Student answers ~10 questions (10 min)
        ↓
Packet enters Navigator review queue
        ↓
Civica navigator requests any missing docs via the app
        ↓
Navigator submits to BenefitsCal CBO Manager portal
        ↓
County issues approval / denial (7 days expedited, 30 days standard)
        ↓
Student receives notice; status updates in your dashboard
```

You can watch each step move in the funnel. The transition from **Navigator review** to **Handoff** means the application has been filed with the county.

## When to escalate

- **Student stuck for >7 days** in any one funnel stage: email Matthew at `[escalation email — Matthew to provide]` with the student's first name and the stage they're stuck in. Do not share full identifying information by email.
- **Student denied and wants to appeal:** the app has a built-in procedural appeal flow. Your job is to make sure they upload the denial letter when the app asks — that's the document the navigator team needs to file the appeal on their behalf.
- **App crash, can't log in, or any technical issue:** screenshot it, email Matthew.

## Manual fallback SOP — BenefitsCal submission

When Civica's automated submission path is unavailable (county portal outage, credential lapse, automation break), the navigator team falls back to manual submission. **This is a navigator task, not a coordinator task** — included here so you understand what's happening if a student's status sits in "Navigator review" longer than usual.

The manual path:

1. Navigator opens the packet view in the dashboard and exports the packet as a PDF.
2. Navigator logs into the BenefitsCal CBO Manager portal manually using the credentials Matthew maintains.
3. Navigator creates a new application in the portal under the student's record.
4. Navigator attaches the exported PDF and uploads any supporting documents from the packet (ID, pay stubs, enrollment proof).
5. Navigator marks the packet status as `Handed Off (manual)` in the dashboard so the funnel reflects the submission.

If you see "Handed Off (manual)" on a student's status, that means this fallback path was used — the application is still in front of the county, just filed by hand rather than via the API.

## Quick reference

| Need | Where |
|---|---|
| Student-facing handout | `docs/coordinator-kit/student-overview.md` |
| Dashboard | `https://civica-dashboard.vercel.app/cbo-preview` |
| TestFlight invite | `[TestFlight link — Matthew to provide]` |
| Escalation | `[escalation email — Matthew to provide]` |
| Staging practice login | `cbo@civica.test` / `civica` |
