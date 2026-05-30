# BenefitsCal — affirmative-path detail forms + explainers (operator-pasted)

Captured 2026-05-29 from operator paste (WAF workaround). These are the **detail sub-forms revealed on affirmative answers** + their explainers — the pages the scripted "answer-and-advance" walk blew past. They populate the **Household Details (step 3)** and **Other Situations (step 6)** sections (both were `status: discovered` shells) and confirm the inferred disability / college / military branch points.

---

## ABLPR — "What's your preferred language?" (full, 3 sub-questions)
- "What language do you prefer to read?" → select (default English)
- "What language do you prefer to speak?" → select (default English)
- "In what language would you like to complete this application?" → select (default English)
- **Explainer "Need Language Help?"** → "Your county office can provide an interpreter for you at no cost."

---

## DISABILITY / MEDICAL branch (affirmative paths)

### Medical facility / nursing home
"Are you in a medical facility or nursing home?" Yes / No → (Yes) text: **Facility/Nursing Home Name**.

### Activities of daily living (ADL / personal care)
"Do you need help with activities of daily living through personal assistance or a medical facility?" Yes / No → (Yes) textarea **"Please explain."** (255 chars).

### Disability duration
"How long is the disability expected to last?" → **30 Days or More** / **12 Months or More**.

### Dependent care (work/school enabler)
"Do you need care so that someone else can work or attend school?" Yes / No.

### IRWE — Impairment-Related Work Expenses
"Do you work and have medical expenses that are needed to help you keep working?
Such as: A wheelchair / Leg braces. If you are not working, click 'Next' to continue." Yes / No → (Yes) textarea **"Please explain."**

---

## STUDENT / EDUCATION branch (affirmative paths) — HIGH VALUE explainers

### "Where are you studying?" (school detail form)
- **School Name** (text)
- **Enrollment Status** — select (-Select One-)
- **Currently Enrolled Number of Units** — select (-Select One-)
- "Are you working while going to school?" Yes / No

### "Do any of the student situations below apply to you?" (CalFresh student eligibility — checklist)
Intro: "CalFresh has special eligibility considerations for college students."
Explainer link: **"How is student eligibility considered for CalFresh?"**
"Select all that apply." Options (checklist):
- Approved for Work Study (even if the job is not assigned or hasn't started yet)
- Aren't planning to be enrolled in school next term
- Getting a TANF-funded Cal Grant A or B
- Taking non-credit courses or are taking Adult Education courses
- Participating in a student employment training program

Inline sub-text under the last option: "A few examples of these are: Local Programs that Increase Employability (LPIE) / Workforce Innovation and Opportunity Act (WIOA) / Campus Employment Programs / Research and Teaching Assistant Programs / On-the-job training programs / CalFresh Employment and Training. View the CalFresh Student Eligibility: List of Approved LPIEs to see if your program is already approved."

**Explainer "What are student employment training programs?"** → "These are programs open to students that focus on building skills for work. Examples of programs include: Academic Programs: GED or High School Equivalent / English as a second language / Career & Technical Education (CTE) / Required Internships / Apprenticeships or Pre-Apprenticeships. Campus Jobs: Research / Teaching Assistant / Campus Employment Program. There are many programs that may qualify. If you're not sure, check the box above and discuss it with your caseworker."

**Explainer "What do LPIE, WIOA, and CalFresh Employment and Training mean?"** → "These programs are all student employment training programs. Local Programs that Increase Employability (LPIE) are campus programs approved by the state. This includes certain majors, minors, or certificates that help students build job skills. Workforce Innovation and Opportunity Act (WIOA) is a federal program that helps people learn job skills and find work. This includes Vocational Rehabilitation. CalFresh Employment and Training is a CalFresh program that helps people learn, get ready for work, find jobs, and keep jobs."

---

## MILITARY branch (affirmative path)
"What is your military status?" → **Active Duty** / **Veteran** / **Dependent**.
"What are the dates of service? (if applicable)" → From MM/DD/YYYY · To MM/DD/YYYY.
"Did you get an honorable discharge?" Yes / No.

---

## FACILITY / SHELTER living arrangement
"What facility, shelter, or other living arrangement do you live in?" → **Facility/Shelter/Living Arrangement Name** (text) · **Expected date of release** MM/DD/YYYY.

---

## OTHER-SITUATIONS entry gates (feed the summary pages)

### Public Assistance (entry)
"Did you get public assistance in California?" Yes / No → (Yes) **County** select (58 CA counties, first option "Amador" — alphabetical, Alameda likely above; default unselected). Feeds the "Public Assistance" summary card below.

## Repeating SUMMARY pages (the "you added" list pattern)
Each declared situation/program shows a summary card with Edit / Remove:
- **Public Assistance** — "Below is the public assistance information that you added. Public Assistance / Test Applicant (36) / Edit / Remove"
- **Food program** — "Below is the food program information that you added. Meals on Wheels / Test Applicant (36) / Edit / Remove"

(Same Edit/Remove summary shape as the income (ABEIS/ABJIS) and expense (ABHEX) summary pages — confirms the repeating-row model across every "add another" section.)

---

## Consumer notes
- **iOS-audit (b):** the disability (ADL / IRWE / duration), student-eligibility checklist, and military-status questions are real state questions — check iOS parity. The CalFresh student-eligibility checklist especially (work-study / TANF Cal Grant / training programs) is eligibility-critical and easy to miss.
- **Chatbot (c):** the 3 student-eligibility explainers + IRWE "wheelchair/leg braces" framing are high-value grounding.
- **Branch confirmation:** these are the detail sub-forms behind the inferred Household-Details / Other-Situations branch points (disability/college/military) in form-tree.json — now real, not inferred.
