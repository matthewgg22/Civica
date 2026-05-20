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
    ctaQualify: "See if you qualify",
    ctaTestFlight: "Get the app (TestFlight)",

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

    languageToggleAria: "Switch language",
  },
  es: {
    eyebrow: "AHORA EN CALIFORNIA",
    heroHeadline:
      "Si eres estudiante de medio tiempo en un Community College, CSU o UC, probablemente calificas para CalFresh ahora.",
    heroSub:
      "Toma unos 10 minutos aplicar. No se requiere ingreso mínimo.",
    ctaQualify: "Ver si calificas",
    ctaTestFlight: "Obtén la app (TestFlight)",

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

    languageToggleAria: "Cambiar idioma",
  },
} satisfies Record<Locale, Record<string, string>>;

export type StringKey = keyof (typeof strings)["en"];
export type Copy = (typeof strings)[Locale];
