import Foundation

// Canonical Civica notification templates — every email + SMS Civica
// will send a user, captured per HANDOFF's EmailTemplatesBoard +
// MobileSMSThreadBoard. Pure data; no rendering, no transport.
//
// Why this file ships before the backend: when SMS + email
// infrastructure lands (Twilio long code per HANDOFF decision #3,
// SendGrid or similar for email), the backend reads these templates
// and substitutes parameters from the user's state. Drafting them
// now both:
//
//   • Lets the iOS app show users WHAT they'll receive (preview
//     surface inside the privacy screen — important for trust;
//     SMS lifts most of the brand voice rules).
//   • Forces the templates through the brand-voice + HANDOFF
//     rules before they're rate-limited by network ops decisions.
//
// HANDOFF rules baked into every template:
//
//   Email — "subject is the headline · renders complete in the
//   inbox row · one button or none · reply-to reaches a human ·
//   prints clean on one page B&W."
//
//   SMS — "every message names next action + time horizon ·
//   not-now is a first-class reply · STOP is honored in the
//   first message · links are tokenized, not generic homepage."

enum CivicaNotificationChannel: String, Codable, Sendable, CaseIterable {
    case email
    case sms
    case push   // future — not enabled at v1 per HANDOFF decision #5

    var displayLabel: CivicaText {
        switch self {
        case .email: return CivicaText("Email", es: "Correo electrónico", zh: "电子邮件", vi: "Email", tl: "Email")
        case .sms:   return CivicaText("Text message", es: "Mensaje de texto", zh: "短信", vi: "Tin nhắn", tl: "Text message")
        case .push:  return CivicaText("Push notification", es: "Notificación push", zh: "推送通知", vi: "Thông báo đẩy", tl: "Push notification")
        }
    }
}

/// Stable identifier for each canonical message. Backend reads the
/// id and dispatches the matching template + channel.
enum CivicaNotificationKind: String, Codable, Sendable, CaseIterable, Identifiable {
    case applicationSubmittedEmail
    case applicationSubmittedSMS
    case documentRequestedSMS
    case approvedEmail
    case approvedSMS
    case recertHeadsUpEmail
    case recertHeadsUpSMS
    case recertOneDayBeforeSMS

    var id: String { rawValue }

    var channel: CivicaNotificationChannel {
        switch self {
        case .applicationSubmittedEmail, .approvedEmail, .recertHeadsUpEmail:
            return .email
        case .applicationSubmittedSMS, .documentRequestedSMS, .approvedSMS,
             .recertHeadsUpSMS, .recertOneDayBeforeSMS:
            return .sms
        }
    }
}

/// A single notification template. Body lines render in order with
/// blank-line separators between them — matches the canvas mock's
/// stanza-per-paragraph layout. Button is nil when none is wanted
/// (per HANDOFF "one button or none").
struct CivicaNotificationTemplate: Equatable {
    let kind: CivicaNotificationKind
    let subject: CivicaText        // Email subject line. SMS uses this as the moment label only.
    let preheader: CivicaText      // Email preheader / SMS one-line summary.
    let body: [CivicaText]         // Body stanzas. Each stanza is one paragraph.
    let buttonLabel: CivicaText?   // Optional one-button CTA label.
    let buttonURLHint: String?     // Tokenized path placeholder — backend substitutes the session id.
}

enum CivicaNotificationTemplates {

    /// Resolve a template by its kind. Returns the canonical template
    /// the backend will read at send time. Templates contain
    /// substitution tokens ({deadline}, {recertDate}, {agency},
    /// {portal}, {hotline}) that the backend / preview view fills in
    /// at render time — see `render(_:stateCode:language:)`.
    static func template(for kind: CivicaNotificationKind) -> CivicaNotificationTemplate {
        switch kind {
        case .applicationSubmittedEmail: return applicationSubmittedEmail
        case .applicationSubmittedSMS:   return applicationSubmittedSMS
        case .documentRequestedSMS:      return documentRequestedSMS
        case .approvedEmail:             return approvedEmail
        case .approvedSMS:              return approvedSMS
        case .recertHeadsUpEmail:        return recertHeadsUpEmail
        case .recertHeadsUpSMS:          return recertHeadsUpSMS
        case .recertOneDayBeforeSMS:     return recertOneDayBeforeSMS
        }
    }

    /// Resolve a CivicaText body line into a final user-facing string,
    /// substituting `{agency}`, `{portal}`, and `{hotline}` tokens
    /// against the active state's SNAPAgencyDirectory entry. Time-
    /// sensitive tokens like `{deadline}` and `{recertDate}` are
    /// substituted server-side and remain in the rendered output
    /// here as bracketed placeholders the preview surface treats
    /// as visible "(your deadline here)" copy.
    static func render(
        _ text: CivicaText,
        stateCode: String?,
        county: String? = nil,
        language: CivicaLanguage
    ) -> String {
        let raw = text.value(in: language)
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        let agencyShort = SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalLabel = portal.isEmpty
            ? (language == .english ? "your state portal" : "el portal estatal")
            : portal
        let hotline = SNAPAgencyDirectory.helplineNumber(for: stateCode)
        // {county} resolves to the supplied county name when present;
        // otherwise to a soft fallback so the sentence still reads
        // naturally. Surfaces that have access to the persisted draft
        // should look up county via CACountyResolver first.
        let countyLabel: String = {
            if let county, !county.isEmpty { return county }
            return language == .english ? "your county" : "tu condado"
        }()
        return raw
            .replacingOccurrences(of: "{agencyFull}", with: agency)
            .replacingOccurrences(of: "{agency}", with: agencyShort)
            .replacingOccurrences(of: "{portal}", with: portalLabel)
            .replacingOccurrences(of: "{hotline}", with: hotline)
            .replacingOccurrences(of: "{county}", with: countyLabel)
    }

    // MARK: - Compliance registry helpers

    /// Returns a CivicaText using the counsel-approved registry string when
    /// the row's status is .approved; falls back to current production copy
    /// while .pendingSignoff. Flip status in SNAPComplianceCopyRegistry to
    /// activate the replacement — no call-site changes needed for these strings.
    private static func registryText(
        id: String,
        fallbackEN: String,
        fallbackES: String
    ) -> CivicaText {
        CivicaText(
            SNAPComplianceCopyRegistry.approvedEnglish(for: id) ?? fallbackEN,
            es: SNAPComplianceCopyRegistry.approvedSpanish(for: id) ?? fallbackES
        )
    }

    /// State-aware resolver for notification body strings that are stored
    /// state-keyed in the compliance registry (rows 6, 7, 8). Backend
    /// dispatch (and the in-app preview surface) should call this with the
    /// recipient's stateCode so CA users see "CalFresh"/CDSS and MA users
    /// see "SNAP"/DTA. Falls back to the flat default approved string when
    /// no state-keyed variant exists, then to the supplied production copy
    /// while .pendingSignoff.
    static func registryString(
        id: String,
        stateCode: String?,
        language: CivicaLanguage,
        fallbackEN: String,
        fallbackES: String
    ) -> String {
        let fallback = language == .english ? fallbackEN : fallbackES
        switch language {
        case .english:
            return SNAPComplianceCopyRegistry.approvedEnglish(for: id, stateCode: stateCode) ?? fallback
        case .mandarin:
            return SNAPComplianceCopyRegistry.approvedEnglish(for: id, stateCode: stateCode) ?? fallback
        case .vietnamese:
            return SNAPComplianceCopyRegistry.approvedEnglish(for: id, stateCode: stateCode) ?? fallback
        case .tagalog:
            return SNAPComplianceCopyRegistry.approvedEnglish(for: id, stateCode: stateCode) ?? fallback
        case .spanish:
            return SNAPComplianceCopyRegistry.approvedSpanish(for: id, stateCode: stateCode) ?? fallback
        }
    }

    /// Registry-aware EBT PIN CTA label (compliance id: ebt_pin_cta, audit Q3).
    /// Call sites that render the approvedEmail buttonLabel should switch to this
    /// function when counsel signs — it returns the state-specific EBT portal URL.
    /// Falls back to the current "Set the EBT PIN" while .pendingSignoff.
    static func ebtPinCTALabel(stateCode: String?, language: CivicaLanguage) -> String {
        guard SNAPComplianceCopyRegistry.approvedEnglish(for: "ebt_pin_cta") != nil else {
            return language == .english ? "Set the EBT PIN" : "Configurar el PIN de EBT"
        }
        let ebtPortal: String
        switch stateCode {
        case "CA": ebtPortal = "ebt.ca.gov"
        case "MA": ebtPortal = "ebtedge.com"
        default:   ebtPortal = language == .english ? "your state's EBT portal" : "el portal EBT de su estado"
        }
        return language == .english
            ? "Set your EBT PIN at \(ebtPortal)"
            : "Establezca su PIN de EBT en \(ebtPortal)"
    }

    // MARK: - Application submitted

    private static let applicationSubmittedEmail = CivicaNotificationTemplate(
        kind: .applicationSubmittedEmail,
        subject: CivicaText(
            "Application sent. Decision usually in about 7 days.",
            es: "Solicitud enviada. Decisión generalmente en unos 7 días.",
            zh: "申请已发送。通常约 7 天内会有决定。",
            vi: "Đã gửi đơn. Thường có quyết định trong khoảng 7 ngày.",
            tl: "Naipadala na ang aplikasyon. Karaniwang may desisyon sa loob ng mga 7 araw."
        ),
        preheader: CivicaText(
            "What happens next, in plain English.",
            es: "Lo que sigue, en lenguaje sencillo.",
            zh: "接下来会发生什么，用大白话告诉你。",
            vi: "Việc tiếp theo sẽ ra sao, nói cho dễ hiểu.",
            tl: "Ano ang susunod na mangyayari, sa simpleng salita."
        ),
        body: [
            CivicaText(
                "Your SNAP application is with {agencyFull}.",
                es: "Tu solicitud de SNAP está con {agencyFull}.",
                zh: "你的 SNAP 申请已经交到 {agencyFull}。",
                vi: "Đơn SNAP của bạn đã được gửi đến {agencyFull}.",
                tl: "Nasa {agencyFull} na ang iyong SNAP application."
            ),
            CivicaText(
                "What's next:\n  • {agency} may text or call to verify something. We'll forward it to you.\n  • Decision usually in about 7 days. State target is 30.\n  • If approved, your EBT card arrives 7–10 days after that.",
                es: "Lo que sigue:\n  • {agency} puede llamar o enviar mensajes para verificar algo. Te lo reenviaremos.\n  • Decisión generalmente en unos 7 días. El objetivo del estado es 30.\n  • Si te aprueban, tu tarjeta EBT llega 7–10 días después.",
                zh: "接下来：\n  • {agency} 可能会发短信或打电话来核实信息。我们会转发给你。\n  • 通常约 7 天内会有决定。州的目标是 30 天。\n  • 如果获批，你的 EBT 卡会在那之后 7–10 天寄到。",
                vi: "Việc tiếp theo:\n  • {agency} có thể nhắn tin hoặc gọi để xác minh thông tin. Chúng tôi sẽ chuyển đến bạn.\n  • Thường có quyết định trong khoảng 7 ngày. Mục tiêu của bang là 30 ngày.\n  • Nếu được duyệt, thẻ EBT sẽ đến trong 7–10 ngày sau đó.",
                tl: "Ano ang susunod:\n  • Maaaring mag-text o tumawag ang {agency} para mag-verify ng isang bagay. Ipapasa namin ito sa iyo.\n  • Karaniwang may desisyon sa loob ng mga 7 araw. Target ng estado ay 30.\n  • Kung maaprubahan, darating ang iyong EBT card 7–10 araw pagkatapos noon."
            ),
            CivicaText(
                "You don't need to do anything right now. We'll text and email when there's news.",
                es: "No tienes que hacer nada ahora. Te enviaremos un mensaje y un correo cuando haya noticias.",
                zh: "你现在不用做任何事。有消息时我们会发短信和邮件给你。",
                vi: "Bạn không cần làm gì lúc này. Chúng tôi sẽ nhắn tin và gửi email khi có tin.",
                tl: "Hindi mo kailangang gumawa ng kahit ano ngayon. Magte-text at mag-e-email kami kapag may balita."
            ),
        ],
        buttonLabel: CivicaText("See your status", es: "Ver tu estado", zh: "查看你的状态", vi: "Xem trạng thái của bạn", tl: "Tingnan ang iyong status"),
        buttonURLHint: "civica://status/{session}"
    )

    private static let applicationSubmittedSMS = CivicaNotificationTemplate(
        kind: .applicationSubmittedSMS,
        subject: CivicaText("Submitted", es: "Enviada", zh: "已提交", vi: "Đã gửi", tl: "Naipasa na"),
        preheader: CivicaText(
            "Civica · application submitted",
            es: "Civica · solicitud enviada",
            zh: "Civica · 申请已提交",
            vi: "Civica · đã gửi đơn",
            tl: "Civica · naipasa na ang aplikasyon"
        ),
        body: [
            CivicaText(
                "Your SNAP application is with {agencyFull}. Decision usually in about 7 days; the state target is 30. We'll text you when there's news.",
                es: "Tu solicitud de SNAP está con {agencyFull}. Decisión generalmente en unos 7 días; el objetivo del estado es 30. Te enviaremos un mensaje cuando haya noticias.",
                zh: "你的 SNAP 申请已经交到 {agencyFull}。通常约 7 天内会有决定；州的目标是 30 天。有消息时我们会发短信给你。",
                vi: "Đơn SNAP của bạn đã được gửi đến {agencyFull}. Thường có quyết định trong khoảng 7 ngày; mục tiêu của bang là 30 ngày. Chúng tôi sẽ nhắn tin khi có tin.",
                tl: "Nasa {agencyFull} na ang iyong SNAP application. Karaniwang may desisyon sa loob ng mga 7 araw; ang target ng estado ay 30. Magte-text kami sa iyo kapag may balita."
            ),
        ],
        buttonLabel: CivicaText("See your status", es: "Ver tu estado", zh: "查看你的状态", vi: "Xem trạng thái của bạn", tl: "Tingnan ang iyong status"),
        buttonURLHint: "civica.us/m/{session}"
    )

    // MARK: - Document requested

    private static let documentRequestedSMS = CivicaNotificationTemplate(
        kind: .documentRequestedSMS,
        subject: CivicaText("Doc needed", es: "Documento necesario", zh: "需要文件", vi: "Cần giấy tờ", tl: "May kailangang dokumento"),
        preheader: CivicaText(
            "{agency} needs one more thing",
            es: "{agency} necesita una cosa más",
            zh: "{agency} 还需要一样东西",
            vi: "{agency} cần thêm một thứ nữa",
            tl: "May isa pang kailangan ang {agency}"
        ),
        body: [
            // Compliance Q3: registry id "doc_requested_sms_body" — flip to .approved to activate.
            registryText(
                id: "doc_requested_sms_body",
                fallbackEN: "{agency} needs one more thing: a recent paystub. Send a photo here or upload in the app. By {deadline} keeps your application moving.",
                fallbackES: "{agency} necesita una cosa más: un talón de pago reciente. Envía una foto aquí o súbela en la app. Antes del {deadline} para que tu solicitud siga su curso."
            ),
        ],
        buttonLabel: CivicaText("Upload now", es: "Subir ahora", zh: "立即上传", vi: "Tải lên ngay", tl: "I-upload na"),
        buttonURLHint: "civica.us/upload/{session}"
    )

    // MARK: - Approved

    private static let approvedEmail = CivicaNotificationTemplate(
        kind: .approvedEmail,
        // Compliance Q3: registry id "approval_email_subject" — flip to .approved to activate.
        subject: registryText(
            id: "approval_email_subject",
            fallbackEN: "Approved. ${monthlyBenefit}/mo, starting this month.",
            fallbackES: "Aprobado. ${monthlyBenefit}/mes, a partir de este mes."
        ),
        preheader: CivicaText(
            "EBT card is on its way. Set the PIN before it arrives.",
            es: "Tu tarjeta EBT está en camino. Configura el PIN antes de que llegue.",
            zh: "EBT 卡正在寄出。请在它到达前设置 PIN 码。",
            vi: "Thẻ EBT đang trên đường tới. Hãy đặt mã PIN trước khi thẻ đến.",
            tl: "Paparating na ang EBT card. I-set ang PIN bago ito dumating."
        ),
        body: [
            CivicaText(
                "You're approved for ${monthlyBenefit}/month. {householdSize}-person household, {annualBenefit}/year total.",
                es: "Estás aprobado para ${monthlyBenefit}/mes. Hogar de {householdSize} persona(s), {annualBenefit}/año en total.",
                zh: "你已获批每月 ${monthlyBenefit}。{householdSize} 人家庭，全年共 {annualBenefit}。",
                vi: "Bạn được duyệt ${monthlyBenefit}/tháng. Hộ {householdSize} người, tổng cộng {annualBenefit}/năm.",
                tl: "Naaprubahan ka para sa ${monthlyBenefit}/buwan. Sambahayan na {householdSize} tao, {annualBenefit}/taon sa kabuuan."
            ),
            CivicaText(
                "EBT card expected {ebtArrivalWindow}. Plain white envelope from the state EBT office. Set the PIN by phone before you use it.",
                es: "Tarjeta EBT esperada para {ebtArrivalWindow}. Sobre blanco de la oficina estatal de EBT. Configura el PIN por teléfono antes de usarla.",
                zh: "EBT 卡预计于 {ebtArrivalWindow} 寄到。州 EBT 办公室寄出的素白色信封。使用前请用电话设置 PIN 码。",
                vi: "Thẻ EBT dự kiến đến {ebtArrivalWindow}. Phong bì trắng trơn từ văn phòng EBT của bang. Hãy gọi điện đặt mã PIN trước khi dùng.",
                tl: "Inaasahang darating ang EBT card sa {ebtArrivalWindow}. Plain na puting sobre mula sa state EBT office. I-set ang PIN sa telepono bago ito gamitin."
            ),
            CivicaText(
                "Recert is {recertDate}. We'll text you 60 and 14 days ahead.",
                es: "Recertificación el {recertDate}. Te enviaremos un mensaje 60 y 14 días antes.",
                zh: "重新认证日期是 {recertDate}。我们会在 60 天和 14 天前发短信提醒你。",
                vi: "Ngày tái xác nhận là {recertDate}. Chúng tôi sẽ nhắn tin nhắc bạn trước 60 ngày và 14 ngày.",
                tl: "Ang recert ay sa {recertDate}. Magte-text kami sa iyo 60 at 14 araw bago noon."
            ),
        ],
        // Compliance Q3: registry id "ebt_pin_cta" — state-parameterized.
        // When counsel signs, replace this buttonLabel with ebtPinCTALabel(stateCode:language:)
        // at the render call site (stateCode must flow in from the user's session).
        buttonLabel: CivicaText("Set the EBT PIN", es: "Configurar el PIN de EBT", zh: "设置 EBT PIN 码", vi: "Đặt mã PIN cho thẻ EBT", tl: "I-set ang EBT PIN"),
        buttonURLHint: "civica.us/ebt-pin"
    )

    private static let approvedSMS = CivicaNotificationTemplate(
        kind: .approvedSMS,
        subject: CivicaText("Approved", es: "Aprobado", zh: "已获批", vi: "Đã duyệt", tl: "Naaprubahan"),
        preheader: CivicaText(
            "Approved · ${monthlyBenefit}/mo",
            es: "Aprobado · ${monthlyBenefit}/mes",
            zh: "已获批 · 每月 ${monthlyBenefit}",
            vi: "Đã duyệt · ${monthlyBenefit}/tháng",
            tl: "Naaprubahan · ${monthlyBenefit}/buwan"
        ),
        body: [
            CivicaText(
                "Approved. ${monthlyBenefit}/mo, starting this month. EBT card expected {ebtArrivalWindow}. Set the PIN by phone before you use it.",
                es: "Aprobado. ${monthlyBenefit}/mes, a partir de este mes. Tarjeta EBT esperada para {ebtArrivalWindow}. Configura el PIN por teléfono antes de usarla.",
                zh: "已获批。本月开始每月 ${monthlyBenefit}。EBT 卡预计于 {ebtArrivalWindow} 寄到。使用前请用电话设置 PIN 码。",
                vi: "Đã duyệt. ${monthlyBenefit}/tháng, bắt đầu từ tháng này. Thẻ EBT dự kiến đến {ebtArrivalWindow}. Hãy gọi điện đặt mã PIN trước khi dùng.",
                tl: "Naaprubahan. ${monthlyBenefit}/buwan, simula ngayong buwan. Inaasahang darating ang EBT card sa {ebtArrivalWindow}. I-set ang PIN sa telepono bago ito gamitin."
            ),
        ],
        buttonLabel: CivicaText("Set the EBT PIN", es: "Configurar PIN de EBT", zh: "设置 EBT PIN 码", vi: "Đặt mã PIN cho thẻ EBT", tl: "I-set ang EBT PIN"),
        buttonURLHint: "civica.us/ebt-pin"
    )

    // MARK: - Recert heads-up (60 days out)

    private static let recertHeadsUpEmail = CivicaNotificationTemplate(
        kind: .recertHeadsUpEmail,
        // Compliance Q3: registry id "recert_heads_up_email_subject" — flip to .approved to activate.
        subject: registryText(
            id: "recert_heads_up_email_subject",
            fallbackEN: "Recertify in 60 days. Usually 4 minutes.",
            fallbackES: "Recertifica en 60 días. Usualmente 4 minutos."
        ),
        preheader: CivicaText(
            "Quick check, not the whole form again.",
            es: "Una verificación rápida, no la solicitud completa otra vez.",
            zh: "只是快速确认，不用再填整张表。",
            vi: "Chỉ là kiểm tra nhanh, không phải điền lại cả đơn.",
            tl: "Mabilis na pag-check lang, hindi na buong form muli."
        ),
        body: [
            CivicaText(
                "Your SNAP has to be renewed by {recertDate} to keep going. {agency} calls this recertification.",
                es: "Tu SNAP tiene que renovarse antes del {recertDate} para continuar. {agency} llama a esto recertificación.",
                zh: "你的 SNAP 必须在 {recertDate} 前续办才能继续。{agency} 把这叫做重新认证。",
                vi: "SNAP của bạn phải được gia hạn trước {recertDate} để tiếp tục. {agency} gọi việc này là tái xác nhận.",
                tl: "Kailangang ma-renew ang iyong SNAP bago ang {recertDate} para magpatuloy. Tinatawag itong recertification ng {agency}."
            ),
            CivicaText(
                "What's on the form:\n  • Anyone new in your household?\n  • Income changes?\n  • Rent or address changes?\n  • One recent pay stub.",
                es: "Lo que está en la solicitud:\n  • ¿Alguien nuevo en tu hogar?\n  • ¿Cambios en tus ingresos?\n  • ¿Cambios de renta o dirección?\n  • Un talón de pago reciente.",
                zh: "表格上的内容：\n  • 家里有新成员吗？\n  • 收入有变化吗？\n  • 房租或地址有变化吗？\n  • 一张最近的工资单。",
                vi: "Trên đơn có:\n  • Có ai mới trong hộ của bạn không?\n  • Thu nhập có thay đổi không?\n  • Tiền thuê nhà hoặc địa chỉ có thay đổi không?\n  • Một phiếu lương gần đây.",
                tl: "Ano ang nasa form:\n  • May bago bang miyembro sa iyong sambahayan?\n  • May pagbabago ba sa kita?\n  • May pagbabago ba sa upa o address?\n  • Isang kamakailang pay stub."
            ),
            CivicaText(
                "We pre-filled everything from last time. You're mostly confirming \"yes, still right\" or telling us what changed.",
                es: "Pre-llenamos todo desde la última vez. Mayormente estás confirmando \"sí, sigue siendo correcto\" o diciéndonos qué cambió.",
                zh: "我们已经用上次的信息预先填好了。你主要是确认「是的，还正确」，或告诉我们有什么变化。",
                vi: "Chúng tôi đã điền sẵn mọi thứ từ lần trước. Bạn chỉ cần xác nhận \u{201C}đúng, vẫn vậy\u{201D} hoặc cho chúng tôi biết có gì thay đổi.",
                tl: "Pre-filled na namin ang lahat mula noong huli. Karamihan ay kinukumpirma mo lang na \u{201C}oo, tama pa rin\u{201D} o sinasabi sa amin kung ano ang nagbago."
            ),
            CivicaText(
                "We'll remind you again 14 days before, and again 1 day before. If you miss the deadline, your benefits may pause — contact {agencyFull} at {hotline} to request reinstatement.",
                es: "Te recordaremos otra vez 14 días antes, y otra vez 1 día antes. Si pierdes la fecha límite, tus beneficios pueden pausarse — comunícate con {agencyFull} al {hotline} para solicitar la reactivación.",
                zh: "我们会在 14 天前再提醒一次，1 天前再提醒一次。如果你错过截止日期，你的福利可能会暂停 — 请拨打 {hotline} 联系 {agencyFull} 申请恢复。",
                vi: "Chúng tôi sẽ nhắc bạn lại trước 14 ngày, và một lần nữa trước 1 ngày. Nếu bạn lỡ hạn, trợ cấp của bạn có thể bị tạm ngưng — hãy liên hệ {agencyFull} qua số {hotline} để xin khôi phục.",
                tl: "Paaalalahanan ka namin muli 14 araw bago, at muli 1 araw bago. Kung malampasan mo ang deadline, maaaring ma-pause ang iyong mga benepisyo — tawagan ang {agencyFull} sa {hotline} para humiling ng reinstatement."
            ),
        ],
        buttonLabel: CivicaText("Start recertification", es: "Comenzar recertificación", zh: "开始重新认证", vi: "Bắt đầu tái xác nhận", tl: "Simulan ang recertification"),
        buttonURLHint: "civica://recert/{session}"
    )

    private static let recertHeadsUpSMS = CivicaNotificationTemplate(
        kind: .recertHeadsUpSMS,
        subject: CivicaText("Recert in 60 days", es: "Recertificación en 60 días", zh: "60 天后重新认证", vi: "Tái xác nhận sau 60 ngày", tl: "Recert sa 60 araw"),
        preheader: CivicaText(
            "Quick check, not the whole form again",
            es: "Verificación rápida, no la solicitud completa",
            zh: "只是快速确认，不用再填整张表",
            vi: "Chỉ là kiểm tra nhanh, không phải điền lại cả đơn",
            tl: "Mabilis na pag-check lang, hindi na buong form muli"
        ),
        body: [
            CivicaText(
                "Heads up — your SNAP has to be renewed by {recertDate} to keep going. Usually 4 minutes. We'll remind you again 14 days and 1 day before.",
                es: "Aviso — tu SNAP tiene que renovarse antes del {recertDate} para continuar. Usualmente 4 minutos. Te recordaremos 14 días y 1 día antes.",
                zh: "提醒一下 — 你的 SNAP 必须在 {recertDate} 前续办才能继续。通常 4 分钟搞定。我们会在 14 天和 1 天前再提醒你。",
                vi: "Nhắc bạn — SNAP của bạn phải được gia hạn trước {recertDate} để tiếp tục. Thường mất 4 phút. Chúng tôi sẽ nhắc lại trước 14 ngày và 1 ngày.",
                tl: "Paalala — kailangang ma-renew ang iyong SNAP bago ang {recertDate} para magpatuloy. Karaniwang 4 minuto. Paaalalahanan ka namin muli 14 araw at 1 araw bago."
            ),
        ],
        buttonLabel: CivicaText("Start recert", es: "Iniciar recertificación", zh: "开始重新认证", vi: "Bắt đầu tái xác nhận", tl: "Simulan ang recert"),
        buttonURLHint: "civica.us/recert/{session}"
    )

    // MARK: - Recert reminder (1 day before)

    private static let recertOneDayBeforeSMS = CivicaNotificationTemplate(
        kind: .recertOneDayBeforeSMS,
        subject: CivicaText("Recert tomorrow", es: "Recertificación mañana", zh: "明天重新认证", vi: "Mai là hạn tái xác nhận", tl: "Recert bukas"),
        preheader: CivicaText(
            "Last reminder before benefits pause",
            es: "Último aviso antes de que se pausen los beneficios",
            zh: "福利暂停前的最后一次提醒",
            vi: "Lời nhắc cuối trước khi trợ cấp tạm ngưng",
            tl: "Huling paalala bago ma-pause ang mga benepisyo"
        ),
        body: [
            // Compliance Q3: registry id "recert_one_day_sms" — counsel-prep
            // approved (2026-05-19). The flat default uses {agency}/{portal}
            // tokens substituted by render(); state-keyed variants (CalFresh
            // CA / SNAP MA) live in the registry's approvedEnglishByState map
            // and are resolved by CivicaNotificationTemplates.registryString
            // at backend dispatch time with the recipient's stateCode.
            registryText(
                id: "recert_one_day_sms",
                fallbackEN: "Tomorrow is your recert deadline ({recertDate}). 4 minutes if you start now. If you miss it, benefits pause until you submit.",
                fallbackES: "Mañana vence tu recertificación ({recertDate}). 4 minutos si empiezas ahora. Si lo olvidas, los beneficios se pausan hasta que envíes."
            ),
        ],
        buttonLabel: CivicaText("Start now", es: "Empezar ahora", zh: "现在开始", vi: "Bắt đầu ngay", tl: "Simulan na"),
        buttonURLHint: "civica.us/recert/{session}"
    )
}
