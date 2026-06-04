import Foundation

// EN/ES copy for the magic-link recovery flow. Spanish parity gate
// per HANDOFF #4.
//
// Tone: the user is reinstalling, switching phones, or otherwise
// stranded mid-application. Every line should reduce panic, not add
// friction. Plain-language, second-person, no jargon.

enum SNAPRecoveryStrings {

    // MARK: - Entry-point card (lives on SNAPEntryView)

    static let entryLinkTitle = CivicaText(
        "Continue an earlier application",
        es: "Continúa una solicitud anterior",
        zh: "继续之前的申请",
        vi: "Tiếp tục đơn đăng ký trước đó"
    )
    static let entryLinkSubtitle = CivicaText(
        "Switched phones or reinstalled the app? Get back in with a one-time code.",
        es: "¿Cambiaste de teléfono o reinstalaste la app? Vuelve con un código de un solo uso.",
        zh: "换了手机或重新安装了 app?用一次性验证码就能回来。",
        vi: "Đổi điện thoại hoặc cài lại app? Quay lại bằng mã dùng một lần."
    )

    // MARK: - Step 1: channel

    static let channelTitle = CivicaText(
        "How can we reach you?",
        es: "¿Cómo podemos contactarte?",
        zh: "我们怎么联系你?",
        vi: "Chúng tôi liên hệ với bạn bằng cách nào?"
    )
    static let channelHelper = CivicaText(
        "We'll send a one-time code to the phone or email you used when you started your application.",
        es: "Te enviaremos un código de un solo uso al teléfono o correo que usaste al iniciar tu solicitud.",
        zh: "我们会把一次性验证码发到你开始申请时用的手机或邮箱。",
        vi: "Chúng tôi sẽ gửi mã dùng một lần đến điện thoại hoặc email bạn đã dùng khi bắt đầu đơn đăng ký."
    )
    static let channelOptionPhone = CivicaText(
        "Text my phone",
        es: "Enviar un mensaje al teléfono",
        zh: "发短信到手机",
        vi: "Nhắn tin đến điện thoại của tôi"
    )
    static let channelOptionEmail = CivicaText(
        "Email me",
        es: "Enviar un correo electrónico",
        zh: "发邮件给我",
        vi: "Gửi email cho tôi"
    )

    // MARK: - Step 2: contact details

    static let contactTitlePhone = CivicaText(
        "What's your phone number?",
        es: "¿Cuál es tu número de teléfono?",
        zh: "你的手机号是多少?",
        vi: "Số điện thoại của bạn là gì?"
    )
    static let contactTitleEmail = CivicaText(
        "What's your email address?",
        es: "¿Cuál es tu dirección de correo electrónico?",
        zh: "你的邮箱地址是什么?",
        vi: "Địa chỉ email của bạn là gì?"
    )
    static let contactHelperPhone = CivicaText(
        "Standard text rates may apply. We never share your number.",
        es: "Pueden aplicar tarifas estándar de mensajes. Nunca compartimos tu número.",
        zh: "可能产生标准短信费用。我们绝不会分享你的号码。",
        vi: "Có thể áp dụng cước nhắn tin tiêu chuẩn. Chúng tôi không bao giờ chia sẻ số của bạn."
    )
    static let contactHelperEmail = CivicaText(
        "We'll only use this to send the code. We never share your email.",
        es: "Solo lo usaremos para enviar el código. Nunca compartimos tu correo.",
        zh: "我们只用它来发送验证码。绝不会分享你的邮箱。",
        vi: "Chúng tôi chỉ dùng nó để gửi mã. Chúng tôi không bao giờ chia sẻ email của bạn."
    )
    static let contactPlaceholderPhone = CivicaText(
        "Phone number",
        es: "Número de teléfono",
        zh: "手机号",
        vi: "Số điện thoại"
    )
    static let contactPlaceholderEmail = CivicaText(
        "you@example.com",
        es: "tu@ejemplo.com",
        zh: "you@example.com"
    )

    // MARK: - Step 3: code entry

    static let codeTitle = CivicaText(
        "Enter the 6-digit code",
        es: "Ingresa el código de 6 dígitos",
        zh: "输入 6 位验证码",
        vi: "Nhập mã 6 chữ số"
    )
    /// "We texted 555-1234." / "We emailed you@example.com." Caller
    /// passes the masked contact in for display.
    static func codeHelper(contact: String, isPhone: Bool, language: CivicaLanguage) -> String {
        switch (language, isPhone) {
        case (.spanish, true):   return "Enviamos un código por mensaje a \(contact). Debería llegar en un minuto."
        case (.spanish, false):  return "Enviamos un código por correo a \(contact). Debería llegar en un minuto."
        case (.mandarin, true):  return "我们已把验证码短信发到 \(contact)。应该一分钟内就到。"
        case (.mandarin, false): return "我们已把验证码发到 \(contact)。应该一分钟内就到。"
        case (.vietnamese, true):  return "Chúng tôi đã nhắn mã đến \(contact). Mã sẽ đến trong một phút."
        case (.vietnamese, false): return "Chúng tôi đã gửi email đến \(contact). Mã sẽ đến trong một phút."
        // English + not-yet-translated languages fall back to English.
        case (_, true):   return "We texted \(contact) a code. It should arrive in a minute."
        case (_, false):  return "We emailed \(contact). The code should arrive in a minute."
        }
    }
    static let codePlaceholder = CivicaText("000000", es: "000000", zh: "000000")
    static let codeResend = CivicaText(
        "Send the code again",
        es: "Enviar el código de nuevo",
        zh: "再发一次验证码",
        vi: "Gửi lại mã"
    )

    // MARK: - Network / error states

    static let sending = CivicaText("Sending…", es: "Enviando…", zh: "发送中…", vi: "Đang gửi…")
    static let redeeming = CivicaText(
        "Finding your application…",
        es: "Buscando tu solicitud…",
        zh: "正在查找你的申请…",
        vi: "Đang tìm đơn đăng ký của bạn…"
    )
    static let sendErrorGeneric = CivicaText(
        "We couldn't send the code right now. Try again in a moment.",
        es: "No pudimos enviar el código en este momento. Inténtalo de nuevo en un momento.",
        zh: "现在无法发送验证码。请稍后再试。",
        vi: "Hiện chúng tôi không gửi được mã. Hãy thử lại sau giây lát."
    )
    static let redeemErrorBadCode = CivicaText(
        "That code doesn't match. Double-check the digits or ask for a new one.",
        es: "Ese código no coincide. Verifica los dígitos o pide uno nuevo.",
        zh: "验证码不正确。请核对数字,或请求一个新的。",
        vi: "Mã đó không khớp. Hãy kiểm tra lại các chữ số hoặc yêu cầu mã mới."
    )
}
