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
    send: "Send",
    stop: "Stop",
    stateLabel: "Your state",
    federal: "All states (federal rules)",
    verified: "Verified",
    federalBadge: "Federal guidance",
    dividerTo: (name: string) => `Now answering for ${name} — earlier answers may not apply.`,
    dividerFederal: "Now answering with federal rules only — earlier answers may not apply.",
    disclaimer:
      "Demeter gives information, not legal advice. Confirm decisions with your SNAP agency.",
    // Sits under the composer, where the decision to type is made — not in the
    // estimate rail, where it used to live and where it vanished entirely at
    // narrow widths. Names the three things redactPii cannot save someone from
    // (it strips structured identifiers but deliberately not names).
    piiHint: "Please don’t type your Social Security number, bank details, or a full name.",
    // The wording is load-bearing. This clears THIS BROWSER; every question and
    // answer is still written to mae_query_log. Saying "clear" without saying
    // that would be the retention lie #703 fixed, rebuilt as a button.
    clear: "Clear this conversation",
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
    errNetwork: "Something went wrong. Please try again.",
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
      title: "Your estimate",
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
      privacy:
        "Close this tab and you cannot return to this conversation. We keep the question and answer to check our accuracy, so please avoid typing names or personal details.",
      privacySaved:
        "Saved to your account — you can come back to it or delete it. We keep the question and answer to check our accuracy, so please avoid typing names or personal details.",
      disclaimer: "An estimate, not a decision. Your county agency decides.",
      pickState: "Pick your state above and your estimate can build here as you talk.",
      pickStateCta: "Choose your state",
      // The two-way switch at the top of the rail. "Just asking" is the
      // DEFAULT: the panel used to gather household facts from the conversation
      // whether or not anyone asked it to, which is a thing to offer rather
      // than a thing to do quietly to someone already nervous about the system.
      modeLabel: "What do you want from this?",
      modeAsk: "Just asking",
      modeEstimate: "Build my estimate",
      modeAskNote:
        "Ask anything. Nothing you say is gathered here, and no estimate is worked out.",
      switchedToAsk: "Estimate cleared. Nothing is being gathered.",
    },
  },
  es: {
    title: "Demeter",
    tagline: "Respuestas verificadas sobre SNAP — para cualquier estado.",
    inputPlaceholder: "Con gusto respondo cualquier pregunta sobre SNAP…",
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
    disclaimer:
      "Demeter da información, no asesoría legal. Confirma las decisiones con tu agencia de SNAP.",
    piiHint:
      "Por favor no escribas tu número de Seguro Social, datos bancarios ni un nombre completo.",
    clear: "Borrar esta conversación",
    clearNote:
      "La quita de este navegador. Seguimos guardando la pregunta y la respuesta para verificar nuestra exactitud.",
    cleared: "Conversación borrada.",
    err429: "Demasiadas preguntas a la vez — espera un minuto e intenta de nuevo.",
    errDailyCap:
      "Has hecho muchas preguntas hoy — esto se reinicia mañana. Para ayuda con SNAP ahora mismo, llama al 211 o a la agencia SNAP de tu estado.",
    errCapacity:
      "Demeter llegó a su capacidad del mes. Para ayuda con SNAP ahora, llama al 211 o a tu agencia estatal.",
    errConfig: "Demeter aún no está disponible — vuelve pronto.",
    errNetwork: "Algo salió mal. Intenta de nuevo.",
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
      title: "Tu estimado",
      subtitle: "Se arma mientras conversas",
      result: "Dónde queda esto",
      estimate: "Beneficio mensual estimado:",
      calc: "Cómo se calculó",
      stillNeeded: "Todavía falta",
      empty:
        "Cuéntale a Demeter sobre tu hogar — quién vive contigo, cuánto ganas, cuánto pagas de renta — y tu estimado se arma aquí.",
      privacy:
        "Cierra esta pestaña y no podrás volver a esta conversación. Guardamos la pregunta y la respuesta para verificar nuestra exactitud, así que evita escribir nombres o datos personales.",
      privacySaved:
        "Guardada en tu cuenta — puedes volver a ella o borrarla. Guardamos la pregunta y la respuesta para verificar nuestra exactitud, así que evita escribir nombres o datos personales.",
      disclaimer: "Un estimado, no una decisión. Tu agencia del condado decide.",
      pickState: "Elige tu estado arriba y tu estimado se irá armando aquí.",
      pickStateCta: "Elige tu estado",
      modeLabel: "¿Qué buscas aquí?",
      modeAsk: "Solo preguntar",
      modeEstimate: "Calcular mi estimado",
      modeAskNote:
        "Pregunta lo que quieras. Nada de lo que digas se recoge aquí y no se calcula ningún estimado.",
      switchedToAsk: "Estimado borrado. No se está recogiendo nada.",
    },
  },
  vi: {
    title: "Demeter",
    tagline: "Câu trả lời đã được xác minh về SNAP — cho mọi tiểu bang.",
    inputPlaceholder: "Rất sẵn lòng giải đáp mọi câu hỏi về SNAP…",
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
    disclaimer:
      "Demeter cung cấp thông tin, không phải tư vấn pháp lý. Hãy xác nhận quyết định với cơ quan SNAP của bạn.",
    piiHint: "Xin đừng nhập số An sinh Xã hội, thông tin ngân hàng hay họ tên đầy đủ.",
    clear: "Xóa cuộc trò chuyện này",
    clearNote:
      "Xóa khỏi trình duyệt này. Chúng tôi vẫn lưu câu hỏi và câu trả lời để kiểm tra độ chính xác.",
    cleared: "Đã xóa cuộc trò chuyện.",
    err429: "Quá nhiều câu hỏi cùng lúc — vui lòng đợi một phút rồi thử lại.",
    errDailyCap:
      "Hôm nay bạn đã hỏi khá nhiều — số lượt sẽ đặt lại vào ngày mai. Cần trợ giúp SNAP ngay bây giờ, hãy gọi 211 hoặc cơ quan SNAP của tiểu bang bạn.",
    errCapacity:
      "Demeter đã đạt giới hạn của tháng. Để được trợ giúp về SNAP ngay bây giờ, hãy gọi 211 hoặc cơ quan SNAP của tiểu bang bạn.",
    errConfig: "Demeter chưa sẵn sàng — vui lòng quay lại sau.",
    errNetwork: "Đã xảy ra lỗi. Vui lòng thử lại.",
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
      title: "Ước tính của bạn",
      subtitle: "Được xây dựng khi bạn trò chuyện",
      result: "Kết quả tạm tính",
      estimate: "Trợ cấp hàng tháng ước tính:",
      calc: "Cách tính ra con số đó",
      stillNeeded: "Còn thiếu",
      empty:
        "Hãy cho Demeter biết về hộ gia đình của bạn — ai sống cùng bạn, bạn kiếm được bao nhiêu, bạn trả bao nhiêu tiền thuê nhà — và ước tính sẽ hiện ở đây.",
      privacy:
        "Đóng tab này thì bạn không thể quay lại cuộc trò chuyện này. Chúng tôi lưu câu hỏi và câu trả lời để kiểm tra độ chính xác, vì vậy xin đừng nhập tên hay thông tin cá nhân.",
      privacySaved:
        "Đã lưu vào tài khoản của bạn — bạn có thể quay lại hoặc xóa đi. Chúng tôi lưu câu hỏi và câu trả lời để kiểm tra độ chính xác, vì vậy xin đừng nhập tên hay thông tin cá nhân.",
      disclaimer: "Chỉ là ước tính, không phải quyết định. Cơ quan quận của bạn mới là nơi quyết định.",
      pickState: "Chọn tiểu bang của bạn ở trên để ước tính có thể hiện ở đây.",
      pickStateCta: "Chọn tiểu bang",
      modeLabel: "Bạn muốn gì ở đây?",
      modeAsk: "Chỉ hỏi thôi",
      modeEstimate: "Tính mức ước tính",
      modeAskNote:
        "Cứ hỏi thoải mái. Không điều gì bạn nói được thu thập ở đây, và không có ước tính nào được tính.",
      switchedToAsk: "Đã xóa ước tính. Không có gì đang được thu thập.",
    },
  },
  zh: {
    title: "Demeter",
    tagline: "经过核实的 SNAP 答案——适用于任何州。",
    inputPlaceholder: "关于 SNAP 的任何问题，都很乐意解答…",
    send: "发送",
    stop: "停止",
    stateLabel: "您所在的州",
    federal: "所有州（联邦规定）",
    verified: "已核实",
    federalBadge: "联邦指引",
    dividerTo: (name: string) => `现在按 ${name} 的规定回答——之前的回答可能不再适用。`,
    dividerFederal: "现在仅按联邦规定回答——之前的回答可能不再适用。",
    disclaimer: "Demeter 提供信息，而非法律建议。请与您所在州的 SNAP 机构确认。",
    piiHint: "请不要输入社会安全号码、银行信息或完整姓名。",
    clear: "清除本次对话",
    clearNote: "仅从此浏览器中清除。我们仍会保留问题和回答以核查准确性。",
    cleared: "对话已清除。",
    err429: "同时提问太多了——请稍等一分钟再试。",
    errDailyCap: "您今天提问较多——明天会重置。如需 SNAP 帮助，请拨打 211 或联系您所在州的 SNAP 机构。",
    errCapacity:
      "Demeter 本月已达使用上限。如需即时的 SNAP 帮助，请拨打 211 或联系您所在州的 SNAP 机构。",
    errConfig: "Demeter 尚未开放——请稍后再来。",
    errNetwork: "出了点问题。请再试一次。",
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
      title: "您的估算",
      subtitle: "随着对话逐步生成",
      result: "初步结果",
      estimate: "每月估计补助：",
      calc: "计算方式",
      stillNeeded: "仍需提供",
      empty:
        "告诉 Demeter 您的家庭情况——谁和您同住、收入多少、房租多少——估算就会在这里逐步生成。",
      privacy:
        "关闭此页面后将无法返回本次对话。我们会保留问题和回答以核查准确性，因此请勿输入姓名或个人信息。",
      privacySaved:
        "已保存到您的账户 — 您可以随时返回或删除。我们会保留问题和回答以核查准确性，因此请勿输入姓名或个人信息。",
      disclaimer: "这只是估算，不是决定。最终由您所在县的机构裁定。",
      pickState: "请在上方选择您所在的州，估算就能在这里生成。",
      pickStateCta: "选择您所在的州",
      modeLabel: "您希望在这里得到什么？",
      modeAsk: "只是问问",
      modeEstimate: "帮我算估算",
      modeAskNote: "随便问。您说的内容不会在这里被收集，也不会计算任何估算。",
      switchedToAsk: "估算已清除。没有在收集任何内容。",
    },
  },
} as const;
