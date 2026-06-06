// All SNAP-wizard copy with English + Spanish parity. Strings are mirrored
// from the iOS CivicaText catalogs where they exist (so a bilingual user
// hops between iPhone and web with identical phrasing).
//
// Adding a key: add to BOTH `en` AND `es`. The i18n-parity test in
// __tests__/snap-copy-parity.test.ts will fail CI if either is missing.

import type { Locale } from "../../app/i18n";

export const snapStrings = {
  en: {
    // Common
    common_continue: "Continue",
    common_back: "Back",
    common_skip: "Skip",
    common_edit: "Edit",
    common_cancel: "Cancel",
    common_yes: "Yes",
    common_no: "No",
    common_not_sure: "Not sure",
    common_not_provided: "Not provided",

    // Sign-in (mirrors SNAPPhoneSignInView.swift)
    signin_title: "Save your application",
    signin_subtitle: "Enter your phone number to receive a code. Your application will be securely saved for your navigator.",
    signin_phone_label: "Phone number",
    signin_phone_placeholder: "+1 (555) 000-0000",
    signin_send_code: "Send code",
    signin_disclosure: "Standard messaging rates may apply. Your number is only used for verification.",
    signin_otp_sent_to: "We sent a 6-digit code to",
    signin_otp_label: "Verification code",
    signin_otp_placeholder: "6-digit code",
    signin_verify: "Verify",
    signin_resend: "Send again",
    signin_error_invalid_phone: "Please enter a valid phone number.",
    signin_error_non_us_phone: "For numbers outside the US, include your country code (e.g. +52 for Mexico).",
    signin_error_rate_limited: "Too many attempts. Please wait 10 minutes and try again.",
    signin_error_invalid_code: "That code didn't match. Try again or send a new one.",
    signin_error_generic: "Something went wrong. Please try again.",

    // Wizard frame
    wizard_step_of: "Section {current} of {total}",
    wizard_completed: "% Completed",
    wizard_review_cta: "Review your application",
    wizard_generate_cta: "Generate my application packet",
    wizard_must_complete: "Finish the required sections before you can review.",

    // Section titles (mirrors SNAPApplicationSection.title)
    section_where_applying: "Where you're applying",
    section_applicant_age: "About you",
    section_household: "Your household",
    section_contact: "Staying in touch",
    section_income: "Income",
    section_student_status: "Student status",
    section_expenses: "Expenses",
    section_documents_checklist: "Documents",

    // Section headers + helpers (mirrors SNAPDraftStep.title / helperCopy)
    header_where_applying: "Where are you currently residing?",
    helper_where_applying: "Share your state, housing status, and address details when requested.",
    header_applicant_age: "Applicant age",
    helper_applicant_age: "Add your date of birth so we can estimate applicant age.",
    header_household: "Your Food Household",
    helper_household: "Start with who lives with you and shares food costs.",
    header_contact: "Contact information",
    helper_contact: "Choose how you would prefer to be reached if you later ask for help.",
    header_income: "Income",
    helper_income: "Give a simple estimate so your draft is easier to review.",
    header_student_status: "Student status",
    helper_student_status: "Answer student questions only if you are enrolled in higher education.",
    header_expenses: "Monthly expenses",
    helper_expenses: "Add broad monthly cost estimates before continuing to official steps.",
    header_documents: "Preparation checklist",
    helper_documents: "Mark what you already have or may want to gather before the official application.",
    header_review: "Review your application",
    helper_review: "Review your answers for missing or incorrect information before continuing.",

    // Status badges
    status_complete: "Complete",
    status_missing_required: "Missing required",
    status_missing_optional: "Optional info pending",
    status_not_started: "Not started",

    // Where applying
    field_state: "State",
    field_state_placeholder: "Two-letter state code (e.g. CA)",
    field_housing_status: "Housing status",
    housing_stable_home: "Stable home",
    housing_temporary: "Temporary housing",
    housing_with_others: "Staying with others",
    housing_unhoused: "Unhoused",
    field_residential_street: "Street address",
    field_residential_city: "City",
    field_residential_zip: "ZIP code",
    error_state_zip_mismatch: "State and ZIP do not match. Please fix one of them.",

    // Applicant age
    field_date_of_birth: "Date of birth",
    field_age: "Age (years)",
    field_age_helper: "Either your date of birth OR your age is fine — both are not required.",

    // Household
    field_household_size: "How many people live in your food household?",
    field_buys_prepares_food: "Do you buy and prepare food with the other people in your household?",
    field_spouse_lives: "Does a spouse live with you?",
    field_child_under_22: "Does a child under 22 live with their parent in this home?",
    field_children_in_household: "Are there children in your household?",
    field_anyone_60_plus: "Is anyone in the household age 60 or older?",
    field_anyone_disability: "Does anyone in the household have a disability?",
    field_anyone_pregnant: "Is anyone in the household pregnant?",
    field_anyone_unhoused: "Is anyone unhoused or without a fixed mailing address?",
    field_safe_mailing: "Preferred safe mailing contact option",
    safe_mailing_shelter: "Shelter",
    safe_mailing_friend: "Friend / relative",
    safe_mailing_helper: "Authorized helper",
    safe_mailing_portal: "Email / portal",
    safe_mailing_phone: "Phone",
    safe_mailing_not_sure: "Not sure",

    // Contact
    field_preferred_contact: "Preferred contact method",
    contact_method_phone: "Phone call",
    contact_method_text: "Text message",
    contact_method_email: "Email",
    contact_method_mail: "Mail",
    field_email: "Email address",
    field_phone: "Phone number",

    // Income
    field_employment_status: "Employment status",
    employment_full_time: "Employed full-time",
    employment_part_time: "Employed part-time",
    employment_self: "Self-employed",
    employment_unemployed: "Not currently working",
    employment_unable: "Unable to work",
    field_monthly_income: "Estimated monthly income (USD)",
    field_income_changes: "Does your income change month to month?",

    // Student status
    field_enrolled_higher_ed: "Are you currently enrolled in higher education?",
    field_enrolled_half_time: "Are you enrolled at least half-time?",
    field_works_20_hours: "Do you work at least 20 hours per week?",
    field_work_study: "Do you participate in work-study?",
    field_dependent_child: "Are you responsible for a dependent child?",

    // Expenses
    field_rent: "Monthly rent or housing cost (USD)",
    field_utilities: "Monthly utilities cost (USD)",
    field_childcare: "Monthly childcare cost estimate (USD)",
    field_medical: "Monthly medical expense estimate (USD)",

    // Documents checklist (mirrors SNAPDocumentType labels)
    doc_photo_id: "Photo ID",
    doc_photo_id_detail: "Driver's license, state ID, or passport",
    doc_proof_address: "Proof of address",
    doc_proof_address_detail: "Utility bill, lease, or mail with your address",
    doc_proof_income: "Proof of income",
    doc_proof_income_detail: "Recent pay stubs or benefit letters",
    doc_rent_proof: "Rent or housing costs",
    doc_rent_proof_detail: "Lease agreement or landlord statement",
    doc_utility_bill: "Utility bill",
    doc_utility_bill_detail: "Current electric, gas, or heat bill",
    doc_student_status: "Student enrollment letter",
    doc_student_status_detail: "Enrollment letter or student ID",
    doc_work_status: "Work status or exemption",
    doc_work_status_detail: "Work schedule or exemption documentation",
    doc_childcare_proof: "Childcare cost receipt",
    doc_childcare_proof_detail: "Receipts or provider statement",
    doc_immigration: "Immigration documents (if asked)",
    doc_immigration_detail: "Only if the official application asks",

    // Documents upload page (mirrors SNAPDocumentUploadView)
    upload_title: "Upload your documents",
    upload_subtitle: "Drag files here or pick from your computer. JPG, PNG, HEIC, or PDF.",
    upload_drop_zone: "Drop a file or click to browse",
    upload_select_kind: "What is this document?",
    upload_uploading: "Uploading…",
    upload_success: "Uploaded — processing…",
    upload_error: "Upload failed. Please try again.",
    upload_status_uploaded: "Uploaded",
    upload_status_classifying: "Classifying",
    upload_status_extracting: "Reading text",
    upload_status_awaiting: "Awaiting navigator review",
    upload_status_confirmed: "Confirmed",
    upload_status_rejected: "Rejected — please re-upload",

    // Document kinds (mirrors EnrollmentDocumentKind.displayLabel)
    kind_photo_id: "Photo ID",
    kind_paystub: "Pay stub",
    kind_utility_bill: "Utility bill",
    kind_lease: "Lease",
    kind_bank_statement: "Bank statement",
    kind_tax_return: "Tax return",
    kind_benefit_letter: "Benefit letter",
    kind_other: "Other",

    // Next steps + confirmation
    next_steps_title: "Next steps",
    next_steps_body: "Your application packet was saved. A Civica navigator will review it and contact you. You can return to civica.app any time to check status.",
    confirmation_packet_id: "Packet ID",
    confirmation_view_status: "View status",

    // Status page (mirrors SNAPEnrollmentInboxSection)
    status_title: "Your packets",
    status_empty: "You don't have any saved applications yet.",
    status_start_new: "Start a new application",
    status_inbox_title: "Action items from your navigator",
    status_inbox_empty: "No outstanding items.",
    status_reentry_title: "Continue where you left off",

    // Errors
    error_session_expired: "Your session expired. Please sign in again.",
    error_gateway_unreachable: "We can't reach the Civica service right now. Please try again in a moment.",

    // Validation hints (mirrors draftValidationHint)
    hint_add_prefix: "To continue, add:",
    hint_state: "state",
    hint_housing_status: "housing status",
    hint_city: "city",
    hint_zip: "ZIP code",
    hint_employment_status: "employment status",
    hint_monthly_income: "estimated monthly income",
    hint_income_change: "income change answer",
    hint_half_time: "half-time enrollment",
    hint_works_20: "20+ hours/week work status",
    hint_work_study: "work-study status",
    hint_dependent_child: "dependent child responsibility",
    hint_rent: "rent or housing cost",
    hint_utilities: "utilities cost",
    hint_applicant_age: "applicant age",
  },
  es: {
    common_continue: "Continuar",
    common_back: "Atrás",
    common_skip: "Omitir",
    common_edit: "Editar",
    common_cancel: "Cancelar",
    common_yes: "Sí",
    common_no: "No",
    common_not_sure: "No estoy seguro",
    common_not_provided: "No proporcionado",

    signin_title: "Guarda tu solicitud",
    signin_subtitle: "Ingresa tu número de teléfono para recibir un código. Tu solicitud se guardará de forma segura para tu navigator.",
    signin_phone_label: "Número de teléfono",
    signin_phone_placeholder: "+1 (555) 000-0000",
    signin_send_code: "Enviar código",
    signin_disclosure: "Pueden aplicar tarifas de mensajería estándar. Tu número se usa solo para verificación.",
    signin_otp_sent_to: "Enviamos un código de 6 dígitos a",
    signin_otp_label: "Código de verificación",
    signin_otp_placeholder: "Código de 6 dígitos",
    signin_verify: "Verificar",
    signin_resend: "Enviar de nuevo",
    signin_error_invalid_phone: "Por favor ingresa un número de teléfono válido.",
    signin_error_non_us_phone: "Para números fuera de EE. UU., incluye el código de país (p. ej. +52 para México).",
    signin_error_rate_limited: "Demasiados intentos. Por favor espera 10 minutos e intenta de nuevo.",
    signin_error_invalid_code: "Ese código no coincide. Intenta de nuevo o envía uno nuevo.",
    signin_error_generic: "Algo salió mal. Por favor intenta de nuevo.",

    wizard_step_of: "Sección {current} de {total}",
    wizard_completed: "% Completado",
    wizard_review_cta: "Revisa tu solicitud",
    wizard_generate_cta: "Generar mi paquete de solicitud",
    wizard_must_complete: "Termina las secciones requeridas antes de revisar.",

    section_where_applying: "Dónde solicitas",
    section_applicant_age: "Sobre ti",
    section_household: "Tu hogar",
    section_contact: "Mantenerse en contacto",
    section_income: "Ingresos",
    section_student_status: "Estatus estudiantil",
    section_expenses: "Gastos",
    section_documents_checklist: "Documentos",

    header_where_applying: "¿Dónde resides actualmente?",
    helper_where_applying: "Comparte tu estado, situación de vivienda y dirección cuando se solicite.",
    header_applicant_age: "Edad del solicitante",
    helper_applicant_age: "Agrega tu fecha de nacimiento para que podamos estimar tu edad.",
    header_household: "Tu hogar alimentario",
    helper_household: "Comienza con quién vive contigo y comparte los costos de alimentos.",
    header_contact: "Información de contacto",
    helper_contact: "Elige cómo prefieres que te contactemos si pides ayuda más adelante.",
    header_income: "Ingresos",
    helper_income: "Da un estimado simple para que tu borrador sea más fácil de revisar.",
    header_student_status: "Estatus estudiantil",
    helper_student_status: "Responde estas preguntas solo si estás inscrito en educación superior.",
    header_expenses: "Gastos mensuales",
    helper_expenses: "Agrega estimados mensuales amplios antes de continuar con los pasos oficiales.",
    header_documents: "Lista de preparación",
    helper_documents: "Marca lo que ya tienes o puedas reunir antes de la solicitud oficial.",
    header_review: "Revisa tu solicitud",
    helper_review: "Revisa tus respuestas en busca de información faltante o incorrecta antes de continuar.",

    status_complete: "Completo",
    status_missing_required: "Falta información requerida",
    status_missing_optional: "Información opcional pendiente",
    status_not_started: "No iniciado",

    field_state: "Estado",
    field_state_placeholder: "Código de dos letras (p. ej. CA)",
    field_housing_status: "Situación de vivienda",
    housing_stable_home: "Hogar estable",
    housing_temporary: "Vivienda temporal",
    housing_with_others: "Quedándome con otros",
    housing_unhoused: "Sin vivienda",
    field_residential_street: "Dirección",
    field_residential_city: "Ciudad",
    field_residential_zip: "Código postal",
    error_state_zip_mismatch: "El estado y el código postal no coinciden. Por favor corrige uno de ellos.",

    field_date_of_birth: "Fecha de nacimiento",
    field_age: "Edad (años)",
    field_age_helper: "Tu fecha de nacimiento O tu edad — no se requieren ambas.",

    field_household_size: "¿Cuántas personas viven en tu hogar alimentario?",
    field_buys_prepares_food: "¿Compras y preparas comida con las otras personas en tu hogar?",
    field_spouse_lives: "¿Vive un cónyuge contigo?",
    field_child_under_22: "¿Vive un menor de 22 años con su padre/madre en este hogar?",
    field_children_in_household: "¿Hay niños en tu hogar?",
    field_anyone_60_plus: "¿Hay alguien en el hogar de 60 años o más?",
    field_anyone_disability: "¿Tiene alguien en el hogar una discapacidad?",
    field_anyone_pregnant: "¿Hay alguien en el hogar embarazada?",
    field_anyone_unhoused: "¿Hay alguien sin vivienda o sin dirección postal fija?",
    field_safe_mailing: "Opción preferida de contacto seguro",
    safe_mailing_shelter: "Refugio",
    safe_mailing_friend: "Amigo / familiar",
    safe_mailing_helper: "Ayudante autorizado",
    safe_mailing_portal: "Correo electrónico / portal",
    safe_mailing_phone: "Teléfono",
    safe_mailing_not_sure: "No estoy seguro",

    field_preferred_contact: "Método de contacto preferido",
    contact_method_phone: "Llamada telefónica",
    contact_method_text: "Mensaje de texto",
    contact_method_email: "Correo electrónico",
    contact_method_mail: "Correo postal",
    field_email: "Correo electrónico",
    field_phone: "Número de teléfono",

    field_employment_status: "Estado laboral",
    employment_full_time: "Empleado de tiempo completo",
    employment_part_time: "Empleado de medio tiempo",
    employment_self: "Auto-empleado",
    employment_unemployed: "No trabajando actualmente",
    employment_unable: "Sin poder trabajar",
    field_monthly_income: "Ingreso mensual estimado (USD)",
    field_income_changes: "¿Cambian tus ingresos mes a mes?",

    field_enrolled_higher_ed: "¿Estás inscrito actualmente en educación superior?",
    field_enrolled_half_time: "¿Estás inscrito al menos a medio tiempo?",
    field_works_20_hours: "¿Trabajas al menos 20 horas por semana?",
    field_work_study: "¿Participas en estudio y trabajo?",
    field_dependent_child: "¿Eres responsable de un menor dependiente?",

    field_rent: "Renta o costo mensual de vivienda (USD)",
    field_utilities: "Costo mensual de servicios (USD)",
    field_childcare: "Estimado mensual de cuidado infantil (USD)",
    field_medical: "Estimado mensual de gastos médicos (USD)",

    doc_photo_id: "Identificación con foto",
    doc_photo_id_detail: "Licencia, identificación estatal o pasaporte",
    doc_proof_address: "Comprobante de domicilio",
    doc_proof_address_detail: "Factura de servicios, contrato o correo con tu dirección",
    doc_proof_income: "Comprobante de ingresos",
    doc_proof_income_detail: "Talones de pago recientes o cartas de beneficios",
    doc_rent_proof: "Costo de renta o vivienda",
    doc_rent_proof_detail: "Contrato de arrendamiento o declaración del arrendador",
    doc_utility_bill: "Factura de servicios",
    doc_utility_bill_detail: "Factura actual de electricidad, gas o calefacción",
    doc_student_status: "Carta de inscripción estudiantil",
    doc_student_status_detail: "Carta de inscripción o identificación estudiantil",
    doc_work_status: "Estado laboral o exención",
    doc_work_status_detail: "Horario laboral o documentación de exención",
    doc_childcare_proof: "Recibo de cuidado infantil",
    doc_childcare_proof_detail: "Recibos o declaración del proveedor",
    doc_immigration: "Documentos de inmigración (si se piden)",
    doc_immigration_detail: "Solo si la solicitud oficial lo pide",

    upload_title: "Sube tus documentos",
    upload_subtitle: "Arrastra archivos aquí o selecciona desde tu computadora. JPG, PNG, HEIC o PDF.",
    upload_drop_zone: "Suelta un archivo o haz clic para buscar",
    upload_select_kind: "¿Qué documento es este?",
    upload_uploading: "Subiendo…",
    upload_success: "Subido — procesando…",
    upload_error: "Falló la subida. Por favor intenta de nuevo.",
    upload_status_uploaded: "Subido",
    upload_status_classifying: "Clasificando",
    upload_status_extracting: "Leyendo texto",
    upload_status_awaiting: "Esperando revisión del navigator",
    upload_status_confirmed: "Confirmado",
    upload_status_rejected: "Rechazado — por favor vuelve a subir",

    kind_photo_id: "Identificación con foto",
    kind_paystub: "Talón de pago",
    kind_utility_bill: "Factura de servicios",
    kind_lease: "Contrato de arrendamiento",
    kind_bank_statement: "Estado de cuenta bancario",
    kind_tax_return: "Declaración de impuestos",
    kind_benefit_letter: "Carta de beneficios",
    kind_other: "Otro",

    next_steps_title: "Próximos pasos",
    next_steps_body: "Tu paquete de solicitud se guardó. Un navigator de Civica lo revisará y te contactará. Puedes volver a civica.app en cualquier momento para revisar el estado.",
    confirmation_packet_id: "ID del paquete",
    confirmation_view_status: "Ver estado",

    status_title: "Tus paquetes",
    status_empty: "Aún no tienes solicitudes guardadas.",
    status_start_new: "Iniciar una nueva solicitud",
    status_inbox_title: "Acciones de tu navigator",
    status_inbox_empty: "No hay acciones pendientes.",
    status_reentry_title: "Continúa donde lo dejaste",

    error_session_expired: "Tu sesión expiró. Por favor inicia sesión de nuevo.",
    error_gateway_unreachable: "No podemos conectarnos con el servicio de Civica ahora. Por favor intenta en un momento.",

    hint_add_prefix: "Para continuar, agrega:",
    hint_state: "estado",
    hint_housing_status: "situación de vivienda",
    hint_city: "ciudad",
    hint_zip: "código postal",
    hint_employment_status: "estado laboral",
    hint_monthly_income: "ingreso mensual estimado",
    hint_income_change: "respuesta sobre cambio de ingreso",
    hint_half_time: "inscripción de medio tiempo",
    hint_works_20: "trabajo de 20+ horas/semana",
    hint_work_study: "estado de estudio y trabajo",
    hint_dependent_child: "responsabilidad de menor dependiente",
    hint_rent: "renta o costo de vivienda",
    hint_utilities: "costo de servicios",
    hint_applicant_age: "edad del solicitante",
  },
} as const satisfies Record<"en" | "es", Record<string, string>>;

export type SnapStringKey = keyof (typeof snapStrings)["en"];

// The deep SNAP-wizard catalog is reviewed en/es only. zh/vi/tl fall back to
// English until a reviewed translation pass (matching how iOS shipped its
// zh/vi/tl parity — machine-translating eligibility copy unreviewed is unsafe
// for a benefits app). The home/welcome surface IS fully translated below.
export function snapT(locale: Locale, key: SnapStringKey): string {
  const table = (snapStrings as Record<string, Record<string, string>>)[locale] ?? snapStrings.en;
  return table[key] ?? snapStrings.en[key];
}

// Welcome page copy (pre-sign-in trust page).
export const welcomeStrings = {
  en: {
    welcome_title: "Apply for CalFresh in about 10 minutes",
    welcome_subtitle: "Civica guides you through the application step by step and keeps your progress saved.",
    welcome_trust_label: "Why Civica",
    welcome_trust_1: "Money for groceries every month, loaded onto an EBT card.",
    welcome_trust_2: "Your information is encrypted and only shared with the state to process your application.",
    welcome_trust_3: "A trained navigator reviews your application before it's submitted.",
    welcome_cta: "Start my application →",
    welcome_returning: "Already started?",
    welcome_signin_link: "Sign in to continue",

    // ─── Home nav tabs ───
    home_nav_what: "What is SNAP",
    home_nav_apply: "Apply now",
    home_nav_why: "Why Civica",
    home_nav_signin: "Sign in",

    // ─── Hero ───
    home_hero_eyebrow: "CalFresh for California",
    home_hero_title: "Do you qualify for free groceries?",
    home_hero_body: "Civica reads California's CalFresh rules and walks you through the application in 10 minutes. No minimum income required.",
    home_hero_secondary: "Sign in to continue",

    // ─── What is SNAP ───
    home_what_title: "What is SNAP?",
    home_what_body: "SNAP is monthly money for groceries, loaded onto a card you use just like a debit card. You might know it by another name — CalFresh in California, EBT, or food stamps — but it's all the same federal program. It's not a loan, and it never has to be paid back.",

    // ─── What you can buy ───
    home_buy_title: "What you can buy with it",
    home_buy_can_label: "Yes — food to bring home",
    home_buy_can: "Fruits & vegetables|Meat, fish & eggs|Milk, cheese & yogurt|Bread, rice & cereal|Snacks & non-alcoholic drinks|Seeds & plants that grow food",
    home_buy_cant: "Hot or prepared deli food|Alcohol & tobacco|Vitamins & medicine|Soap, diapers & household items|Pet food",
    home_cant_q: "What can't I buy with SNAP?",
    home_findfood_title: "Find food & EBT stores near you",
    home_findfood_body: "The Civica app maps nearby food banks, free meals, and stores that accept your EBT card.",

    // ─── Income guide ───
    home_income_title: "How much can I earn and still qualify?",
    home_income_intro: "These are rough guideposts — many states, including California, use the higher end shown here.",
    home_income_col_size: "Household size",
    home_income_col_amount: "Monthly income (about)",
    home_income_person: "person",
    home_income_people: "people",
    home_income_benefit: "If you're approved, benefits go up to about {max} a month for one person — and more for a larger household.",
    home_income_note: "This is a guide, not a cutoff. Many people who think they earn too much actually qualify once rent, childcare, and medical costs are counted. The only way to know is to apply — and Civica figures out your state's real limit for you.",

    // ─── FAQ ───
    home_faq_title: "Questions people ask",
    home_faq_q1: "Isn't SNAP the same everywhere?",
    home_faq_a1: "No — and that's the confusing part. SNAP is one federal program, but every state runs it a little differently. Even the name changes: SNAP in most states, CalFresh in California, \"food stamps\" to a lot of people. The income limits, the documents you need, and the rules about students, cars, and savings are all set state by state. Civica reads your state's rules for you and only asks for what your state actually needs.",
    home_faq_q2: "Do I make too much to qualify?",
    home_faq_a2: "Probably not as much as you'd think. Most states let you earn well above the federal guideline, and costs like rent, childcare, and medical bills lower the income they actually count. Many working people, seniors, students, and families qualify — though the exact rules (especially for students) depend on your state. The only way to know is to check, and we do that math for you.",
    home_faq_q3: "Am I taking food from someone who needs it more?",
    home_faq_a3: "No. SNAP isn't a fixed pot that runs out — your benefit doesn't reduce anyone else's. If you qualify, the help is there for you.",
    home_faq_q4: "Do I have to pay it back?",
    home_faq_a4: "No. SNAP isn't a loan. You've already paid into it through your taxes — this is help you've earned, not a debt.",
    home_faq_q5: "Will it affect my immigration status?",
    home_faq_a5: "For most families, no. SNAP isn't counted as a \"public charge,\" and applying for your eligible children doesn't put you at risk. These rules can be specific, so if you're unsure, we'll point you to free, confidential help before you file.",

    // ─── App island ───
    home_app_cta: "Get the app →",

    // ─── How it works ───
  },
  es: {
    welcome_title: "Solicita CalFresh en unos 10 minutos",
    welcome_subtitle: "Civica te guía paso a paso y guarda tu progreso automáticamente.",
    welcome_trust_label: "Por qué Civica",
    welcome_trust_1: "Dinero para comestibles cada mes, cargado en una tarjeta EBT.",
    welcome_trust_2: "Tu información está cifrada y solo se comparte con el estado para procesar tu solicitud.",
    welcome_trust_3: "Un navigator capacitado revisa tu solicitud antes de enviarla.",
    welcome_cta: "Comenzar mi solicitud →",
    welcome_returning: "¿Ya empezaste?",
    welcome_signin_link: "Inicia sesión para continuar",

    // ─── Pestañas de navegación ───
    home_nav_what: "Qué es SNAP",
    home_nav_apply: "Solicitar ahora",
    home_nav_why: "Por qué Civica",
    home_nav_signin: "Iniciar sesión",

    // ─── Hero ───
    home_hero_eyebrow: "CalFresh para California",
    home_hero_title: "¿Calificas para comestibles gratis?",
    home_hero_body: "Civica lee las reglas de CalFresh de California y te guía por la solicitud en 10 minutos. No se requiere ingreso mínimo.",
    home_hero_secondary: "Inicia sesión para continuar",

    // ─── Qué es SNAP ───
    home_what_title: "¿Qué es SNAP?",
    home_what_body: "SNAP es dinero mensual para comprar comida, cargado en una tarjeta que usas igual que una de débito. Quizás lo conozcas con otro nombre — CalFresh en California, EBT o estampillas de comida — pero es el mismo programa federal. No es un préstamo y nunca tienes que devolverlo.",

    // ─── Qué puedes comprar ───
    home_buy_title: "Qué puedes comprar con SNAP",
    home_buy_can_label: "Sí — comida para llevar a casa",
    home_buy_can: "Frutas y verduras|Carne, pescado y huevos|Leche, queso y yogur|Pan, arroz y cereal|Bocadillos y bebidas sin alcohol|Semillas y plantas que dan alimento",
    home_buy_cant: "Comida caliente o preparada|Alcohol y tabaco|Vitaminas y medicinas|Jabón, pañales y artículos del hogar|Comida para mascotas",
    home_cant_q: "¿Qué no puedo comprar con SNAP?",
    home_findfood_title: "Encuentra comida y tiendas EBT cerca de ti",
    home_findfood_body: "La app de Civica ubica bancos de alimentos, comidas gratis y tiendas que aceptan tu tarjeta EBT cerca de ti.",

    // ─── Guía de ingresos ───
    home_income_title: "¿Cuánto puedo ganar y aún calificar?",
    home_income_intro: "Estas cifras son orientativas — muchos estados, incluido California, usan el extremo más alto que se muestra aquí.",
    home_income_col_size: "Tamaño del hogar",
    home_income_col_amount: "Ingreso mensual (aprox.)",
    home_income_person: "persona",
    home_income_people: "personas",
    home_income_benefit: "Si te aprueban, los beneficios llegan hasta cerca de {max} al mes para una persona — y más para un hogar más grande.",
    home_income_note: "Esto es una guía, no un límite. Muchas personas que creen que ganan demasiado sí califican una vez que se cuentan la renta, el cuidado de niños y los gastos médicos. La única forma de saberlo es solicitar — y Civica calcula el límite real de tu estado por ti.",

    // ─── Preguntas frecuentes ───
    home_faq_title: "Preguntas que la gente hace",
    home_faq_q1: "¿No es SNAP igual en todas partes?",
    home_faq_a1: "No — y esa es la parte confusa. SNAP es un programa federal, pero cada estado lo maneja un poco diferente. Hasta el nombre cambia: SNAP en la mayoría de los estados, CalFresh en California, \"estampillas de comida\" para muchas personas. Los límites de ingresos, los documentos que necesitas y las reglas sobre estudiantes, autos y ahorros los fija cada estado. Civica lee las reglas de tu estado por ti y solo te pide lo que tu estado realmente necesita.",
    home_faq_q2: "¿Gano demasiado para calificar?",
    home_faq_a2: "Probablemente no tanto como crees. La mayoría de los estados permiten ganar bastante más que la guía federal, y gastos como la renta, el cuidado de niños y las facturas médicas reducen el ingreso que realmente cuentan. Muchas personas que trabajan, personas mayores, estudiantes y familias califican — aunque las reglas exactas (sobre todo para estudiantes) dependen de tu estado. La única forma de saberlo es revisar, y nosotros hacemos ese cálculo por ti.",
    home_faq_q3: "¿Le estoy quitando comida a alguien que la necesita más?",
    home_faq_a3: "No. SNAP no es una olla fija que se acaba — tu beneficio no reduce el de nadie más. Si calificas, la ayuda está ahí para ti.",
    home_faq_q4: "¿Tengo que devolverlo?",
    home_faq_a4: "No. SNAP no es un préstamo. Ya has aportado a través de tus impuestos — es ayuda que te has ganado, no una deuda.",
    home_faq_q5: "¿Afecta mi estatus migratorio?",
    home_faq_a5: "Para la mayoría de las familias, no. SNAP no se cuenta como \"carga pública\", y solicitar para tus hijos elegibles no te pone en riesgo. Estas reglas pueden ser específicas, así que si tienes dudas, te conectamos con ayuda gratuita y confidencial antes de presentar la solicitud.",

    // ─── App island ───
    home_app_cta: "Obtén la app →",

    // ─── Cómo funciona ───
  },
  zh: {
    welcome_title: "约 10 分钟即可申请 CalFresh",
    welcome_subtitle: "Civica 一步步引导你完成申请,并自动保存进度。",
    welcome_trust_label: "为什么选择 Civica",
    welcome_trust_1: "每月可获得购买食品的钱,存入 EBT 卡。",
    welcome_trust_2: "你的信息已加密,仅与州政府共享以处理你的申请。",
    welcome_trust_3: "经过培训的导航员会在提交前审核你的申请。",
    welcome_cta: "开始我的申请 →",
    welcome_returning: "已经开始了?",
    welcome_signin_link: "登录以继续",

    home_nav_what: "什么是 SNAP",
    home_nav_apply: "立即申请",
    home_nav_why: "为什么选择 Civica",
    home_nav_signin: "登录",

    home_hero_eyebrow: "加州 CalFresh",
    home_hero_title: "你有资格获得免费食品吗？",
    home_hero_body: "Civica 为您解读加州 CalFresh 规则,并在 10 分钟内引导您完成申请。不需要最低收入。",
    home_hero_secondary: "登录以继续",

    home_what_title: "什么是 SNAP?",
    home_what_body: "SNAP 是每月用于购买食品的钱,存入一张像借记卡一样使用的卡。它可能有别的名字——在加州叫 CalFresh,也有人叫 EBT 或食品券——但都是同一个联邦项目。它不是贷款,永远不用偿还。",

    home_buy_title: "可以用它买什么",
    home_buy_can_label: "可以——带回家的食物",
    home_buy_can: "水果和蔬菜|肉、鱼和蛋|牛奶、奶酪和酸奶|面包、米和谷物|零食和无酒精饮料|可种植食物的种子和植物",
    home_buy_cant: "热食或熟食|酒类和烟草|维生素和药品|肥皂、尿布和家居用品|宠物食品",
    home_cant_q: "SNAP 不能买什么?",
    home_findfood_title: "查找附近的食品和 EBT 商店",
    home_findfood_body: "Civica 应用会在地图上显示附近的食物银行、免费餐点,以及接受 EBT 卡的商店。",

    home_income_title: "我能挣多少还能符合资格?",
    home_income_intro: "以下数字仅供参考——许多州(包括加州)采用这里显示的较高标准。",
    home_income_col_size: "家庭人数",
    home_income_col_amount: "每月收入(约)",
    home_income_person: "人",
    home_income_people: "人",
    home_income_benefit: "如果获批,一个人的福利最高约为每月 {max}——家庭人数越多,金额越高。",
    home_income_note: "这只是参考,不是上限。很多以为自己挣得太多的人,在算上房租、托儿和医疗费用后其实符合资格。唯一确定的方法就是申请——Civica 会替你算出你所在州的真实限额。",

    home_faq_title: "人们常问的问题",
    home_faq_q1: "SNAP 在各地不是都一样吗?",
    home_faq_a1: "不一样——这正是让人困惑的地方。SNAP 是一个联邦项目,但每个州的做法都略有不同。连名字都会变:大多数州叫 SNAP,加州叫 CalFresh,很多人叫“食品券”。收入限额、所需文件,以及关于学生、车辆和存款的规定,都由各州自行决定。Civica 会替你解读你所在州的规定,只询问你所在州真正需要的内容。",
    home_faq_q2: "我挣得太多,会不会不符合资格?",
    home_faq_a2: "可能没有你想的那么多。大多数州允许的收入远高于联邦标准,而房租、托儿和医疗账单等支出会降低实际计算的收入。许多有工作的人、长者、学生和家庭都符合资格——不过具体规定(尤其是学生)取决于你所在的州。唯一确定的方法就是核对,我们会替你做这个计算。",
    home_faq_q3: "我是不是抢走了更需要的人的食物?",
    home_faq_a3: "不会。SNAP 不是一个会用完的固定额度——你的福利不会减少别人的。只要你符合资格,这份帮助就属于你。",
    home_faq_q4: "我需要偿还吗?",
    home_faq_a4: "不需要。SNAP 不是贷款。你已经通过纳税为它做出了贡献——这是你应得的帮助,不是债务。",
    home_faq_q5: "它会影响我的移民身份吗?",
    home_faq_a5: "对大多数家庭来说,不会。SNAP 不算作“公共负担”,为符合资格的孩子申请也不会让你面临风险。这些规定可能很具体,如果你不确定,我们会在你提交前为你介绍免费、保密的帮助。",

    home_app_cta: "获取应用 →",

  },
  vi: {
    welcome_title: "Đăng ký CalFresh trong khoảng 10 phút",
    welcome_subtitle: "Civica hướng dẫn bạn từng bước và tự động lưu tiến trình của bạn.",
    welcome_trust_label: "Vì sao chọn Civica",
    welcome_trust_1: "Tiền mua thực phẩm mỗi tháng, nạp vào thẻ EBT.",
    welcome_trust_2: "Thông tin của bạn được mã hóa và chỉ chia sẻ với tiểu bang để xử lý đơn của bạn.",
    welcome_trust_3: "Một nhân viên hỗ trợ được đào tạo sẽ xem xét đơn của bạn trước khi nộp.",
    welcome_cta: "Bắt đầu đơn của tôi →",
    welcome_returning: "Đã bắt đầu rồi?",
    welcome_signin_link: "Đăng nhập để tiếp tục",

    home_nav_what: "SNAP là gì",
    home_nav_apply: "Đăng ký ngay",
    home_nav_why: "Vì sao chọn Civica",
    home_nav_signin: "Đăng nhập",

    home_hero_eyebrow: "CalFresh cho California",
    home_hero_title: "Bạn có đủ điều kiện nhận thực phẩm miễn phí không?",
    home_hero_body: "Civica đọc các quy tắc CalFresh của California và hướng dẫn bạn qua đơn đăng ký trong 10 phút. Không yêu cầu thu nhập tối thiểu.",
    home_hero_secondary: "Đăng nhập để tiếp tục",

    home_what_title: "SNAP là gì?",
    home_what_body: "SNAP là tiền hằng tháng để mua thực phẩm, nạp vào một thẻ bạn dùng như thẻ ghi nợ. Bạn có thể biết nó với tên khác — CalFresh ở California, EBT, hay tem phiếu thực phẩm — nhưng đều là cùng một chương trình liên bang. Đây không phải khoản vay và không bao giờ phải trả lại.",

    home_buy_title: "Bạn có thể mua gì bằng SNAP",
    home_buy_can_label: "Được — thực phẩm mang về nhà",
    home_buy_can: "Trái cây và rau|Thịt, cá và trứng|Sữa, phô mai và sữa chua|Bánh mì, gạo và ngũ cốc|Đồ ăn vặt và đồ uống không cồn|Hạt giống và cây trồng ra thực phẩm",
    home_buy_cant: "Đồ ăn nóng hoặc chế biến sẵn|Rượu bia và thuốc lá|Vitamin và thuốc men|Xà phòng, tã và đồ gia dụng|Thức ăn cho thú cưng",
    home_cant_q: "Tôi không thể mua gì bằng SNAP?",
    home_findfood_title: "Tìm thực phẩm và cửa hàng EBT gần bạn",
    home_findfood_body: "Ứng dụng Civica hiển thị bản đồ các ngân hàng thực phẩm, bữa ăn miễn phí và cửa hàng chấp nhận thẻ EBT gần bạn.",

    home_income_title: "Tôi kiếm được bao nhiêu mà vẫn đủ điều kiện?",
    home_income_intro: "Đây là các mốc tham khảo — nhiều tiểu bang, gồm California, dùng mức cao hơn hiển thị bên dưới.",
    home_income_col_size: "Số người trong hộ",
    home_income_col_amount: "Thu nhập hằng tháng (khoảng)",
    home_income_person: "người",
    home_income_people: "người",
    home_income_benefit: "Nếu được duyệt, trợ cấp lên tới khoảng {max} mỗi tháng cho một người — và nhiều hơn cho hộ đông người hơn.",
    home_income_note: "Đây là hướng dẫn, không phải giới hạn. Nhiều người nghĩ mình kiếm quá nhiều nhưng thực ra vẫn đủ điều kiện sau khi tính tiền thuê nhà, giữ trẻ và chi phí y tế. Cách duy nhất để biết là nộp đơn — và Civica sẽ tính ra hạn mức thực của tiểu bang bạn.",

    home_faq_title: "Những câu hỏi thường gặp",
    home_faq_q1: "SNAP không phải giống nhau ở mọi nơi sao?",
    home_faq_a1: "Không — và đó là phần gây bối rối. SNAP là một chương trình liên bang, nhưng mỗi tiểu bang vận hành hơi khác nhau. Ngay cả tên gọi cũng thay đổi: SNAP ở hầu hết các bang, CalFresh ở California, “tem phiếu thực phẩm” với nhiều người. Hạn mức thu nhập, giấy tờ cần nộp, và quy định về sinh viên, xe cộ và tiền tiết kiệm đều do từng tiểu bang đặt ra. Civica đọc quy định của tiểu bang bạn và chỉ hỏi những gì tiểu bang bạn thực sự cần.",
    home_faq_q2: "Tôi kiếm quá nhiều nên không đủ điều kiện?",
    home_faq_a2: "Có lẽ không nhiều như bạn nghĩ. Hầu hết các tiểu bang cho phép thu nhập cao hơn nhiều so với hướng dẫn liên bang, và các chi phí như tiền thuê nhà, giữ trẻ và hóa đơn y tế làm giảm thu nhập thực được tính. Nhiều người đi làm, người cao tuổi, sinh viên và gia đình đều đủ điều kiện — dù quy định chính xác (nhất là với sinh viên) tùy theo tiểu bang. Cách duy nhất để biết là kiểm tra, và chúng tôi làm phép tính đó giúp bạn.",
    home_faq_q3: "Tôi có đang lấy mất thực phẩm của người cần hơn không?",
    home_faq_a3: "Không. SNAP không phải một khoản cố định sẽ cạn — trợ cấp của bạn không làm giảm của ai khác. Nếu bạn đủ điều kiện, sự trợ giúp đó là dành cho bạn.",
    home_faq_q4: "Tôi có phải trả lại không?",
    home_faq_a4: "Không. SNAP không phải khoản vay. Bạn đã đóng góp qua tiền thuế của mình — đây là sự trợ giúp bạn xứng đáng nhận, không phải món nợ.",
    home_faq_q5: "Nó có ảnh hưởng đến tình trạng di trú của tôi không?",
    home_faq_a5: "Với hầu hết các gia đình, không. SNAP không bị tính là “gánh nặng xã hội” (public charge), và nộp đơn cho con đủ điều kiện không khiến bạn gặp rủi ro. Các quy định này có thể rất cụ thể, nên nếu bạn không chắc, chúng tôi sẽ giới thiệu bạn đến sự trợ giúp miễn phí, bảo mật trước khi bạn nộp.",

    home_app_cta: "Tải ứng dụng →",

  },
  tl: {
    welcome_title: "Mag-apply para sa CalFresh sa mga 10 minuto",
    welcome_subtitle: "Ginagabayan ka ng Civica nang hakbang-hakbang at sini-save ang iyong progreso.",
    welcome_trust_label: "Bakit Civica",
    welcome_trust_1: "Pera para sa pagkain kada buwan, nilalagay sa EBT card.",
    welcome_trust_2: "Naka-encrypt ang iyong impormasyon at ibinabahagi lamang sa estado para iproseso ang iyong aplikasyon.",
    welcome_trust_3: "May sanay na navigator na sumusuri sa iyong aplikasyon bago ito isumite.",
    welcome_cta: "Simulan ang aking aplikasyon →",
    welcome_returning: "Nagsimula na?",
    welcome_signin_link: "Mag-sign in para magpatuloy",

    home_nav_what: "Ano ang SNAP",
    home_nav_apply: "Mag-apply na",
    home_nav_why: "Bakit Civica",
    home_nav_signin: "Mag-sign in",

    home_hero_eyebrow: "CalFresh para sa California",
    home_hero_title: "Kwalipikado ka ba para sa libreng pagkain?",
    home_hero_body: "Binabasa ng Civica ang mga patakaran ng CalFresh sa California at ginagabayan ka sa aplikasyon sa loob ng 10 minuto. Hindi kailangan ng minimum na kita.",
    home_hero_secondary: "Mag-sign in para magpatuloy",

    home_what_title: "Ano ang SNAP?",
    home_what_body: "Ang SNAP ay buwanang pera para sa pagkain, nasa isang card na ginagamit mo na parang debit card. Maaaring kilala mo ito sa ibang pangalan — CalFresh sa California, EBT, o food stamps — pero iisang pederal na programa lang ito. Hindi ito utang at hindi kailangang bayaran kailanman.",

    home_buy_title: "Ano ang pwede mong bilhin gamit ito",
    home_buy_can_label: "Oo — pagkaing iuuwi",
    home_buy_can: "Prutas at gulay|Karne, isda at itlog|Gatas, keso at yogurt|Tinapay, bigas at cereal|Meryenda at inuming walang alak|Buto at halamang nagbubunga ng pagkain",
    home_buy_cant: "Mainit o nakahandang pagkain|Alak at tabako|Bitamina at gamot|Sabon, diaper at gamit sa bahay|Pagkain ng alagang hayop",
    home_cant_q: "Ano ang hindi ko mabibili gamit ang SNAP?",
    home_findfood_title: "Maghanap ng pagkain at EBT store malapit sa iyo",
    home_findfood_body: "Ipinapakita ng Civica app ang mga food bank, libreng pagkain, at tindahang tumatanggap ng EBT card na malapit sa iyo.",

    home_income_title: "Magkano ang pwede kong kitain at kwalipikado pa rin?",
    home_income_intro: "Mga panimulang gabay lang ito — maraming estado, kasama ang California, ang gumagamit ng mas mataas na antas na ipinapakita rito.",
    home_income_col_size: "Laki ng sambahayan",
    home_income_col_amount: "Buwanang kita (humigit-kumulang)",
    home_income_person: "tao",
    home_income_people: "tao",
    home_income_benefit: "Kung maaprubahan, ang benepisyo ay umaabot hanggang mga {max} kada buwan para sa isang tao — at mas mataas para sa mas malaking sambahayan.",
    home_income_note: "Gabay ito, hindi hangganan. Maraming nag-aakalang masyadong malaki ang kita nila ay kwalipikado pala kapag isinama na ang upa, pag-aalaga ng bata, at gastusing medikal. Ang tanging paraan para malaman ay mag-apply — at kukwentahin ng Civica ang totoong limitasyon ng iyong estado para sa iyo.",

    home_faq_title: "Mga tanong ng mga tao",
    home_faq_q1: "Hindi ba pareho ang SNAP saan man?",
    home_faq_a1: "Hindi — at iyan ang nakalilito. Ang SNAP ay iisang pederal na programa, pero bahagyang magkaiba ang pagpapatakbo nito sa bawat estado. Kahit ang pangalan ay nagbabago: SNAP sa karamihan ng estado, CalFresh sa California, “food stamps” para sa marami. Ang mga limitasyon sa kita, ang mga dokumentong kailangan, at ang mga patakaran tungkol sa estudyante, sasakyan, at ipon ay itinatakda ng bawat estado. Binabasa ng Civica ang mga patakaran ng iyong estado para sa iyo at tinatanong lang ang talagang kailangan ng estado mo.",
    home_faq_q2: "Masyado ba akong malaki ang kita para maging kwalipikado?",
    home_faq_a2: "Malamang hindi kasing-laki ng iniisip mo. Pinapayagan ng karamihan ng estado ang kita na mas mataas kaysa sa pederal na gabay, at ang mga gastos tulad ng upa, pag-aalaga ng bata, at mga bayarin sa medikal ay nagpapababa sa kita na talagang binibilang. Maraming nagtatrabaho, nakatatanda, estudyante, at pamilya ang kwalipikado — bagaman ang eksaktong patakaran (lalo na sa mga estudyante) ay depende sa iyong estado. Ang tanging paraan para malaman ay suriin, at ginagawa namin ang kuwentang iyon para sa iyo.",
    home_faq_q3: "Inaagawan ko ba ng pagkain ang mas nangangailangan?",
    home_faq_a3: "Hindi. Ang SNAP ay hindi isang takdang pondo na nauubos — ang benepisyo mo ay hindi nagpapababa sa kanino man. Kung kwalipikado ka, nariyan ang tulong para sa iyo.",
    home_faq_q4: "Kailangan ko ba itong bayaran?",
    home_faq_a4: "Hindi. Ang SNAP ay hindi utang. Nakapag-ambag ka na rito sa pamamagitan ng iyong buwis — tulong ito na nararapat sa iyo, hindi utang.",
    home_faq_q5: "Maaapektuhan ba nito ang aking katayuan sa imigrasyon?",
    home_faq_a5: "Para sa karamihan ng pamilya, hindi. Ang SNAP ay hindi itinuturing na “public charge,” at ang pag-apply para sa iyong kwalipikadong mga anak ay hindi naglalagay sa iyo sa panganib. Ang mga patakarang ito ay maaaring tiyak, kaya kung hindi ka sigurado, ituturo namin sa iyo ang libre at kumpidensyal na tulong bago ka mag-file.",

    home_app_cta: "Kunin ang app →",

  },
} as const satisfies Record<Locale, Record<string, string>>;

export type WelcomeStringKey = keyof (typeof welcomeStrings)["en"];
