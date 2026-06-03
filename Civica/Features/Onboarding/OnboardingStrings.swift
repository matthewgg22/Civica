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
        es: "Bienvenido a Civica",
        zh: "欢迎使用 Civica"
    )
    static let languageScreenSubtitle = CivicaText(
        "Pick a language to continue.",
        es: "Elige un idioma para continuar.",
        zh: "选择一种语言以继续。"
    )

    // MARK: - Screen 2: Value prop

    static let valuePropTitle = CivicaText(
        "Apply for SNAP in 15 minutes, not 90.",
        es: "Solicita SNAP en 15 minutos, no en 90.",
        zh: "申请 SNAP 只需 15 分钟,不再需要 90 分钟。"
    )
    static let valuePropBody = CivicaText(
        "We're not the government. We help you fill out their form.",
        es: "No somos el gobierno. Te ayudamos a completar su formulario.",
        zh: "我们不是政府。我们帮你填写政府的表格。"
    )
    static let valuePropContinue = CivicaText("Continue", es: "Continuar", zh: "继续")

    // MARK: - Screen 3: How it works

    static let howItWorksTitle = CivicaText(
        "Here's how it works.",
        es: "Así es como funciona.",
        zh: "它是这样运作的。"
    )
    static let howItWorksStep1Heading = CivicaText(
        "Answer a few questions",
        es: "Responde algunas preguntas",
        zh: "回答几个问题"
    )
    static let howItWorksStep1Body = CivicaText(
        "About your household, your income, and your housing. We use what you share to estimate your benefit.",
        es: "Sobre tu hogar, tus ingresos y tu vivienda. Usamos esa información para estimar tu beneficio.",
        zh: "关于你的家庭、收入和住房。我们会用你分享的信息来估算你的福利金额。"
    )
    static let howItWorksStep2Heading = CivicaText(
        "Take photos of your paystub and ID",
        es: "Toma fotos de tu recibo de pago y tu identificación",
        zh: "拍下你的工资单和身份证件"
    )
    static let howItWorksStep2Body = CivicaText(
        "We read them on your phone so you don't have to type the numbers. You confirm everything before it's used.",
        es: "Las leemos en tu teléfono para que no tengas que escribir los números. Confirmas todo antes de usarlo.",
        zh: "我们在你的手机上识别内容,这样你就不用自己输入数字。在使用之前,所有信息都由你确认。"
    )
    static let howItWorksStep3Heading = CivicaText(
        "Submit on your state's official site",
        es: "Envía en el sitio oficial de tu estado",
        zh: "在你所在州的官方网站上提交"
    )
    static let howItWorksStep3Body = CivicaText(
        "We give you a packet to bring to DTA Connect. Your state agency makes the final decision.",
        es: "Te damos un paquete para llevar a DTA Connect. Tu agencia estatal toma la decisión final.",
        zh: "我们会为你准备一份资料包,供你带到 DTA Connect 提交。最终的决定由你所在州的机构作出。"
    )
    static let howItWorksContinue = CivicaText(
        "Got it",
        es: "Entendido",
        zh: "明白了"
    )

    // MARK: - Screen 4: Consent

    static let consentTitle = CivicaText(
        "Before we start.",
        es: "Antes de empezar.",
        zh: "在开始之前。"
    )
    static let consentBullet1 = CivicaText(
        "Your answers stay encrypted on this device and on our servers.",
        es: "Tus respuestas se guardan cifradas en este dispositivo y en nuestros servidores.",
        zh: "你的回答会以加密方式保存在这台设备和我们的服务器上。"
    )
    static let consentBullet2 = CivicaText(
        "We never sell your data.",
        es: "Nunca vendemos tus datos.",
        zh: "我们绝不出售你的数据。"
    )
    static let consentBullet3 = CivicaText(
        "You can delete everything any time.",
        es: "Puedes borrar todo en cualquier momento.",
        zh: "你随时可以删除所有内容。"
    )
    static let consentBullet4 = CivicaText(
        "We are not affiliated with USDA or any state agency.",
        es: "No estamos afiliados con el USDA ni con ninguna agencia estatal.",
        zh: "我们与美国农业部(USDA)及任何州级机构均无隶属关系。"
    )
    static let consentAgree = CivicaText(
        "I understand. Continue.",
        es: "Entiendo. Continuar.",
        zh: "我已了解。继续。"
    )

    // MARK: - Screen 5: Phone capture

    static let phoneTitle = CivicaText(
        "Save your progress.",
        es: "Guarda tu progreso.",
        zh: "保存你的进度。"
    )
    static let phoneBody = CivicaText(
        "If you have to step away, we'll text you a link to pick up where you left off. We only use this number to send you the link.",
        es: "Si tienes que detenerte, te enviaremos un mensaje con un enlace para continuar donde lo dejaste. Solo usamos este número para enviarte el enlace.",
        zh: "如果你需要中途离开,我们会发短信给你一个链接,方便你回来时从上次的位置继续。这个号码我们只用来给你发送链接。"
    )
    static let phoneFieldPlaceholder = CivicaText(
        "(555) 555-5555",
        es: "(555) 555-5555",
        zh: "(555) 555-5555"
    )
    static let phoneSubmit = CivicaText(
        "Send me the link",
        es: "Enviarme el enlace",
        zh: "把链接发给我"
    )
    static let phoneSkip = CivicaText(
        "I'll skip this for now",
        es: "Lo omitiré por ahora",
        zh: "暂时跳过"
    )
    static let phoneInvalid = CivicaText(
        "Enter a 10-digit U.S. phone number.",
        es: "Ingresa un número de teléfono de EE. UU. de 10 dígitos.",
        zh: "请输入 10 位美国电话号码。"
    )

    // MARK: - Shared chrome

    static let stepIndicator = CivicaText(
        "Step %d of 5",
        es: "Paso %d de 5",
        zh: "第 %d 步,共 5 步"
    )

    static func stepIndicatorString(currentStep: Int, language: CivicaLanguage) -> String {
        let template = stepIndicator.value(in: language)
        return template.replacingOccurrences(of: "%d", with: "\(currentStep)")
    }
}
