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
    title: "Demeter",
    tagline: "Verified answers about SNAP — for any state.",
    inputPlaceholder: "Happy to answer any questions about SNAP…",
    inputPlaceholderEstimate: "Tell me about your household, and I'll build it up…",
    send: "Send",
    stop: "Stop",
    stateLabel: "Your state",
    federal: "All states (federal rules)",
    verified: "Verified",
    federalBadge: "Federal guidance",
    dividerTo: (name: string) => `Now answering for ${name} — earlier answers may not apply.`,
    dividerFederal: "Now answering with federal rules only — earlier answers may not apply.",
    dividerUncovered: (place: string) =>
      `Demeter does not cover ${place} yet — answers below use federal rules, and your local agency is the one to confirm with.`,
    // "Demeter is AI" up front, because someone who knows that reads the rest
    // differently. The agency is a LINK: telling somebody to check with an
    // office without saying which one is the same as not telling them.
    disclaimer: "Demeter is AI and can make mistakes. Please double-check cited sources and",
    disclaimerAgency: "your state agency",
    // Sits under the composer, where the decision to type is made — not in the
    // estimate rail, where it used to live and where it vanished entirely at
    // narrow widths. Names the three things redactPii cannot save someone from
    // (it strips structured identifiers but deliberately not names).
    piiHint: "Please don’t type your Social Security number, bank details, or a full name.",
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
    modeOffer: "Shall I start gathering your answers as we go, so you can take them to the application? Or keep this as just questions for now?",
    modeOfferEstimate: "Gather my answers",
    modeOfferAsk: "Just asking",
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
    err429: "Too many questions at once — give it a minute and try again.",
    // DISTINCT from err429, matching a distinction the route already makes
    // deliberately. A per-minute rate limit resets in a minute; a daily cap
    // resets tomorrow. Telling someone to wait a minute for something that
    // resets tomorrow sends them into a retry loop.
    errDailyCap:
      "You have asked a lot of questions today — this resets tomorrow. For SNAP help right now, call 211 or your state SNAP agency.",
    errCapacity:
      "Demeter is at capacity for the month. For SNAP help right now, call 211 or your state SNAP agency.",
    errConfig: "Demeter isn't available yet — please check back soon.",
    // WHOSE FAULT IT IS, because "something went wrong" told nobody anything —
     // not the reader deciding whether to retry, and not us when it was
     // reported. A failure on our side is worth retrying and worth telling us
     // about; a connection failure is worth checking their network for; a
     // request we could not read needs a different action entirely.
    errServer: "That failed on our side, not yours. Trying again usually works — if it keeps happening, please tell us.",
    errNetwork: "We couldn't reach Demeter. Check your connection and try again.",
    errRequest: "Demeter couldn't read that. Starting a new conversation usually clears it — a very long chat is the commonest cause.",
    thinking: "One moment",
    // The empty chat's own words. Three bare buttons floating in 414px of
    // measured whitespace read as stray controls; a mark, a line, and the
    // questions grouped under it read as an invitation.
    emptyTitle: "What would you like to know?",
    emptyLede: "Every answer quotes the rule it comes from, so you can check it.",
    empty1: "Do I earn too much to qualify?",
    empty2: "I need food this week — can I get help faster?",
    empty3: "Will I have to do an interview?",
    picker: {
      label: "Your state",
      federal: "All states (federal rules)",
      federalHint: "Federal floor — state figures deferred to your agency",
      search: "Search by state, program, or agency…",
      verified: "Verified",
      noMatch: "No verified pack for that state yet — federal rules still apply.",
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
      thanks: "Thank you — that helps us fix it.",
      reasonPrompt: "What was wrong with it?",
      reasons: [
        { value: "incorrect", label: "The answer was wrong" },
        { value: "citation_wrong", label: "The source doesn't say that" },
        { value: "unclear", label: "I couldn't understand it" },
        { value: "other", label: "Something else" },
      ],
      notePlaceholder: "Anything else? (optional — please don't include personal details)",
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
        "Make a free account and this conversation will be here when you come back. You don't need one to keep asking — an account is only for saving.",
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
      calc: "How that was worked out",
      stillNeeded: "Still needed",
      empty:
        "Tell Demeter about your household — who lives with you, what you earn, what you pay in rent — and your estimate builds here.",
      // Retention copy — see #703 and the header of DemeterWorksheet. The
      // second sentence is the honest version of a claim we cannot make:
      // redactPii strips structured identifiers but deliberately NOT names, and
      // says so in its own header, so this asks rather than promises.
      // SHORT. This was two full paragraphs plus a disclaimer under the panel,
      // taking more room than the estimate it qualified. Every clause that was
      // load-bearing is still here: it goes when the tab closes, we keep the
      // text, and this is not a decision.
      privacy: "Closing the tab ends this. We keep the text to check our accuracy — avoid names.",
      privacySaved: "Saved to your account. We keep the text to check our accuracy — avoid names.",
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
      modeLabel: "What do you want from this?",
      modeAsk: "Just asking",
      modeEstimate: "Build my estimate",
      modeAskNote:
        "Nothing you say here goes into the document Demeter is building for you. Switch to this any time you want to ask a what-if, or about someone else, without it counting toward your own answers. (We still keep the question and answer to check our accuracy — that is true in both modes.)",
      switchedToAsk: "Nothing is being gathered. Ask anything.",
    },
  },
  es: {
    title: "Demeter",
    tagline: "Respuestas verificadas sobre SNAP — para cualquier estado.",
    inputPlaceholder: "Con gusto respondo cualquier pregunta sobre SNAP…",
    inputPlaceholderEstimate: "Cuéntame sobre tu hogar y lo voy armando…",
    send: "Enviar",
    stop: "Parar",
    stateLabel: "Tu estado",
    federal: "Todos los estados (reglas federales)",
    verified: "Verificado",
    federalBadge: "Guía federal",
    dividerTo: (name: string) =>
      `Ahora respondiendo para ${name} — las respuestas anteriores pueden no aplicar.`,
    dividerFederal:
      "Ahora respondiendo solo con reglas federales — las respuestas anteriores pueden no aplicar.",
    dividerUncovered: (place: string) =>
      `Demeter todavía no cubre ${place} — las respuestas de abajo usan reglas federales, y tu agencia local es la que debe confirmarlo.`,
    disclaimer: "Demeter es IA y puede equivocarse. Verifica las fuentes citadas y",
    disclaimerAgency: "tu agencia estatal",
    piiHint:
      "Por favor no escribas tu número de Seguro Social, datos bancarios ni un nombre completo.",
    clear: "Empezar una conversación nueva",
    stateOffer: "Mencionaste {place}. ¿Respondo para {state}?",
    modeOffer: "¿Quieres que calcule una cifra aproximada, o por ahora solo buscas respuestas?",
    modeOfferEstimate: "Calcular una cifra",
    modeOfferAsk: "Solo preguntas",
    portalLead: "En {state}, la solicitud se hace a través de {agency}.",
    portalCta: "Solicitar en {portal}",
    portalStay:
      "Ahí es donde se presenta formalmente la solicitud, y el enlace también está en tu solicitud esbozada, así que no tendrás que buscarlo otra vez.\n\n**_¿Empezamos a repasar lo que te pide?_**",
    stateOfferYes: "Sí, usa {state}",
    stateOfferNo: "No, déjalo así",
    clearNote:
      "La quita de este navegador. Seguimos guardando la pregunta y la respuesta para verificar nuestra exactitud.",
    cleared: "Conversación borrada.",
    err429: "Demasiadas preguntas a la vez — espera un minuto e intenta de nuevo.",
    errDailyCap:
      "Has hecho muchas preguntas hoy — esto se reinicia mañana. Para ayuda con SNAP ahora mismo, llama al 211 o a la agencia SNAP de tu estado.",
    errCapacity:
      "Demeter llegó a su capacidad del mes. Para ayuda con SNAP ahora, llama al 211 o a tu agencia estatal.",
    errConfig: "Demeter aún no está disponible — vuelve pronto.",
    errServer: "Eso falló de nuestro lado, no del tuyo. Volver a intentarlo suele funcionar — si sigue pasando, avísanos.",
    errNetwork: "No pudimos conectar con Demeter. Revisa tu conexión e intenta de nuevo.",
    errRequest: "Demeter no pudo leer eso. Empezar una conversación nueva suele resolverlo — una conversación muy larga es la causa más común.",
    thinking: "Un momento",
    emptyTitle: "¿Qué te gustaría saber?",
    emptyLede: "Cada respuesta cita la regla de la que proviene, para que puedas comprobarla.",
    empty1: "¿Gano demasiado para calificar?",
    empty2: "Necesito comida esta semana, ¿puedo recibir ayuda más rápido?",
    empty3: "¿Tendré que hacer una entrevista?",
    picker: {
      label: "Tu estado",
      federal: "Todos los estados (reglas federales)",
      federalHint: "Base federal — las cifras estatales se remiten a tu agencia",
      search: "Busca por estado, programa o agencia…",
      verified: "Verificado",
      noMatch: "Aún no hay paquete verificado para ese estado — las reglas federales aplican.",
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
      thanks: "Gracias — eso nos ayuda a corregirlo.",
      reasonPrompt: "¿Qué estuvo mal?",
      reasons: [
        { value: "incorrect", label: "La respuesta era incorrecta" },
        { value: "citation_wrong", label: "La fuente no dice eso" },
        { value: "unclear", label: "No la entendí" },
        { value: "other", label: "Otra cosa" },
      ],
      notePlaceholder: "¿Algo más? (opcional — por favor no incluyas datos personales)",
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
        "Crea una cuenta gratis y esta conversación estará aquí cuando regreses. No necesitas una para seguir preguntando — la cuenta es solo para guardar.",
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
      calc: "Cómo se calculó",
      stillNeeded: "Todavía falta",
      empty:
        "Cuéntale a Demeter sobre tu hogar — quién vive contigo, cuánto ganas, cuánto pagas de renta — y tu estimado se arma aquí.",
      privacy:
        "Cerrar la pestaña termina esto. Guardamos el texto para verificar nuestra exactitud — evita nombres.",
      privacySaved:
        "Guardada en tu cuenta. Guardamos el texto para verificar nuestra exactitud — evita nombres.",
      disclaimer: "Un estimado, no una decisión.",
      pickState: "Elige tu estado arriba y tu estimado se irá armando aquí.",
      pickStateCta: "Elige tu estado",
      modeLabel: "¿Qué buscas aquí?",
      modeAsk: "Solo preguntar",
      modeEstimate: "Calcular mi estimado",
      modeAskNote:
        "Nada de lo que digas aquí entra en el documento que Demeter arma para ti. Cámbiate a esto cuando quieras preguntar un supuesto, o por otra persona, sin que cuente para tus propias respuestas. (Igual guardamos la pregunta y la respuesta para verificar nuestra exactitud — eso vale en los dos modos.)",
      switchedToAsk: "Estimado borrado. No se está recogiendo nada.",
    },
  },
  vi: {
    title: "Demeter",
    tagline: "Câu trả lời đã được xác minh về SNAP — cho mọi tiểu bang.",
    inputPlaceholder: "Rất sẵn lòng giải đáp mọi câu hỏi về SNAP…",
    inputPlaceholderEstimate: "Kể cho tôi về hộ của bạn, tôi sẽ dựng dần lên…",
    send: "Gửi",
    stop: "Dừng",
    stateLabel: "Tiểu bang của bạn",
    federal: "Tất cả tiểu bang (quy định liên bang)",
    verified: "Đã xác minh",
    federalBadge: "Hướng dẫn liên bang",
    dividerTo: (name: string) =>
      `Bây giờ đang trả lời cho ${name} — các câu trả lời trước có thể không còn áp dụng.`,
    dividerFederal:
      "Bây giờ chỉ trả lời theo quy định liên bang — các câu trả lời trước có thể không còn áp dụng.",
    dividerUncovered: (place: string) =>
      `Demeter chưa hỗ trợ ${place} — các câu trả lời dưới đây theo quy định liên bang, và cơ quan địa phương của bạn mới là nơi xác nhận.`,
    disclaimer: "Demeter là AI và có thể sai. Vui lòng kiểm tra lại các nguồn được trích dẫn và",
    disclaimerAgency: "cơ quan tiểu bang của bạn",
    piiHint: "Xin đừng nhập số An sinh Xã hội, thông tin ngân hàng hay họ tên đầy đủ.",
    clear: "Bắt đầu cuộc trò chuyện mới",
    stateOffer: "Bạn có nhắc đến {place}. Trả lời cho {state} nhé?",
    modeOffer: "Bạn có muốn tôi ước tính một con số không, hay hiện giờ chỉ cần câu trả lời?",
    modeOfferEstimate: "Ước tính một con số",
    modeOfferAsk: "Chỉ hỏi thôi",
    portalLead: "Ở {state}, bạn nộp đơn qua {agency}.",
    portalCta: "Nộp đơn tại {portal}",
    portalStay:
      "Đó là nơi nộp đơn chính thức, và đường dẫn cũng có trong bản phác thảo đơn của bạn, nên bạn sẽ không phải tìm lại.\n\n**_Chúng ta bắt đầu xem đơn yêu cầu những gì nhé?_**",
    stateOfferYes: "Vâng, dùng {state}",
    stateOfferNo: "Không, giữ nguyên",
    clearNote:
      "Xóa khỏi trình duyệt này. Chúng tôi vẫn lưu câu hỏi và câu trả lời để kiểm tra độ chính xác.",
    cleared: "Đã xóa cuộc trò chuyện.",
    err429: "Quá nhiều câu hỏi cùng lúc — vui lòng đợi một phút rồi thử lại.",
    errDailyCap:
      "Hôm nay bạn đã hỏi khá nhiều — số lượt sẽ đặt lại vào ngày mai. Cần trợ giúp SNAP ngay bây giờ, hãy gọi 211 hoặc cơ quan SNAP của tiểu bang bạn.",
    errCapacity:
      "Demeter đã đạt giới hạn của tháng. Để được trợ giúp về SNAP ngay bây giờ, hãy gọi 211 hoặc cơ quan SNAP của tiểu bang bạn.",
    errConfig: "Demeter chưa sẵn sàng — vui lòng quay lại sau.",
    errServer: "Lỗi này ở phía chúng tôi, không phải của bạn. Thử lại thường được — nếu vẫn vậy, hãy báo cho chúng tôi.",
    errNetwork: "Không kết nối được với Demeter. Hãy kiểm tra mạng và thử lại.",
    errRequest: "Demeter không đọc được nội dung đó. Bắt đầu cuộc trò chuyện mới thường xử lý được — nguyên nhân hay gặp là cuộc trò chuyện quá dài.",
    thinking: "Chờ một chút",
    emptyTitle: "Bạn muốn biết điều gì?",
    emptyLede: "Mỗi câu trả lời đều trích dẫn điều luật mà nó dựa vào, để bạn tự kiểm chứng được.",
    empty1: "Tôi kiếm được nhiều quá thì có còn đủ điều kiện không?",
    empty2: "Tuần này tôi cần thực phẩm — có cách nào nhận nhanh hơn không?",
    empty3: "Tôi có phải phỏng vấn không?",
    picker: {
      label: "Tiểu bang của bạn",
      federal: "Tất cả tiểu bang (quy định liên bang)",
      federalHint: "Mức cơ bản liên bang — các con số của tiểu bang do cơ quan bạn quyết định",
      search: "Tìm theo tiểu bang, chương trình hoặc cơ quan…",
      verified: "Đã xác minh",
      noMatch: "Chưa có gói đã xác minh cho tiểu bang đó — quy định liên bang vẫn áp dụng.",
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
      thanks: "Cảm ơn bạn — điều này giúp chúng tôi sửa lại.",
      reasonPrompt: "Điều gì chưa đúng?",
      reasons: [
        { value: "incorrect", label: "Câu trả lời sai" },
        { value: "citation_wrong", label: "Nguồn không nói như vậy" },
        { value: "unclear", label: "Tôi không hiểu được" },
        { value: "other", label: "Điều khác" },
      ],
      notePlaceholder: "Còn gì nữa không? (không bắt buộc — xin đừng ghi thông tin cá nhân)",
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
        "Tạo một tài khoản miễn phí và cuộc trò chuyện này sẽ vẫn còn khi bạn quay lại. Bạn không cần tài khoản để tiếp tục hỏi — tài khoản chỉ dùng để lưu.",
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
      calc: "Cách tính ra con số đó",
      stillNeeded: "Còn thiếu",
      empty:
        "Hãy cho Demeter biết về hộ gia đình của bạn — ai sống cùng bạn, bạn kiếm được bao nhiêu, bạn trả bao nhiêu tiền thuê nhà — và ước tính sẽ hiện ở đây.",
      privacy:
        "Đóng tab là kết thúc. Chúng tôi lưu nội dung để kiểm tra độ chính xác — đừng nhập tên.",
      privacySaved:
        "Đã lưu vào tài khoản của bạn. Chúng tôi lưu nội dung để kiểm tra độ chính xác — đừng nhập tên.",
      disclaimer: "Chỉ là ước tính, không phải quyết định.",
      pickState: "Chọn tiểu bang của bạn ở trên để ước tính có thể hiện ở đây.",
      pickStateCta: "Chọn tiểu bang",
      modeLabel: "Bạn muốn gì ở đây?",
      modeAsk: "Chỉ hỏi thôi",
      modeEstimate: "Tính mức ước tính",
      modeAskNote:
        "Những gì bạn nói ở đây không được đưa vào bản tài liệu Demeter đang lập cho bạn. Hãy chuyển sang mục này khi bạn muốn hỏi giả định, hoặc hỏi giúp người khác, mà không ảnh hưởng đến hồ sơ của chính bạn. (Chúng tôi vẫn lưu câu hỏi và câu trả lời để kiểm tra độ chính xác — điều này đúng với cả hai chế độ.)",
      switchedToAsk: "Đã xóa ước tính. Không có gì đang được thu thập.",
    },
  },
  zh: {
    title: "Demeter",
    tagline: "经过核实的 SNAP 答案——适用于任何州。",
    inputPlaceholder: "关于 SNAP 的任何问题，都很乐意解答…",
    inputPlaceholderEstimate: "跟我说说您的家庭情况，我来逐步整理…",
    send: "发送",
    stop: "停止",
    stateLabel: "您所在的州",
    federal: "所有州（联邦规定）",
    verified: "已核实",
    federalBadge: "联邦指引",
    dividerTo: (name: string) => `现在按 ${name} 的规定回答——之前的回答可能不再适用。`,
    dividerFederal: "现在仅按联邦规定回答——之前的回答可能不再适用。",
    dividerUncovered: (place: string) =>
      `Demeter 尚未覆盖${place}——下面的回答按联邦规定，请以您当地机构的说法为准。`,
    disclaimer: "Demeter 是 AI，可能出错。请核对引用的来源，并咨询",
    disclaimerAgency: "您所在州的机构",
    piiHint: "请不要输入社会安全号码、银行信息或完整姓名。",
    clear: "开始新的对话",
    stateOffer: "您提到了 {place}。要按 {state} 来回答吗？",
    modeOffer: "需要我帮您估算一个大致金额吗？还是目前只想先了解情况？",
    modeOfferEstimate: "帮我估算金额",
    modeOfferAsk: "只是问问",
    portalLead: "在{state}，申请通过{agency}办理。",
    portalCta: "前往 {portal} 申请",
    portalStay:
      "那里是正式提交申请的地方，这个链接也在您的申请提纲里，您不用再去找一遍。\n\n**_我们现在开始逐项看看表格会问什么，好吗？_**",
    stateOfferYes: "好，用 {state}",
    stateOfferNo: "不用，保持不变",
    clearNote: "仅从此浏览器中清除。我们仍会保留问题和回答以核查准确性。",
    cleared: "对话已清除。",
    err429: "同时提问太多了——请稍等一分钟再试。",
    errDailyCap: "您今天提问较多——明天会重置。如需 SNAP 帮助，请拨打 211 或联系您所在州的 SNAP 机构。",
    errCapacity:
      "Demeter 本月已达使用上限。如需即时的 SNAP 帮助，请拨打 211 或联系您所在州的 SNAP 机构。",
    errConfig: "Demeter 尚未开放——请稍后再来。",
    errServer: "这是我们这边出的问题，不是您的。再试一次通常就好了——如果一直这样，请告诉我们。",
    errNetwork: "连接不上 Demeter。请检查网络后再试一次。",
    errRequest: "Demeter 读不了这条内容。开始新的对话通常就能解决——最常见的原因是对话太长。",
    thinking: "请稍候",
    emptyTitle: "您想了解什么？",
    emptyLede: "每条回答都会引用其依据的条文，方便您自行核对。",
    empty1: "我赚得太多，就不符合条件了吗？",
    empty2: "这周就需要食物，能更快拿到吗？",
    empty3: "我需要参加面谈吗？",
    picker: {
      label: "您所在的州",
      federal: "所有州（联邦规定）",
      federalHint: "联邦最低标准——各州的具体金额请以您所在机构为准",
      search: "按州、项目或机构搜索…",
      verified: "已核实",
      noMatch: "该州暂无已核实的政策包——联邦规定仍然适用。",
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
      thanks: "谢谢您——这能帮我们改正。",
      reasonPrompt: "哪里不对？",
      reasons: [
        { value: "incorrect", label: "回答是错的" },
        { value: "citation_wrong", label: "来源里并没有这么说" },
        { value: "unclear", label: "我看不懂" },
        { value: "other", label: "其他问题" },
      ],
      notePlaceholder: "还有别的吗？（选填——请勿填写个人信息）",
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
        "注册一个免费账号，下次回来时这次对话还在。继续提问不需要账号——账号只用于保存。",
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
      calc: "计算方式",
      stillNeeded: "仍需提供",
      empty:
        "告诉 Demeter 您的家庭情况——谁和您同住、收入多少、房租多少——估算就会在这里逐步生成。",
      privacy:
        "关闭标签页即结束。我们保留文字以核查准确性——请勿输入姓名。",
      privacySaved:
        "已保存到您的账户。我们保留文字以核查准确性——请勿输入姓名。",
      disclaimer: "这只是估算，不是决定。",
      pickState: "请在上方选择您所在的州，估算就能在这里生成。",
      pickStateCta: "选择您所在的州",
      modeLabel: "您希望在这里得到什么？",
      modeAsk: "只是问问",
      modeEstimate: "帮我算估算",
      modeAskNote: "您在这里说的内容不会进入 Demeter 为您整理的那份文件。任何时候想问假设情况、或替别人问，都可以切到这里，不会影响您自己的材料。（我们仍会保留问题和回答以核查准确性——两种模式都是如此。）",
      switchedToAsk: "估算已清除。没有在收集任何内容。",
    },
  },
} as const;
