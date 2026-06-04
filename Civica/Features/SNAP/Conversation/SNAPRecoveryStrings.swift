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
        vi: "Tiếp tục đơn đăng ký trước đó"
    )
    static let entryLinkSubtitle = CivicaText(
        "Switched phones or reinstalled the app? Get back in with a one-time code.",
        es: "¿Cambiaste de teléfono o reinstalaste la app? Vuelve con un código de un solo uso.",
        vi: "Đổi điện thoại hoặc cài đặt lại ứng dụng? Quay lại bằng mã dùng một lần."
    )

    // MARK: - Step 1: channel

    static let channelTitle = CivicaText(
        "How can we reach you?",
        es: "¿Cómo podemos contactarte?",
        vi: "Chúng tôi có thể liên hệ với bạn bằng cách nào?"
    )
    static let channelHelper = CivicaText(
        "We'll send a one-time code to the phone or email you used when you started your application.",
        es: "Te enviaremos un código de un solo uso al teléfono o correo que usaste al iniciar tu solicitud.",
        vi: "Chúng tôi sẽ gửi mã dùng một lần đến số điện thoại hoặc email bạn đã dùng khi bắt đầu đơn đăng ký."
    )
    static let channelOptionPhone = CivicaText(
        "Text my phone",
        es: "Enviar un mensaje al teléfono",
        vi: "Nhắn tin đến điện thoại của tôi"
    )
    static let channelOptionEmail = CivicaText(
        "Email me",
        es: "Enviar un correo electrónico",
        vi: "Gửi email cho tôi"
    )

    // MARK: - Step 2: contact details

    static let contactTitlePhone = CivicaText(
        "What's your phone number?",
        es: "¿Cuál es tu número de teléfono?",
        vi: "Số điện thoại của bạn là gì?"
    )
    static let contactTitleEmail = CivicaText(
        "What's your email address?",
        es: "¿Cuál es tu dirección de correo electrónico?",
        vi: "Địa chỉ email của bạn là gì?"
    )
    static let contactHelperPhone = CivicaText(
        "Standard text rates may apply. We never share your number.",
        es: "Pueden aplicar tarifas estándar de mensajes. Nunca compartimos tu número.",
        vi: "Có thể áp dụng cước phí tin nhắn tiêu chuẩn. Chúng tôi không bao giờ chia sẻ số của bạn."
    )
    static let contactHelperEmail = CivicaText(
        "We'll only use this to send the code. We never share your email.",
        es: "Solo lo usaremos para enviar el código. Nunca compartimos tu correo.",
        vi: "Chúng tôi chỉ dùng email này để gửi mã. Chúng tôi không bao giờ chia sẻ email của bạn."
    )
    static let contactPlaceholderPhone = CivicaText(
        "Phone number",
        es: "Número de teléfono",
        vi: "Số điện thoại"
    )
    static let contactPlaceholderEmail = CivicaText(
        "you@example.com",
        es: "tu@ejemplo.com",
        vi: "ban@vidu.com"
    )

    // MARK: - Step 3: code entry

    static let codeTitle = CivicaText(
        "Enter the 6-digit code",
        es: "Ingresa el código de 6 dígitos",
        vi: "Nhập mã 6 chữ số"
    )
    /// "We texted 555-1234." / "We emailed you@example.com." Caller
    /// passes the masked contact in for display.
    static func codeHelper(contact: String, isPhone: Bool, language: CivicaLanguage) -> String {
        switch (language, isPhone) {
        case (.spanish, true):   return "Enviamos un código por mensaje a \(contact). Debería llegar en un minuto."
        case (.spanish, false):  return "Enviamos un código por correo a \(contact). Debería llegar en un minuto."
        case (.vietnamese, true):   return "Chúng tôi đã nhắn mã đến \(contact). Mã sẽ đến trong vòng một phút."
        case (.vietnamese, false):  return "Chúng tôi đã gửi email đến \(contact). Mã sẽ đến trong vòng một phút."
        // English + not-yet-translated languages fall back to English.
        case (_, true):   return "We texted \(contact) a code. It should arrive in a minute."
        case (_, false):  return "We emailed \(contact). The code should arrive in a minute."
        }
    }
    static let codePlaceholder = CivicaText("000000", es: "000000", vi: "000000")
    static let codeResend = CivicaText(
        "Send the code again",
        es: "Enviar el código de nuevo",
        vi: "Gửi lại mã"
    )

    // MARK: - Network / error states

    static let sending = CivicaText("Sending…", es: "Enviando…", vi: "Đang gửi…")
    static let redeeming = CivicaText(
        "Finding your application…",
        es: "Buscando tu solicitud…",
        vi: "Đang tìm đơn đăng ký của bạn…"
    )
    static let sendErrorGeneric = CivicaText(
        "We couldn't send the code right now. Try again in a moment.",
        es: "No pudimos enviar el código en este momento. Inténtalo de nuevo en un momento.",
        vi: "Chúng tôi không thể gửi mã ngay bây giờ. Hãy thử lại sau giây lát."
    )
    static let redeemErrorBadCode = CivicaText(
        "That code doesn't match. Double-check the digits or ask for a new one.",
        es: "Ese código no coincide. Verifica los dígitos o pide uno nuevo.",
        vi: "Mã đó không khớp. Hãy kiểm tra lại các chữ số hoặc yêu cầu mã mới."
    )
}