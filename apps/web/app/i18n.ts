// Landing-page bilingual dictionary. Standalone so we don't pull
// @civica/snap-compliance-copy (which is scoped to SNAP-specific notices) into
// a marketing page. Keep strings concise, journalistic, on-brand.

export type Locale = "en" | "es";

export const LOCALES: Locale[] = ["en", "es"];

export const STORAGE_KEY = "civica-web.locale";

export const strings = {
  en: {
    eyebrow: "NOW IN CALIFORNIA",
    heroHeadline:
      "If you're a half-time student at a Community College, CSU, or UC, you likely qualify for CalFresh now.",
    heroSub:
      "Takes about 10 minutes to apply. No minimum income required.",
    ctaStartApplication: "Start your application",
    ctaQualify: "See if you qualify",
    ctaIslandLabel: "Apply on your iPhone",
    ctaIslandSub: "CalFresh in your pocket",
    ctaIslandBtn: "Get the app →",
    ctaIslandDismiss: "Close app download prompt",

    whatTitle: "Up to $292/month for groceries",
    whatBody:
      "CalFresh (SNAP) loads money onto a card you use like a debit card at any grocery store. Most eligible California Community College students don't claim it — they don't know the rules just changed.",

    formTitle: "Tell us where you go to school.",
    formSub: "We'll text you when our app is ready for your campus.",
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
      "We saved what you started — feel free to keep going where you left off.",
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
    eyebrow: "AHORA EN CALIFORNIA",
    heroHeadline:
      "Si eres estudiante de medio tiempo en un Community College, CSU o UC, probablemente calificas para CalFresh ahora.",
    heroSub:
      "Toma unos 10 minutos aplicar. No se requiere ingreso mínimo.",
    ctaStartApplication: "Comienza tu solicitud",
    ctaQualify: "Ver si calificas",
    ctaIslandLabel: "Solicita en tu iPhone",
    ctaIslandSub: "CalFresh en tu bolsillo",
    ctaIslandBtn: "Obtén la app →",
    ctaIslandDismiss: "Cerrar aviso de descarga",

    whatTitle: "Hasta $292/mes para comestibles",
    whatBody:
      "CalFresh (SNAP) carga dinero en una tarjeta que usas como débito en cualquier supermercado. La mayoría de los estudiantes elegibles en California no lo solicitan — no sabían que las reglas acaban de cambiar.",

    formTitle: "Cuéntanos dónde estudias.",
    formSub:
      "Te enviaremos un mensaje cuando nuestra app esté lista para tu campus.",
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
      "Guardamos lo que empezaste — continúa donde lo dejaste.",
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
} satisfies Record<Locale, Record<string, string>>;

export type StringKey = keyof (typeof strings)["en"];
export type Copy = (typeof strings)[Locale];
