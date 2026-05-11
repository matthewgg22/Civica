import Foundation

// All user-visible strings for the 5-screen onboarding flow (HANDOFF
// board 03). Every string has English + Spanish parity per HANDOFF
// decision #4 ("Spanish parity is a v1 gate, not a v2 feature").
//
// When adding a new string here:
//   1. Provide both `en` and `es` values
//   2. Match HANDOFF brand voice (board 16 — "six rules + word-list
//      + nine-moment table" — concrete, no government-speak)
//   3. Test that Spanish rendering survives at 130% length (per
//      HANDOFF QA gate)

enum OnboardingStrings {

    // MARK: - Screen 1: Language picker

    static let languageScreenTitle = CivicaText(
        "Welcome to Civica",
        es: "Bienvenido a Civica"
    )
    static let languageScreenSubtitle = CivicaText(
        "Pick a language to continue.",
        es: "Elige un idioma para continuar."
    )

    // MARK: - Screen 2: Value prop

    static let valuePropTitle = CivicaText(
        "Apply for SNAP in 15 minutes, not 90.",
        es: "Solicita SNAP en 15 minutos, no en 90."
    )
    static let valuePropBody = CivicaText(
        "We're not the government. We help you fill out their form.",
        es: "No somos el gobierno. Te ayudamos a completar su formulario."
    )
    static let valuePropContinue = CivicaText("Continue", es: "Continuar")

    // MARK: - Screen 3: How it works

    static let howItWorksTitle = CivicaText(
        "Here's how it works.",
        es: "Así es como funciona."
    )
    static let howItWorksStep1Heading = CivicaText(
        "Answer a few questions",
        es: "Responde algunas preguntas"
    )
    static let howItWorksStep1Body = CivicaText(
        "About your household, your income, and your housing. We use what you share to estimate your benefit.",
        es: "Sobre tu hogar, tus ingresos y tu vivienda. Usamos esa información para estimar tu beneficio."
    )
    static let howItWorksStep2Heading = CivicaText(
        "Take photos of your paystub and ID",
        es: "Toma fotos de tu recibo de pago y tu identificación"
    )
    static let howItWorksStep2Body = CivicaText(
        "We read them on your phone so you don't have to type the numbers. You confirm everything before it's used.",
        es: "Las leemos en tu teléfono para que no tengas que escribir los números. Confirmas todo antes de usarlo."
    )
    static let howItWorksStep3Heading = CivicaText(
        "Submit on your state's official site",
        es: "Envía en el sitio oficial de tu estado"
    )
    static let howItWorksStep3Body = CivicaText(
        "We give you a packet to bring to DTA Connect. Your state agency makes the final decision.",
        es: "Te damos un paquete para llevar a DTA Connect. Tu agencia estatal toma la decisión final."
    )
    static let howItWorksContinue = CivicaText(
        "Got it",
        es: "Entendido"
    )

    // MARK: - Screen 4: Consent

    static let consentTitle = CivicaText(
        "Before we start.",
        es: "Antes de empezar."
    )
    static let consentBullet1 = CivicaText(
        "Your answers stay encrypted on this device and on our servers.",
        es: "Tus respuestas se guardan cifradas en este dispositivo y en nuestros servidores."
    )
    static let consentBullet2 = CivicaText(
        "We never sell your data.",
        es: "Nunca vendemos tus datos."
    )
    static let consentBullet3 = CivicaText(
        "You can delete everything any time.",
        es: "Puedes borrar todo en cualquier momento."
    )
    static let consentBullet4 = CivicaText(
        "We are not affiliated with USDA or any state agency.",
        es: "No estamos afiliados con el USDA ni con ninguna agencia estatal."
    )
    static let consentAgree = CivicaText(
        "I understand. Continue.",
        es: "Entiendo. Continuar."
    )

    // MARK: - Screen 5: Phone capture

    static let phoneTitle = CivicaText(
        "Save your progress.",
        es: "Guarda tu progreso."
    )
    static let phoneBody = CivicaText(
        "If you have to step away, we'll text you a link to pick up where you left off. We only use this number to send you the link.",
        es: "Si tienes que detenerte, te enviaremos un mensaje con un enlace para continuar donde lo dejaste. Solo usamos este número para enviarte el enlace."
    )
    static let phoneFieldPlaceholder = CivicaText(
        "(555) 555-5555",
        es: "(555) 555-5555"
    )
    static let phoneSubmit = CivicaText(
        "Send me the link",
        es: "Enviarme el enlace"
    )
    static let phoneSkip = CivicaText(
        "I'll skip this for now",
        es: "Lo omitiré por ahora"
    )
    static let phoneInvalid = CivicaText(
        "Enter a 10-digit U.S. phone number.",
        es: "Ingresa un número de teléfono de EE. UU. de 10 dígitos."
    )

    // MARK: - Shared chrome

    static let stepIndicator = CivicaText(
        "Step %d of 5",
        es: "Paso %d de 5"
    )

    static func stepIndicatorString(currentStep: Int, language: CivicaLanguage) -> String {
        let template = stepIndicator.value(in: language)
        return template.replacingOccurrences(of: "%d", with: "\(currentStep)")
    }
}
