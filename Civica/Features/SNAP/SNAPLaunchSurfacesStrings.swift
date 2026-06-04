import Foundation

// Spanish-parity strings for the launch-critical SNAP surfaces that
// previously used raw Text("...") literals. Each module below maps to a
// single view file; keep entries in the same order they appear on
// screen so reviewers can scan top-to-bottom.

enum SNAPConfirmationStrings {
    static let title = CivicaText(
        "Your SNAP draft is ready",
        es: "Tu borrador de SNAP está listo",
        zh: "你的 SNAP 草稿已准备好"
    )
    static let subtitle = CivicaText(
        "You can use this information to complete your official application through your state’s benefits website.",
        es: "Puedes usar esta información para completar tu solicitud oficial en el sitio web de beneficios de tu estado.",
        zh: "你可以用这些信息在你所在州的福利官网上完成正式申请。"
    )
    static let stateSelectedLabel = CivicaText(
        "State selected",
        es: "Estado seleccionado",
        zh: "已选择的州"
    )
    static let openOfficialSite = CivicaText(
        "Open official state SNAP website",
        es: "Abrir el sitio oficial de SNAP del estado",
        zh: "打开州官方 SNAP 网站"
    )
    static let officialLinkComingSoon = CivicaText(
        "Official state link coming soon.",
        es: "Próximamente: enlace oficial del estado.",
        zh: "州官方链接即将推出。"
    )
    static let reviewDraftAgain = CivicaText(
        "Review my draft again",
        es: "Revisar mi borrador de nuevo",
        zh: "再次查看我的草稿"
    )
    static let doesNotSubmit = CivicaText(
        "This assistant does not submit your application.",
        es: "Este asistente no envía tu solicitud.",
        zh: "此助手不会替你提交申请。"
    )
    static let notProvided = CivicaText(
        "Not provided",
        es: "No proporcionado",
        zh: "未提供"
    )
}

enum SNAPApplicationGeneratorStrings {
    static let title = CivicaText(
        "Your application packet",
        es: "Tu paquete de solicitud",
        zh: "你的申请资料包"
    )
    static func subtitle(stateCode: String?, language: CivicaLanguage) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalEN = portal.isEmpty ? "your state portal" : portal
        let portalES = portal.isEmpty ? "el portal estatal" : portal
        let portalZH = portal.isEmpty ? "你所在州的门户网站" : portal
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Save or share the summary, then finish the official application in \(portalEN)."
        case .mandarin:
            return "保存或分享摘要,然后在 \(portalZH) 完成正式申请。"
        case .spanish:
            return "Guarda o comparte el resumen, luego completa la solicitud oficial en \(portalES)."
        }
    }
    static let generating = CivicaText(
        "Putting your packet together…",
        es: "Preparando tu paquete…",
        zh: "正在整理你的资料包……"
    )
    static let ready = CivicaText(
        "Your packet is ready.",
        es: "Tu paquete está listo.",
        zh: "你的资料包已准备好。"
    )
    static let saveOrShare = CivicaText(
        "Save or share packet",
        es: "Guardar o compartir paquete",
        zh: "保存或分享资料包"
    )
    static let tryAgain = CivicaText(
        "Try again",
        es: "Intentar de nuevo",
        zh: "再试一次"
    )
}

enum SNAPEligibilityIntroStrings {
    static let whatIsSNAP = CivicaText(
        "What is SNAP?",
        es: "¿Qué es SNAP?",
        zh: "什么是 SNAP?"
    )
    static let snapDescription = CivicaText(
        "The Supplemental Nutrition Assistance Program (commonly referred to as SNAP) is a U.S. government program that helps low-income individuals and families buy food.",
        es: "El Programa de Asistencia Nutricional Suplementaria (conocido como SNAP) es un programa del gobierno de EE. UU. que ayuda a personas y familias de bajos ingresos a comprar alimentos.",
        zh: "补充营养援助计划(通常称为 SNAP)是美国政府的一项计划,帮助低收入个人和家庭购买食物。"
    )
    static let ebtRow = CivicaText(
        "Monthly benefits are loaded onto an Electronic Benefits Transfer (EBT) card.",
        es: "Los beneficios mensuales se cargan en una tarjeta de Transferencia Electrónica de Beneficios (EBT).",
        zh: "每月的福利金会发到一张电子福利转账(EBT)卡上。"
    )
    static let cartRow = CivicaText(
        "The card works like a debit card at grocery stores and some farmers markets.",
        es: "La tarjeta funciona como una tarjeta de débito en supermercados y algunos mercados de agricultores.",
        zh: "这张卡在杂货店和一些农贸市场可以像借记卡一样使用。"
    )
    static let foodRow = CivicaText(
        "SNAP can buy eligible food items to fruits, vegetables, meat, dairy, bread, and more.",
        es: "SNAP puede comprar alimentos elegibles como frutas, verduras, carne, lácteos, pan y más.",
        zh: "SNAP 可以购买符合条件的食物,包括水果、蔬菜、肉类、乳制品、面包等。"
    )
    static let restrictionsRow = CivicaText(
        "SNAP cannot be used for alcohol, tobacco, or hot prepared meals.",
        es: "SNAP no se puede usar para alcohol, tabaco ni comidas calientes preparadas.",
        zh: "SNAP 不能用于购买酒类、烟草或加热的熟食。"
    )
    static let prepStatusTitle = CivicaText(
        "SNAP prep status",
        es: "Estado de preparación de SNAP",
        zh: "SNAP 准备状态"
    )
    static let statusLabel = CivicaText(
        "Status:",
        es: "Estado:",
        zh: "状态:"
    )
    static let prepCompleted = CivicaText(
        "Prep checklist completed",
        es: "Lista de preparación completada",
        zh: "准备清单已完成"
    )
    static let dateLabel = CivicaText(
        "Date:",
        es: "Fecha:",
        zh: "日期:"
    )
    static let openNextSteps = CivicaText(
        "Open next steps",
        es: "Abrir próximos pasos",
        zh: "打开下一步"
    )
    static let prepareApplication = CivicaText(
        "See if I qualify",
        es: "Ver si califico",
        zh: "看我是否符合资格"
    )
    static let questionnaireTitle = CivicaText(
        "SNAP Application",
        es: "Solicitud de SNAP",
        zh: "SNAP 申请"
    )
}

enum SNAPReviewStrings {
    static let title = CivicaText(
        "Review your SNAP draft",
        es: "Revisa tu borrador de SNAP",
        zh: "查看你的 SNAP 草稿"
    )
    static let reviewBeforeSubmitting = CivicaText(
        "Review this before using it to complete your official state application.",
        es: "Revisa esto antes de usarlo para completar tu solicitud oficial del estado.",
        zh: "在用它来完成州的正式申请之前,先检查一遍。"
    )
    static let showNextSteps = CivicaText(
        "Show next steps",
        es: "Mostrar próximos pasos",
        zh: "显示下一步"
    )
    static let edit = CivicaText(
        "Edit",
        es: "Editar",
        zh: "编辑"
    )
    static let yes = CivicaText(
        "Yes",
        es: "Sí",
        zh: "是"
    )
    static let no = CivicaText(
        "No",
        es: "No",
        zh: "否"
    )
    static let notProvided = CivicaText(
        "Not provided",
        es: "No proporcionado",
        zh: "未提供"
    )
    static let notApplicable = CivicaText(
        "Not applicable",
        es: "No aplica",
        zh: "不适用"
    )
    static let nothingChecked = CivicaText(
        "Nothing checked yet",
        es: "Aún no marcaste nada",
        zh: "还没有勾选任何项"
    )
    static let householdSection = CivicaText(
        "Household",
        es: "Hogar",
        zh: "家庭"
    )
    static let locationSection = CivicaText(
        "Location",
        es: "Ubicación",
        zh: "所在地"
    )
    static let studentSection = CivicaText(
        "Student status",
        es: "Estado de estudiante",
        zh: "学生身份"
    )
    static let incomeSection = CivicaText(
        "Income",
        es: "Ingresos",
        zh: "收入"
    )
    static let expensesSection = CivicaText(
        "Expenses",
        es: "Gastos",
        zh: "支出"
    )
    static let documentsSection = CivicaText(
        "Documents checklist",
        es: "Lista de documentos",
        zh: "文件清单"
    )
    static let householdSize = CivicaText(
        "Household size",
        es: "Tamaño del hogar",
        zh: "家庭人数"
    )
    static let applicantAge = CivicaText(
        "Applicant age",
        es: "Edad del solicitante",
        zh: "申请人年龄"
    )
    static let housingStatus = CivicaText(
        "Housing status",
        es: "Estado de vivienda",
        zh: "住房情况"
    )
    static let stateLabel = CivicaText(
        "State",
        es: "Estado",
        zh: "州"
    )
    static let zipCode = CivicaText(
        "ZIP code",
        es: "Código postal",
        zh: "邮政编码"
    )
    static let inHigherEducation = CivicaText(
        "In higher education",
        es: "En educación superior",
        zh: "正在接受高等教育"
    )
    static let halfTimeEnrolled = CivicaText(
        "Enrolled half-time",
        es: "Inscrito medio tiempo",
        zh: "半日制注册"
    )
    static let works20Hours = CivicaText(
        "Works 20+ hours/week",
        es: "Trabaja 20+ horas/semana",
        zh: "每周工作 20 小时以上"
    )
    static let workStudy = CivicaText(
        "Participates in work-study",
        es: "Participa en trabajo-estudio",
        zh: "参与勤工俭学"
    )
    static let dependentChild = CivicaText(
        "Responsible for dependent child",
        es: "Responsable de un hijo dependiente",
        zh: "负责抚养未成年子女"
    )
    static let employmentStatus = CivicaText(
        "Employment status",
        es: "Situación laboral",
        zh: "就业状况"
    )
    static let monthlyIncome = CivicaText(
        "Monthly income estimate",
        es: "Ingreso mensual estimado",
        zh: "每月收入估算"
    )
    static let incomeChanges = CivicaText(
        "Income changes month to month",
        es: "El ingreso cambia mes a mes",
        zh: "收入每月会变化"
    )
    static let rentOrHousing = CivicaText(
        "Rent or housing",
        es: "Renta o vivienda",
        zh: "租金或住房"
    )
    static let utilities = CivicaText(
        "Utilities",
        es: "Servicios públicos",
        zh: "水电煤气等公用事业"
    )
    static let childcareOptional = CivicaText(
        "Childcare (optional)",
        es: "Cuidado infantil (opcional)",
        zh: "托儿费用(可选)"
    )
    static let medicalOptional = CivicaText(
        "Medical (optional estimate)",
        es: "Médico (estimado opcional)",
        zh: "医疗费用(可选估算)"
    )
    static let itemsChecked = CivicaText(
        "Items checked",
        es: "Elementos marcados",
        zh: "已勾选的项目"
    )
}

enum SNAPDocumentConfirmationStrings {
    static let title = CivicaText(
        "Does this look right?",
        es: "¿Se ve correcto?",
        zh: "这些信息看起来对吗?"
    )
    static let subtitle = CivicaText(
        "We read these from your photo. Tap 'Fix something' if anything is off.",
        es: "Leímos esto de tu foto. Toca 'Corregir algo' si hay algo incorrecto.",
        zh: "我们从你的照片中读出了这些信息。如果有不对的地方,点「修改」。"
    )
    static let stoppedReading = CivicaText(
        "Thanks — we'll keep it on file. We'll only read paystubs in detail for now.",
        es: "Gracias — lo guardaremos. Por ahora solo leemos comprobantes de pago en detalle.",
        zh: "谢谢 — 我们会把它保存好。目前我们只会仔细读取工资单。"
    )
    static let deductionsHeading = CivicaText(
        "Deductions",
        es: "Deducciones",
        zh: "扣款"
    )
    static let doubleCheckHeading = CivicaText(
        "A few things to double-check:",
        es: "Algunas cosas para verificar:",
        zh: "有几项需要再核对一下:"
    )
    static let fixSomething = CivicaText(
        "Fix something",
        es: "Corregir algo",
        zh: "修改"
    )
    static let looksRight = CivicaText(
        "Looks right",
        es: "Se ve bien",
        zh: "看起来没问题"
    )
    static let employerLabel = CivicaText(
        "Employer",
        es: "Empleador",
        zh: "雇主"
    )
    static let payPeriodLabel = CivicaText(
        "Pay period",
        es: "Período de pago",
        zh: "工资周期"
    )
    static let payDateLabel = CivicaText(
        "Pay date",
        es: "Fecha de pago",
        zh: "发薪日期"
    )
    static let grossPayLabel = CivicaText(
        "Gross pay (this period)",
        es: "Pago bruto (este período)",
        zh: "税前工资(本期)"
    )
    static let netPayLabel = CivicaText(
        "Net pay (this period)",
        es: "Pago neto (este período)",
        zh: "税后工资(本期)"
    )
    static let hoursWorkedLabel = CivicaText(
        "Hours worked",
        es: "Horas trabajadas",
        zh: "工作小时数"
    )
    static let hourlyRateLabel = CivicaText(
        "Hourly rate",
        es: "Tarifa por hora",
        zh: "时薪"
    )
    static let hourlyRateSuffix = CivicaText(
        "/hr",
        es: "/hora",
        zh: "/小时"
    )
    static let grossYearToDateLabel = CivicaText(
        "Gross year-to-date",
        es: "Bruto en lo que va del año",
        zh: "今年迄今税前总收入"
    )
    static func documentTypeAcknowledgement(rawType: String, language: CivicaLanguage) -> String {
        let prettyType = rawType.replacingOccurrences(of: "_", with: " ")
        switch language {
        case .english, .vietnamese, .tagalog: return "We saw a \(prettyType)"
        case .mandarin: return "我们看到了一份 \(prettyType)"
        case .spanish: return "Vimos un \(prettyType)"
        }
    }
}

enum SNAPConversationViewStrings {
    static let thinking = CivicaText(
        "Thinking…",
        es: "Pensando…",
        zh: "思考中……"
    )
    static let youllNeed = CivicaText(
        "You'll need:",
        es: "Necesitarás:",
        zh: "你需要准备:"
    )
    static let seeTheMath = CivicaText(
        "See the math",
        es: "Ver el cálculo",
        zh: "查看计算过程"
    )
    static let retry = CivicaText(
        "Retry",
        es: "Reintentar",
        zh: "重试"
    )
    static let screenerTitle = CivicaText(
        "SNAP Eligibility Screener",
        es: "Evaluador de elegibilidad de SNAP",
        zh: "SNAP 资格筛查"
    )
    static let close = CivicaText(
        "Close",
        es: "Cerrar",
        zh: "关闭"
    )
    static let confirmUnderstanding = CivicaText(
        "Just to confirm, did I understand your answer correctly?",
        es: "Solo para confirmar, ¿entendí tu respuesta correctamente?",
        zh: "再确认一下,我有没有正确理解你的回答?"
    )
    static let dismissErrorBanner = CivicaText(
        "Dismiss error banner",
        es: "Cerrar aviso de error",
        zh: "关闭错误提示"
    )
    static let getHelpByPhone = CivicaText(
        "Get help by phone",
        es: "Obtén ayuda por teléfono",
        zh: "通过电话获得帮助"
    )
    static let callNavigator = CivicaText(
        "Call Civica navigator",
        es: "Llamar al navegador de Civica",
        zh: "致电 Civica 协助员"
    )
    static let orConnector = CivicaText(
        "or",
        es: "o",
        zh: "或"
    )
}

// Existing `SNAPPrivacyNoticeStrings` enum (in SNAPPrivacyNoticeView.swift)
// holds English-only body copy with compliance regression tests that
// assert exact substrings. Spanish parity for those bodies is a separate
// legal-review task. This enum just covers nav/buttons added here.
enum SNAPPrivacyNoticeNavStrings {
    static let navTitle = CivicaText(
        "Before You Start",
        es: "Antes de comenzar",
        zh: "开始之前"
    )
    static let continueToPrep = CivicaText(
        "Continue to SNAP prep",
        es: "Continuar a preparación de SNAP",
        zh: "继续进行 SNAP 准备"
    )
    static let goToOfficial = CivicaText(
        "Go to official application",
        es: "Ir a la solicitud oficial",
        zh: "前往正式申请"
    )
    static let goBack = CivicaText(
        "Go back",
        es: "Volver",
        zh: "返回"
    )
    static let checkWhatYouNeed = CivicaText(
        "Check what you may need",
        es: "Revisa lo que podrías necesitar",
        zh: "查看你可能需要的材料"
    )
}

enum SNAPApplicationWalkthroughStrings {
    static func submitTo(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english, .vietnamese, .tagalog: return "Submit to \(agency)"
        case .mandarin: return "提交给 \(agency)"
        case .spanish: return "Enviar a \(agency)"
        }
    }
    static func openPortalTitle(portal: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog: return "Open \(portal)"
        case .mandarin: return "打开 \(portal)"
        case .spanish: return "Abrir \(portal)"
        }
    }
    static func openPortalDetail(shortURL: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog: return "Go to \(shortURL) on your phone or computer."
        case .mandarin: return "在你的手机或电脑上打开 \(shortURL)。"
        case .spanish: return "Ve a \(shortURL) en tu teléfono o computadora."
        }
    }
    static let applyForSNAP = CivicaText(
        "Apply for SNAP",
        es: "Solicitar SNAP",
        zh: "申请 SNAP"
    )
    static func applyForSNAPDetail(portal: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog: return "Tap Apply for SNAP and create or sign into your \(portal) account."
        case .mandarin: return "点击「申请 SNAP」,然后创建或登录你的 \(portal) 账户。"
        case .spanish: return "Toca Solicitar SNAP y crea o inicia sesión en tu cuenta de \(portal)."
        }
    }
    static let useYourPacket = CivicaText(
        "Use your packet as a reference",
        es: "Usa tu paquete como referencia",
        zh: "把你的资料包当作参考"
    )
    static func useYourPacketDetail(agencyShort: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Answer the official application's questions using the summary you just saved. Upload the documents listed on the last page when \(agencyShort) asks for them."
        case .mandarin:
            return "用你刚保存的摘要来回答正式申请中的问题。当 \(agencyShort) 要求时,上传最后一页列出的文件。"
        case .spanish:
            return "Responde las preguntas de la solicitud oficial usando el resumen que acabas de guardar. Sube los documentos de la última página cuando \(agencyShort) los pida."
        }
    }
    static func footnote(agencyShort: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Need help? Most \(agencyShort) offices have community navigators who can walk you through the application in person."
        case .mandarin:
            return "需要帮助吗?大多数 \(agencyShort) 办公室都有社区协助员,可以当面帮你完成申请。"
        case .spanish:
            return "¿Necesitas ayuda? La mayoría de las oficinas de \(agencyShort) tienen navegadores comunitarios que pueden ayudarte con la solicitud en persona."
        }
    }
}

enum SNAPGenericStrings {
    static let close = CivicaText(
        "Close",
        es: "Cerrar",
        zh: "关闭"
    )
    static let back = CivicaText(
        "Back",
        es: "Volver",
        zh: "返回"
    )
    static let searchThisArea = CivicaText(
        "Search this area",
        es: "Buscar en esta área",
        zh: "在此区域搜索"
    )
}
