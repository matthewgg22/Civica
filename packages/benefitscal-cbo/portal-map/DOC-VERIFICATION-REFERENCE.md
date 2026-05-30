# BenefitsCal — Documents for Verification (verbatim reference)

Source: `https://benefitscal.com/Help/documents-verification/DOC?lang=en` (the "Not sure what to upload? Let's look at some examples" link on **APDMC** step-7 doc upload). Captured 2026-05-29.

Page intro: "This page has many examples of documents that may be acceptable. This isn't a full list. If you need any help, ask your caseworker."

This is the canonical "what to upload / why" content for **use-case (c) chatbot** and the **APDMC** node. Each category maps to an upload **document type** (the dropdown the assister picks on APDMC).

| # | Category | Maps to document type | Acceptable documents (examples) |
|---|----------|----------------------|---------------------------------|
| 1 | **Bank Accounts** | Assets/Resources-Related **or** Income/Employment-Related | Full bank statement; Bank website/app webpage screenshot |
| 2 | **Childcare** | Expenses | Childcare receipt/statement incl. Amount, Date paid, Name(s) of person(s) care was for, Signature of provider + date |
| 3 | **US Citizenship** | Citizenship/Immigration-Related | Birth certificate; Passport; Baptismal certificate (with date + place of birth); Statement of witness to birth; Certificate of naturalization; Certificate of citizenship number for derived citizens; Any proof of U.S. citizenship |
| 4 | **Disability** | Medical/Disability **or** Income/Employment-Related | Benefits Award Letter (Disability, SSI, SSP, etc.); Doctor's note; Hospital records; Employer statement or termination notice; Proof of Worker's Compensation |
| 5 | **Income** | Income/Employment-Related | Pay stubs for the last 30 days; Statement from your employer; Copy of last year's tax return; Child support/Alimony; Award letters (Unemployment, Veterans, Social Security, etc.); Statement from college financial aid office |
| 6 | **Immigration** | Citizenship/Immigration-Related | Immigration papers/forms/cards (copy of both sides); Other USCIS proof — Work authorization, Letter of decision, Court order on your case. Note: verified through SAVE (Systematic Alien Verification for Entitlement) |
| 7 | **Immunization** | Medical/Disability | Statement that immunizations are against your beliefs; Statement from parent/caretaker relative explaining why you can't get immunizations; Statement from doctor that records are not available; Copy of shot record; Statement from doctor that immunizations are not in the best interest of the child's health |
| 8 | **Medical** | Medical/Disability | Medical bills, receipts, or itemized statements; Medical transportation bills or receipts; Health or dental insurance policies or premiums; Medicare card (for Medi-Cal only) |
| 9 | **Proof of Identification** | Identity Proof | Passport; Driver's License or Real ID; School ID; Military ID; Social security card; Proof of application (if no SSN exists) |
| 10 | **Resources** | Assets/Resources-Related | Property tax bill(s); Payments from settlements (lawsuits, insurance claims); Most recent retirement account statement(s); Life insurance policy, stocks, bonds, IRAs; Property deed; Statement of joint ownership; Burial plots/crypts |
| 11 | **School Information** | Student Verification's [sic] | Report card; Class schedule or syllabus; Registration schedule or fees; Financial aid; College/university enrollment; Written statement; Attendance records; Certificate of completion or diploma |
| 12 | **Vehicle Registration** | Assets/Resources-Related | Motor Vehicle registration certificate |
| 13 | **Utilities or Household Expenses** | Expenses **or** Address Proof | Rental agreement; Bill or other document(s) with name and address; Rent or mortgage receipt; Utility bill |
| 14 | **Welfare to Work or Travel Claims** | Welfare to Work | County/State forms; County mileage claim forms; Employer contacts (Job Search); Work schedule/timecard; WEX (work experience) documents; Supportive service requests |

Footer CTAs: "Ready to upload documents? **LOG IN TO UPLOAD** / **UPLOAD WITHOUT ACCOUNT**".

## Notes for consumers
- **APDMC autofill:** still N/A (file inputs); but this table lets the extension/chatbot tell the assister *which document type to pick* for a given uploaded file.
- **iOS-audit (b):** the SNAP-only flow surfaces 6 of these on APDMC (Identity Proof, Release of Information ABCDM228, Income/Employment, Rent/Lease/Mortgage, Expenses, Address Proof). The other categories appear when the corresponding situation is declared.
- **Disability / Immigration / Immunization** categories confirm branches that exist deeper in the form (Household-category disability, ABDOC=No immigration sub-flow) — corroborates the inferred branch points.
