// Landing-page bilingual dictionary. Standalone so we don't pull
// @civica/snap-compliance-copy (which is scoped to SNAP-specific notices) into
// a marketing page. Keep strings concise, journalistic, on-brand.

export type Locale = "en" | "es";

export const LOCALES: Locale[] = ["en", "es"];

export const STORAGE_KEY = "civica-web.locale";

export const strings = {
  en: {
    eyebrow: "NEW IN CALIFORNIA — JUNE 2026",
    heroHeadline:
      "If you're a half-time student at a Community College, CSU, or UC, you likely qualify for CalFresh now.",
    heroSub:
      "The rules changed. Many students who were told no before are eligible today.",
    ctaQualify: "See if you qualify",
    ctaTestFlight: "Get the app (TestFlight)",

    whatTitle: "What's CalFresh?",
    whatBody:
      "CalFresh (SNAP) puts up to ~$292/month on a card for groceries. The average eligible California Community College student is missing this benefit because they didn't know the rules just changed.",

    formTitle: "Tell us where you go to school.",
    formSub: "We'll text you when our app is ready for your campus.",
    fieldEmail: "Email",
    fieldPhone: "Phone (optional)",
    fieldCampus: "Campus",
    fieldCampusPlaceholder: "Select your campus…",
    formSubmit: "Notify me",
    formSubmitting: "Submitting…",
    formSuccess: "Thanks — we'll reach out when Civica is live on your campus.",
    formError: "Something went wrong. Please try again.",
    formValidationError: "Please enter a valid email.",
    formCampusRequired: "Please choose your campus.",

    footer: "Civica — built for California students.",
    languageToggleAria: "Switch language",
  },
  es: {
    eyebrow: "NUEVO EN CALIFORNIA — JUNIO 2026",
    heroHeadline:
      "Si eres estudiante de medio tiempo en un Community College, CSU o UC, probablemente calificas para CalFresh ahora.",
    heroSub:
      "Las reglas cambiaron. Muchos estudiantes a quienes les dijeron que no antes son elegibles hoy.",
    ctaQualify: "Ver si calificas",
    ctaTestFlight: "Obtén la app (TestFlight)",

    whatTitle: "¿Qué es CalFresh?",
    whatBody:
      "CalFresh (SNAP) deposita hasta ~$292/mes en una tarjeta para comestibles. El estudiante promedio elegible en los Community Colleges de California no recibe este beneficio porque no sabía que las reglas acaban de cambiar.",

    formTitle: "Cuéntanos dónde estudias.",
    formSub:
      "Te enviaremos un mensaje cuando nuestra app esté lista para tu campus.",
    fieldEmail: "Correo electrónico",
    fieldPhone: "Teléfono (opcional)",
    fieldCampus: "Campus",
    fieldCampusPlaceholder: "Selecciona tu campus…",
    formSubmit: "Avísame",
    formSubmitting: "Enviando…",
    formSuccess:
      "Gracias — te contactaremos cuando Civica esté disponible en tu campus.",
    formError: "Algo salió mal. Por favor intenta de nuevo.",
    formValidationError: "Por favor ingresa un correo válido.",
    formCampusRequired: "Por favor elige tu campus.",

    footer: "Civica — hecho para estudiantes de California.",
    languageToggleAria: "Cambiar idioma",
  },
} satisfies Record<Locale, Record<string, string>>;

export type StringKey = keyof (typeof strings)["en"];
export type Copy = (typeof strings)[Locale];
