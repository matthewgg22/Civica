import Foundation

// The canonical 12 questions a Massachusetts DTA interviewer
// actually asks during a SNAP eligibility interview, paired with
// suggested phrasings the user can borrow. Sourced from the
// MA DTA Operations Memo + canvas board #12-new.
//
// Brand-voice rule from the canvas: "Coach before, never lecture —
// 'you can say:' beats 'you should say:'." Phrasings are
// suggestions, not scripts.
//
// "You can say" replacements use draft data when available — but at
// v1 the user's name + exact dollars aren't always captured, so
// the suggestions stay illustrative ("$1,820 before taxes" not
// "$$$"). When the orchestrator collects more identifying detail,
// these get personalized.

enum SNAPInterviewQuestions {

    struct Question {
        let questionText: String
        let suggestion: String
    }

    static func list(language: CivicaLanguage) -> [Question] {
        switch language {
        case .english:
            return englishQuestions
        case .mandarin:
            return mandarinQuestions
        case .spanish:
            return spanishQuestions
        case .vietnamese:
            return vietnameseQuestions
        case .tagalog:
            return tagalogQuestions
        }
    }

    private static let englishQuestions: [Question] = [
        .init(
            questionText: "\"Can you confirm your full name and date of birth?\"",
            suggestion: "Your legal name and birthday as written on your ID."
        ),
        .init(
            questionText: "\"How many people live in your household and buy / prepare food together?\"",
            suggestion: "\"Just me\" / \"Me and my partner\" / \"Three of us — me, my partner, and our daughter\""
        ),
        .init(
            questionText: "\"What's your current mailing address?\"",
            suggestion: "Street, apartment number, city, zip — same as your ID."
        ),
        .init(
            questionText: "\"How much do you make in a typical month, before taxes?\"",
            suggestion: "\"About $1,820 before taxes.\" Use a monthly number, not weekly."
        ),
        .init(
            questionText: "\"Where do you work, and how often do you get paid?\"",
            suggestion: "Employer name, weekly / biweekly / monthly."
        ),
        .init(
            questionText: "\"Does anyone in the household get unearned income — Social Security, unemployment, child support, pension, VA?\"",
            suggestion: "\"Yes, my mom gets $1,100/mo from Social Security\" or \"No.\" Honest yes/no."
        ),
        .init(
            questionText: "\"What's your monthly rent or mortgage?\"",
            suggestion: "\"$1,650 plus gas and electric.\" Include utilities you pay yourself."
        ),
        .init(
            questionText: "\"Anyone in the household 60 or older, or living with a disability?\"",
            suggestion: "Honest yes/no. \"No\" is a complete answer."
        ),
        .init(
            questionText: "\"Do you pay for childcare so you can work?\"",
            suggestion: "\"Yes, $300/mo for after-school care\" or \"No.\" This is a real deduction — say yes if it applies."
        ),
        .init(
            questionText: "\"Any out-of-pocket medical costs over $35/month?\"",
            suggestion: "Only applies if someone is 60+ or disabled. \"Yes, about $60/mo in prescriptions\" or \"No.\""
        ),
        .init(
            questionText: "\"Bank account balance or other resources?\"",
            suggestion: "A general estimate is fine. Massachusetts has no asset test for most households — they're asking for completeness."
        ),
        .init(
            questionText: "\"Anyone in your household a student in college?\"",
            suggestion: "Yes/no. If yes, they'll ask follow-ups about hours worked and dependents."
        ),
    ]

    private static let mandarinQuestions: [Question] = [
        .init(
            questionText: "「请确认你的全名和出生日期。」",
            suggestion: "你证件上写的法定姓名和生日。"
        ),
        .init(
            questionText: "「你家里有几个人,一起买菜或做饭?」",
            suggestion: "「只有我」/「我和我的伴侣」/「三个人 —— 我、我的伴侣和我们的女儿」"
        ),
        .init(
            questionText: "「你目前的邮寄地址是什么?」",
            suggestion: "街道、公寓号、城市、邮编 —— 和你证件上一样。"
        ),
        .init(
            questionText: "「你一个月一般赚多少钱,税前?」",
            suggestion: "「税前大约 1,820 美元。」用每月数字,不要用每周。"
        ),
        .init(
            questionText: "「你在哪里工作?多久领一次工资?」",
            suggestion: "雇主名字,每周 / 每两周 / 每月。"
        ),
        .init(
            questionText: "「家里有人拿非劳动收入吗 —— 社安、失业金、子女抚养费、退休金、退伍军人福利?」",
            suggestion: "「有,我妈妈每月从社安拿 1,100 美元」或「没有。」诚实回答有或没有。"
        ),
        .init(
            questionText: "「你每月的房租或房贷是多少?」",
            suggestion: "「1,650 美元,另外还要付煤气和电费。」算上你自己付的水电煤。"
        ),
        .init(
            questionText: "「家里有人 60 岁或以上,或者有残疾吗?」",
            suggestion: "诚实回答有或没有。「没有」就是一个完整的回答。"
        ),
        .init(
            questionText: "「你为了工作付儿童照顾费吗?」",
            suggestion: "「有,每月 300 美元课后托管」或「没有。」这是真实的扣除项 —— 如果适用就说有。"
        ),
        .init(
            questionText: "「每月有超过 35 美元的自付医疗费吗?」",
            suggestion: "只有家里有人 60 岁或以上、或有残疾才适用。「有,每月大约 60 美元的处方药」或「没有。」"
        ),
        .init(
            questionText: "「银行账户余额或其他资源?」",
            suggestion: "大概估一下就行。Massachusetts 对大多数家庭没有资产审查 —— 他们只是为了把表填全。"
        ),
        .init(
            questionText: "「家里有人在上大学吗?」",
            suggestion: "有或没有。如果有,他们会追问工作小时数和有没有受抚养人。"
        ),
    ]

    private static let spanishQuestions: [Question] = [
        .init(
            questionText: "\"¿Puedes confirmar tu nombre completo y fecha de nacimiento?\"",
            suggestion: "Tu nombre legal y fecha de nacimiento como aparecen en tu identificación."
        ),
        .init(
            questionText: "\"¿Cuántas personas viven en tu hogar y compran o preparan comida juntas?\"",
            suggestion: "\"Solo yo\" / \"Mi pareja y yo\" / \"Tres — yo, mi pareja y nuestra hija\""
        ),
        .init(
            questionText: "\"¿Cuál es tu dirección postal actual?\"",
            suggestion: "Calle, número de apartamento, ciudad, código postal — igual que tu identificación."
        ),
        .init(
            questionText: "\"¿Cuánto ganas en un mes típico, antes de impuestos?\"",
            suggestion: "\"Cerca de $1,820 antes de impuestos.\" Usa un número mensual, no semanal."
        ),
        .init(
            questionText: "\"¿Dónde trabajas y con qué frecuencia te pagan?\"",
            suggestion: "Nombre del empleador, semanal / quincenal / mensual."
        ),
        .init(
            questionText: "\"¿Alguien en el hogar recibe ingresos no laborales — Seguro Social, desempleo, manutención de hijos, pensión, VA?\"",
            suggestion: "\"Sí, mi mamá recibe $1,100/mes del Seguro Social\" o \"No.\" Sí o no honesto."
        ),
        .init(
            questionText: "\"¿Cuál es tu renta o hipoteca mensual?\"",
            suggestion: "\"$1,650 más gas y electricidad.\" Incluye los servicios que pagas tú."
        ),
        .init(
            questionText: "\"¿Alguien en el hogar tiene 60 años o más, o vive con una discapacidad?\"",
            suggestion: "Sí o no honesto. \"No\" es una respuesta completa."
        ),
        .init(
            questionText: "\"¿Pagas por cuidado infantil para poder trabajar?\"",
            suggestion: "\"Sí, $300/mes por cuidado extraescolar\" o \"No.\" Es una deducción real — di que sí si aplica."
        ),
        .init(
            questionText: "\"¿Algún gasto médico de tu bolsillo mayor a $35/mes?\"",
            suggestion: "Solo aplica si alguien tiene 60 años o más o vive con una discapacidad. \"Sí, cerca de $60/mes en medicamentos\" o \"No.\""
        ),
        .init(
            questionText: "\"¿Saldo de cuenta bancaria u otros recursos?\"",
            suggestion: "Una estimación general está bien. Massachusetts no tiene prueba de bienes para la mayoría de los hogares — preguntan por completitud."
        ),
        .init(
            questionText: "\"¿Alguien en tu hogar estudia en la universidad?\"",
            suggestion: "Sí o no. Si sí, harán preguntas adicionales sobre horas trabajadas y dependientes."
        ),
    ]

    private static let vietnameseQuestions: [Question] = [
        .init(
            questionText: "「Bạn có thể xác nhận họ tên đầy đủ và ngày sinh của mình không?」",
            suggestion: "Tên hợp pháp và ngày sinh của bạn đúng như ghi trên giấy tờ tùy thân."
        ),
        .init(
            questionText: "「Có bao nhiêu người sống trong gia đình bạn và cùng nhau mua hoặc nấu ăn?」",
            suggestion: "「Chỉ mình tôi」/「Tôi và bạn đời của tôi」/「Ba người — tôi, bạn đời của tôi và con gái chúng tôi」"
        ),
        .init(
            questionText: "「Địa chỉ nhận thư hiện tại của bạn là gì?」",
            suggestion: "Tên đường, số căn hộ, thành phố, mã ZIP — giống như trên giấy tờ tùy thân của bạn."
        ),
        .init(
            questionText: "「Một tháng bình thường bạn kiếm được bao nhiêu, trước thuế?」",
            suggestion: "「Khoảng $1,820 trước thuế.」 Dùng con số theo tháng, không phải theo tuần."
        ),
        .init(
            questionText: "「Bạn làm việc ở đâu, và bao lâu được trả lương một lần?」",
            suggestion: "Tên chủ lao động, hàng tuần / hai tuần một lần / hàng tháng."
        ),
        .init(
            questionText: "「Có ai trong gia đình nhận thu nhập không do lao động không — An Sinh Xã Hội, trợ cấp thất nghiệp, tiền cấp dưỡng con, lương hưu, VA?」",
            suggestion: "「Có, mẹ tôi nhận $1,100/tháng từ An Sinh Xã Hội」 hoặc 「Không.」 Trả lời có hoặc không một cách trung thực."
        ),
        .init(
            questionText: "「Tiền thuê nhà hoặc tiền trả góp nhà hàng tháng của bạn là bao nhiêu?」",
            suggestion: "「$1,650 cộng thêm gas và điện.」 Tính cả các tiện ích bạn tự trả."
        ),
        .init(
            questionText: "「Có ai trong gia đình từ 60 tuổi trở lên, hoặc đang sống chung với khuyết tật không?」",
            suggestion: "Trả lời có hoặc không một cách trung thực. 「Không」 là một câu trả lời đầy đủ."
        ),
        .init(
            questionText: "「Bạn có trả tiền giữ trẻ để có thể đi làm không?」",
            suggestion: "「Có, $300/tháng cho dịch vụ trông trẻ sau giờ học」 hoặc 「Không.」 Đây là một khoản khấu trừ thật sự — hãy nói có nếu áp dụng cho bạn."
        ),
        .init(
            questionText: "「Có khoản chi phí y tế tự trả nào trên $35/tháng không?」",
            suggestion: "Chỉ áp dụng nếu có người từ 60 tuổi trở lên hoặc bị khuyết tật. 「Có, khoảng $60/tháng tiền thuốc theo toa」 hoặc 「Không.」"
        ),
        .init(
            questionText: "「Số dư tài khoản ngân hàng hoặc các tài sản khác?」",
            suggestion: "Ước lượng đại khái là được. Massachusetts không xét tài sản đối với hầu hết các gia đình — họ hỏi cho đầy đủ thôi."
        ),
        .init(
            questionText: "「Có ai trong gia đình bạn đang là sinh viên đại học không?」",
            suggestion: "Có hoặc không. Nếu có, họ sẽ hỏi thêm về số giờ làm việc và người phụ thuộc."
        ),
    ]

    private static let tagalogQuestions: [Question] = [
        .init(
            questionText: "「Pwede mo bang kumpirmahin ang buo mong pangalan at petsa ng kapanganakan?」",
            suggestion: "Ang legal mong pangalan at kaarawan gaya ng nakasulat sa iyong ID."
        ),
        .init(
            questionText: "「Ilan kayo sa bahay na sama-samang bumibili o nagluluto ng pagkain?」",
            suggestion: "「Ako lang」 / 「Ako at ang partner ko」 / 「Tatlo kami — ako, ang partner ko, at ang anak naming babae」"
        ),
        .init(
            questionText: "「Ano ang kasalukuyan mong mailing address?」",
            suggestion: "Kalye, numero ng apartment, lungsod, zip — pareho sa iyong ID."
        ),
        .init(
            questionText: "「Magkano ang kita mo sa karaniwang buwan, bago ang buwis?」",
            suggestion: "「Mga $1,820 bago ang buwis.」 Gumamit ng buwanang numero, hindi lingguhan."
        ),
        .init(
            questionText: "「Saan ka nagtatrabaho, at gaano ka kadalas suwelduhan?」",
            suggestion: "Pangalan ng employer, lingguhan / kada dalawang linggo / buwanan."
        ),
        .init(
            questionText: "「May kahit sino ba sa bahay na may kita na hindi galing sa trabaho — Social Security, unemployment, child support, pension, VA?」",
            suggestion: "「Oo, ang nanay ko ay tumatanggap ng $1,100/buwan mula sa Social Security」 o 「Wala.」 Tapat na oo o hindi."
        ),
        .init(
            questionText: "「Magkano ang buwanan mong upa o mortgage?」",
            suggestion: "「$1,650 plus gas at kuryente.」 Isama ang mga utility na ikaw mismo ang nagbabayad."
        ),
        .init(
            questionText: "「May kahit sino ba sa bahay na 60 anyos pataas, o may kapansanan?」",
            suggestion: "Tapat na oo o hindi. Ang 「Wala」 ay kumpletong sagot."
        ),
        .init(
            questionText: "「Nagbabayad ka ba ng childcare para makapagtrabaho?」",
            suggestion: "「Oo, $300/buwan para sa after-school care」 o 「Hindi.」 Tunay na deduction ito — sabihing oo kung totoo sa iyo."
        ),
        .init(
            questionText: "「May out-of-pocket na gastos sa medikal ba na higit sa $35/buwan?」",
            suggestion: "Para lang ito kung may 60+ o may kapansanan. 「Oo, mga $60/buwan sa gamot」 o 「Wala.」"
        ),
        .init(
            questionText: "「Balanse ng bank account o iba pang resources?」",
            suggestion: "Okay lang ang pangkalahatang tantya. Walang asset test ang Massachusetts para sa karamihan ng mga sambahayan — para lang makumpleto ang form."
        ),
        .init(
            questionText: "「May kahit sino ba sa bahay mo na estudyante sa kolehiyo?」",
            suggestion: "Oo o hindi. Kung oo, magtatanong sila ng follow-up tungkol sa oras ng trabaho at mga dependent."
        ),
    ]
}

// MARK: - Interview view copy

enum SNAPInterviewStrings {

    // MARK: Prep

    // Pre-call rehearsal cross-link to the AI Interview Coach. The live
    // coach is the day-of companion; rehearsal is practice beforehand.
    // Surfaced from prep phase only — once the user is on the call,
    // rehearsing is no longer the action they need.
    static let rehearseHeading = CivicaText(
        "Want a dry run?",
        es: "¿Quieres practicar antes?",
        zh: "想先练习一下吗?",
        vi: "Muốn tập dượt trước không?",
        tl: "Gusto mo bang mag-ensayo muna?"
    )
    static let rehearseBody = CivicaText(
        "Practice answering caseworker-style questions with a simulated interviewer before the real call.",
        es: "Practica responder a preguntas estilo trabajador social con un entrevistador simulado antes de la llamada real.",
        zh: "在真正打电话之前,和模拟面试官练习回答工作人员风格的问题。",
        vi: "Tập trả lời những câu hỏi kiểu nhân viên xã hội với một người phỏng vấn mô phỏng trước cuộc gọi thật.",
        tl: "Mag-praktis sumagot ng mga tanong na parang sa caseworker kasama ang isang simulated na interviewer bago ang tunay na tawag."
    )
    static let rehearseAction = CivicaText(
        "Start a practice session",
        es: "Iniciar sesión de práctica",
        zh: "开始练习",
        vi: "Bắt đầu buổi luyện tập",
        tl: "Magsimula ng practice session"
    )

    static let prepPrimary = CivicaText(
        "See what they'll ask",
        es: "Ver qué te preguntarán",
        zh: "看看他们会问什么",
        vi: "Xem họ sẽ hỏi gì",
        tl: "Tingnan kung ano ang itatanong nila"
    )

    // MARK: Questions

    static let questionsEyebrow = CivicaText(
        "What they'll ask",
        es: "Lo que te preguntarán",
        zh: "他们会问什么",
        vi: "Họ sẽ hỏi gì",
        tl: "Ang itatanong nila"
    )
    static let questionsTitle = CivicaText(
        "Twelve questions. You can read these during the call.",
        es: "Doce preguntas. Puedes leerlas durante la llamada.",
        zh: "12 个问题。打电话的时候你可以照着念。",
        vi: "Mười hai câu hỏi. Bạn có thể đọc những câu này trong lúc gọi.",
        tl: "Labindalawang tanong. Pwede mong basahin ang mga ito habang nasa tawag."
    )
    static let youCanSayLabel = CivicaText(
        "You can say:",
        es: "Puedes decir:",
        zh: "你可以这样说:",
        vi: "Bạn có thể nói:",
        tl: "Pwede mong sabihin:"
    )
    static let dontKnowHeading = CivicaText(
        "Don't know an answer?",
        es: "¿No sabes una respuesta?",
        zh: "不知道怎么答?",
        vi: "Không biết câu trả lời?",
        tl: "Hindi alam ang sagot?"
    )
    static let dontKnowBody = CivicaText(
        "\"I'm not sure\" is a real answer. The interviewer writes down \"self-attested\" and moves on. You don't have to know everything off the top of your head.",
        es: "\"No estoy seguro/a\" es una respuesta real. El entrevistador anota \"self-attested\" (auto-declarado) y continúa. No tienes que saberlo todo de memoria.",
        zh: "「我不太确定」也是一个真实的回答。面试官会记下「self-attested」(自我声明)然后继续问下一题。你不需要把所有事情都记在脑子里。",
        vi: "「Tôi không chắc」 là một câu trả lời thật sự. Người phỏng vấn ghi xuống 「self-attested」 (tự khai báo) rồi đi tiếp. Bạn không cần phải nhớ hết mọi thứ trong đầu.",
        tl: "Ang 「Hindi ako sigurado」 ay tunay na sagot. Isusulat ng interviewer ang 「self-attested」 (sariling pahayag) at magpapatuloy. Hindi mo kailangang malaman lahat sa isang iglap."
    )

    // MARK: Live (during call)

    static let liveEyebrow = CivicaText(
        "On the call",
        es: "En la llamada",
        zh: "通话中",
        vi: "Trong cuộc gọi",
        tl: "Nasa tawag"
    )
    static let nextUpLabel = CivicaText(
        "What's coming next",
        es: "Qué sigue",
        zh: "接下来是什么",
        vi: "Tiếp theo là gì",
        tl: "Ano ang susunod"
    )
    static let stuckHeading = CivicaText(
        "Stuck?",
        es: "¿Atascado?",
        zh: "卡住了?",
        vi: "Bị kẹt?",
        tl: "Naipit?"
    )
    static let stuckBody = CivicaText(
        "\"Can I have a moment to check?\" is completely normal. They'll wait. Take the breath.",
        es: "\"¿Me das un momento para verificar?\" es completamente normal. Te esperarán. Toma el respiro.",
        zh: "「我能先查一下吗?」这样问完全正常。他们会等。深呼吸一下。",
        vi: "「Cho tôi một chút để kiểm tra được không?」 là hoàn toàn bình thường. Họ sẽ đợi. Hít một hơi thật sâu.",
        tl: "Ang 「Pwede ba akong magpa-sandali para tingnan?」 ay normal lang talaga. Maghihintay sila. Huminga ka muna."
    )
    static let liveAdvance = CivicaText(
        "Done with this one",
        es: "Listo con esta",
        zh: "这题答完了",
        vi: "Xong câu này rồi",
        tl: "Tapos na ito"
    )
    static let liveFinished = CivicaText(
        "Interview finished",
        es: "Entrevista terminada",
        zh: "面试结束",
        vi: "Phỏng vấn xong",
        tl: "Tapos na ang interbiyu"
    )
    static let livePause = CivicaText(
        "End / pause",
        es: "Terminar / pausar",
        zh: "结束 / 暂停",
        vi: "Kết thúc / tạm dừng",
        tl: "Tapusin / i-pause"
    )

    static func questionOfLabel(current: Int, total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Question \(current) of \(total)"
        case .mandarin: return "第 \(current) 题,共 \(total) 题"
        case .spanish: return "Pregunta \(current) de \(total)"
        case .vietnamese: return "Câu hỏi \(current) trên \(total)"
        case .tagalog: return "Tanong \(current) sa \(total)"
        }
    }

    // MARK: Wrapup

    static let wrapupEyebrow = CivicaText(
        "After the call",
        es: "Después de la llamada",
        zh: "通话之后",
        vi: "Sau cuộc gọi",
        tl: "Pagkatapos ng tawag"
    )
    static let wrapupTitle = CivicaText(
        "How did that go?",
        es: "¿Cómo te fue?",
        zh: "刚才怎么样?",
        vi: "Vừa rồi thế nào?",
        tl: "Kumusta ang naganap?"
    )
    static let wrapupNoteHeading = CivicaText(
        "What happens next",
        es: "Qué pasa ahora",
        zh: "接下来会发生什么",
        vi: "Tiếp theo sẽ ra sao",
        tl: "Ano ang mangyayari sunod"
    )
    static let wrapupNoteBody = CivicaText(
        "Decision usually within 7 days. We'll text the moment we hear from DTA.",
        es: "La decisión usualmente llega en 7 días. Te enviaremos un mensaje en cuanto sepamos del DTA.",
        zh: "通常 7 天内会有决定。一收到 DTA 的消息,我们就给你发短信。",
        vi: "Quyết định thường có trong vòng 7 ngày. Chúng tôi sẽ nhắn tin ngay khi nghe tin từ DTA.",
        tl: "Karaniwang may desisyon sa loob ng 7 araw. Tetext ka namin pagkarinig namin mula sa DTA."
    )

    struct WrapupOptionCopy {
        let title: String
        let body: String
    }

    static func wrapupOption(_ option: SNAPInterviewCoachView.WrapupOption, language: CivicaLanguage) -> WrapupOptionCopy {
        switch (option, language) {
        case (.smooth, .english):
            return .init(
                title: "Smooth — got through everything",
                body: "We mark you done and watch for the decision."
            )
        case (.smooth, .tagalog):
            return .init(
                title: "Maayos — natapos lahat",
                body: "Mamarkahan ka naming tapos na at babantayan ang desisyon."
            )
        case (.smooth, .mandarin):
            return .init(
                title: "顺利 —— 全部答完了",
                body: "我们把你标记为完成,然后等决定。"
            )
        case (.smooth, .spanish):
            return .init(
                title: "Sin problemas — pasé por todo",
                body: "Te marcamos como completado y esperamos la decisión."
            )
        case (.smooth, .vietnamese):
            return .init(
                title: "Suôn sẻ — đã trả lời hết mọi câu",
                body: "Chúng tôi đánh dấu bạn đã xong và theo dõi quyết định."
            )
        case (.stuck, .english):
            return .init(
                title: "They asked something I couldn't answer",
                body: "We'll coach you on what to send next — and what \"self-attested\" really means."
            )
        case (.stuck, .tagalog):
            return .init(
                title: "May tinanong silang hindi ko nasagot",
                body: "Tuturuan ka namin kung ano ang ipapadala sunod — at kung ano talaga ang ibig sabihin ng 「self-attested」."
            )
        case (.stuck, .mandarin):
            return .init(
                title: "他们问了一个我答不上来的问题",
                body: "我们会帮你想接下来要寄什么 —— 以及「self-attested」到底是什么意思。"
            )
        case (.stuck, .spanish):
            return .init(
                title: "Me preguntaron algo que no pude responder",
                body: "Te ayudaremos con qué enviar a continuación — y qué significa \"self-attested\"."
            )
        case (.stuck, .vietnamese):
            return .init(
                title: "Họ hỏi điều mà tôi không trả lời được",
                body: "Chúng tôi sẽ hướng dẫn bạn gửi gì tiếp theo — và 「self-attested」 thật sự nghĩa là gì."
            )
        case (.rude, .english):
            return .init(
                title: "It felt off / they were rude",
                body: "A real person reads this. We can flag the case if you'd like us to."
            )
        case (.rude, .tagalog):
            return .init(
                title: "Parang may mali / bastos sila",
                body: "May totoong tao na magbabasa nito. Pwede naming i-flag ang kaso kung gusto mo."
            )
        case (.rude, .mandarin):
            return .init(
                title: "感觉不对劲 / 他们态度很差",
                body: "有真人会看这条反馈。如果你愿意,我们可以把这个案子标记出来。"
            )
        case (.rude, .spanish):
            return .init(
                title: "Se sintió raro / fueron groseros",
                body: "Una persona real lee esto. Podemos marcar el caso si quieres."
            )
        case (.rude, .vietnamese):
            return .init(
                title: "Cảm thấy không ổn / họ thô lỗ",
                body: "Một người thật sẽ đọc phản hồi này. Chúng tôi có thể đánh dấu hồ sơ nếu bạn muốn."
            )
        case (.noCall, .english):
            return .init(
                title: "They never called",
                body: "Missed-interview is the #2 reason applications get denied. We'll help you reach the supervisor today."
            )
        case (.noCall, .tagalog):
            return .init(
                title: "Hindi sila tumawag",
                body: "Ang naliban na interbiyu ang pangalawang pinakamadalas na dahilan ng pagtanggi sa aplikasyon. Tutulungan ka naming maabot ang supervisor ngayon."
            )
        case (.noCall, .mandarin):
            return .init(
                title: "他们一直没打来",
                body: "错过面试是申请被拒的第二大原因。我们今天就帮你联系主管。"
            )
        case (.noCall, .spanish):
            return .init(
                title: "Nunca llamaron",
                body: "Entrevista perdida es la razón #2 por la que se deniegan solicitudes. Te ayudaremos a contactar al supervisor hoy."
            )
        case (.noCall, .vietnamese):
            return .init(
                title: "Họ chẳng bao giờ gọi",
                body: "Lỡ buổi phỏng vấn là lý do số 2 khiến đơn bị từ chối. Hôm nay chúng tôi sẽ giúp bạn liên lạc với người giám sát."
            )
        }
    }

    static let wrapupPrimary = CivicaText(
        "Send this to Civica",
        es: "Enviar esto a Civica",
        zh: "把这条发给 Civica",
        vi: "Gửi cái này cho Civica",
        tl: "Ipadala ito sa Civica"
    )

    // MARK: Misc

    static let imOnTheCall = CivicaText(
        "I'm on the call now",
        es: "Estoy en la llamada ahora",
        zh: "我现在在通话中",
        vi: "Tôi đang trong cuộc gọi",
        tl: "Nasa tawag na ako ngayon"
    )
    static let backToPrep = CivicaText(
        "Back to prep",
        es: "Volver a la preparación",
        zh: "返回准备",
        vi: "Quay lại chuẩn bị",
        tl: "Bumalik sa paghahanda"
    )
}