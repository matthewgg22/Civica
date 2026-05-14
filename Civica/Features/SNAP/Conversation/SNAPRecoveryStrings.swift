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
        es: "Continúa una solicitud anterior"
    )
    static let entryLinkSubtitle = CivicaText(
        "Switched phones or reinstalled the app? Get back in with a one-time code.",
        es: "¿Cambiaste de teléfono o reinstalaste la app? Vuelve con un código de un solo uso."
    )

    // MARK: - Step 1: channel

    static let channelTitle = CivicaText(
        "How can we reach you?",
        es: "¿Cómo podemos contactarte?"
    )
    static let channelHelper = CivicaText(
        "We'll send a one-time code to the phone or email you used when you started your application.",
        es: "Te enviaremos un código de un solo uso al teléfono o correo que usaste al iniciar tu solicitud."
    )
    static let channelOptionPhone = CivicaText(
        "Text my phone",
        es: "Enviar un mensaje al teléfono"
    )
    static let channelOptionEmail = CivicaText(
        "Email me",
        es: "Enviar un correo electrónico"
    )

    // MARK: - Step 2: contact details

    static let contactTitlePhone = CivicaText(
        "What's your phone number?",
        es: "¿Cuál es tu número de teléfono?"
    )
    static let contactTitleEmail = CivicaText(
        "What's your email address?",
        es: "¿Cuál es tu dirección de correo electrónico?"
    )
    static let contactHelperPhone = CivicaText(
        "Standard text rates may apply. We never share your number.",
        es: "Pueden aplicar tarifas estándar de mensajes. Nunca compartimos tu número."
    )
    static let contactHelperEmail = CivicaText(
        "We'll only use this to send the code. We never share your email.",
        es: "Solo lo usaremos para enviar el código. Nunca compartimos tu correo."
    )
    static let contactPlaceholderPhone = CivicaText(
        "Phone number",
        es: "Número de teléfono"
    )
    static let contactPlaceholderEmail = CivicaText(
        "you@example.com",
        es: "tu@ejemplo.com"
    )

    // MARK: - Step 3: code entry

    static let codeTitle = CivicaText(
        "Enter the 6-digit code",
        es: "Ingresa el código de 6 dígitos"
    )
    /// "We texted 555-1234." / "We emailed you@example.com." Caller
    /// passes the masked contact in for display.
    static func codeHelper(contact: String, isPhone: Bool, language: CivicaLanguage) -> String {
        switch (language, isPhone) {
        case (.english, true):   return "We texted \(contact) a code. It should arrive in a minute."
        case (.english, false):  return "We emailed \(contact). The code should arrive in a minute."
        case (.spanish, true):   return "Enviamos un código por mensaje a \(contact). Debería llegar en un minuto."
        case (.spanish, false):  return "Enviamos un código por correo a \(contact). Debería llegar en un minuto."
        }
    }
    static let codePlaceholder = CivicaText("000000", es: "000000")
    static let codeResend = CivicaText(
        "Send the code again",
        es: "Enviar el código de nuevo"
    )

    // MARK: - Network / error states

    static let sending = CivicaText("Sending…", es: "Enviando…")
    static let redeeming = CivicaText(
        "Finding your application…",
        es: "Buscando tu solicitud…"
    )
    static let sendErrorGeneric = CivicaText(
        "We couldn't send the code right now. Try again in a moment.",
        es: "No pudimos enviar el código en este momento. Inténtalo de nuevo en un momento."
    )
    static let redeemErrorBadCode = CivicaText(
        "That code doesn't match. Double-check the digits or ask for a new one.",
        es: "Ese código no coincide. Verifica los dígitos o pide uno nuevo."
    )
}
