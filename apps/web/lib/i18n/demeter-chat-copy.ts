// Demeter chat + entry copy, per language.
//
// EXTRACTED FROM DemeterChat.tsx, which is a "use client" module. A server
// component cannot import a plain VALUE across the client boundary — only
// components survive it, and everything else arrives `undefined` at runtime.
// /screen/ask renders the entry card on the server and needs this table, so
// the table lives here, in a module with no "use client".
//
// It is the SAME table the chat uses. DemeterChat re-exports it, so existing
// imports and the retention-copy test are unchanged.
//
// The failure this prevents is quiet in dev and loud in prod: importing T from
// the client module typechecked fine, built fine, and only blew up at request
// time with "Cannot read properties of undefined (reading 'inputPlaceholder')".

// Exported for the retention-copy test (#703): the privacy line is a claim
// about what we store, so it is pinned per locale rather than left to whoever
// edits this table next.
export const T = {
  en: {
    // ASSENT, not decoration. Terms in a footer link is browsewrap, which courts
    // routinely refuse to enforce — and an unenforceable agreement takes the
    // arbitration clause and every disclaimer down with it. Notice has to be
    // conspicuous and ADJACENT to the act that manifests agreement, which for an
    // anonymous chat is sending the first message. Do not move this into the
    // footer, and do not shrink it below the disclaimer beside it.
    termsNotice: {
      before: 'By sending a message you agree to our ',
      terms: 'Terms',
      between: ' and ',
      privacy: 'Privacy Policy',
      after: '.',
    },
    title: "Demeter",
    tagline: "SNAP enrollment and eligibility assistance",
    inputPlaceholder: "Happy to answer any questions about SNAP…",
    // Once the chat is already going and the last answer didn't end in a
    // specific question to fall back on (pendingQuestion returns null), the
    // box used to revert to the FIRST-TIME invitation above — which reads
    // like Demeter forgot the conversation was happening (real feedback,
    // 2026-08-15). A shorter, conversation-aware line instead.
    inputPlaceholderContinue: "Ask a follow-up…",
    inputPlaceholderEstimate: "Tell me about your household, and I'll build it up…",
    send: "Send",
    stop: "Stop",
    stateLabel: "Your state",
    federal: "All states (federal rules)",
    verified: "Verified",
    federalBadge: "Federal guidance",
    dividerTo: (name: string) => `Now answering for ${name}. Earlier answers may not apply.`,
    dividerFederal: "Now answering with federal rules only. Earlier answers may not apply.",
    dividerUncovered: (place: string) =>
      `Demeter does not cover ${place} yet. Answers below use federal rules, and your local agency is the one to confirm with.`,
    // "Demeter is AI" up front, because someone who knows that reads the rest
    // differently. The agency is a LINK: telling somebody to check with an
    // office without saying which one is the same as not telling them.
    disclaimer: "Demeter is AI and can make mistakes. Please double-check cited sources and",
    disclaimerAgency: "your state agency",
    // Sits under the composer, where the decision to type is made — not in the
    // estimate rail, where it used to live and where it vanished entirely at
    // narrow widths. Names the three things redactPii cannot save someone from
    // (it strips structured identifiers but deliberately not names).
    piiHint: "Please don’t type your Social Security number or bank details.",
    // The wording is load-bearing. This clears THIS BROWSER; every question and
    // answer is still written to mae_query_log. Saying "clear" without saying
    // that would be the retention lie #703 fixed, rebuilt as a button.
    clear: "Start a new conversation",
    // Offered when someone names a place in the chat. An OFFER, never an
    // automatic switch: re-scoping on a guess answers the wrong state with more
    // confidence than before.
    stateOffer: "You mentioned {place}. Answer for {state}?",
    // Asked once, after the first answer — the toggle for this lives in the
    // right-hand panel, which nobody reads while taking in their first reply.
    // ONE LINE (owner, 2026-08-22). It ran to three lines beside two buttons
    // that already SAY the two options — "Just asking" and "Gather my
    // answers" — so the sentence spent its length re-describing them.
    modeOffer: "Want me to gather your answers into an application outline as we go?",
    modeOfferEstimate: "Gather my answers",
    modeOfferAsk: "Just asking",
    // Shown after several turns if the conversation hasn't been saved yet.
    // The Save button lives in the right-hand panel — same problem as
    // modeOffer above, nobody notices it there — and a real 15-turn
    // conversation with real content in it never once got an inline nudge
    // to keep it (#833 audit, 2026-08-15).
    saveNudge: "This is a long conversation to lose if you close the tab. Save it so you can come back to it?",
    saveNudgeYes: "Save it",
    saveNudgeNo: "Not now",
    // Shown in the transcript when a state is picked. The portal is where the
    // application actually goes; this is the one moment we know exactly which
    // link that is, so it should not be something they have to ask for.
    portalLead: "In {state}, you apply through {agency}.",
    portalCta: "Apply at {portal}",
    portalStay:
      "That is where the application is formally submitted, and the link is on your outlined application too, so you will not have to find it again.\n\n**_Shall we start working through what it asks for?_**",
    stateOfferYes: "Yes, use {state}",
    stateOfferNo: "No, keep as is",
    clearNote:
      "Removes it from this browser. We still keep the question and answer to check our accuracy.",
    cleared: "Conversation cleared.",
    err429: "Too many questions at once. Give it a minute and try again.",
    // DISTINCT from err429, matching a distinction the route already makes
    // deliberately. A per-minute rate limit resets in a minute; a daily cap
    // resets tomorrow. Telling someone to wait a minute for something that
    // resets tomorrow sends them into a retry loop.
    errDailyCap:
      "You have asked a lot of questions today. This resets tomorrow. For SNAP help right now, call 211 or your state SNAP agency.",
    errCapacity:
      "Demeter is at capacity for the month. For SNAP help right now, call 211 or your state SNAP agency.",
    errConfig: "Demeter isn't available yet. Please check back soon.",
    // WHOSE FAULT IT IS, because "something went wrong" told nobody anything —
     // not the reader deciding whether to retry, and not us when it was
     // reported. A failure on our side is worth retrying and worth telling us
     // about; a connection failure is worth checking their network for; a
     // request we could not read needs a different action entirely.
    errServer: "That failed on our side, not yours. Trying again usually works. If it keeps happening, please tell us.",
    errNetwork: "We couldn't reach Demeter. Check your connection and try again.",
    errRequest: "Demeter couldn't read that. Starting a new conversation usually clears it. A very long chat is the commonest cause.",
    thinking: "One moment",
    // The empty chat's own words. Three bare buttons floating in 414px of
    // measured whitespace read as stray controls; a mark, a line, and the
    // questions grouped under it read as an invitation.
    emptyTitle: "Ask me anything about SNAP",
    // USDA's OWN SENTENCE, reproduced rather than reworded (fns.usda.gov/snap).
    // It leads because the "What is SNAP?" link is gone (owner, 2026-08-22) —
    // someone who does not yet know what the program IS should not have to
    // leave the chat to find out. A US government work, so free to reproduce;
    // translated below because a definition nobody can read is not a
    // definition, and this is a program description, not a mandated notice.
    welcome: {
      title: "Food benefits, called SNAP",
      // TWO SHORT LINES, NOT TWO PARAGRAPHS. The card carried two dense blocks
      // and the reader had to mine both for the one fact that matters. Each
      // line makes ONE point now.
      signIn: "Sign in to save your conversation",
      continueWithout: "Continue without signing in",
      // LEADS WITH WHAT IT DOES. It opened on "is not the government and
      // cannot decide your case" — two negations before a word about what the
      // thing is for, which reads as a disclaimer wearing an introduction's
      // clothes. The disclaimer still has to be here (it is the confusion the
      // SNAP mark invites), it just does not go first.
      body: "Every answer quotes the rule it came from, so you can check it.",
      bodyTwo: "Demeter is not the government and cannot decide your case.",
      cta: "Start asking",
      close: "Close",
    },
    emptyWhatIsSnap:
      "SNAP (formerly known as food stamps) provides food benefits to low-income families to supplement their grocery budget so they can afford the nutritious food essential to health and well-being.",
    // SAYS WHAT IT DOES, and stops short of what it does not (owner, 2026-08-22).
    // "likely to qualify", never "find out if you are eligible": this produces
    // an ESTIMATE, and the panel two inches away says "an estimate, not a
    // decision". A chat that opens by promising an eligibility answer has
    // already made the claim the whole product is built to avoid.
    emptyLede:
      "I can help you see whether you\u2019re likely to qualify and build up your application as we go, quoting the rule behind every answer, so you can check it.",
    // Pre-chat framing (#898 P2-6): a real tester finished a full 25-turn
    // conversation without ever being told that SNAP is formula work this
    // chat can walk through, or that TWO modes exist. Names the modes by
    // their exact toggle labels — the parity test holds them together.
    emptyModes:
      "\u201cJust asking\u201d explains how the program works. \u201cBuild my estimate\u201d turns your answers into an application outline as you go.",
    // Pi redesign (2026-08-21): the empty state asks for the STATE, never a
    // name — the retention line says "avoid names", and the pi-redesign test
    // pins the ban in all four languages.
    emptyAskState:
      "Which state are you in? Choose it above. Until then, answers use the federal rules.",
    sidebarLabel: "Menu",
    sidebarSaved: "Saved conversations",
    sidebarSigninNote: "Sign in to keep your conversations.",
    signin: "Sign in",
    sidebarSignedIn: "Signed in as",
    // The rail's settings bar (owner rec 2026-08-22): with the site nav gone
    // from /chat, these are the ONLY route to the standing pages, so they
    // live with the account controls rather than in a footer this surface
    // does not have.
    skipToComposer: "Skip to the message box",
    sidebarSavedSignin: "Sign in for saved conversations",
    settingsLabel: "Settings",
    privacyLink: "Privacy policy",
    termsLink: "Terms",
    feedbackLink: "Send feedback",
    navQuestions: "What is SNAP?",
    empty1: "Do I earn too much to qualify?",
    empty2: "I need food this week. Can I get help faster?",
    empty3: "Will I have to do an interview?",
    picker: {
      label: "Your state",
      federal: "All states (federal rules)",
      federalHint: "Federal floor: state figures deferred to your agency",
      search: "Search by state, program, or agency…",
      verified: "Verified",
      noMatch: "No verified pack for that state yet. Federal rules still apply.",
      // These three do NOT run SNAP. The label has to say so, because a
      // reader who sees "Puerto Rico" in a SNAP tool reasonably assumes SNAP.
      napGroup: "Territories with a different program (not SNAP)",
      useHint: "Use {state}",
      scopeAgency: "Answers from",
      scopeApply: "Apply at",
    },
    // TAKE IT WITH YOU. The outline lived only on the screen it was built on.
    emailOutline: "Email this to me",
    emailSending: "Sending…",
    emailSent: "Sent to your inbox",
    emailSignIn: "Sign in to send it",
    emailError: "That didn't send.",
    // No account needed for this one — for someone who does not want to hand
    // over an address, it is the whole deliverable.
    pdfDownload: "Download as PDF",
    pdfWorking: "Preparing…",
    pdfDownloaded: "Your outlined application has downloaded.",
    pdfError: "That didn't download. Please try again.",
    howWeVerify: "How we verify",
    languageLabel: "Language",
    feedback: {
      prompt: "Was this helpful?",
      helpful: "Yes",
      notHelpful: "No",
      thanks: "Thank you. That helps us fix it.",
      reasonPrompt: "What was wrong with it?",
      reasons: [
        { value: "incorrect", label: "The answer was wrong" },
        { value: "citation_wrong", label: "The source doesn't say that" },
        { value: "unclear", label: "I couldn't understand it" },
        { value: "other", label: "Something else" },
      ],
      notePlaceholder: "Anything else? (optional, please don't include personal details)",
      send: "Send",
      skip: "Skip",
    },
    save: {
      save: "Save this conversation",
      saving: "Saving…",
      saved: "Saved",
      viewSaved: "Your conversations",
      panelTitle: "Save this conversation",
      panelBody:
        "Make a free account and this conversation will be here when you come back. You don't need one to keep asking. An account is only for saving.",
      panelStored:
        "We keep what you typed, word for word, so it reads the same when you return. Only you can see it, and you can delete it whenever you want.",
      panelCta: "Sign in to save",
      panelDismiss: "Not now",
      limit: (n: number) => `You've saved ${n} conversations. Delete one to save another.`,
      error: "That didn't save. Please try again.",
    },
    worksheet: {
      title: "Your outlined application",
      subtitle: "Builds as you talk",
      result: "Where this lands",
      estimate: "Estimated monthly benefit:",
      // THE FIGURE'S OWN INPUTS, beside it. A number with no visible cause is
      // a number nobody can correct: if the household size was misheard the
      // estimate is wrong and nothing on screen says why.
      basedOn: "Based on",
      // "Still needed" was a list. These turn the item into the QUESTION it
      // stands for, so the panel moves the conversation forward instead of
      // reporting on it. Keyed by completeness.ts's own English labels;
      // anything unmapped stays plain text rather than guessing a question.
      askPrefix: "Ask about",
      askFor: {
        "Household size": "Who else buys and cooks food with you?",
        "Rent or shelter cost": "How much do you pay for rent or housing each month?",
        "Countable assets, if any": "Do you have any savings or money in the bank?",
        "Whether the household receives SSI or TANF": "Does anyone in your household get SSI or TANF?",
        "Citizenship or qualified status": "What is your citizenship or immigration status?",
      } as Record<string, string>,
      calc: "How that was worked out",
      // WHAT IT HEARD, not just what it lacks. The panel listed "still
      // needed" and the final number but never showed the facts it was
      // working from, so a mis-heard income or household size was invisible
      // until it came out in the estimate — if it ever did.
      captured: "From what you\u2019ve told me",
      capturedNote: "Wrong? Say so in the chat and I\u2019ll correct it.",
      capturedHousehold: "Household",
      capturedHouseholdOne: "Just you",
      capturedHouseholdN: "{n} people",
      capturedIncome: "Monthly income",
      capturedIncomeNone: "None right now",
      capturedRent: "Rent",
      capturedUtilities: "Utilities",
      capturedHomeless: "Housing",
      capturedHomelessYes: "No fixed address",
      capturedAssets: "Savings and assets",
      capturedExpedited: "May qualify for expedited service",
      stillNeeded: "Still needed",
      empty:
        "Tell Demeter about your household: who lives with you, what you earn, what you pay in rent. Your estimate builds here.",
      // Retention copy — see #703 and the header of DemeterWorksheet. The
      // second sentence is the honest version of a claim we cannot make:
      // redactPii strips structured identifiers but deliberately NOT names, and
      // says so in its own header, so this asks rather than promises.
      // SHORT. This was two full paragraphs plus a disclaimer under the panel,
      // taking more room than the estimate it qualified. Every clause that was
      // load-bearing is still here: it goes when the tab closes, we keep the
      // text, and this is not a decision.
      // ONE LINE, TWO FACTS (owner, 2026-08-26). It ran as two sentences plus
      // a separate "An estimate, not a decision" below it — three statements
      // where two do. The retention ask survives verbatim in substance: we
      // keep the text, so avoid names.
      privacy: "An estimate, not a decision. We keep the text to check our accuracy, so avoid names.",
      privacySaved: "An estimate, not a decision. Saved to your account; we keep the text to check our accuracy, so avoid names.",
      disclaimer: "An estimate, not a decision.",
      pickState: "Pick your state above and your estimate can build here as you talk.",
      pickStateCta: "Choose your state",
      // THE TWO MODES, described for what they actually do.
      //
      // "Build my estimate" gathers what you say into something you can keep
      // and take to the portal. "Just asking" gathers NOTHING — and that is the
      // point of it: it is the mode you switch to mid-conversation to ask a
      // hypothetical, or about a situation that might not be yours, without it
      // being written into your case. Describing it as merely "no estimate is
      // worked out" made it sound like the lesser of the two. It is the escape
      // hatch, and people who are nervous about the system need to know it is
      // there.
      //
      // SHORT (like `privacy` above): this ran three sentences plus a
      // parenthetical — longer than the panel it explains. Two sentences,
      // every load-bearing clause kept: nothing here enters your estimate,
      // what-ifs and other people's situations are what it is FOR, and the
      // disclosure that we keep the text to check accuracy in both modes.
      // That last clause is the one that may never be cut for room — dropping
      // it would turn a disclosure into a secret. Budget pinned in
      // worksheet-mode.test.tsx.
      modeLabel: "What do you want from this?",
      modeAsk: "Just asking",
      modeEstimate: "Build my estimate",
      modeAskNote:
        "Nothing here goes into an estimate. Ask a what-if, or about someone else.",
      templateTitle: "What this will fill in",
      template: [
        "Who's in your household",
        "Your monthly income",
        "Rent, utilities, and other costs",
        "Your estimated monthly benefit",
      ],
      switchedToAsk: "Nothing is being gathered. Ask anything.",
    },
  },
  es: {
    // ASSENT, not decoration. Terms in a footer link is browsewrap, which courts
    // routinely refuse to enforce — and an unenforceable agreement takes the
    // arbitration clause and every disclaimer down with it. Notice has to be
    // conspicuous and ADJACENT to the act that manifests agreement, which for an
    // anonymous chat is sending the first message. Do not move this into the
    // footer, and do not shrink it below the disclaimer beside it.
    termsNotice: {
      before: 'Al enviar un mensaje, aceptas nuestros ',
      terms: 'Términos',
      between: ' y la ',
      privacy: 'Política de Privacidad',
      after: '.',
    },
    title: "Demeter",
    tagline: "Ayuda con la inscripción y elegibilidad de SNAP",
    inputPlaceholder: "Con gusto respondo cualquier pregunta sobre SNAP…",
    inputPlaceholderContinue: "Haz una pregunta de seguimiento…",
    inputPlaceholderEstimate: "Cuéntame sobre tu hogar y lo voy armando…",
    send: "Enviar",
    stop: "Parar",
    stateLabel: "Tu estado",
    federal: "Todos los estados (reglas federales)",
    verified: "Verificado",
    federalBadge: "Guía federal",
    dividerTo: (name: string) =>
      `Ahora respondiendo para ${name}. Las respuestas anteriores pueden no aplicar.`,
    dividerFederal:
      "Ahora respondiendo solo con reglas federales. Las respuestas anteriores pueden no aplicar.",
    dividerUncovered: (place: string) =>
      `Demeter todavía no cubre ${place}. Las respuestas de abajo usan reglas federales, y tu agencia local es la que debe confirmarlo.`,
    disclaimer: "Demeter es IA y puede equivocarse. Verifica las fuentes citadas y",
    disclaimerAgency: "tu agencia estatal",
    piiHint: "Por favor no escribas tu número de Seguro Social ni datos bancarios.",
    clear: "Empezar una conversación nueva",
    stateOffer: "Mencionaste {place}. ¿Respondo para {state}?",
    modeOffer: "¿Quieres que calcule una cifra aproximada, o por ahora solo buscas respuestas?",
    modeOfferEstimate: "Calcular una cifra",
    modeOfferAsk: "Solo preguntas",
    saveNudge: "Esta es una conversación larga para perderla si cierras la pestaña. ¿La guardo para que puedas volver a ella?",
    saveNudgeYes: "Guardarla",
    saveNudgeNo: "Ahora no",
    portalLead: "En {state}, la solicitud se hace a través de {agency}.",
    portalCta: "Solicitar en {portal}",
    portalStay:
      "Ahí es donde se presenta formalmente la solicitud, y el enlace también está en tu solicitud esbozada, así que no tendrás que buscarlo otra vez.\n\n**_¿Empezamos a repasar lo que te pide?_**",
    stateOfferYes: "Sí, usa {state}",
    stateOfferNo: "No, déjalo así",
    clearNote:
      "La quita de este navegador. Seguimos guardando la pregunta y la respuesta para verificar nuestra exactitud.",
    cleared: "Conversación borrada.",
    err429: "Demasiadas preguntas a la vez. Espera un minuto e intenta de nuevo.",
    errDailyCap:
      "Has hecho muchas preguntas hoy. Esto se reinicia mañana. Para ayuda con SNAP ahora mismo, llama al 211 o a la agencia SNAP de tu estado.",
    errCapacity:
      "Demeter llegó a su capacidad del mes. Para ayuda con SNAP ahora, llama al 211 o a tu agencia estatal.",
    errConfig: "Demeter aún no está disponible. Vuelve pronto.",
    errServer: "Eso falló de nuestro lado, no del tuyo. Volver a intentarlo suele funcionar. Si sigue pasando, avísanos.",
    errNetwork: "No pudimos conectar con Demeter. Revisa tu conexión e intenta de nuevo.",
    errRequest: "Demeter no pudo leer eso. Empezar una conversación nueva suele resolverlo. Una conversación muy larga es la causa más común.",
    thinking: "Un momento",
    emptyTitle: "Pregúntame lo que quieras sobre SNAP",
    welcome: {
      title: "Beneficios de alimentos, llamados SNAP",
      signIn: "Inicia sesión para guardar tu conversación",
      continueWithout: "Continuar sin iniciar sesión",
      body: "Cada respuesta cita la regla de la que salió, para que puedas comprobarla.",
      bodyTwo: "Demeter no es el gobierno y no puede decidir tu caso.",
      cta: "Empezar a preguntar",
      close: "Cerrar",
    },
    emptyWhatIsSnap:
      "SNAP (antes conocido como cupones de alimentos) ofrece beneficios de alimentos a familias de bajos ingresos para complementar su presupuesto de comida, de modo que puedan pagar los alimentos nutritivos esenciales para la salud y el bienestar.",
    emptyLede:
      "Puedo ayudarte a ver si es probable que califiques e ir armando tu solicitud sobre la marcha, citando la regla detrás de cada respuesta, para que puedas comprobarla.",
    emptyModes:
      "«Solo preguntar» explica cómo funciona el programa. «Calcular mi estimado» convierte tus respuestas en un esquema de solicitud sobre la marcha.",
    emptyAskState:
      "¿En qué estado estás? Elígelo arriba. Hasta entonces, las respuestas usan las reglas federales.",
    sidebarLabel: "Menú",
    sidebarSaved: "Conversaciones guardadas",
    sidebarSigninNote: "Inicia sesión para conservar tus conversaciones.",
    signin: "Iniciar sesión",
    sidebarSignedIn: "Sesión iniciada:",
    skipToComposer: "Saltar al cuadro de mensaje",
    sidebarSavedSignin: "Inicia sesión para ver tus conversaciones",
    settingsLabel: "Ajustes",
    privacyLink: "Política de privacidad",
    termsLink: "Términos",
    feedbackLink: "Enviar comentarios",
    navQuestions: "¿Qué es SNAP?",
    empty1: "¿Gano demasiado para calificar?",
    empty2: "Necesito comida esta semana, ¿puedo recibir ayuda más rápido?",
    empty3: "¿Tendré que hacer una entrevista?",
    picker: {
      label: "Tu estado",
      federal: "Todos los estados (reglas federales)",
      federalHint: "Base federal: las cifras estatales se remiten a tu agencia",
      search: "Busca por estado, programa o agencia…",
      verified: "Verificado",
      noMatch: "Aún no hay paquete verificado para ese estado. Las reglas federales aplican.",
      napGroup: "Territorios con un programa distinto (no SNAP)",
      useHint: "Usar {state}",
      scopeAgency: "Respuestas de",
      scopeApply: "Solicita en",
    },
    emailOutline: "Envíamelo por correo",
    emailSending: "Enviando…",
    emailSent: "Enviado a tu correo",
    emailSignIn: "Inicia sesión para enviarlo",
    emailError: "No se pudo enviar.",
    pdfDownload: "Descargar en PDF",
    pdfWorking: "Preparando…",
    pdfDownloaded: "Se descargó tu solicitud esbozada.",
    pdfError: "No se pudo descargar. Intenta de nuevo.",
    howWeVerify: "Cómo verificamos",
    languageLabel: "Idioma",
    feedback: {
      prompt: "¿Te sirvió esta respuesta?",
      helpful: "Sí",
      notHelpful: "No",
      thanks: "Gracias. Eso nos ayuda a corregirlo.",
      reasonPrompt: "¿Qué estuvo mal?",
      reasons: [
        { value: "incorrect", label: "La respuesta era incorrecta" },
        { value: "citation_wrong", label: "La fuente no dice eso" },
        { value: "unclear", label: "No la entendí" },
        { value: "other", label: "Otra cosa" },
      ],
      notePlaceholder: "¿Algo más? (opcional, por favor no incluyas datos personales)",
      send: "Enviar",
      skip: "Omitir",
    },
    save: {
      save: "Guardar esta conversación",
      saving: "Guardando…",
      saved: "Guardada",
      viewSaved: "Tus conversaciones",
      panelTitle: "Guarda esta conversación",
      panelBody:
        "Crea una cuenta gratis y esta conversación estará aquí cuando regreses. No necesitas una para seguir preguntando. La cuenta es solo para guardar.",
      panelStored:
        "Guardamos lo que escribiste, palabra por palabra, para que se lea igual cuando vuelvas. Solo tú puedes verla, y puedes borrarla cuando quieras.",
      panelCta: "Inicia sesión para guardar",
      panelDismiss: "Ahora no",
      limit: (n: number) =>
        `Ya guardaste ${n} conversaciones. Borra una para poder guardar otra.`,
      error: "No se pudo guardar. Intenta de nuevo.",
    },
    worksheet: {
      title: "Tu solicitud esbozada",
      subtitle: "Se arma mientras conversas",
      result: "Dónde queda esto",
      estimate: "Beneficio mensual estimado:",
      basedOn: "Según",
      askPrefix: "Preguntar sobre",
      askFor: {
        "Household size": "¿Quién más compra y cocina la comida contigo?",
        "Rent or shelter cost": "¿Cuánto pagas de alquiler o vivienda al mes?",
        "Countable assets, if any": "¿Tienes ahorros o dinero en el banco?",
        "Whether the household receives SSI or TANF": "¿Alguien en tu hogar recibe SSI o TANF?",
        "Citizenship or qualified status": "¿Cuál es tu estatus migratorio o de ciudadanía?",
      } as Record<string, string>,
      calc: "Cómo se calculó",
      captured: "Por lo que me has dicho",
      capturedNote: "\u00bfAlgo mal? Dímelo en el chat y lo corrijo.",
      capturedHousehold: "Hogar",
      capturedHouseholdOne: "Solo tú",
      capturedHouseholdN: "{n} personas",
      capturedIncome: "Ingreso mensual",
      capturedIncomeNone: "Ninguno por ahora",
      capturedRent: "Alquiler",
      capturedUtilities: "Servicios",
      capturedHomeless: "Vivienda",
      capturedHomelessYes: "Sin domicilio fijo",
      capturedAssets: "Ahorros y bienes",
      capturedExpedited: "Puede calificar para servicio acelerado",
      stillNeeded: "Todavía falta",
      empty:
        "Cuéntale a Demeter sobre tu hogar: quién vive contigo, cuánto ganas, cuánto pagas de renta. Tu estimado se arma aquí.",
      privacy:
        "Un estimado, no una decisión. Guardamos el texto para verificar nuestra exactitud, así que evita nombres.",
      privacySaved:
        "Un estimado, no una decisión. Guardada en tu cuenta. Guardamos el texto para verificar nuestra exactitud, así que evita nombres.",
      disclaimer: "Un estimado, no una decisión.",
      pickState: "Elige tu estado arriba y tu estimado se irá armando aquí.",
      pickStateCta: "Elige tu estado",
      modeLabel: "¿Qué buscas aquí?",
      modeAsk: "Solo preguntar",
      modeEstimate: "Calcular mi estimado",
      modeAskNote:
        "Nada de esto entra en un estimado. Pregunta un supuesto, o por otra persona.",
      templateTitle: "Lo que se irá completando",
      template: [
        "Quiénes forman tu hogar",
        "Tu ingreso mensual",
        "Renta, servicios y otros gastos",
        "Tu beneficio mensual estimado",
      ],
      switchedToAsk: "Estimado borrado. No se está recogiendo nada.",
    },
  },
  vi: {
    // ASSENT, not decoration. Terms in a footer link is browsewrap, which courts
    // routinely refuse to enforce — and an unenforceable agreement takes the
    // arbitration clause and every disclaimer down with it. Notice has to be
    // conspicuous and ADJACENT to the act that manifests agreement, which for an
    // anonymous chat is sending the first message. Do not move this into the
    // footer, and do not shrink it below the disclaimer beside it.
    termsNotice: {
      before: 'Bằng cách gửi tin nhắn, bạn đồng ý với ',
      terms: 'Điều khoản',
      between: ' và ',
      privacy: 'Chính sách quyền riêng tư',
      after: ' của chúng tôi.',
    },
    title: "Demeter",
    tagline: "Hỗ trợ ghi danh và điều kiện SNAP",
    inputPlaceholder: "Rất sẵn lòng giải đáp mọi câu hỏi về SNAP…",
    inputPlaceholderContinue: "Đặt một câu hỏi tiếp theo…",
    inputPlaceholderEstimate: "Kể cho tôi về hộ của bạn, tôi sẽ dựng dần lên…",
    send: "Gửi",
    stop: "Dừng",
    stateLabel: "Tiểu bang của bạn",
    federal: "Tất cả tiểu bang (quy định liên bang)",
    verified: "Đã xác minh",
    federalBadge: "Hướng dẫn liên bang",
    dividerTo: (name: string) =>
      `Bây giờ đang trả lời cho ${name}. Các câu trả lời trước có thể không còn áp dụng.`,
    dividerFederal:
      "Bây giờ chỉ trả lời theo quy định liên bang. Các câu trả lời trước có thể không còn áp dụng.",
    dividerUncovered: (place: string) =>
      `Demeter chưa hỗ trợ ${place}. Các câu trả lời dưới đây theo quy định liên bang, và cơ quan địa phương của bạn mới là nơi xác nhận.`,
    disclaimer: "Demeter là AI và có thể sai. Vui lòng kiểm tra lại các nguồn được trích dẫn và",
    disclaimerAgency: "cơ quan tiểu bang của bạn",
    piiHint: "Xin đừng nhập số An sinh Xã hội hay thông tin ngân hàng.",
    clear: "Bắt đầu cuộc trò chuyện mới",
    stateOffer: "Bạn có nhắc đến {place}. Trả lời cho {state} nhé?",
    modeOffer: "Bạn có muốn tôi ước tính một con số không, hay hiện giờ chỉ cần câu trả lời?",
    modeOfferEstimate: "Ước tính một con số",
    modeOfferAsk: "Chỉ hỏi thôi",
    saveNudge: "Đây là một cuộc trò chuyện dài, sẽ mất nếu bạn đóng tab. Lưu lại để bạn có thể quay lại sau?",
    saveNudgeYes: "Lưu lại",
    saveNudgeNo: "Để sau",
    portalLead: "Ở {state}, bạn nộp đơn qua {agency}.",
    portalCta: "Nộp đơn tại {portal}",
    portalStay:
      "Đó là nơi nộp đơn chính thức, và đường dẫn cũng có trong bản phác thảo đơn của bạn, nên bạn sẽ không phải tìm lại.\n\n**_Chúng ta bắt đầu xem đơn yêu cầu những gì nhé?_**",
    stateOfferYes: "Vâng, dùng {state}",
    stateOfferNo: "Không, giữ nguyên",
    clearNote:
      "Xóa khỏi trình duyệt này. Chúng tôi vẫn lưu câu hỏi và câu trả lời để kiểm tra độ chính xác.",
    cleared: "Đã xóa cuộc trò chuyện.",
    err429: "Quá nhiều câu hỏi cùng lúc. Vui lòng đợi một phút rồi thử lại.",
    errDailyCap:
      "Hôm nay bạn đã hỏi khá nhiều. Số lượt sẽ đặt lại vào ngày mai. Cần trợ giúp SNAP ngay bây giờ, hãy gọi 211 hoặc cơ quan SNAP của tiểu bang bạn.",
    errCapacity:
      "Demeter đã đạt giới hạn của tháng. Để được trợ giúp về SNAP ngay bây giờ, hãy gọi 211 hoặc cơ quan SNAP của tiểu bang bạn.",
    errConfig: "Demeter chưa sẵn sàng. Vui lòng quay lại sau.",
    errServer: "Lỗi này ở phía chúng tôi, không phải của bạn. Thử lại thường được. Nếu vẫn vậy, hãy báo cho chúng tôi.",
    errNetwork: "Không kết nối được với Demeter. Hãy kiểm tra mạng và thử lại.",
    errRequest: "Demeter không đọc được nội dung đó. Bắt đầu cuộc trò chuyện mới thường xử lý được. Nguyên nhân hay gặp là cuộc trò chuyện quá dài.",
    thinking: "Chờ một chút",
    emptyTitle: "Hỏi tôi bất cứ điều gì về SNAP",
    welcome: {
      title: "Trợ cấp thực phẩm, gọi là SNAP",
      signIn: "Đăng nhập để lưu cuộc trò chuyện",
      continueWithout: "Tiếp tục mà không đăng nhập",
      body: "Mỗi câu trả lời đều trích dẫn quy định mà nó dựa vào, để bạn tự kiểm chứng.",
      bodyTwo: "Demeter không phải là chính phủ và không thể quyết định hồ sơ của bạn.",
      cta: "Bắt đầu hỏi",
      close: "Đóng",
    },
    emptyWhatIsSnap:
      "SNAP (trước đây gọi là tem phiếu thực phẩm) cung cấp trợ cấp thực phẩm cho các gia đình thu nhập thấp để bổ sung vào ngân sách đi chợ, giúp họ mua được thực phẩm dinh dưỡng thiết yếu cho sức khỏe và đời sống.",
    emptyLede:
      "Tôi có thể giúp bạn xem mình có khả năng đủ điều kiện hay không và dần dựng nên đơn xin, kèm trích dẫn điều luật cho mỗi câu trả lời, để bạn tự kiểm chứng.",
    emptyModes:
      "“Chỉ hỏi thôi” giải thích chương trình hoạt động ra sao. “Tính mức ước tính” biến câu trả lời của bạn thành bản phác thảo đơn xin.",
    emptyAskState:
      "Bạn ở tiểu bang nào? Chọn ở phía trên. Trước đó, câu trả lời dùng quy định liên bang.",
    sidebarLabel: "Trình đơn",
    sidebarSaved: "Cuộc trò chuyện đã lưu",
    sidebarSigninNote: "Đăng nhập để giữ các cuộc trò chuyện của bạn.",
    signin: "Đăng nhập",
    sidebarSignedIn: "Đã đăng nhập:",
    skipToComposer: "Bỏ qua đến ô nhập tin nhắn",
    sidebarSavedSignin: "Đăng nhập để xem cuộc trò chuyện đã lưu",
    settingsLabel: "Cài đặt",
    privacyLink: "Chính sách bảo mật",
    termsLink: "Điều khoản",
    feedbackLink: "Gửi phản hồi",
    navQuestions: "SNAP là gì?",
    empty1: "Tôi kiếm được nhiều quá thì có còn đủ điều kiện không?",
    empty2: "Tuần này tôi cần thực phẩm. Có cách nào nhận nhanh hơn không?",
    empty3: "Tôi có phải phỏng vấn không?",
    picker: {
      label: "Tiểu bang của bạn",
      federal: "Tất cả tiểu bang (quy định liên bang)",
      federalHint: "Mức cơ bản liên bang: các con số của tiểu bang do cơ quan bạn quyết định",
      search: "Tìm theo tiểu bang, chương trình hoặc cơ quan…",
      verified: "Đã xác minh",
      noMatch: "Chưa có gói đã xác minh cho tiểu bang đó. Quy định liên bang vẫn áp dụng.",
      napGroup: "Lãnh thổ có chương trình khác (không phải SNAP)",
      useHint: "Dùng {state}",
      scopeAgency: "Câu trả lời dựa trên",
      scopeApply: "Nộp đơn tại",
    },
    emailOutline: "Gửi bản này cho tôi",
    emailSending: "Đang gửi…",
    emailSent: "Đã gửi vào hộp thư của bạn",
    emailSignIn: "Đăng nhập để gửi",
    emailError: "Chưa gửi được.",
    pdfDownload: "Tải về dạng PDF",
    pdfWorking: "Đang chuẩn bị…",
    pdfDownloaded: "Bản phác thảo đơn của bạn đã tải về.",
    pdfError: "Chưa tải về được. Vui lòng thử lại.",
    howWeVerify: "Cách chúng tôi xác minh",
    languageLabel: "Ngôn ngữ",
    feedback: {
      prompt: "Câu trả lời này có hữu ích không?",
      helpful: "Có",
      notHelpful: "Không",
      thanks: "Cảm ơn bạn. Điều này giúp chúng tôi sửa lại.",
      reasonPrompt: "Điều gì chưa đúng?",
      reasons: [
        { value: "incorrect", label: "Câu trả lời sai" },
        { value: "citation_wrong", label: "Nguồn không nói như vậy" },
        { value: "unclear", label: "Tôi không hiểu được" },
        { value: "other", label: "Điều khác" },
      ],
      notePlaceholder: "Còn gì nữa không? (không bắt buộc, xin đừng ghi thông tin cá nhân)",
      send: "Gửi",
      skip: "Bỏ qua",
    },
    save: {
      save: "Lưu cuộc trò chuyện này",
      saving: "Đang lưu…",
      saved: "Đã lưu",
      viewSaved: "Cuộc trò chuyện của bạn",
      panelTitle: "Lưu cuộc trò chuyện này",
      panelBody:
        "Tạo một tài khoản miễn phí và cuộc trò chuyện này sẽ vẫn còn khi bạn quay lại. Bạn không cần tài khoản để tiếp tục hỏi. Tài khoản chỉ dùng để lưu.",
      panelStored:
        "Chúng tôi giữ nguyên những gì bạn đã viết, từng chữ một, để khi quay lại bạn đọc thấy y như cũ. Chỉ mình bạn xem được, và bạn có thể xóa bất cứ lúc nào.",
      panelCta: "Đăng nhập để lưu",
      panelDismiss: "Để sau",
      limit: (n: number) =>
        `Bạn đã lưu ${n} cuộc trò chuyện. Hãy xóa bớt một cuộc để lưu cuộc mới.`,
      error: "Không lưu được. Vui lòng thử lại.",
    },
    worksheet: {
      title: "Bản phác thảo đơn của bạn",
      subtitle: "Được xây dựng khi bạn trò chuyện",
      result: "Kết quả tạm tính",
      estimate: "Trợ cấp hàng tháng ước tính:",
      basedOn: "Dựa trên",
      askPrefix: "Hỏi về",
      askFor: {
        "Household size": "Còn ai mua và nấu ăn chung với bạn không?",
        "Rent or shelter cost": "Mỗi tháng bạn trả bao nhiêu tiền thuê nhà hoặc chỗ ở?",
        "Countable assets, if any": "Bạn có tiền tiết kiệm hay tiền trong ngân hàng không?",
        "Whether the household receives SSI or TANF": "Trong nhà có ai nhận SSI hoặc TANF không?",
        "Citizenship or qualified status": "Tình trạng quốc tịch hoặc di trú của bạn là gì?",
      } as Record<string, string>,
      calc: "Cách tính ra con số đó",
      captured: "Theo những gì bạn đã nói",
      capturedNote: "Có gì chưa đúng? Cứ nhắn trong khung chat, tôi sẽ sửa.",
      capturedHousehold: "Hộ gia đình",
      capturedHouseholdOne: "Chỉ mình bạn",
      capturedHouseholdN: "{n} người",
      capturedIncome: "Thu nhập hàng tháng",
      capturedIncomeNone: "Hiện không có",
      capturedRent: "Tiền thuê nhà",
      capturedUtilities: "Tiện ích",
      capturedHomeless: "Chỗ ở",
      capturedHomelessYes: "Không có địa chỉ cố định",
      capturedAssets: "Tiết kiệm và tài sản",
      capturedExpedited: "Có thể đủ điều kiện xử lý nhanh",
      stillNeeded: "Còn thiếu",
      empty:
        "Hãy cho Demeter biết về hộ gia đình của bạn: ai sống cùng bạn, bạn kiếm được bao nhiêu, bạn trả bao nhiêu tiền thuê nhà. Ước tính sẽ hiện ở đây.",
      privacy:
        "Chỉ là ước tính, không phải quyết định. Chúng tôi lưu nội dung để kiểm tra độ chính xác, nên đừng nhập tên.",
      privacySaved:
        "Chỉ là ước tính, không phải quyết định. Đã lưu vào tài khoản. Chúng tôi lưu nội dung để kiểm tra độ chính xác, nên đừng nhập tên.",
      disclaimer: "Chỉ là ước tính, không phải quyết định.",
      pickState: "Chọn tiểu bang của bạn ở trên để ước tính có thể hiện ở đây.",
      pickStateCta: "Chọn tiểu bang",
      modeLabel: "Bạn muốn gì ở đây?",
      modeAsk: "Chỉ hỏi thôi",
      modeEstimate: "Tính mức ước tính",
      modeAskNote:
        "Không gì ở đây được đưa vào bản ước tính. Cứ hỏi giả định, hoặc hỏi giúp người khác.",
      templateTitle: "Những phần sẽ được điền",
      template: [
        "Những ai trong hộ của bạn",
        "Thu nhập hằng tháng của bạn",
        "Tiền thuê nhà, điện nước và chi phí khác",
        "Mức trợ cấp hằng tháng ước tính",
      ],
      switchedToAsk: "Đã xóa ước tính. Không có gì đang được thu thập.",
    },
  },
  zh: {
    // ASSENT, not decoration. Terms in a footer link is browsewrap, which courts
    // routinely refuse to enforce — and an unenforceable agreement takes the
    // arbitration clause and every disclaimer down with it. Notice has to be
    // conspicuous and ADJACENT to the act that manifests agreement, which for an
    // anonymous chat is sending the first message. Do not move this into the
    // footer, and do not shrink it below the disclaimer beside it.
    termsNotice: {
      before: '发送消息即表示您同意我们的',
      terms: '服务条款',
      between: '和',
      privacy: '隐私政策',
      after: '。',
    },
    title: "Demeter",
    tagline: "SNAP 申请与资格协助",
    inputPlaceholder: "关于 SNAP 的任何问题，都很乐意解答…",
    inputPlaceholderContinue: "还有什么想问的…",
    inputPlaceholderEstimate: "跟我说说您的家庭情况，我来逐步整理…",
    send: "发送",
    stop: "停止",
    stateLabel: "您所在的州",
    federal: "所有州（联邦规定）",
    verified: "已核实",
    federalBadge: "联邦指引",
    dividerTo: (name: string) => `现在按 ${name} 的规定回答，之前的回答可能不再适用。`,
    dividerFederal: "现在仅按联邦规定回答。之前的回答可能不再适用。",
    dividerUncovered: (place: string) =>
      `Demeter 尚未覆盖${place}，下面的回答按联邦规定，请以您当地机构的说法为准。`,
    disclaimer: "Demeter 是 AI，可能出错。请核对引用的来源，并咨询",
    disclaimerAgency: "您所在州的机构",
    piiHint: "请不要输入社会安全号码或银行信息。",
    clear: "开始新的对话",
    stateOffer: "您提到了 {place}。要按 {state} 来回答吗？",
    modeOffer: "需要我帮您估算一个大致金额吗？还是目前只想先了解情况？",
    modeOfferEstimate: "帮我估算金额",
    modeOfferAsk: "只是问问",
    saveNudge: "这段对话很长，关闭标签页就会丢失。要保存下来，方便以后继续吗？",
    saveNudgeYes: "保存",
    saveNudgeNo: "暂不",
    portalLead: "在{state}，申请通过{agency}办理。",
    portalCta: "前往 {portal} 申请",
    portalStay:
      "那里是正式提交申请的地方，这个链接也在您的申请提纲里，您不用再去找一遍。\n\n**_我们现在开始逐项看看表格会问什么，好吗？_**",
    stateOfferYes: "好，用 {state}",
    stateOfferNo: "不用，保持不变",
    clearNote: "仅从此浏览器中清除。我们仍会保留问题和回答以核查准确性。",
    cleared: "对话已清除。",
    err429: "同时提问太多了，请稍等一分钟再试。",
    errDailyCap: "您今天提问较多，明天会重置。如需 SNAP 帮助，请拨打 211 或联系您所在州的 SNAP 机构。",
    errCapacity:
      "Demeter 本月已达使用上限。如需即时的 SNAP 帮助，请拨打 211 或联系您所在州的 SNAP 机构。",
    errConfig: "Demeter 尚未开放，请稍后再来。",
    errServer: "这是我们这边出的问题，不是您的。再试一次通常就好了，如果一直这样，请告诉我们。",
    errNetwork: "连接不上 Demeter。请检查网络后再试一次。",
    errRequest: "Demeter 读不了这条内容。开始新的对话通常就能解决，最常见的原因是对话太长。",
    thinking: "请稍候",
    emptyTitle: "关于 SNAP，什么都可以问我",
    welcome: {
      title: "食品补助，简称 SNAP",
      signIn: "登录以保存对话",
      continueWithout: "不登录，继续使用",
      body: "每条回答都会附上依据的法规，方便您自行核对。",
      bodyTwo: "Demeter 不是政府机构，无法决定您的案件。",
      cta: "开始提问",
      close: "关闭",
    },
    emptyWhatIsSnap:
      "SNAP（旧称食品券）为低收入家庭提供食品补助，补贴他们的买菜开支，使其能够负担对健康和生活至关重要的营养食品。",
    emptyLede:
      "我可以帮您看看是否可能符合资格，并一步步整理出您的申请内容，每条回答都会附上依据的条文，方便您自行核对。",
    emptyModes:
      "“只是问问”讲解这个项目如何运作。“帮我算估算”会把您说的内容逐步整理成一份申请提纲。",
    emptyAskState: "您在哪个州？请在上方选择。在那之前，回答使用联邦规定。",
    sidebarLabel: "菜单",
    sidebarSaved: "已保存的对话",
    sidebarSigninNote: "登录即可保留您的对话。",
    signin: "登录",
    sidebarSignedIn: "已登录：",
    skipToComposer: "跳到输入框",
    sidebarSavedSignin: "登录以查看已保存的对话",
    settingsLabel: "设置",
    privacyLink: "隐私政策",
    termsLink: "条款",
    feedbackLink: "发送反馈",
    navQuestions: "什么是 SNAP？",
    empty1: "我赚得太多，就不符合条件了吗？",
    empty2: "这周就需要食物，能更快拿到吗？",
    empty3: "我需要参加面谈吗？",
    picker: {
      label: "您所在的州",
      federal: "所有州（联邦规定）",
      federalHint: "联邦最低标准：各州的具体金额请以您所在机构为准",
      search: "按州、项目或机构搜索…",
      verified: "已核实",
      noMatch: "该州暂无已核实的政策包，联邦规定仍然适用。",
      napGroup: "使用其他项目的属地（非 SNAP）",
      useHint: "使用{state}",
      scopeAgency: "答案来源",
      scopeApply: "申请入口",
    },
    emailOutline: "把这份发到我的邮箱",
    emailSending: "发送中…",
    emailSent: "已发送到您的邮箱",
    emailSignIn: "登录后发送",
    emailError: "没能发送。",
    pdfDownload: "下载 PDF",
    pdfWorking: "正在准备…",
    pdfDownloaded: "您的申请提纲已下载。",
    pdfError: "没能下载，请再试一次。",
    howWeVerify: "我们如何核实",
    languageLabel: "语言",
    feedback: {
      prompt: "这个回答有帮助吗？",
      helpful: "有",
      notHelpful: "没有",
      thanks: "谢谢您。这能帮我们改正。",
      reasonPrompt: "哪里不对？",
      reasons: [
        { value: "incorrect", label: "回答是错的" },
        { value: "citation_wrong", label: "来源里并没有这么说" },
        { value: "unclear", label: "我看不懂" },
        { value: "other", label: "其他问题" },
      ],
      notePlaceholder: "还有别的吗？（选填，请勿填写个人信息）",
      send: "发送",
      skip: "跳过",
    },
    save: {
      save: "保存这次对话",
      saving: "正在保存…",
      saved: "已保存",
      viewSaved: "你的对话",
      panelTitle: "保存这次对话",
      panelBody:
        "注册一个免费账号，下次回来时这次对话还在。继续提问不需要账号，账号只用于保存。",
      panelStored:
        "我们会原样保留你输入的内容，一字不改，这样你回来时看到的和现在一样。只有你能看到，也可以随时删除。",
      panelCta: "登录以保存",
      panelDismiss: "暂不",
      limit: (n: number) => `你已保存 ${n} 次对话。请先删除一次，再保存新的。`,
      error: "保存失败，请再试一次。",
    },
    worksheet: {
      title: "您的申请提纲",
      subtitle: "随着对话逐步生成",
      result: "初步结果",
      estimate: "每月估计补助：",
      basedOn: "依据",
      askPrefix: "询问",
      askFor: {
        "Household size": "还有谁和您一起买菜做饭？",
        "Rent or shelter cost": "您每月的房租或住房费用是多少？",
        "Countable assets, if any": "您有存款或银行里的钱吗？",
        "Whether the household receives SSI or TANF": "家里有人领取 SSI 或 TANF 吗？",
        "Citizenship or qualified status": "您的公民身份或移民身份是什么？",
      } as Record<string, string>,
      calc: "计算方式",
      captured: "根据您告诉我的",
      capturedNote: "有不对的地方？在对话里说一声，我来更正。",
      capturedHousehold: "家庭人数",
      capturedHouseholdOne: "只有您",
      capturedHouseholdN: "{n} 人",
      capturedIncome: "每月收入",
      capturedIncomeNone: "目前没有",
      capturedRent: "房租",
      capturedUtilities: "水电等费用",
      capturedHomeless: "住所",
      capturedHomelessYes: "没有固定住址",
      capturedAssets: "存款与资产",
      capturedExpedited: "可能符合加急办理",
      stillNeeded: "仍需提供",
      empty:
        "告诉 Demeter 您的家庭情况：谁和您同住、收入多少、房租多少。估算就会在这里逐步生成。",
      privacy:
        "只是估算，不是决定。我们保留文字以核查准确性，请勿输入姓名。",
      privacySaved:
        "只是估算，不是决定。已保存到您的账户。我们保留文字以核查准确性，请勿输入姓名。",
      disclaimer: "这只是估算，不是决定。",
      pickState: "请在上方选择您所在的州，估算就能在这里生成。",
      pickStateCta: "选择您所在的州",
      modeLabel: "您希望在这里得到什么？",
      modeAsk: "只是问问",
      modeEstimate: "帮我算估算",
      modeAskNote: "这里说的内容不会进入估算，可以问假设情况，或替别人问。",
      templateTitle: "将要填写的部分",
      template: ["您的家庭成员", "您的每月收入", "房租、水电及其他开支", "您的预计每月补助"],
      switchedToAsk: "估算已清除。没有在收集任何内容。",
    },
  },
} as const;
