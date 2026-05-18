# Civica Spanish Copy — Native Reviewer Packet

**Prepared:** 2026-05-18  
**Branch:** `claude/spanish-reviewer-packet`  
**For:** Native Spanish reviewer (do not distribute)  
**Prepared by:** Engineering — Matthew Greer-Gentis

---

## Reviewer Brief

### Audience

California SNAP applicants. California has the largest Spanish-speaking SNAP-eligible population in the US, with significant Mexican and Central American communities. **Default to neutral Latin American Spanish** unless a phrase has clear regional meaning that differs across communities (flag those cases in your notes).

### Formality register

**Use `usted` throughout — never `tú`.** Government benefit applications call for formal register. All current Spanish copy uses `tú`; correcting this to `usted` is an expected outcome of this review pass.

> **Engineering note:** The current strings use `tú` forms (`tú`, `tu`, `te`, `inténtalo`, etc.). The reviewer should correct all informal forms to `usted` equivalents (`usted`, `su`, `le`, `inténtelo`, etc.) where applicable. This will touch most strings — that is expected and correct.

### Technical terms to keep in English

Keep these terms in English regardless of surrounding language:

- **SNAP** — the federal program name; also appears on the EBT card itself
- **CalFresh** — California's SNAP brand name; California applicants know this term
- **DTA** — Massachusetts Department of Transitional Assistance (appears in MA-specific copy)
- **EBT** — Electronic Benefits Transfer; appears on the physical card
- **BenefitsCal** — California's application portal name
- **MA DTA Connect** — Massachusetts portal name
- **WIC** — Women, Infants, and Children program
- **HIP** — Healthy Incentives Program (Massachusetts)
- **BBCE** — Broad-Based Categorical Eligibility (regulatory term)
- **CCPA** — California Consumer Privacy Act (legal term)
- **PIN** — Personal Identification Number

### Banned phrases

The following phrases are **forbidden** in any SNAP user-facing string. They come from `SNAPComplianceCopyRegistry.bannedPhrases`. If you see a Spanish translation that would translate back to one of these English phrases, flag it.

| ID | Phrase | Audit Ref | Rationale |
|----|--------|-----------|-----------|
| `submit_to_dta` | "Submit to DTA Connect" | Q14 | Implies a Civica→DTA write integration that does not exist without written MA DTA authorization. The approved form is "Open MA DTA Connect to submit." |
| `submit_to_benefitscal` | "Submit to BenefitsCal" | Q14 (CA launch parallel) | Implies a Civica→BenefitsCal/CDSS write integration that does not exist without written authorization from CDSS or the user's county welfare department. The approved form is "Open BenefitsCal to submit." |

### How to submit corrections

Return **one markdown file** with this format for every change:

```
## <surface>/<key>
- was: <current Spanish — verbatim>
- now: <revised Spanish>
- reason: <short note — formality, accuracy, regional preference, etc.>
```

**Surface codes:**

| Surface | Meaning |
|---------|---------|
| `web` | `web/messages/es.json` key |
| `ios/SNAPLaunchSurfaces` | `SNAPLaunchSurfacesStrings.swift` |
| `ios/FindHelp` | `FindHelpStrings.swift` |
| `ios/Estimator` | `SNAPBenefitEstimatorStrings.swift` |
| `ios/InterviewCoach` | `InterviewCoachStrings.swift` |
| `ios/QuestionChrome` | `CivicaQuestionStrings.swift` |
| `ios/EBTBalance` | `EBTBalanceStrings.swift` |
| `ios/StatusHome` | `SNAPStatusHomeStrings.swift` |
| `ios/DecisionMath` | `SNAPDecisionMathStrings.swift` |
| `ios/Recovery` | `SNAPRecoveryStrings.swift` |

**Example:**

```
## web/common.continue
- was: Continuar
- now: Continuar
- reason: OK as-is

## web/auth.sendMagicLink
- was: Enviar enlace mágico
- now: Enviar enlace de acceso
- reason: "Enlace mágico" is informal marketing language; neutral "enlace de acceso" is clearer for usted-register copy
```

Engineering parses the corrections file and applies them in a single PR titled **"Apply Spanish reviewer corrections"**.

---

## Section A — Web copy (`web/messages/es.json`)

**Total keys in this branch: 123**  
*(The spec anticipated 139; the difference is 16 keys not yet present in this branch — likely a pending merge. Engineering will schedule a follow-up review pass for those additions.)*

**Placeholder format for reviewer notes:** `_____`

---

### A.1 `common` (12 keys)

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `common.disclaimer` | Civica helps you prepare your SNAP application packet. We do not determine eligibility or approve benefits. | Civica te ayuda a preparar tu paquete de solicitud de SNAP. No determinamos elegibilidad ni aprobamos beneficios. | _____ |
| `common.continue` | Continue | Continuar | _____ |
| `common.back` | Back | Atrás | _____ |
| `common.save` | Save | Guardar | _____ |
| `common.cancel` | Cancel | Cancelar | _____ |
| `common.loading` | Loading… | Cargando… | _____ |
| `common.error` | Something went wrong. Please try again. | Algo salió mal. Por favor, inténtalo de nuevo. | _____ |
| `common.savedOffline` | Saved offline — will sync when reconnected | Guardado sin conexión — se sincronizará al reconectarse | _____ |
| `common.signOut` | Sign out | Cerrar sesión | _____ |
| `common.loadError` | Unable to load your application. Please try again. | No se pudo cargar tu solicitud. Por favor, inténtalo de nuevo. | _____ |
| `common.tryAgain` | Try again | Intentar de nuevo | _____ |
| `common.processing` | Processing… | Procesando… | _____ |

---

### A.2 `auth` (12 keys)

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `auth.signIn` | Sign in | Iniciar sesión | _____ |
| `auth.signUp` | Create account | Crear cuenta | _____ |
| `auth.email` | Email address | Correo electrónico | _____ |
| `auth.emailPlaceholder` | you@example.com | tu@ejemplo.com | _____ |
| `auth.sendMagicLink` | Send magic link | Enviar enlace mágico | _____ |
| `auth.magicLinkSent` | Check your email — we sent you a sign-in link. | Revisa tu correo — te enviamos un enlace para iniciar sesión. | _____ |
| `auth.phone` | Phone number | Número de teléfono | _____ |
| `auth.sendOtp` | Send code | Enviar código | _____ |
| `auth.otpCode` | Enter your code | Ingresa tu código | _____ |
| `auth.verifyOtp` | Verify | Verificar | _____ |
| `auth.orUsePhone` | Or sign in with phone | O inicia sesión con teléfono | _____ |
| `auth.orUseEmail` | Or sign in with email | O inicia sesión con correo | _____ |

---

### A.3 `onboarding` (6 keys)

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `onboarding.selectState` | Which state do you live in? | ¿En qué estado vives? | _____ |
| `onboarding.stateCA` | California | California | _____ |
| `onboarding.stateMA` | Massachusetts | Massachusetts | _____ |
| `onboarding.selectLanguage` | Choose your language | Elige tu idioma | _____ |
| `onboarding.languageEn` | English | English | _____ |
| `onboarding.languageEs` | Español | Español | _____ |

---

### A.4 `questions` (13 keys)

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `questions.sectionHousehold` | Household | Hogar | _____ |
| `questions.sectionIncome` | Income | Ingresos | _____ |
| `questions.sectionExpenses` | Expenses | Gastos | _____ |
| `questions.sectionHousing` | Housing | Vivienda | _____ |
| `questions.sectionIdentity` | Identity | Identidad | _____ |
| `questions.sectionResidency` | Residency | Residencia | _____ |
| `questions.progress` | {completed} of {total} completed | {completed} de {total} completados | _____ |
| `questions.autoSaved` | Saved | Guardado | _____ |
| `questions.saving` | Saving… | Guardando… | _____ |
| `questions.distressTitle` | Before you continue | Antes de continuar | _____ |
| `questions.distressBody` | This question asks about financial or housing stress. If you or your household are in crisis, local resources may be able to help immediately. | Esta pregunta trata sobre estrés financiero o de vivienda. Si tú o tu hogar están en crisis, los recursos locales pueden ayudar de inmediato. | _____ |
| `questions.distressContinue` | Continue to question | Continuar a la pregunta | _____ |
| `questions.distressResources` | See local resources first | Ver recursos locales primero | _____ |

---

### A.5 `documents` (18 keys)

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `documents.title` | Documents | Documentos | _____ |
| `documents.statusNotStarted` | Not Started | No iniciado | _____ |
| `documents.statusUploaded` | Uploaded | Subido | _____ |
| `documents.statusNeedsReview` | Needs Review | Necesita revisión | _____ |
| `documents.statusAccepted` | Accepted for Packet | Aceptado para el paquete | _____ |
| `documents.statusInsufficient` | Insufficient | Insuficiente | _____ |
| `documents.statusMissing` | Missing | Faltante | _____ |
| `documents.statusOptional` | Optional | Opcional | _____ |
| `documents.statusNA` | N/A | N/A | _____ |
| `documents.upload` | Upload | Subir | _____ |
| `documents.uploadAnother` | Upload another | Subir otro | _____ |
| `documents.required` | Required | Requerido | _____ |
| `documents.cameraCapture` | Take photo | Tomar foto | _____ |
| `documents.filePicker` | Choose file | Elegir archivo | _____ |
| `documents.uploadProgress` | Uploading… {percent}% | Subiendo… {percent}% | _____ |
| `documents.uploadSuccess` | Uploaded | Subido | _____ |
| `documents.uploadError` | Upload failed — please try again | Error al subir — por favor inténtalo de nuevo | _____ |
| `documents.progressLabel` | {uploaded} of {total} required documents uploaded | {uploaded} de {total} documentos requeridos subidos | _____ |

---

### A.6 `inbox` (6 keys)

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `inbox.title` | Requests from your navigator | Solicitudes de tu navegador | _____ |
| `inbox.empty` | No open requests | No hay solicitudes pendientes | _____ |
| `inbox.uploadResponse` | Upload your response | Sube tu respuesta | _____ |
| `inbox.markResolved` | Mark as resolved | Marcar como resuelto | _____ |
| `inbox.openSection` | Open ({count}) | Abiertos ({count}) | _____ |
| `inbox.resolvedSection` | Resolved ({count}) | Resueltos ({count}) | _____ |

---

### A.7 `packet` (21 keys)

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `packet.title` | Application status | Estado de la solicitud | _____ |
| `packet.statusDraft` | Draft | Borrador | _____ |
| `packet.statusSubmitted` | Submitted for Review | Enviado para revisión | _____ |
| `packet.statusNeedsDocuments` | Needs Documents | Necesita documentos | _____ |
| `packet.statusNeedsClarification` | Needs Applicant Clarification | Necesita aclaración del solicitante | _____ |
| `packet.statusInReview` | In Navigator Review | En revisión del navegador | _____ |
| `packet.statusReadyForHandoff` | Ready for Handoff | Listo para transferencia | _____ |
| `packet.statusHandedOff` | Handed Off | Transferido | _____ |
| `packet.statusClosed` | Closed | Cerrado | _____ |
| `packet.ctaUploadDocuments` | Upload missing documents | Subir documentos faltantes | _____ |
| `packet.ctaAnswerQuestions` | Answer questions | Responder preguntas | _____ |
| `packet.statusDescDraft` | Your application packet is in progress. Answer all questions and upload required documents when you're ready. | Tu paquete de solicitud está en progreso. Responde todas las preguntas y sube los documentos requeridos cuando estés listo. | _____ |
| `packet.statusDescSubmitted` | Your packet has been submitted. A navigator will review it soon. | Tu paquete ha sido enviado. Un navegador lo revisará pronto. | _____ |
| `packet.statusDescNeedsDocuments` | Your navigator needs additional documents. Please upload them to continue. | Tu navegador necesita documentos adicionales. Por favor súbelos para continuar. | _____ |
| `packet.statusDescNeedsClarification` | Your navigator has questions about your application. Check your inbox. | Tu navegador tiene preguntas sobre tu solicitud. Revisa tu bandeja de entrada. | _____ |
| `packet.statusDescInReview` | A navigator is reviewing your packet. No action needed from you right now. | Un navegador está revisando tu paquete. No se requiere ninguna acción tuya en este momento. | _____ |
| `packet.statusDescReadyForHandoff` | Your packet is ready to be submitted to the SNAP office. | Tu paquete está listo para ser enviado a la oficina de SNAP. | _____ |
| `packet.statusDescHandedOff` | Your packet has been submitted to the SNAP office on your behalf. | Tu paquete ha sido enviado a la oficina de SNAP en tu nombre. | _____ |
| `packet.statusDescClosed` | This application has been closed. | Esta solicitud ha sido cerrada. | _____ |
| `packet.lastUpdated` | Last updated {date} | Última actualización {date} | _____ |
| `packet.historyHeading` | History | Historial | _____ |

---

### A.8 `resources` (9 keys)

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `resources.title` | Local Resources | Recursos locales | _____ |
| `resources.intro` | If you or your household are experiencing a food or housing crisis, the following organizations may be able to help immediately. | Si tú o tu hogar están experimentando una crisis alimentaria o de vivienda, las siguientes organizaciones pueden ayudar de inmediato. | _____ |
| `resources.call211Title` | Call or Text 2-1-1 | Llama o escribe al 2-1-1 | _____ |
| `resources.call211Body` | Free, confidential referrals to local food, housing, and financial assistance programs. Available 24/7 in English and Spanish. | Referencias gratuitas y confidenciales a programas locales de alimentos, vivienda y asistencia financiera. Disponible las 24 horas, en inglés y español. | _____ |
| `resources.snapHotlineTitle` | SNAP Information | Información sobre SNAP | _____ |
| `resources.snapHotlineBody` | For questions about SNAP benefits, call your state's SNAP office. California: 1-877-847-3663. Massachusetts: 1-877-382-2363. | Para preguntas sobre los beneficios de SNAP, llama a la oficina de SNAP de tu estado. California: 1-877-847-3663. Massachusetts: 1-877-382-2363. | _____ |
| `resources.foodBankTitle` | Find a Food Bank | Encuentra un banco de alimentos | _____ |
| `resources.foodBankBody` | Feeding America's food bank locator can help you find free food near you at feedingamerica.org/find-your-local-foodbank. | El localizador de bancos de alimentos de Feeding America te ayuda a encontrar alimentos gratuitos cerca de ti en feedingamerica.org/find-your-local-foodbank. | _____ |
| `resources.backToApp` | Return to your application | Volver a tu solicitud | _____ |

---

### A.9 `consent` (9 keys)

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `consent.title` | Review and submit | Revisar y enviar | _____ |
| `consent.body` | By submitting, I authorize Civica to share my application packet with a SNAP navigator on my behalf. I understand that Civica does not determine my eligibility for SNAP benefits. I can withdraw this consent at any time before the packet is handed off. | Al enviar, autorizo a Civica a compartir mi paquete de solicitud con un navegador de SNAP en mi nombre. Entiendo que Civica no determina mi elegibilidad para los beneficios de SNAP. Puedo retirar este consentimiento en cualquier momento antes de que el paquete sea transferido. | _____ |
| `consent.checkboxLabel` | I have read and agree to the above | He leído y acepto lo anterior | _____ |
| `consent.signaturePlaceholder` | Type your full name | Escribe tu nombre completo | _____ |
| `consent.submit` | Submit for review | Enviar para revisión | _____ |
| `consent.withdraw` | Withdraw consent | Retirar consentimiento | _____ |
| `consent.withdrawConfirm` | Are you sure you want to withdraw? Your packet will return to Draft status. | ¿Estás seguro de que deseas retirar? Tu paquete volverá al estado de borrador. | _____ |
| `consent.blockerQuestions` | {answered} of {total} required questions answered — complete all questions before submitting. | {answered} de {total} preguntas requeridas respondidas — completa todas las preguntas antes de enviar. | _____ |
| `consent.blockerDocuments` | {uploaded} of {total} required documents uploaded — upload all required documents before submitting. | {uploaded} de {total} documentos requeridos cargados — sube todos los documentos requeridos antes de enviar. | _____ |

---

### A.10 `footer` (2 keys)

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `footer.privacy` | Privacy | Privacidad | _____ |
| `footer.doNotSell` | Do Not Sell or Share My Personal Information | No Vendas Ni Compartas Mi Información Personal | _____ |

---

### A.11 `privacy` (15 keys)

> **Note for reviewer:** These are the privacy policy strings. They contain legal language. Flag any issues with accuracy or formality but do not change the legal meaning without counsel review.

| Key | English (`en.json`) | Current Spanish | Reviewer notes |
|-----|--------------------|--------------------|----------------|
| `privacy.title` | Privacy Policy | Política de Privacidad | _____ |
| `privacy.effectiveDate` | Effective May 18, 2026. | Vigente desde el 18 de mayo de 2026. | _____ |
| `privacy.collectHeading` | What we collect | Qué recopilamos | _____ |
| `privacy.collectBody` | Civica collects only the information needed to prepare your SNAP application packet — household composition, income, expenses, contact details, and uploaded supporting documents. We do not collect biometric data, browsing history, or location beyond ZIP code. | Civica recopila solo la información necesaria para preparar tu paquete de solicitud de SNAP — composición del hogar, ingresos, gastos, datos de contacto y documentos justificativos cargados. No recopilamos datos biométricos, historial de navegación ni ubicación más allá del código postal. | _____ |
| `privacy.useHeading` | How we use it | Cómo la usamos | _____ |
| `privacy.useBody` | Information you enter is used to assemble your application packet and route it to a SNAP navigator at your request. We do not use your information for advertising, profiling, or any purpose unrelated to your SNAP application. | La información que ingresas se usa para armar tu paquete de solicitud y enviarlo a un navegador de SNAP cuando lo solicites. No usamos tu información para publicidad, perfilado ni ningún propósito ajeno a tu solicitud de SNAP. | _____ |
| `privacy.rightsHeading` | Your rights (Right to Know, Right to Delete) | Tus derechos (Derecho a saber, Derecho a eliminar) | _____ |
| `privacy.rightsBody` | Under the California Consumer Privacy Act (CCPA) and analogous laws in other states, you have the right to ask what information we hold about you and to request its deletion. We will respond within 45 days. | Bajo la Ley de Privacidad del Consumidor de California (CCPA) y leyes análogas en otros estados, tienes derecho a solicitar qué información tenemos sobre ti y pedir que la eliminemos. Responderemos en un plazo de 45 días. | _____ |
| `privacy.rightsContact` | To exercise these rights, email | Para ejercer estos derechos, envía un correo a | _____ |
| `privacy.doNotSellHeading` | Do Not Sell or Share My Personal Information | No Vendas Ni Compartas Mi Información Personal | _____ |
| `privacy.doNotSellBody` | Civica does not sell or share your personal information, as those terms are defined by the California Consumer Privacy Act (CCPA §1798.140). We do not exchange your data for monetary or other valuable consideration, and we do not share it for cross-context behavioral advertising. We disclose information to service providers (cloud hosting, error tracking, document processing) under written data processing addenda that prohibit secondary use. | Civica no vende ni comparte tu información personal, según las definiciones de la Ley de Privacidad del Consumidor de California (CCPA §1798.140). No intercambiamos tus datos por una contraprestación monetaria u otra contraprestación valiosa, y no los compartimos para publicidad comportamental entre contextos. Divulgamos información a proveedores de servicios (alojamiento en la nube, seguimiento de errores, procesamiento de documentos) bajo acuerdos escritos de procesamiento de datos que prohíben su uso secundario. | _____ |
| `privacy.doNotSellContact` | If you believe your data has been sold or shared in error, or to opt out of any future change to this policy, email | Si crees que tus datos se han vendido o compartido por error, o para excluirte de cualquier cambio futuro a esta política, envía un correo a | _____ |
| `privacy.childrenHeading` | Children under 13 | Menores de 13 años | _____ |
| `privacy.childrenBody` | Civica is designed for adults applying for SNAP benefits on behalf of a household. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided information to us, please contact us and we will delete it. | Civica está diseñada para adultos que solicitan beneficios de SNAP en nombre de un hogar. No recopilamos a sabiendas información personal de menores de 13 años. Si crees que un menor de 13 años nos ha proporcionado información, contáctanos y la eliminaremos. | _____ |
| `privacy.contactEmail` | privacy@civica.app | privacy@civica.app | _____ |

---

## Section B — iOS copy (Swift Strings files)

**Source directory:** `Civica/Features/SNAP/`  
**Total files: 9**  
**Pattern:** All strings use `CivicaText("English", es: "Spanish")` or `switch language { case .spanish: return "..." }` patterns.

> **Note for reviewer:** iOS copy is displayed in the Civica iOS app. Some strings contain `%@` or `\(variable)` Swift string interpolation placeholders — leave those tokens in place verbatim in your corrections.

---

### B.1 `SNAPLaunchSurfacesStrings.swift`

**File:** `Civica/Features/SNAP/SNAPLaunchSurfacesStrings.swift`

#### SNAPConfirmationStrings

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPConfirmationStrings.title` | Your SNAP draft is ready | Tu borrador de SNAP está listo | _____ |
| `SNAPConfirmationStrings.subtitle` | You can use this information to complete your official application through your state's benefits website. | Puedes usar esta información para completar tu solicitud oficial en el sitio web de beneficios de tu estado. | _____ |
| `SNAPConfirmationStrings.stateSelectedLabel` | State selected | Estado seleccionado | _____ |
| `SNAPConfirmationStrings.openOfficialSite` | Open official state SNAP website | Abrir el sitio oficial de SNAP del estado | _____ |
| `SNAPConfirmationStrings.officialLinkComingSoon` | Official state link coming soon. | Próximamente: enlace oficial del estado. | _____ |
| `SNAPConfirmationStrings.reviewDraftAgain` | Review my draft again | Revisar mi borrador de nuevo | _____ |
| `SNAPConfirmationStrings.doesNotSubmit` | This assistant does not submit your application. | Este asistente no envía tu solicitud. | _____ |
| `SNAPConfirmationStrings.notProvided` | Not provided | No proporcionado | _____ |

#### SNAPApplicationGeneratorStrings

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPApplicationGeneratorStrings.title` | Your application packet | Tu paquete de solicitud | _____ |
| `SNAPApplicationGeneratorStrings.subtitle` *(func — spanish case)* | Save or share the summary, then finish the official application in \<portal\>. | Guarda o comparte el resumen, luego completa la solicitud oficial en \<portal\>. | _____ |
| `SNAPApplicationGeneratorStrings.generating` | Putting your packet together… | Preparando tu paquete… | _____ |
| `SNAPApplicationGeneratorStrings.ready` | Your packet is ready. | Tu paquete está listo. | _____ |
| `SNAPApplicationGeneratorStrings.saveOrShare` | Save or share packet | Guardar o compartir paquete | _____ |
| `SNAPApplicationGeneratorStrings.tryAgain` | Try again | Intentar de nuevo | _____ |

#### SNAPEligibilityIntroStrings

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPEligibilityIntroStrings.whatIsSNAP` | What is SNAP? | ¿Qué es SNAP? | _____ |
| `SNAPEligibilityIntroStrings.snapDescription` | The Supplemental Nutrition Assistance Program (commonly referred to as SNAP) is a U.S. government program that helps low-income individuals and families buy food. | El Programa de Asistencia Nutricional Suplementaria (conocido como SNAP) es un programa del gobierno de EE. UU. que ayuda a personas y familias de bajos ingresos a comprar alimentos. | _____ |
| `SNAPEligibilityIntroStrings.ebtRow` | Monthly benefits are loaded onto an Electronic Benefits Transfer (EBT) card. | Los beneficios mensuales se cargan en una tarjeta de Transferencia Electrónica de Beneficios (EBT). | _____ |
| `SNAPEligibilityIntroStrings.cartRow` | The card works like a debit card at grocery stores and some farmers markets. | La tarjeta funciona como una tarjeta de débito en supermercados y algunos mercados de agricultores. | _____ |
| `SNAPEligibilityIntroStrings.foodRow` | SNAP can buy eligible food items to fruits, vegetables, meat, dairy, bread, and more. | SNAP puede comprar alimentos elegibles como frutas, verduras, carne, lácteos, pan y más. | _____ |
| `SNAPEligibilityIntroStrings.restrictionsRow` | SNAP cannot be used for alcohol, tobacco, or hot prepared meals. | SNAP no se puede usar para alcohol, tabaco ni comidas calientes preparadas. | _____ |
| `SNAPEligibilityIntroStrings.prepStatusTitle` | SNAP prep status | Estado de preparación de SNAP | _____ |
| `SNAPEligibilityIntroStrings.statusLabel` | Status: | Estado: | _____ |
| `SNAPEligibilityIntroStrings.prepCompleted` | Prep checklist completed | Lista de preparación completada | _____ |
| `SNAPEligibilityIntroStrings.dateLabel` | Date: | Fecha: | _____ |
| `SNAPEligibilityIntroStrings.openNextSteps` | Open next steps | Abrir próximos pasos | _____ |
| `SNAPEligibilityIntroStrings.prepareApplication` | Prepare my SNAP application | Preparar mi solicitud de SNAP | _____ |
| `SNAPEligibilityIntroStrings.questionnaireTitle` | SNAP Application | Solicitud de SNAP | _____ |

#### SNAPReviewStrings

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPReviewStrings.title` | Review your SNAP draft | Revisa tu borrador de SNAP | _____ |
| `SNAPReviewStrings.reviewBeforeSubmitting` | Review this before using it to complete your official state application. | Revisa esto antes de usarlo para completar tu solicitud oficial del estado. | _____ |
| `SNAPReviewStrings.showNextSteps` | Show next steps | Mostrar próximos pasos | _____ |
| `SNAPReviewStrings.edit` | Edit | Editar | _____ |
| `SNAPReviewStrings.yes` | Yes | Sí | _____ |
| `SNAPReviewStrings.no` | No | No | _____ |
| `SNAPReviewStrings.notProvided` | Not provided | No proporcionado | _____ |
| `SNAPReviewStrings.notApplicable` | Not applicable | No aplica | _____ |
| `SNAPReviewStrings.nothingChecked` | Nothing checked yet | Aún no marcaste nada | _____ |
| `SNAPReviewStrings.householdSection` | Household | Hogar | _____ |
| `SNAPReviewStrings.locationSection` | Location | Ubicación | _____ |
| `SNAPReviewStrings.studentSection` | Student status | Estado de estudiante | _____ |
| `SNAPReviewStrings.incomeSection` | Income | Ingresos | _____ |
| `SNAPReviewStrings.expensesSection` | Expenses | Gastos | _____ |
| `SNAPReviewStrings.documentsSection` | Documents checklist | Lista de documentos | _____ |
| `SNAPReviewStrings.householdSize` | Household size | Tamaño del hogar | _____ |
| `SNAPReviewStrings.applicantAge` | Applicant age | Edad del solicitante | _____ |
| `SNAPReviewStrings.housingStatus` | Housing status | Estado de vivienda | _____ |
| `SNAPReviewStrings.stateLabel` | State | Estado | _____ |
| `SNAPReviewStrings.zipCode` | ZIP code | Código postal | _____ |
| `SNAPReviewStrings.inHigherEducation` | In higher education | En educación superior | _____ |
| `SNAPReviewStrings.halfTimeEnrolled` | Enrolled half-time | Inscrito medio tiempo | _____ |
| `SNAPReviewStrings.works20Hours` | Works 20+ hours/week | Trabaja 20+ horas/semana | _____ |
| `SNAPReviewStrings.workStudy` | Participates in work-study | Participa en trabajo-estudio | _____ |
| `SNAPReviewStrings.dependentChild` | Responsible for dependent child | Responsable de un hijo dependiente | _____ |
| `SNAPReviewStrings.employmentStatus` | Employment status | Situación laboral | _____ |
| `SNAPReviewStrings.monthlyIncome` | Monthly income estimate | Ingreso mensual estimado | _____ |
| `SNAPReviewStrings.incomeChanges` | Income changes month to month | El ingreso cambia mes a mes | _____ |
| `SNAPReviewStrings.rentOrHousing` | Rent or housing | Renta o vivienda | _____ |
| `SNAPReviewStrings.utilities` | Utilities | Servicios públicos | _____ |
| `SNAPReviewStrings.childcareOptional` | Childcare (optional) | Cuidado infantil (opcional) | _____ |
| `SNAPReviewStrings.medicalOptional` | Medical (optional estimate) | Médico (estimado opcional) | _____ |
| `SNAPReviewStrings.itemsChecked` | Items checked | Elementos marcados | _____ |

#### SNAPDocumentConfirmationStrings

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPDocumentConfirmationStrings.title` | Does this look right? | ¿Se ve correcto? | _____ |
| `SNAPDocumentConfirmationStrings.subtitle` | We read these from your photo. Tap 'Fix something' if anything is off. | Leímos esto de tu foto. Toca 'Corregir algo' si hay algo incorrecto. | _____ |
| `SNAPDocumentConfirmationStrings.stoppedReading` | Thanks — we'll keep it on file. We'll only read paystubs in detail for now. | Gracias — lo guardaremos. Por ahora solo leemos comprobantes de pago en detalle. | _____ |
| `SNAPDocumentConfirmationStrings.deductionsHeading` | Deductions | Deducciones | _____ |
| `SNAPDocumentConfirmationStrings.doubleCheckHeading` | A few things to double-check: | Algunas cosas para verificar: | _____ |
| `SNAPDocumentConfirmationStrings.fixSomething` | Fix something | Corregir algo | _____ |
| `SNAPDocumentConfirmationStrings.looksRight` | Looks right | Se ve bien | _____ |
| `SNAPDocumentConfirmationStrings.employerLabel` | Employer | Empleador | _____ |
| `SNAPDocumentConfirmationStrings.payPeriodLabel` | Pay period | Período de pago | _____ |
| `SNAPDocumentConfirmationStrings.payDateLabel` | Pay date | Fecha de pago | _____ |
| `SNAPDocumentConfirmationStrings.grossPayLabel` | Gross pay (this period) | Pago bruto (este período) | _____ |
| `SNAPDocumentConfirmationStrings.netPayLabel` | Net pay (this period) | Pago neto (este período) | _____ |
| `SNAPDocumentConfirmationStrings.hoursWorkedLabel` | Hours worked | Horas trabajadas | _____ |
| `SNAPDocumentConfirmationStrings.hourlyRateLabel` | Hourly rate | Tarifa por hora | _____ |
| `SNAPDocumentConfirmationStrings.hourlyRateSuffix` | /hr | /hora | _____ |
| `SNAPDocumentConfirmationStrings.grossYearToDateLabel` | Gross year-to-date | Bruto en lo que va del año | _____ |
| `SNAPDocumentConfirmationStrings.documentTypeAcknowledgement` *(func — spanish case)* | We saw a \<document type\>. | Vimos un \<document type\>. | _____ |

#### SNAPConversationViewStrings

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPConversationViewStrings.thinking` | Thinking… | Pensando… | _____ |
| `SNAPConversationViewStrings.youllNeed` | You'll need: | Necesitarás: | _____ |
| `SNAPConversationViewStrings.seeTheMath` | See the math | Ver el cálculo | _____ |
| `SNAPConversationViewStrings.retry` | Retry | Reintentar | _____ |
| `SNAPConversationViewStrings.screenerTitle` | SNAP Eligibility Screener | Evaluador de elegibilidad de SNAP | _____ |
| `SNAPConversationViewStrings.close` | Close | Cerrar | _____ |

#### SNAPPrivacyNoticeNavStrings

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPPrivacyNoticeNavStrings.continueToPrep` | Continue to SNAP prep | Continuar a preparación de SNAP | _____ |
| `SNAPPrivacyNoticeNavStrings.goToOfficial` | Go to official application | Ir a la solicitud oficial | _____ |
| `SNAPPrivacyNoticeNavStrings.goBack` | Go back | Volver | _____ |
| `SNAPPrivacyNoticeNavStrings.checkWhatYouNeed` | Check what you may need | Revisa lo que podrías necesitar | _____ |

#### SNAPApplicationWalkthroughStrings

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPApplicationWalkthroughStrings.submitTo` *(func — spanish case)* | Submit to \<agency\> | Enviar a \<agency\> | _____ |
| `SNAPApplicationWalkthroughStrings.openPortalTitle` *(func — spanish case)* | Open \<portal\> | Abrir \<portal\> | _____ |
| `SNAPApplicationWalkthroughStrings.openPortalDetail` *(func — spanish case)* | Go to \<shortURL\> on your phone or computer. | Ve a \<shortURL\> en tu teléfono o computadora. | _____ |
| `SNAPApplicationWalkthroughStrings.applyForSNAP` | Apply for SNAP | Solicitar SNAP | _____ |
| `SNAPApplicationWalkthroughStrings.applyForSNAPDetail` *(func — spanish case)* | Tap Apply for SNAP and create or sign into your \<portal\> account. | Toca Solicitar SNAP y crea o inicia sesión en tu cuenta de \<portal\>. | _____ |
| `SNAPApplicationWalkthroughStrings.useYourPacket` | Use your packet as a reference | Usa tu paquete como referencia | _____ |
| `SNAPApplicationWalkthroughStrings.useYourPacketDetail` *(func — spanish case)* | Answer the official application's questions using the summary you just saved. Upload the documents listed on the last page when \<agency\> asks for them. | Responde las preguntas de la solicitud oficial usando el resumen que acabas de guardar. Sube los documentos de la última página cuando \<agency\> los pida. | _____ |
| `SNAPApplicationWalkthroughStrings.footnote` *(func — spanish case)* | Need help? Most \<agency\> offices have community navigators who can walk you through the application in person. | ¿Necesitas ayuda? La mayoría de las oficinas de \<agency\> tienen navegadores comunitarios que pueden ayudarte con la solicitud en persona. | _____ |

#### SNAPGenericStrings

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPGenericStrings.close` | Close | Cerrar | _____ |
| `SNAPGenericStrings.back` | Back | Volver | _____ |
| `SNAPGenericStrings.searchThisArea` | Search this area | Buscar en esta área | _____ |

---

### B.2 `FindHelp/FindHelpStrings.swift`

**File:** `Civica/Features/SNAP/FindHelp/FindHelpStrings.swift`

#### Permission explainer

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `FindHelpStrings.permissionEyebrow` | Find help nearby | Encuentra ayuda cerca de ti | _____ |
| `FindHelpStrings.permissionTitle` | Show me places within walking distance. | Muéstrame lugares a distancia caminable. | _____ |
| `FindHelpStrings.permissionBody` | Civica will ask iOS for your location next. Before that, here's exactly what we do and don't do with it. | Civica le pedirá tu ubicación a iOS a continuación. Antes de eso, aquí está exactamente qué hacemos y qué no hacemos con ella. | _____ |
| `FindHelpStrings.permissionDoEyebrow` | What we do | Qué hacemos | _____ |
| `FindHelpStrings.permissionDoBody` | Pull a list of nearby places, show them on a map, and sort by distance. | Buscamos lugares cercanos, los mostramos en un mapa y los ordenamos por distancia. | _____ |
| `FindHelpStrings.permissionDontEyebrow` | What we don't do | Qué no hacemos | _____ |
| `FindHelpStrings.permissionDontBody` | Track you over time. Share your location with Massachusetts DTA. Use it for ads. | Rastrearte con el tiempo. Compartir tu ubicación con el DTA de Massachusetts. Usarla para anuncios. | _____ |
| `FindHelpStrings.permissionWithoutSharing` | You can use the map without sharing — type a zip code instead. | Puedes usar el mapa sin compartir tu ubicación — ingresa un código postal en su lugar. | _____ |
| `FindHelpStrings.permissionShareCTA` | Share my location | Compartir mi ubicación | _____ |
| `FindHelpStrings.permissionZipCTA` | Use a zip code instead | Usar un código postal | _____ |

#### Detail sheet

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `FindHelpStrings.detailEyebrow` | Place details | Detalles del lugar | _____ |
| `FindHelpStrings.detailReportIncorrect` | Report incorrect info | Informar de un error | _____ |
| `FindHelpStrings.detailLabelAddress` | Address | Dirección | _____ |
| `FindHelpStrings.detailLabelPhone` | Phone | Teléfono | _____ |
| `FindHelpStrings.detailLabelHours` | Hours | Horario | _____ |
| `FindHelpStrings.detailLabelLanguagesServed` | Languages served | Idiomas ofrecidos | _____ |
| `FindHelpStrings.detailLabelNotes` | Notes | Notas | _____ |
| `FindHelpStrings.detailLastUpdatedPrefix` | Last updated: | Última actualización: | _____ |
| `FindHelpStrings.detailDoneButton` | Done | Listo | _____ |

#### Weekday labels *(func — spanish cases)*

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `FindHelpStrings.weekdayLabel("mon")` | Monday | Lunes | _____ |
| `FindHelpStrings.weekdayLabel("tue")` | Tuesday | Martes | _____ |
| `FindHelpStrings.weekdayLabel("wed")` | Wednesday | Miércoles | _____ |
| `FindHelpStrings.weekdayLabel("thu")` | Thursday | Jueves | _____ |
| `FindHelpStrings.weekdayLabel("fri")` | Friday | Viernes | _____ |
| `FindHelpStrings.weekdayLabel("sat")` | Saturday | Sábado | _____ |
| `FindHelpStrings.weekdayLabel("sun")` | Sunday | Domingo | _____ |

#### Loading state

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `FindHelpStrings.loadingEyebrow` | About 2 seconds | Unos 2 segundos | _____ |
| `FindHelpStrings.loadingTitle` | Reading the local directory and food bank list… | Consultando el directorio local y la lista de bancos de alimentos… | _____ |

#### Empty state

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `FindHelpStrings.emptyTitle` | Nothing within %@ miles. | Nada dentro de %@ millas. | _____ |
| `FindHelpStrings.emptyBody` | Rural areas often need a wider radius. We can also help you over the phone — that works anywhere. | Las áreas rurales suelen necesitar un radio más amplio. También podemos ayudarte por teléfono — eso funciona en cualquier lugar. | _____ |
| `FindHelpStrings.emptyExpandCTA` | Search 25 miles | Buscar a 25 millas | _____ |
| `FindHelpStrings.emptyHumanLineLabel` | Talk to someone | Habla con alguien | _____ |

#### Transport error state

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `FindHelpStrings.transportErrorTitle` | We can't reach the directory right now. | Ahora mismo no podemos consultar el directorio. | _____ |
| `FindHelpStrings.transportErrorBody` | Check your connection and try again, or use a zip code instead. The phone line below works without internet. | Revisa tu conexión e inténtalo de nuevo, o usa un código postal. La línea telefónica funciona sin internet. | _____ |
| `FindHelpStrings.transportErrorRetryCTA` | Try again | Reintentar | _____ |

#### Eligibility chips

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `FindHelpStrings.chipEbt` | EBT accepted | Acepta EBT | _____ |
| `FindHelpStrings.chipWic` | WIC accepted | Acepta WIC | _____ |
| `FindHelpStrings.chipHip` | HIP matched | Bonificación HIP | _____ |

#### Retailer pill labels

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `FindHelpStrings.pillSupermarket` | GROCERY | MERCADO | _____ |
| `FindHelpStrings.pillSmallGrocer` | LOCAL GROCER | TIENDA LOCAL | _____ |
| `FindHelpStrings.pillFarmersMarket` | FARMERS MARKET | MERCADO AGRÍCOLA | _____ |
| `FindHelpStrings.pillCoOp` | CO-OP | COOPERATIVA | _____ |
| `FindHelpStrings.pillRestaurantRMP` | MEALS PROGRAM | COMIDAS RMP | _____ |

#### Layer toggle

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `FindHelpStrings.layerFindHelp` | Find help | Buscar ayuda | _____ |
| `FindHelpStrings.layerSpend` | Spend EBT | Gastar EBT | _____ |
| `FindHelpStrings.layerBoth` | Both | Ambos | _____ |
| `FindHelpStrings.layerFindHelpSubtitle` | SNAP offices, food pantries & application help | Oficinas SNAP, despensas y ayuda para solicitar | _____ |
| `FindHelpStrings.layerSpendSubtitle` | Stores & markets that accept your EBT card | Tiendas y mercados que aceptan tu tarjeta EBT | _____ |
| `FindHelpStrings.layerBothSubtitle` | Apply for benefits and find places to use them | Solicita beneficios y encuentra dónde usarlos | _____ |

---

### B.3 `Estimator/SNAPBenefitEstimatorStrings.swift`

**File:** `Civica/Features/SNAP/Estimator/SNAPBenefitEstimatorStrings.swift`

#### Header & questions

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPBenefitEstimatorStrings.pageTitle` | Estimate SNAP Benefit | Estima beneficio de SNAP | _____ |
| `SNAPBenefitEstimatorStrings.householdSizeQuestion` | How many people are in your household? | ¿Cuántas personas hay en tu hogar? | _____ |
| `SNAPBenefitEstimatorStrings.householdSizeHelper` | Count everyone you buy and prepare food with. | Cuenta a todos los que compran y preparan comida contigo. | _____ |
| `SNAPBenefitEstimatorStrings.householdDecreaseLabel` | Remove a person from household | Quitar una persona del hogar | _____ |
| `SNAPBenefitEstimatorStrings.householdIncreaseLabel` | Add a person to household | Agregar una persona al hogar | _____ |
| `SNAPBenefitEstimatorStrings.elderlyOrDisabledQuestion` | Anyone 60+ or disabled? | ¿Alguien con 60+ o discapacidad? | _____ |
| `SNAPBenefitEstimatorStrings.elderlyOrDisabledHelper` | Unlocks extra SNAP deductions, including uncapped shelter costs. | Habilita deducciones adicionales de SNAP, incluyendo gastos de vivienda sin tope. | _____ |
| `SNAPBenefitEstimatorStrings.incomeQuestion` | Monthly household income before tax | Ingreso mensual del hogar antes de impuestos | _____ |
| `SNAPBenefitEstimatorStrings.incomeHelper` | All paychecks, gig work, unemployment, Social Security, and child support combined. | Todos los cheques, trabajo por encargo, desempleo, Seguro Social y manutención de niños sumados. | _____ |
| `SNAPBenefitEstimatorStrings.rentQuestion` | Monthly rent or mortgage | Renta o hipoteca mensual | _____ |
| `SNAPBenefitEstimatorStrings.rentHelper` | Use what you actually pay each month — your share if you split. | Usa lo que realmente pagas cada mes — tu parte si lo compartes. | _____ |
| `SNAPBenefitEstimatorStrings.utilitiesQuestion` | Pay utilities separately? | ¿Pagas servicios aparte? | _____ |
| `SNAPBenefitEstimatorStrings.utilitiesHelper` | Heat, electricity, water, gas — even just one counts. | Calefacción, electricidad, agua, gas — incluso solo uno cuenta. | _____ |

#### Yes/No toggle

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPBenefitEstimatorStrings.toggleYes` | Yes | Sí | _____ |
| `SNAPBenefitEstimatorStrings.toggleNo` | No | No | _____ |

#### Result card

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPBenefitEstimatorStrings.resultEyebrow` | Estimated monthly benefit | Beneficio mensual estimado | _____ |
| `SNAPBenefitEstimatorStrings.resultAnnualLabel` | About | Unos | _____ |
| `SNAPBenefitEstimatorStrings.resultAnnualSuffix` | a year | al año | _____ |
| `SNAPBenefitEstimatorStrings.resultContextEligible` *(func — spanish case)* | This is an estimate — \<agency\> reviews your full application and confirms the amount. | Esto es una estimación — \<agency\> revisa tu solicitud completa y confirma el monto. | _____ |
| `SNAPBenefitEstimatorStrings.resultContextMinBenefit` *(func — spanish case)* | Under federal law, most 1–2 person households receive at least $24/month if approved. \<agency\> confirms your exact amount. | Bajo la ley federal, la mayoría de los hogares de 1 a 2 personas reciben al menos $24/mes si son aprobados. \<agency\> confirma tu monto exacto. | _____ |

#### Ineligible copy

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPBenefitEstimatorStrings.ineligibleHeadline` | Above the estimated SNAP limit | Por encima del límite estimado de SNAP | _____ |
| `SNAPBenefitEstimatorStrings.ineligibleContextGrossOver` | Your income looks higher than the federal SNAP cutoff for your household size. | Tus ingresos parecen más altos que el límite federal de SNAP para el tamaño de tu hogar. | _____ |
| `SNAPBenefitEstimatorStrings.ineligibleContextNetOver` | After SNAP deductions, your net income is still above the SNAP cutoff. | Después de las deducciones de SNAP, tu ingreso neto aún supera el límite. | _____ |
| `SNAPBenefitEstimatorStrings.ineligibleContextBelowMin` | Based on these numbers, the formula produces no benefit. Adjusting rent or income can change this. | Con estos números la fórmula no produce beneficio. Cambiar la renta o el ingreso puede modificarlo. | _____ |
| `SNAPBenefitEstimatorStrings.bbceSoftNote` | Many states use Broad-Based Categorical Eligibility (BBCE) with higher income limits — it may still be worth applying. | Muchos estados usan Elegibilidad Categórica Amplia (BBCE) con límites de ingresos más altos — aún puede valer la pena aplicar. | _____ |

#### CTAs

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPBenefitEstimatorStrings.applyCTA` | Apply for SNAP | Aplicar para SNAP | _____ |
| `SNAPBenefitEstimatorStrings.seeTheMathLink` | See how we calculated this | Ver cómo lo calculamos | _____ |

#### Entry card

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPBenefitEstimatorStrings.entryCardTitle` | Estimate your benefit | Estima tu beneficio | _____ |
| `SNAPBenefitEstimatorStrings.entryCardSubtitle` | Five questions. See your monthly dollar amount before you apply. | Cinco preguntas. Ve tu monto mensual antes de aplicar. | _____ |

#### Footer

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPBenefitEstimatorStrings.disclaimerFooter` | This is Civica's estimate. Your state agency makes the final decision. | Esta es la estimación de Civica. Tu agencia estatal toma la decisión final. | _____ |
| `SNAPBenefitEstimatorStrings.closeLabel` | Close | Cerrar | _____ |

---

### B.4 `InterviewCoach/InterviewCoachStrings.swift`

**File:** `Civica/Features/SNAP/InterviewCoach/InterviewCoachStrings.swift`

> **Context:** Interview Coach question prompts and "How to answer" guidance are English-only by design (pending a separate legal review). The strings in this file are UI chrome only. An inline notice (`englishOnlyNotice`) already informs Spanish users of this limitation.

#### Entry hub

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `InterviewCoachStrings.entryTitle` | Practice your SNAP interview | Practica tu entrevista de SNAP | _____ |
| `InterviewCoachStrings.entryBody` | Rehearse the questions caseworkers actually ask. Pick your state, choose a scenario, and practice communicating your situation clearly. Preparation doesn't affect eligibility — but it can reduce the stress of the interview. | Practica las preguntas que realmente hacen los trabajadores sociales. Elige tu estado, elige un escenario, y practica comunicar tu situación con claridad. La preparación no afecta la elegibilidad — pero puede reducir el estrés de la entrevista. | _____ |
| `InterviewCoachStrings.browseTitle` | Browse practice questions | Explorar preguntas de práctica | _____ |
| `InterviewCoachStrings.browseSubtitle` | Read sample interview questions with guidance on how to answer. | Lee preguntas de entrevista de ejemplo con guía sobre cómo responder. | _____ |
| `InterviewCoachStrings.practiceTitle` | Start a practice session | Iniciar sesión de práctica | _____ |
| `InterviewCoachStrings.practiceSubtitle` | Roleplay with a simulated caseworker. Massachusetts initial-application scenario. | Practica con un trabajador social simulado. Escenario de solicitud inicial de Massachusetts. | _____ |
| `InterviewCoachStrings.loadErrorPrefix` | Couldn't load practice questions: | No se pudieron cargar las preguntas de práctica: | _____ |

#### Navigation titles

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `InterviewCoachStrings.navInterviewCoach` | Interview Coach | Coach de entrevista | _____ |
| `InterviewCoachStrings.navPracticeSession` | Practice session | Sesión de práctica | _____ |
| `InterviewCoachStrings.navPracticeQuestion` | Practice question | Pregunta de práctica | _____ |
| `InterviewCoachStrings.navPracticeQuestions` | Practice questions | Preguntas de práctica | _____ |
| `InterviewCoachStrings.navFeedback` | Feedback | Comentarios | _____ |

#### Browser

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `InterviewCoachStrings.pickYourState` | Pick your state | Selecciona tu estado | _____ |
| `InterviewCoachStrings.comingSoon` | Coming soon | Próximamente | _____ |
| `InterviewCoachStrings.allCategories` | All | Todas | _____ |
| `InterviewCoachStrings.emptyResults` | No questions yet for this state and filter. | Aún no hay preguntas para este estado y filtro. | _____ |
| `InterviewCoachStrings.englishOnlyNotice` | *(empty in English — shown only to Spanish users)* | Las preguntas y la guía están en inglés por ahora. Estamos traduciendo el banco completo. | _____ |

#### Question detail & session

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `InterviewCoachStrings.howToAnswer` | How to answer | Cómo responder | _____ |
| `InterviewCoachStrings.especiallyRelevantFor` | Especially relevant for | Especialmente relevante para | _____ |
| `InterviewCoachStrings.caseworkerTyping` | Caseworker is typing… | El trabajador social está escribiendo… | _____ |
| `InterviewCoachStrings.scoringSession` | Scoring your session… | Evaluando tu sesión… | _____ |
| `InterviewCoachStrings.yourAnswerPlaceholder` | Your answer… | Tu respuesta… | _____ |
| `InterviewCoachStrings.interviewComplete` | Interview complete. | Entrevista completada. | _____ |
| `InterviewCoachStrings.getFeedback` | Get feedback | Obtener comentarios | _____ |
| `InterviewCoachStrings.seeFeedback` | See feedback | Ver comentarios | _____ |
| `InterviewCoachStrings.tryAgain` | Try again | Intentar de nuevo | _____ |

#### Review summary

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `InterviewCoachStrings.sessionFeedbackTitle` | Session feedback | Comentarios de la sesión | _____ |
| `InterviewCoachStrings.sessionFeedbackIntro` | This is practice feedback, not a prediction of your real interview. It reflects how a caseworker might read your answers — a learning signal, not a guarantee. Lower accuracy-risk and lower missing-context are better; higher completeness is better. | Estos son comentarios de práctica, no una predicción de tu entrevista real. Reflejan cómo un trabajador social podría leer tus respuestas — una señal para aprender, no una garantía. Menos riesgo de precisión y menos contexto faltante es mejor; más completitud es mejor. | _____ |
| `InterviewCoachStrings.axisCompleteness` | Completeness | Completitud | _____ |
| `InterviewCoachStrings.axisCompletenessHint` | Did you address what was asked? | ¿Respondiste lo que te preguntaron? | _____ |
| `InterviewCoachStrings.axisAccuracyRisk` | Accuracy risk | Riesgo de precisión | _____ |
| `InterviewCoachStrings.axisAccuracyRiskHint` | How likely are your answers to be misread as fraud or contradiction? | ¿Qué tan probable es que tus respuestas se interpreten como fraude o contradicción? | _____ |
| `InterviewCoachStrings.axisMissingContext` | Missing context | Contexto faltante | _____ |
| `InterviewCoachStrings.axisMissingContextHint` | Did you leave out information that would help your case? | ¿Omitiste información que ayudaría a tu caso? | _____ |
| `InterviewCoachStrings.perTurnNotes` | Per-turn notes | Notas por turno | _____ |
| `InterviewCoachStrings.turnLabel` *(func — spanish case)* | Turn \<N\> | Turno \<N\> | _____ |

#### Disclaimer

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `InterviewCoachStrings.disclaimerBody` | This is a practice tool, not legal advice. For binding answers about your SNAP application, contact Massachusetts Legal Aid (mass.gov/dta) or your local DTA office. Practice prompts and AI feedback are illustrative — they may not match your situation. | Esto es una herramienta de práctica, no asesoría legal. Para respuestas vinculantes sobre tu solicitud de SNAP, comunícate con Asistencia Legal de Massachusetts (mass.gov/dta) o tu oficina local del DTA. Las preguntas de práctica y los comentarios de la IA son ilustrativos — pueden no aplicar a tu situación. | _____ |
| `InterviewCoachStrings.disclaimerCompact` | Practice tool — not legal advice. | Herramienta de práctica — no es asesoría legal. | _____ |

---

### B.5 `Application/CivicaQuestionStrings.swift`

**File:** `Civica/Features/SNAP/Application/CivicaQuestionStrings.swift`

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `CivicaQuestionStrings.continueLabel` | Continue | Continuar | _____ |
| `CivicaQuestionStrings.closeLabel` | Close | Cerrar | _____ |
| `CivicaQuestionStrings.backLabel` | Back | Atrás | _____ |
| `CivicaQuestionStrings.skipLabel` | Skip for now | Omitir por ahora | _____ |
| `CivicaQuestionStrings.notSureLabel` | I'm not sure | No estoy seguro | _____ |
| `CivicaQuestionStrings.yesLabel` | Yes | Sí | _____ |
| `CivicaQuestionStrings.noLabel` | No | No | _____ |
| `CivicaQuestionStrings.amountPlaceholder` | Amount | Cantidad | _____ |
| `CivicaQuestionStrings.progressLabel` *(func — spanish case)* | \<N\> of \<M\> | \<N\> de \<M\> | _____ |
| `CivicaQuestionStrings.progressAccessibilityLabel` *(func — spanish case)* | Question \<N\> of \<M\> | Pregunta \<N\> de \<M\> | _____ |
| `CivicaQuestionStrings.sectionLabel` *(func — spanish case)* | Section \<N\> of \<M\> · \<title\> | Sección \<N\> de \<M\> · \<title\> | _____ |
| `CivicaQuestionStrings.overallProgressAccessibilityLabel` *(func — spanish case)* | Application progress: about \<N\> percent. Section \<X\> of \<Y\>. | Progreso de la solicitud: aproximadamente \<N\> por ciento. Sección \<X\> de \<Y\>. | _____ |

---

### B.6 `EBTBalance/EBTBalanceStrings.swift`

**File:** `Civica/Features/SNAP/EBTBalance/EBTBalanceStrings.swift`

#### Hero balance card

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.screenTitle` | EBT Balance | Saldo de EBT | _____ |
| `EBTBalanceStrings.balanceEyebrow` | CalFresh balance | Saldo de CalFresh | _____ |
| `EBTBalanceStrings.balanceRemainingSuffix` | remaining | disponible | _____ |
| `EBTBalanceStrings.lastUpdatedPrefix` | Last updated | Última actualización | _____ |
| `EBTBalanceStrings.lastUpdatedJustNow` | Last updated just now | Actualizado hace un momento | _____ |

#### Next deposit

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.nextDepositLabel` | Next deposit | Próximo depósito | _____ |
| `EBTBalanceStrings.nextDepositTiming(0)` *(func — spanish case)* | today | hoy | _____ |
| `EBTBalanceStrings.nextDepositTiming(1)` *(func — spanish case)* | tomorrow | mañana | _____ |
| `EBTBalanceStrings.nextDepositTiming(N)` *(func — spanish case)* | in \<N\> days | dentro de \<N\> días | _____ |

#### Connect-card flow

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.linkEyebrow` | Connect your card | Conecta tu tarjeta | _____ |
| `EBTBalanceStrings.linkTitle` | See your CalFresh balance in one place. | Consulta tu saldo de CalFresh en un solo lugar. | _____ |
| `EBTBalanceStrings.linkBody` | Link your EBT card and Civica will show your balance, recent activity, and next deposit — like connecting a bank account to a budgeting app. | Conecta tu tarjeta EBT y Civica mostrará tu saldo, actividad reciente y próximo depósito — como conectar una cuenta bancaria a una app de presupuesto. | _____ |
| `EBTBalanceStrings.linkSecurityEyebrow` | What Civica never stores | Lo que Civica nunca guarda | _____ |
| `EBTBalanceStrings.linkSecurityBody` | Your PIN, your full card number, or your Social Security number. You can unlink your card anytime. | Tu PIN, el número completo de tu tarjeta, ni tu número de Seguro Social. Puedes desconectar tu tarjeta cuando quieras. | _____ |
| `EBTBalanceStrings.linkCardFieldLabel` | EBT card number | Número de tarjeta EBT | _____ |
| `EBTBalanceStrings.linkStateLabel` | State | Estado | _____ |
| `EBTBalanceStrings.linkStateValue` | California | California | _____ |
| `EBTBalanceStrings.linkCTA` | Link my card | Conectar mi tarjeta | _____ |
| `EBTBalanceStrings.linkingProgress` | Connecting to California EBT… | Conectando con EBT de California… | _____ |

#### Recent activity

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.recentActivityEyebrow` | Recent activity | Actividad reciente | _____ |
| `EBTBalanceStrings.depositRowLabel` | Deposit | Depósito | _____ |

#### Card security

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.securityRowTitle` | Card security | Seguridad de la tarjeta | _____ |
| `EBTBalanceStrings.securityStatusLocked` | Locked | Bloqueada | _____ |
| `EBTBalanceStrings.securityStatusUnlocked` | Unlocked | Desbloqueada | _____ |
| `EBTBalanceStrings.lockedBannerText` | Card locked — unlock it before you shop. | Tarjeta bloqueada — desbloquéala antes de comprar. | _____ |
| `EBTBalanceStrings.lockScreenTitle` | Card security | Seguridad de la tarjeta | _____ |
| `EBTBalanceStrings.lockToggleTitle` | Lock my card | Bloquear mi tarjeta | _____ |
| `EBTBalanceStrings.lockToggleHelp` | Keep your card locked when you're not shopping, then unlock it right before you check out. A locked card can't be used — this is the strongest protection against EBT theft. | Mantén tu tarjeta bloqueada cuando no estés comprando, y desbloquéala justo antes de pagar. Una tarjeta bloqueada no se puede usar — es la mejor protección contra el robo de EBT. | _____ |
| `EBTBalanceStrings.lockStatusOnLine` | Your card is locked. No purchases will go through. | Tu tarjeta está bloqueada. No se procesarán compras. | _____ |
| `EBTBalanceStrings.lockStatusOffLine` | Your card is unlocked and ready to use. | Tu tarjeta está desbloqueada y lista para usar. | _____ |
| `EBTBalanceStrings.lockExtrasEyebrow` | Extra protection | Protección adicional | _____ |
| `EBTBalanceStrings.blockOutOfStateTitle` | Block out-of-state purchases | Bloquear compras fuera del estado | _____ |
| `EBTBalanceStrings.blockOutOfStateHelp` | Only allow purchases in California. | Permitir compras solo en California. | _____ |
| `EBTBalanceStrings.blockOnlineTitle` | Block online purchases | Bloquear compras en línea | _____ |
| `EBTBalanceStrings.blockOnlineHelp` | Only allow purchases in person at a store. | Permitir compras solo en persona en una tienda. | _____ |

#### Transaction categories *(func — spanish cases)*

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.categoryLabel(.groceries)` | Groceries | Supermercado | _____ |
| `EBTBalanceStrings.categoryLabel(.restaurant)` | Restaurant | Restaurante | _____ |
| `EBTBalanceStrings.categoryLabel(.farmersMarket)` | Farmers market | Mercado de agricultores | _____ |
| `EBTBalanceStrings.categoryLabel(.other)` | Other | Otro | _____ |
| `EBTBalanceStrings.categoryLabel(.deposit)` | Deposit | Depósito | _____ |

#### Spending insights

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.insightsEyebrow` | This month | Este mes | _____ |
| `EBTBalanceStrings.insightsSpentLabel` | Spent so far | Gastado hasta ahora | _____ |
| `EBTBalanceStrings.insightsRunwayLine` *(func — spanish case)* | At this pace, your balance lasts until \<date\>. | A este ritmo, tu saldo dura hasta el \<date\>. | _____ |
| `EBTBalanceStrings.lowBalanceBanner` | Low balance — check your next deposit date below. | Saldo bajo — revisa la fecha de tu próximo depósito abajo. | _____ |

#### Transaction detail sheet

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.detailSheetTitle` | Transaction | Transacción | _____ |
| `EBTBalanceStrings.detailCategoryLabel` | Category | Categoría | _____ |
| `EBTBalanceStrings.detailDateLabel` | Date | Fecha | _____ |
| `EBTBalanceStrings.detailAmountLabel` | Amount | Monto | _____ |
| `EBTBalanceStrings.detailBalanceAfterLabel` | Balance after | Saldo después | _____ |
| `EBTBalanceStrings.detailDoneButton` | Done | Listo | _____ |

#### Deposit schedule & perks

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.depositScheduleEyebrow` | Deposit schedule | Calendario de depósitos | _____ |
| `EBTBalanceStrings.depositScheduleBody` *(func — spanish case)* | CalFresh loads your card on the \<ordinal\> of every month. California staggers the day by case number. | CalFresh carga tu tarjeta el \<ordinal\> de cada mes. California escalona el día según el número de caso. | _____ |
| `EBTBalanceStrings.perksEyebrow` | Free & discounted with EBT | Gratis y con descuento con EBT | _____ |
| `EBTBalanceStrings.newsEyebrow` | Benefit updates | Novedades de beneficios | _____ |
| `EBTBalanceStrings.unlinkLink` | Unlink this card | Desconectar esta tarjeta | _____ |

#### Demo controls

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.demoMenuLabel` | Demo | Demo | _____ |
| `EBTBalanceStrings.simulatePurchaseButton` | Simulate a purchase | Simular una compra | _____ |
| `EBTBalanceStrings.simulateDepositButton` | Simulate this month's deposit | Simular el depósito de este mes | _____ |
| `EBTBalanceStrings.depositLandedBanner` *(func — spanish case)* | Your \<amount\> CalFresh deposit landed. | Tu depósito de CalFresh de \<amount\> llegó. | _____ |

#### Benefits expiration

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `EBTBalanceStrings.expirationEyebrow` | Use it or lose it | Úsalo o piérdelo | _____ |
| `EBTBalanceStrings.expirationBody` *(func — spanish case)* | CalFresh removes benefits left completely unused for 9 months. Keep using your card — your balance is good through \<date\>. | CalFresh elimina los beneficios que no se usan durante 9 meses. Sigue usando tu tarjeta — tu saldo es válido hasta \<date\>. | _____ |
| `EBTBalanceStrings.demoDisclosure` | Demo — not connected to a real EBT account. | Demostración — no está conectado a una cuenta EBT real. | _____ |

---

### B.7 `Application/SNAPStatusHomeStrings.swift`

**File:** `Civica/Features/SNAP/Application/SNAPStatusHomeStrings.swift`

#### Returning user home

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPStatusHomeStrings.returningWelcome` | Welcome back | Bienvenido de nuevo | _____ |
| `SNAPStatusHomeStrings.returningSubtitle` | Here's where your SNAP application stands. | Aquí está el estado de tu solicitud de SNAP. | _____ |
| `SNAPStatusHomeStrings.returningResume` | Continue where you left off | Continuar donde lo dejaste | _____ |
| `SNAPStatusHomeStrings.returningStartOver` | Start over | Empezar de nuevo | _____ |

#### Waiting room

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPStatusHomeStrings.waitingTitle` | What's happening now | Qué está pasando ahora | _____ |
| `SNAPStatusHomeStrings.waitingBody` *(func — spanish case)* | Your application is with \<agency\>. Most decisions take 7–30 days. We'll let you know when something changes. | Tu solicitud está con \<agency\>. La mayoría de las decisiones tardan de 7 a 30 días. Te avisaremos cuando algo cambie. | _____ |

#### Action chips

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPStatusHomeStrings.actionGeneratePacket` | Generate your application packet | Genera tu paquete de solicitud | _____ |
| `SNAPStatusHomeStrings.actionSubmitToState` *(func — spanish case)* | Open \<portal\> to submit | Abrir \<portal\> para enviar | _____ |
| `SNAPStatusHomeStrings.actionUploadRequested` | Upload requested documents | Sube los documentos solicitados | _____ |
| `SNAPStatusHomeStrings.actionPrepareInterview` | Prepare for your interview | Prepárate para tu entrevista | _____ |
| `SNAPStatusHomeStrings.actionViewDecision` | View your decision | Ver tu decisión | _____ |
| `SNAPStatusHomeStrings.actionRecert` | Start your recertification | Comienza tu recertificación | _____ |

#### Timeline step labels

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPStatusHomeStrings.stepScreener` | Eligibility screener | Evaluación de elegibilidad | _____ |
| `SNAPStatusHomeStrings.stepPacket` | Application packet generated | Paquete de solicitud generado | _____ |
| `SNAPStatusHomeStrings.stepStateAcknowledged` | State received your application | El estado recibió tu solicitud | _____ |
| `SNAPStatusHomeStrings.stepDocuments` | Documents requested | Documentos solicitados | _____ |
| `SNAPStatusHomeStrings.stepInterview` | Phone interview | Entrevista telefónica | _____ |
| `SNAPStatusHomeStrings.stepDecision` | Decision | Decisión | _____ |
| `SNAPStatusHomeStrings.detailEstimatedBenefit` *(func — spanish case)* | Estimated benefit: \<amount\> | Beneficio estimado: \<amount\> | _____ |

#### Status indicators

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPStatusHomeStrings.statusComplete` | Complete | Completado | _____ |
| `SNAPStatusHomeStrings.statusInProgress` | In progress | En curso | _____ |
| `SNAPStatusHomeStrings.statusActionNeeded` | Action needed | Acción necesaria | _____ |
| `SNAPStatusHomeStrings.statusWaiting` | Waiting | En espera | _____ |

#### Denial surface

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPStatusHomeStrings.deniedTitle` | Your SNAP application was denied | Tu solicitud de SNAP fue denegada | _____ |
| `SNAPStatusHomeStrings.deniedBody` *(func — spanish case)* | \<agency\> decided you don't qualify right now. You have options — denials are not the end of the road. | \<agency\> decidió que no calificas en este momento. Tienes opciones — una denegación no es el final del camino. | _____ |
| `SNAPStatusHomeStrings.deniedReasonHeading` | What the state told us | Lo que nos dijo el estado | _____ |
| `SNAPStatusHomeStrings.deniedReasonMissing` *(func — spanish case)* | The state hasn't shared a specific reason with Civica yet. Check your \<portal\> inbox or the denial notice you received in the mail. | El estado todavía no ha compartido una razón específica con Civica. Revisa tu bandeja de \<portal\> o la carta de denegación que recibiste por correo. | _____ |
| `SNAPStatusHomeStrings.deniedNextStepsHeading` | What you can do next | Qué puedes hacer ahora | _____ |
| `SNAPStatusHomeStrings.deniedAppealTitle` | Request a fair hearing | Solicitar una audiencia justa | _____ |
| `SNAPStatusHomeStrings.deniedAppealBody` | Federal law gives you 90 days from the denial notice to request a fair hearing. Submit your appeal by the deadline on your denial letter — outcomes depend on the reason for denial. | La ley federal te da 90 días desde la carta de denegación para solicitar una audiencia justa. Presenta tu apelación antes de la fecha límite indicada en tu carta — el resultado depende del motivo de la denegación. | _____ |
| `SNAPStatusHomeStrings.deniedReviewTitle` | Review what you submitted | Revisa lo que enviaste | _____ |
| `SNAPStatusHomeStrings.deniedReviewBody` | Sometimes a denial comes from a missing document or a number that looked wrong. Look at your application before you appeal. | A veces la denegación viene de un documento que falta o un número que parecía incorrecto. Mira tu solicitud antes de apelar. | _____ |
| `SNAPStatusHomeStrings.deniedFoodHelpTitle` | Find food help today | Encuentra ayuda con comida hoy | _____ |
| `SNAPStatusHomeStrings.deniedFoodHelpBody` | Food banks, school meal programs, and community fridges don't require SNAP approval. Most are open to anyone in need. | Los bancos de alimentos, programas de comidas escolares y refrigeradores comunitarios no requieren aprobación de SNAP. La mayoría están abiertos a cualquier persona necesitada. | _____ |
| `SNAPStatusHomeStrings.deniedReapplyTitle` | Apply again when something changes | Solicita de nuevo cuando algo cambie | _____ |
| `SNAPStatusHomeStrings.deniedReapplyBody` | If your income drops, your household grows, or your expenses go up, you can reapply right away. There's no waiting period. | Si tus ingresos bajan, tu hogar crece o tus gastos suben, puedes volver a solicitar de inmediato. No hay un período de espera. | _____ |
| `SNAPStatusHomeStrings.deniedPrimaryActionAppeal` | Start an appeal | Iniciar una apelación | _____ |
| `SNAPStatusHomeStrings.deniedSecondaryActionReapply` | Start a new application | Iniciar una nueva solicitud | _____ |

#### Recertification surface

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPStatusHomeStrings.recertTitle` | Time to recertify your SNAP | Es hora de recertificar tu SNAP | _____ |
| `SNAPStatusHomeStrings.recertBody` *(func — spanish case)* | Recertification is how \<state\> checks that you still qualify. It's basically reapplying — most of the questions will look familiar. | La recertificación es cómo \<state\> verifica que aún calificas. Básicamente es volver a solicitar — la mayoría de las preguntas te resultarán familiares. | _____ |
| `SNAPStatusHomeStrings.recertDueLine` *(func — spanish case)* | Due by \<date\> | Vence el \<date\> | _____ |
| `SNAPStatusHomeStrings.recertDueSoon` | Due soon | Vence pronto | _____ |
| `SNAPStatusHomeStrings.recertWhyMattersHeading` | Why this matters | Por qué importa esto | _____ |
| `SNAPStatusHomeStrings.recertWhyMattersBody` | If you miss the deadline, your benefits stop on the last day of the month. You'd need to apply from scratch to get them back. | Si no cumples con la fecha límite, tus beneficios terminan el último día del mes. Tendrías que solicitar desde cero para recuperarlos. | _____ |
| `SNAPStatusHomeStrings.recertWhatYoullNeedHeading` | What you'll need | Lo que necesitarás | _____ |
| `SNAPStatusHomeStrings.recertNeedIncome` | Recent paystubs or proof of income | Talones de pago recientes o prueba de ingresos | _____ |
| `SNAPStatusHomeStrings.recertNeedHousehold` | Anyone who joined or left the household | Cualquier persona que se haya unido o salido del hogar | _____ |
| `SNAPStatusHomeStrings.recertNeedExpenses` | Updated rent, utilities, or medical expenses | Renta, servicios o gastos médicos actualizados | _____ |
| `SNAPStatusHomeStrings.recertNeedAddress` | Proof of address if you moved | Prueba de domicilio si te mudaste | _____ |
| `SNAPStatusHomeStrings.recertPrimaryAction` | Start your recertification | Comienza tu recertificación | _____ |
| `SNAPStatusHomeStrings.recertSecondaryOpenPortal` *(func — spanish case)* | Open \<portal\> | Abrir \<portal\> | _____ |

#### FindHelp integration callouts

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPStatusHomeStrings.findHelpFoodLinkTitle` | See food help on the map | Ver ayuda con comida en el mapa | _____ |
| `SNAPStatusHomeStrings.findHelpFoodLinkSubtitle` | Food banks, pantries, and community fridges near you. No SNAP approval required. | Bancos de alimentos, despensas y refrigeradores comunitarios cerca de ti. No requieren aprobación de SNAP. | _____ |
| `SNAPStatusHomeStrings.findHelpApplicationLinkTitle` | Get help with your application | Recibe ayuda con tu solicitud | _____ |
| `SNAPStatusHomeStrings.findHelpApplicationLinkSubtitle` | Local SNAP navigators and community organizations who can help in person or on the phone. | Asesores locales de SNAP y organizaciones comunitarias que pueden ayudarte en persona o por teléfono. | _____ |

---

### B.8 `Application/SNAPDecisionMathStrings.swift`

**File:** `Civica/Features/SNAP/Application/SNAPDecisionMathStrings.swift`

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPDecisionMathStrings.pageTitle` | Your eligibility result | Tu resultado de elegibilidad | _____ |
| `SNAPDecisionMathStrings.pageSubtitle` | Here's how we got to this number. | Así llegamos a este número. | _____ |
| `SNAPDecisionMathStrings.sectionHowWeCalc` | How we calculated it | Cómo lo calculamos | _____ |
| `SNAPDecisionMathStrings.sectionSources` | Sources | Fuentes | _____ |
| `SNAPDecisionMathStrings.grossMonthlyIncome` | Gross monthly income | Ingreso bruto mensual | _____ |
| `SNAPDecisionMathStrings.earnedIncomeDeduction` | Earned income deduction (20%) | Deducción por ingresos del trabajo (20%) | _____ |
| `SNAPDecisionMathStrings.standardDeduction` | Standard deduction | Deducción estándar | _____ |
| `SNAPDecisionMathStrings.dependentCareDeduction` | Dependent care | Cuidado de dependientes | _____ |
| `SNAPDecisionMathStrings.medicalDeduction` | Medical (elderly/disabled) | Médico (mayores/discapacidad) | _____ |
| `SNAPDecisionMathStrings.childSupportDeduction` | Child support paid | Manutención pagada | _____ |
| `SNAPDecisionMathStrings.excessShelterDeduction` | Excess shelter deduction | Deducción por exceso de vivienda | _____ |
| `SNAPDecisionMathStrings.netMonthlyIncome` | Net monthly income | Ingreso neto mensual | _____ |
| `SNAPDecisionMathStrings.thirtyPercentOfNet` | 30% of net income | 30% del ingreso neto | _____ |
| `SNAPDecisionMathStrings.maxAllotment` | Maximum allotment for your household | Asignación máxima para tu hogar | _____ |
| `SNAPDecisionMathStrings.monthlyBenefit` | Your monthly benefit | Tu beneficio mensual | _____ |
| `SNAPDecisionMathStrings.headlineEligible` | Likely eligible | Probablemente elegible | _____ |
| `SNAPDecisionMathStrings.headlineIneligible` | Likely not eligible | Probablemente no elegible | _____ |
| `SNAPDecisionMathStrings.headlineInsufficient` | Need more information | Necesitamos más información | _____ |
| `SNAPDecisionMathStrings.estimateDisclaimer` | This is Civica's estimate. Your state agency makes the final decision. | Esta es la estimación de Civica. Tu agencia estatal toma la decisión final. | _____ |
| `SNAPDecisionMathStrings.rulesVersion` | Rules version | Versión de reglas | _____ |
| `SNAPDecisionMathStrings.rulesVersionHintReveal` | Double-tap to show the technical version code. | Toca dos veces para ver el código técnico de la versión. | _____ |
| `SNAPDecisionMathStrings.rulesVersionHintHumanize` | Double-tap to show the human-readable label. | Toca dos veces para ver la etiqueta legible. | _____ |
| `SNAPDecisionMathStrings.effectiveAsOf` | Effective as of | Efectivo a partir de | _____ |
| `SNAPDecisionMathStrings.continueToPacket` | Get my application packet | Obtener mi paquete de solicitud | _____ |
| `SNAPDecisionMathStrings.backToSummary` | Back to summary | Volver al resumen | _____ |

---

### B.9 `Conversation/SNAPRecoveryStrings.swift`

**File:** `Civica/Features/SNAP/Conversation/SNAPRecoveryStrings.swift`

| Key | English | Current Spanish | Reviewer notes |
|-----|---------|-----------------|----------------|
| `SNAPRecoveryStrings.entryLinkTitle` | Continue an earlier application | Continúa una solicitud anterior | _____ |
| `SNAPRecoveryStrings.entryLinkSubtitle` | Switched phones or reinstalled the app? Get back in with a one-time code. | ¿Cambiaste de teléfono o reinstalaste la app? Vuelve con un código de un solo uso. | _____ |
| `SNAPRecoveryStrings.channelTitle` | How can we reach you? | ¿Cómo podemos contactarte? | _____ |
| `SNAPRecoveryStrings.channelHelper` | We'll send a one-time code to the phone or email you used when you started your application. | Te enviaremos un código de un solo uso al teléfono o correo que usaste al iniciar tu solicitud. | _____ |
| `SNAPRecoveryStrings.channelOptionPhone` | Text my phone | Enviar un mensaje al teléfono | _____ |
| `SNAPRecoveryStrings.channelOptionEmail` | Email me | Enviar un correo electrónico | _____ |
| `SNAPRecoveryStrings.contactTitlePhone` | What's your phone number? | ¿Cuál es tu número de teléfono? | _____ |
| `SNAPRecoveryStrings.contactTitleEmail` | What's your email address? | ¿Cuál es tu dirección de correo electrónico? | _____ |
| `SNAPRecoveryStrings.contactHelperPhone` | Standard text rates may apply. We never share your number. | Pueden aplicar tarifas estándar de mensajes. Nunca compartimos tu número. | _____ |
| `SNAPRecoveryStrings.contactHelperEmail` | We'll only use this to send the code. We never share your email. | Solo lo usaremos para enviar el código. Nunca compartimos tu correo. | _____ |
| `SNAPRecoveryStrings.contactPlaceholderPhone` | Phone number | Número de teléfono | _____ |
| `SNAPRecoveryStrings.contactPlaceholderEmail` | you@example.com | tu@ejemplo.com | _____ |
| `SNAPRecoveryStrings.codeTitle` | Enter the 6-digit code | Ingresa el código de 6 dígitos | _____ |
| `SNAPRecoveryStrings.codeHelper(isPhone: true)` *(func — spanish case)* | We texted \<contact\> a code. It should arrive in a minute. | Enviamos un código por mensaje a \<contact\>. Debería llegar en un minuto. | _____ |
| `SNAPRecoveryStrings.codeHelper(isPhone: false)` *(func — spanish case)* | We emailed \<contact\>. The code should arrive in a minute. | Enviamos un código por correo a \<contact\>. Debería llegar en un minuto. | _____ |
| `SNAPRecoveryStrings.codePlaceholder` | 000000 | 000000 | _____ |
| `SNAPRecoveryStrings.codeResend` | Send the code again | Enviar el código de nuevo | _____ |
| `SNAPRecoveryStrings.sending` | Sending… | Enviando… | _____ |
| `SNAPRecoveryStrings.redeeming` | Finding your application… | Buscando tu solicitud… | _____ |
| `SNAPRecoveryStrings.sendErrorGeneric` | We couldn't send the code right now. Try again in a moment. | No pudimos enviar el código en este momento. Inténtalo de nuevo en un momento. | _____ |
| `SNAPRecoveryStrings.redeemErrorBadCode` | That code doesn't match. Double-check the digits or ask for a new one. | Ese código no coincide. Verifica los dígitos o pide uno nuevo. | _____ |

---

## Section C — Compliance strings (BLOCKED — wait for counsel)

> ### ⛔ DO NOT REVIEW THESE STRINGS YET
>
> **All 9 strings below are pending counsel sign-off on the English copy first.**
>
> The OBBBA compliance audit identified these strings as requiring revision. The proposed English replacements (`approvedEnglish`) have NOT yet been signed by counsel. The Spanish translations (`approvedSpanish`) are blank because:
>
> 1. There is no approved English source yet to translate from.
> 2. Translating from the `currentEnglish` copy would be wasted work — the English will change before this ships.
>
> **When to review:** Engineering will send a follow-up packet once counsel has signed the English replacements. That follow-up will show `currentEnglish → approvedEnglish` side-by-side so you can write `approvedSpanish` from the final source. See [docs/snap/counsel_packet_compliance_strings.md](counsel_packet_compliance_strings.md) for the counsel review packet.
>
> **Source:** `Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift` → `pendingCopyRevisions`

---

| # | ID | Surface file | String constant | Current English (do not translate) | Approved Spanish | Reviewer notes |
|---|----|-------------|----------------|--------------------------------------|-----------------|----------------|
| 1 | `approval_email_subject` | `CivicaNotificationTemplates.swift` | `approvedEmail.subject` | Approved. ${monthlyBenefit}/mo, starting this month. | *(awaiting counsel sign-off on English)* | _____ |
| 2 | `decision_approved_headline` | `SNAPDecisionApprovedView.swift` | `SNAPDecisionApprovedStrings.headline` | You're approved. | *(awaiting counsel sign-off on English)* | _____ |
| 3 | `expedited_banner_almost` | `SNAPExpeditedBanner.swift` | `almostHeadline` | Almost — one more answer could speed this up | *(awaiting counsel sign-off on English)* | _____ |
| 4 | `estimator_entry_subtitle` | `SNAPBenefitEstimatorStrings.swift` | `entryCardSubtitle` | Five questions. See your monthly dollar amount before you apply. | *(awaiting counsel sign-off on English)* | _____ |
| 5 | `estimator_apply_cta` | `SNAPBenefitEstimatorStrings.swift` | `applyCTA` | Apply for SNAP | *(awaiting counsel sign-off on English)* | _____ |
| 6 | `doc_requested_sms_body` | `CivicaNotificationTemplates.swift` | `documentRequestedSMS.body` | DTA needs one more thing: a recent paystub. Send a photo here or upload in the app. By {deadline} keeps your application moving. | *(awaiting counsel sign-off on English)* | _____ |
| 7 | `recert_one_day_sms` | `CivicaNotificationTemplates.swift` | `recertOneDayBeforeSMS.body` | Tomorrow is your recert deadline ({recertDate}). 4 minutes if you start now. If you miss it, benefits pause until you submit — text RECERT for a fast link any time. | *(awaiting counsel sign-off on English)* | _____ |
| 8 | `recert_heads_up_email_subject` | `CivicaNotificationTemplates.swift` | `recertHeadsUpEmail.subject` | Recertify in 60 days. Usually 4 minutes. | *(awaiting counsel sign-off on English)* | _____ |
| 9 | `ebt_pin_cta` | `CivicaNotificationTemplates.swift` | `approvedEmail.buttonLabel` | Set the EBT PIN | *(awaiting counsel sign-off on English)* | _____ |

---

## How to submit corrections

Return **one markdown file** (e.g., `spanish_reviewer_corrections.md`) with an entry for every string you want changed. Leave strings you approve as-is out of the file.

### Format

~~~markdown
## web/common.disclaimer
- was: Civica te ayuda a preparar tu paquete de solicitud de SNAP. No determinamos elegibilidad ni aprobamos beneficios.
- now: Civica le ayuda a preparar su paquete de solicitud de SNAP. No determinamos elegibilidad ni aprobamos beneficios.
- reason: usted register ("le ayuda", "su paquete")

## ios/SNAPLaunchSurfaces/SNAPConfirmationStrings.title
- was: Tu borrador de SNAP está listo
- now: Su borrador de SNAP está listo
- reason: usted register
~~~

### Surface/key format

Use `<surface>/<enum>.<key>` as shown in the surface code table in the Reviewer Brief. For web keys use `web/<namespace>.<key>`.

### Do NOT

- Do not propose changes to Section C strings — those await counsel on the English side first.
- Do not change the meaning of legal copy (privacy policy, consent body, disclaimer) — only flag formality or grammatical issues.
- Do not alter `%@`, `{variable}`, or `\<placeholder\>` interpolation tokens.
- Do not change terms listed in the "Technical terms to keep in English" section.

### Delivery

Email corrections to Matthew Greer-Gentis. Engineering applies all corrections in a single PR titled **"Apply Spanish reviewer corrections"**.
