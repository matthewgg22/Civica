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
        vi: "Chào mừng đến với Civica",
        tl: "Maligayang pagdating sa Civica"
    )
    static let languageScreenSubtitle = CivicaText(
        "Pick a language to continue.",
        es: "Elige un idioma para continuar.",
        vi: "Chọn ngôn ngữ để tiếp tục.",
        tl: "Pumili ng wika para magpatuloy."
    )

    // MARK: - Screen 2: Value prop

    static let valuePropTitle = CivicaText(
        "Apply for SNAP in 15 minutes, not 90.",
        es: "Solicita SNAP en 15 minutos, no en 90.",
        vi: "Nộp đơn SNAP trong 15 phút, không phải 90.",
        tl: "Mag-apply sa SNAP sa loob ng 15 minuto, hindi 90."
    )
    static let valuePropBody = CivicaText(
        "We're not the government. We help you fill out their form.",
        es: "No somos el gobierno. Te ayudamos a completar su formulario.",
        vi: "Chúng tôi không phải là chính phủ. Chúng tôi giúp bạn điền vào mẫu đơn của họ.",
        tl: "Hindi kami ang gobyerno. Tinutulungan ka naming punan ang kanilang form."
    )
    static let valuePropContinue = CivicaText("Continue", es: "Continuar", vi: "Tiếp tục", tl: "Magpatuloy")

    // MARK: - Screen 3: How it works

    static let howItWorksTitle = CivicaText(
        "Here's how it works.",
        es: "Así es como funciona.",
        vi: "Cách hoạt động như sau.",
        tl: "Ganito ito gumagana."
    )
    static let howItWorksStep1Heading = CivicaText(
        "Answer a few questions",
        es: "Responde algunas preguntas",
        vi: "Trả lời một vài câu hỏi",
        tl: "Sagutin ang ilang tanong"
    )
    static let howItWorksStep1Body = CivicaText(
        "About your household, your income, and your housing. We use what you share to estimate your benefit.",
        es: "Sobre tu hogar, tus ingresos y tu vivienda. Usamos esa información para estimar tu beneficio.",
        vi: "Về hộ gia đình, thu nhập và nhà ở của bạn. Chúng tôi dùng những gì bạn chia sẻ để ước tính quyền lợi của bạn.",
        tl: "Tungkol sa iyong sambahayan, kita, at tirahan. Ginagamit namin ang ibinahagi mo para tantyahin ang iyong benepisyo."
    )
    static let howItWorksStep2Heading = CivicaText(
        "Take photos of your paystub and ID",
        es: "Toma fotos de tu recibo de pago y tu identificación",
        vi: "Chụp ảnh phiếu lương và giấy tờ tùy thân của bạn",
        tl: "Kumuha ng litrato ng iyong paystub at ID"
    )
    static let howItWorksStep2Body = CivicaText(
        "We read them on your phone so you don't have to type the numbers. You confirm everything before it's used.",
        es: "Las leemos en tu teléfono para que no tengas que escribir los números. Confirmas todo antes de usarlo.",
        vi: "Chúng tôi đọc chúng trên điện thoại của bạn để bạn không phải gõ các con số. Bạn xác nhận mọi thứ trước khi được dùng.",
        tl: "Binabasa namin ang mga ito sa iyong telepono para hindi mo na kailangang i-type ang mga numero. Iko-confirm mo ang lahat bago ito gamitin."
    )
    static let howItWorksStep3Heading = CivicaText(
        "Submit on your state's official site",
        es: "Envía en el sitio oficial de tu estado",
        vi: "Nộp trên trang chính thức của tiểu bang bạn",
        tl: "I-submit sa opisyal na site ng iyong estado"
    )
    static let howItWorksStep3Body = CivicaText(
        "We give you a packet to bring to DTA Connect. Your state agency makes the final decision.",
        es: "Te damos un paquete para llevar a DTA Connect. Tu agencia estatal toma la decisión final.",
        vi: "Chúng tôi đưa cho bạn một bộ hồ sơ để mang đến DTA Connect. Cơ quan tiểu bang của bạn đưa ra quyết định cuối cùng.",
        tl: "Bibigyan ka namin ng packet na dadalhin sa DTA Connect. Ang ahensya ng iyong estado ang gagawa ng huling desisyon."
    )
    static let howItWorksContinue = CivicaText(
        "Got it",
        es: "Entendido",
        vi: "Đã hiểu",
        tl: "Nakuha ko"
    )

    // MARK: - Screen 4: Consent

    static let consentTitle = CivicaText(
        "Before we start.",
        es: "Antes de empezar.",
        vi: "Trước khi bắt đầu.",
        tl: "Bago tayo magsimula."
    )
    static let consentBullet1 = CivicaText(
        "Your answers stay encrypted on this device and on our servers.",
        es: "Tus respuestas se guardan cifradas en este dispositivo y en nuestros servidores.",
        vi: "Câu trả lời của bạn được mã hóa trên thiết bị này và trên máy chủ của chúng tôi.",
        tl: "Ang iyong mga sagot ay nananatiling naka-encrypt sa device na ito at sa aming mga server."
    )
    static let consentBullet2 = CivicaText(
        "We never sell your data.",
        es: "Nunca vendemos tus datos.",
        vi: "Chúng tôi không bao giờ bán dữ liệu của bạn.",
        tl: "Hindi namin kailanman ibinebenta ang iyong data."
    )
    static let consentBullet3 = CivicaText(
        "You can delete everything any time.",
        es: "Puedes borrar todo en cualquier momento.",
        vi: "Bạn có thể xóa mọi thứ bất cứ lúc nào.",
        tl: "Puwede mong burahin ang lahat anumang oras."
    )
    static let consentBullet4 = CivicaText(
        "We are not affiliated with USDA or any state agency.",
        es: "No estamos afiliados con el USDA ni con ninguna agencia estatal.",
        vi: "Chúng tôi không liên kết với USDA hay bất kỳ cơ quan tiểu bang nào.",
        tl: "Hindi kami kaugnay ng USDA o anumang ahensya ng estado."
    )
    static let consentAgree = CivicaText(
        "I understand. Continue.",
        es: "Entiendo. Continuar.",
        vi: "Tôi hiểu. Tiếp tục.",
        tl: "Naiintindihan ko. Magpatuloy."
    )

    // MARK: - Screen 5: Phone capture

    static let phoneTitle = CivicaText(
        "Save your progress.",
        es: "Guarda tu progreso.",
        vi: "Lưu tiến trình của bạn.",
        tl: "I-save ang iyong progreso."
    )
    static let phoneBody = CivicaText(
        "If you have to step away, we'll text you a link to pick up where you left off. We only use this number to send you the link.",
        es: "Si tienes que detenerte, te enviaremos un mensaje con un enlace para continuar donde lo dejaste. Solo usamos este número para enviarte el enlace.",
        vi: "Nếu bạn phải tạm dừng, chúng tôi sẽ nhắn tin cho bạn một liên kết để tiếp tục từ chỗ bạn đã dừng. Chúng tôi chỉ dùng số này để gửi liên kết cho bạn.",
        tl: "Kung kailangan mong tumigil sandali, magte-text kami sa iyo ng link para magpatuloy mula sa huling tinigilan mo. Ginagamit lang namin ang numerong ito para ipadala sa iyo ang link."
    )
    static let phoneFieldPlaceholder = CivicaText(
        "(555) 555-5555",
        es: "(555) 555-5555"
    )
    static let phoneSubmit = CivicaText(
        "Send me the link",
        es: "Enviarme el enlace",
        vi: "Gửi liên kết cho tôi",
        tl: "Ipadala sa akin ang link"
    )
    static let phoneSkip = CivicaText(
        "I'll skip this for now",
        es: "Lo omitiré por ahora",
        vi: "Tôi sẽ bỏ qua bây giờ",
        tl: "Lalaktawan ko muna ito"
    )
    static let phoneInvalid = CivicaText(
        "Enter a 10-digit U.S. phone number.",
        es: "Ingresa un número de teléfono de EE. UU. de 10 dígitos.",
        vi: "Nhập số điện thoại Hoa Kỳ gồm 10 chữ số.",
        tl: "Maglagay ng 10-digit na numero ng telepono sa U.S."
    )

    // MARK: - Shared chrome

    static let stepIndicator = CivicaText(
        "Step %d of 5",
        es: "Paso %d de 5",
        vi: "Bước %d trên 5",
        tl: "Hakbang %d sa 5"
    )

    static func stepIndicatorString(currentStep: Int, language: CivicaLanguage) -> String {
        let template = stepIndicator.value(in: language)
        return template.replacingOccurrences(of: "%d", with: "\(currentStep)")
    }
}
