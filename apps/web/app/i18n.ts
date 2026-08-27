// Landing-page bilingual dictionary. Standalone so we don't pull
// @civica/snap-compliance-copy (which is scoped to SNAP-specific notices) into
// a marketing page. Keep strings concise, journalistic, on-brand.

// The applicant portal serves California's largest LEP communities. Mirrors
// the iOS CivicaText catalog (en + es + zh + vi + tl).
export type Locale = "en" | "es" | "zh" | "vi" | "tl";

export const LOCALES: Locale[] = ["en", "es", "zh", "vi", "tl"];

// Native-name labels for the language picker.
export const LANGUAGE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  vi: "Tiếng Việt",
  tl: "Tagalog",
};

// The landing marketing page only ships en/es copy; its toggle stays binary.
export type LandingLocale = "en" | "es";

export const STORAGE_KEY = "civica-web.locale";

export const strings = {
  en: {
    eyebrow: "CalFresh for California Students",
    heroHeadline: "Do you qualify for CalFresh?",
    heroSub:
      "Civica walks you through the 10-minute application. No prior knowledge needed. No minimum income required.",
    ctaCheckQualify: "Check if I qualify →",
    ctaAlreadyApplied: "Already applied? Sign in →",
    ctaStartApplication: "Start your application",
    ctaQualify: "See if you qualify",
    navSignIn: "Sign in",
    ctaIslandLabel: "Apply on your iPhone",
    ctaIslandSub: "CalFresh in your pocket",
    ctaIslandBtn: "Get the app →",
    ctaIslandDismiss: "Close app download prompt",

    trustChipUSDA: "✓ USDA-verified rules",
    trustChipCBO: "✓ 38+ CBO partners",
    trustChipStudents: "✓ 34,000 students helped",
    phoneAlt: "Civica iOS app showing CalFresh application status",

    processTitle: "How it works",
    step1Title: "Check eligibility",
    step1Body: "Answer a few questions about your household income and situation. Takes about 2 minutes.",
    step2Title: "Apply with guidance",
    step2Body: "We pull the right CalFresh forms and explain each question in plain language. About 8 minutes.",
    step3Title: "EBT card in ~30 days",
    step3Body: "Your card arrives in the mail. Use it like a debit card at any grocery store.",

    ecosystemTitle: "One connected system",
    ecosystemSub: "Start on web, continue on iOS, get support from a CBO partner. Your progress syncs everywhere.",
    ecosystemIOSTitle: "iOS App",
    ecosystemIOSBody: "Apply and track from your iPhone. Biometric login, push notifications for status updates.",
    ecosystemWebTitle: "Web",
    ecosystemWebBody: "Full application in any browser. No app download needed. Works on every device.",
    ecosystemCBOTitle: "CBO Dashboard",
    ecosystemCBOBody: "38+ partner organizations guide applicants through the process step by step.",
    ecosystemFootnote: "Your data syncs automatically. Start anywhere, continue anywhere.",

    appBannerTitle: "Track your application from your phone",
    appBannerSub: "Available on iOS",
    appBannerCTA: "Get the app →",

    whatTitle: "Up to $292/month for groceries",
    whatBody:
      "CalFresh (SNAP) loads money onto a card you use like a debit card at any grocery store. Most eligible California Community College students don't claim it. They don't know the rules just changed.",

    formTitle: "Get notified when your campus launches.",
    formSub: "We'll text you as soon as Civica is ready for your school.",
    fieldEmail: "Email",
    fieldPhone: "Phone (optional)",
    fieldCampus: "Campus",
    fieldCampusPlaceholder: "Choose one…",
    formSubmit: "Notify me",
    formSubmitting: "Submitting…",
    formSuccess: "You're on the list. We'll text you when Civica is ready for your campus.",
    formError: "Something went wrong. Please try again.",
    formErrorRateLimit: "Too many attempts. Please wait a few minutes and try again.",
    formValidationError: "Please enter a valid email.",
    formValidationErrorPhone: "Please enter a valid phone number (at least 7 digits).",
    formCampusRequired: "Please choose your campus.",

    formDraftRestored:
      "We saved what you started. Feel free to keep going where you left off.",
    formDraftClear: "Clear draft",

    languageToggleAria: "Switch language",

    errorStatus: "SOMETHING WENT WRONG",
    errorTitle: "We hit an unexpected error.",
    errorBody:
      "Our team has been notified. You can try again, or head back to the home page.",
    errorReferenceLabel: "Reference",
    errorRetryCta: "Try again",
    errorHomeCta: "Back to Civica",

    notFoundStatus: "PAGE NOT FOUND",
    notFoundTitle: "That page does not exist.",
    notFoundBody:
      "The link may be outdated. Civica helps half-time California Community College, CSU, and UC students apply for CalFresh.",
    notFoundHomeCta: "Go to Civica",
    notFoundQualifyCta: "See if you qualify",
  },
  es: {
    eyebrow: "CalFresh para Estudiantes de California",
    heroHeadline: "¿Calificas para CalFresh?",
    heroSub:
      "Civica te guía por la solicitud de 10 minutos. Sin conocimiento previo requerido. No se requiere ingreso mínimo.",
    ctaCheckQualify: "Ver si califico →",
    ctaAlreadyApplied: "¿Ya solicitaste? Iniciar sesión →",
    ctaStartApplication: "Comienza tu solicitud",
    ctaQualify: "Ver si calificas",
    navSignIn: "Iniciar sesión",
    ctaIslandLabel: "Solicita en tu iPhone",
    ctaIslandSub: "CalFresh en tu bolsillo",
    ctaIslandBtn: "Obtén la app →",
    ctaIslandDismiss: "Cerrar aviso de descarga",

    trustChipUSDA: "✓ Reglas verificadas por USDA",
    trustChipCBO: "✓ 38+ organizaciones asociadas",
    trustChipStudents: "✓ 34,000 estudiantes ayudados",
    phoneAlt: "App Civica en iOS mostrando el estado de la solicitud de CalFresh",

    processTitle: "Cómo funciona",
    step1Title: "Verifica elegibilidad",
    step1Body: "Responde algunas preguntas sobre los ingresos de tu hogar. Toma unos 2 minutos.",
    step2Title: "Solicita con orientación",
    step2Body: "Obtenemos los formularios correctos de CalFresh y explicamos cada pregunta en lenguaje sencillo. Unos 8 minutos.",
    step3Title: "Tarjeta EBT en ~30 días",
    step3Body: "Tu tarjeta llega por correo. Úsala como débito en cualquier supermercado.",

    ecosystemTitle: "Un sistema conectado",
    ecosystemSub: "Empieza en web, continúa en iOS, recibe apoyo de una organización asociada. Tu progreso se sincroniza en todos lados.",
    ecosystemIOSTitle: "App iOS",
    ecosystemIOSBody: "Solicita y da seguimiento desde tu iPhone. Inicio con biometría, notificaciones de estado.",
    ecosystemWebTitle: "Web",
    ecosystemWebBody: "Solicitud completa en cualquier navegador. Sin necesidad de descargar app.",
    ecosystemCBOTitle: "Panel CBO",
    ecosystemCBOBody: "Más de 38 organizaciones asociadas guían a los solicitantes paso a paso.",
    ecosystemFootnote: "Tus datos se sincronizan automáticamente. Empieza donde quieras, continúa donde quieras.",

    appBannerTitle: "Da seguimiento a tu solicitud desde tu teléfono",
    appBannerSub: "Disponible en iOS",
    appBannerCTA: "Obtén la app →",

    whatTitle: "Hasta $292/mes para comestibles",
    whatBody:
      "CalFresh (SNAP) carga dinero en una tarjeta que usas como débito en cualquier supermercado. La mayoría de los estudiantes elegibles en California no lo solicitan. No sabían que las reglas acaban de cambiar.",

    formTitle: "Recibe una notificación cuando tu campus esté listo.",
    formSub:
      "Te enviaremos un mensaje en cuanto Civica esté lista para tu escuela.",
    fieldEmail: "Correo electrónico",
    fieldPhone: "Teléfono (opcional)",
    fieldCampus: "Campus",
    fieldCampusPlaceholder: "Elige uno…",
    formSubmit: "Avísame",
    formSubmitting: "Enviando…",
    formSuccess: "Estás en la lista. Te avisaremos por mensaje cuando Civica esté lista para tu campus.",
    formError: "Algo salió mal. Por favor intenta de nuevo.",
    formErrorRateLimit: "Demasiados intentos. Por favor espera unos minutos y vuelve a intentarlo.",
    formValidationError: "Por favor ingresa un correo válido.",
    formValidationErrorPhone: "Por favor ingresa un número de teléfono válido (mínimo 7 dígitos).",
    formCampusRequired: "Por favor elige tu campus.",

    formDraftRestored:
      "Guardamos lo que empezaste. Continúa donde lo dejaste.",
    formDraftClear: "Borrar borrador",

    languageToggleAria: "Cambiar idioma",

    errorStatus: "ALGO SALIÓ MAL",
    errorTitle: "Encontramos un error inesperado.",
    errorBody:
      "Nuestro equipo ha sido notificado. Puedes intentar de nuevo o volver al inicio.",
    errorReferenceLabel: "Referencia",
    errorRetryCta: "Intentar de nuevo",
    errorHomeCta: "Volver a Civica",

    notFoundStatus: "PÁGINA NO ENCONTRADA",
    notFoundTitle: "Esa página no existe.",
    notFoundBody:
      "El enlace puede estar desactualizado. Civica ayuda a estudiantes de medio tiempo en Community Colleges, CSU y UC de California a solicitar CalFresh.",
    notFoundHomeCta: "Ir a Civica",
    notFoundQualifyCta: "Ver si calificas",
  },
} satisfies Record<LandingLocale, Record<string, string>>;

export type StringKey = keyof (typeof strings)["en"];
export type Copy = (typeof strings)["en"];
