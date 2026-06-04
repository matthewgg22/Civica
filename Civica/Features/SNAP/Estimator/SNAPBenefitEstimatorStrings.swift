import Foundation

// User-visible copy for the SNAP benefit estimator. Every string is
// keyed for English + Spanish per HANDOFF #4 Spanish parity gate.
// Structure mirrors SNAPDecisionMathStrings.swift.

enum SNAPBenefitEstimatorStrings {

    // MARK: - Header

    static let pageTitle = CivicaText(
        "Estimate SNAP Benefit",
        es: "Estima beneficio de SNAP",
        zh: "估算 SNAP 福利"
    )
    /// Retained as an empty string-ish constant for backward
    /// compatibility — surfaces that referenced it now suppress the
    /// subtitle entirely. Kept as an explicit empty CivicaText
    /// rather than deleted so callers in other modules (Spanish
    /// strings catalog, marketing screenshots) don't break on a
    /// missing symbol.
    static let pageSubtitle = CivicaText("", es: "", zh: "")

    // MARK: - Questions

    static let householdSizeQuestion = CivicaText(
        "How many people are in your household?",
        es: "¿Cuántas personas hay en tu hogar?",
        zh: "你家里有多少人?"
    )
    static let householdSizeHelper = CivicaText(
        "Count everyone you buy and prepare food with.",
        es: "Cuenta a todos los que compran y preparan comida contigo.",
        zh: "把和你一起买菜、做饭的人都算上。"
    )
    static let householdDecreaseLabel = CivicaText(
        "Remove a person from household",
        es: "Quitar una persona del hogar",
        zh: "从家庭中减少一人"
    )
    static let householdIncreaseLabel = CivicaText(
        "Add a person to household",
        es: "Agregar una persona al hogar",
        zh: "向家庭中增加一人"
    )

    /// Pairs with `utilitiesQuestion` in a 2-column row. Trimmed to
    /// a 4-word question so the chip fits the half-width column on
    /// a single line at the design-system page-title scale; the
    /// longer-form helper has been dropped from the 2-col layout
    /// since the question itself is unambiguous.
    static let elderlyOrDisabledQuestion = CivicaText(
        "Anyone 60+ or disabled?",
        es: "¿Alguien con 60+ o discapacidad?",
        zh: "有 60 岁以上或残障的家人吗?"
    )
    static let elderlyOrDisabledHelper = CivicaText(
        "Unlocks extra SNAP deductions, including uncapped shelter costs.",
        es: "Habilita deducciones adicionales de SNAP, incluyendo gastos de vivienda sin tope.",
        zh: "可解锁额外的 SNAP 扣除项,包括不设上限的住房支出。"
    )

    static let incomeQuestion = CivicaText(
        "Monthly household income before tax",
        es: "Ingreso mensual del hogar antes de impuestos",
        zh: "家庭每月税前收入"
    )
    static let incomeHelper = CivicaText(
        "All paychecks, gig work, unemployment, Social Security, and child support combined.",
        es: "Todos los cheques, trabajo por encargo, desempleo, Seguro Social y manutención de niños sumados.",
        zh: "把所有工资、零工收入、失业金、Social Security 和子女抚养费加在一起。"
    )

    static let rentQuestion = CivicaText(
        "Monthly rent or mortgage",
        es: "Renta o hipoteca mensual",
        zh: "每月房租或房贷"
    )
    static let rentHelper = CivicaText(
        "Use what you actually pay each month — your share if you split.",
        es: "Usa lo que realmente pagas cada mes — tu parte si lo compartes.",
        zh: "填你每月实际付的金额 —— 如果是分摊,只填你自己那份。"
    )

    /// Pairs with `elderlyOrDisabledQuestion` in a 2-column row.
    /// Question shortened from the prior multi-line version so the
    /// 2-col card stays compact.
    static let utilitiesQuestion = CivicaText(
        "Pay utilities separately?",
        es: "¿Pagas servicios aparte?",
        zh: "水电费另付吗?"
    )

    // MARK: - Yes / No toggle

    static let toggleYes = CivicaText("Yes", es: "Sí", zh: "是")
    static let toggleNo = CivicaText("No", es: "No", zh: "否")

    // MARK: - Result card

    static let resultEyebrow = CivicaText(
        "Estimated monthly benefit",
        es: "Beneficio mensual estimado",
        zh: "预计每月福利"
    )
    static let resultAnnualLabel = CivicaText(
        "About",
        es: "Unos",
        zh: "大约"
    )
    static let resultAnnualSuffix = CivicaText(
        "a year",
        es: "al año",
        zh: "每年"
    )
    static func resultContextEligible(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english, .vietnamese, .tagalog:
            return "This is an estimate — \(agency) reviews your full application and confirms the amount."
        case .mandarin:
            return "这是一个估算 —— \(agency) 会审核你的完整申请并确认金额。"
        case .spanish:
            return "Esto es una estimación — \(agency) revisa tu solicitud completa y confirma el monto."
        }
    }

    static func resultContextMinBenefit(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Under federal law, most 1–2 person households receive at least $24/month if approved. \(agency) confirms your exact amount."
        case .mandarin:
            return "根据联邦法律,大多数 1–2 人家庭获批后每月至少可领 $24。\(agency) 会确认你的具体金额。"
        case .spanish:
            return "Bajo la ley federal, la mayoría de los hogares de 1 a 2 personas reciben al menos $24/mes si son aprobados. \(agency) confirma tu monto exacto."
        }
    }

    static let ineligibleHeadline = CivicaText(
        "Above the estimated SNAP limit",
        es: "Por encima del límite estimado de SNAP",
        zh: "超过 SNAP 预估上限"
    )
    static let ineligibleContextGrossOver = CivicaText(
        "Your income looks higher than the federal SNAP cutoff for your household size.",
        es: "Tus ingresos parecen más altos que el límite federal de SNAP para el tamaño de tu hogar.",
        zh: "你的收入看起来高于联邦 SNAP 对你家庭规模的收入上限。"
    )
    static let ineligibleContextNetOver = CivicaText(
        "After SNAP deductions, your net income is still above the SNAP cutoff.",
        es: "Después de las deducciones de SNAP, tu ingreso neto aún supera el límite.",
        zh: "扣除 SNAP 允许的项目后,你的净收入仍超过 SNAP 上限。"
    )
    static let ineligibleContextBelowMin = CivicaText(
        "Based on these numbers, the formula produces no benefit. Adjusting rent or income can change this.",
        es: "Con estos números la fórmula no produce beneficio. Cambiar la renta o el ingreso puede modificarlo.",
        zh: "按这些数字计算,公式得出的福利为零。调整房租或收入可能会改变结果。"
    )
    static let bbceSoftNote = CivicaText(
        "Many states use Broad-Based Categorical Eligibility (BBCE) with higher income limits — it may still be worth applying.",
        es: "Muchos estados usan Elegibilidad Categórica Amplia (BBCE) con límites de ingresos más altos — aún puede valer la pena aplicar.",
        zh: "很多州采用广泛类别资格(BBCE),收入上限更高 —— 仍然值得提交申请试一试。"
    )

    // MARK: - CTAs

    // Compliance Q3/Q2.3: registry id "estimator_apply_cta" — .pendingSignoff.
    // Once counsel signs, call sites must switch to applyCTA(stateCode:language:) below
    // so the correct state portal name is used. This static let is the pre-sign fallback.
    static let applyCTA = CivicaText(
        "Apply for SNAP",
        es: "Aplicar para SNAP",
        zh: "申请 SNAP"
    )

    /// Registry-aware, state-parameterized CTA. Replaces `applyCTA` at call sites
    /// when counsel signs "estimator_apply_cta". CA → "Apply on BenefitsCal";
    /// MA → "Apply on DTA Connect". Falls back to generic "Apply for SNAP" while
    /// .pendingSignoff.
    static func applyCTA(stateCode: String?, language: CivicaLanguage) -> String {
        guard SNAPComplianceCopyRegistry.approvedEnglish(for: "estimator_apply_cta") != nil else {
            return language == .english ? "Apply for SNAP" : "Aplicar para SNAP"
        }
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        switch language {
        case .english, .vietnamese, .tagalog:
            return portal.isEmpty ? "Apply for SNAP benefits" : "Apply on \(portal)"
        case .mandarin:
            return portal.isEmpty ? "申请 SNAP 福利" : "在 \(portal) 上申请"
        case .spanish:
            return portal.isEmpty ? "Solicitar beneficios de SNAP" : "Solicitar en \(portal)"
        }
    }
    static let seeTheMathLink = CivicaText(
        "See how we calculated this",
        es: "Ver cómo lo calculamos",
        zh: "查看我们是怎么算出来的"
    )

    // MARK: - Entry card (shown on SNAPEntryView above the application card)

    static let entryCardTitle = CivicaText(
        "Estimate your benefit",
        es: "Estima tu beneficio",
        zh: "估算你的福利"
    )
    // Compliance Q3/Q2.3: registry id "estimator_entry_subtitle" — .pendingSignoff.
    // Once counsel signs, call sites must switch to entryCardSubtitle(stateCode:language:)
    // below so the agency name is substituted. This static let is the pre-sign fallback.
    static let entryCardSubtitle = CivicaText(
        "Five questions. See your monthly dollar amount before you apply.",
        es: "Cinco preguntas. Ve tu monto mensual antes de aplicar.",
        zh: "五个问题。在申请前看到你的每月金额。"
    )

    /// Registry-aware, state-parameterized subtitle. Replaces `entryCardSubtitle` at call
    /// sites when counsel signs "estimator_entry_subtitle". Prefers the state-keyed variant
    /// from the registry (Decision 2 — CA: CDSS/county; MA: DTA) and falls back to substituting
    /// [Agency] in the flat default for any other state.
    static func entryCardSubtitle(stateCode: String?, language: CivicaLanguage) -> String {
        // State-keyed lookup first.
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog:
            if let stateKeyed = SNAPComplianceCopyRegistry.approvedEnglish(
                for: "estimator_entry_subtitle",
                stateCode: stateCode
            ), stateKeyed != SNAPComplianceCopyRegistry.approvedEnglish(for: "estimator_entry_subtitle") {
                return stateKeyed
            }
        case .spanish:
            if let stateKeyed = SNAPComplianceCopyRegistry.approvedSpanish(
                for: "estimator_entry_subtitle",
                stateCode: stateCode
            ), stateKeyed != SNAPComplianceCopyRegistry.approvedSpanish(for: "estimator_entry_subtitle") {
                return stateKeyed
            }
        }

        // Fall back to flat approved string with [Agency] substitution, or
        // to the pre-sign production copy when the row is reverted.
        guard let approvedEN = SNAPComplianceCopyRegistry.approvedEnglish(for: "estimator_entry_subtitle"),
              let approvedES = SNAPComplianceCopyRegistry.approvedSpanish(for: "estimator_entry_subtitle") else {
            return language == .english
                ? "Five questions. See your monthly dollar amount before you apply."
                : "Cinco preguntas. Ve tu monto mensual antes de aplicar."
        }
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        let template = language == .english ? approvedEN : approvedES
        return template
            .replacingOccurrences(of: "[Agency]", with: agency)
            .replacingOccurrences(of: "[Agencia]", with: agency)
    }

    // MARK: - Stale-rules banner (OBBBA Q12)

    /// Headline shown above the result card when the rules-engine
    /// snapshot has passed its effective window. Surfaces staleness
    /// the engine already knows about — without this the UI would
    /// happily render a dollar amount the engine itself flagged as
    /// untrustworthy.
    static let staleRulesHeadline = CivicaText(
        "Benefit data may be outdated",
        es: "Los datos del beneficio pueden estar desactualizados",
        zh: "福利数据可能已过时"
    )
    static let staleRulesBody = CivicaText(
        "Civica's SNAP rules were last refreshed for the current fiscal year and may not reflect new federal or state updates. Use the estimate as a rough guide and confirm with your state agency.",
        es: "Las reglas de SNAP de Civica fueron actualizadas para el año fiscal actual y pueden no reflejar nuevos cambios federales o estatales. Usa la estimación como una guía aproximada y confirma con tu agencia estatal.",
        zh: "Civica 的 SNAP 规则上次更新是按本财年的版本,可能未反映最新的联邦或州政策。把这个估算当作大致参考,并和你的州机构核实。"
    )

    // MARK: - Federal-vs-state clarifier

    /// One-line clarifier shown on the eligible result card below
    /// the dollar amount. Notes that this is a CalFresh estimate so
    /// users aren't surprised when their official determination may
    /// differ (different income period, categorical eligibility, etc).
    static func federalEstimateNote(stateCode: String?, language: CivicaLanguage) -> String {
        let resolved = stateCode ?? SNAPAgencyDirectory.launchStateCode
        let agency = SNAPAgencyDirectory.agencyShortName(for: resolved, language: language)
        switch language {
        case .english, .vietnamese, .tagalog:
            return "CalFresh estimate. Your official \(agency) determination uses your full case file and may differ."
        case .mandarin:
            return "CalFresh 估算。\(agency) 的正式裁定会基于你的完整案卷,结果可能不同。"
        case .spanish:
            return "Estimación de CalFresh. La determinación oficial de \(agency) usa tu expediente completo y puede ser diferente."
        }
    }

    // MARK: - Source-citation footer (signoff defensibility)

    /// One-line provenance shown under the dollar amount on every
    /// estimator result card. Establishes the data vintage so that
    /// if a user appeals a state agency's determination, the
    /// screenshot shows the FY and source the app used. Keep this
    /// string in sync with the active rules engine's effective
    /// snapshot (currently FY26, USDA FNS COLA effective Oct 1 2025).
    static let citationFooter = CivicaText(
        "FY26 figures · USDA FNS COLA effective Oct 1, 2025",
        es: "Cifras de FY26 · COLA de USDA FNS vigente desde el 1 de octubre de 2025",
        zh: "FY26 数据 · USDA FNS COLA 自 2025 年 10 月 1 日生效"
    )

    // MARK: - Footer & a11y

    static let disclaimerFooter = CivicaText(
        "This is Civica's estimate. Your state agency makes the final decision.",
        es: "Esta es la estimación de Civica. Tu agencia estatal toma la decisión final.",
        zh: "这是 Civica 的估算。最终决定由你所在的州机构作出。"
    )
    static let closeLabel = CivicaText(
        "Close",
        es: "Cerrar",
        zh: "关闭"
    )
}
