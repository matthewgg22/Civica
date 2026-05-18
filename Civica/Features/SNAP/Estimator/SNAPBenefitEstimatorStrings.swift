import Foundation

// User-visible copy for the SNAP benefit estimator. Every string is
// keyed for English + Spanish per HANDOFF #4 Spanish parity gate.
// Structure mirrors SNAPDecisionMathStrings.swift.

enum SNAPBenefitEstimatorStrings {

    // MARK: - Header

    static let pageTitle = CivicaText(
        "Estimate SNAP Benefit",
        es: "Estima beneficio de SNAP"
    )
    /// Retained as an empty string-ish constant for backward
    /// compatibility — surfaces that referenced it now suppress the
    /// subtitle entirely. Kept as an explicit empty CivicaText
    /// rather than deleted so callers in other modules (Spanish
    /// strings catalog, marketing screenshots) don't break on a
    /// missing symbol.
    static let pageSubtitle = CivicaText("", es: "")

    // MARK: - Questions

    static let householdSizeQuestion = CivicaText(
        "How many people are in your household?",
        es: "¿Cuántas personas hay en tu hogar?"
    )
    static let householdSizeHelper = CivicaText(
        "Count everyone you buy and prepare food with.",
        es: "Cuenta a todos los que compran y preparan comida contigo."
    )
    static let householdDecreaseLabel = CivicaText(
        "Remove a person from household",
        es: "Quitar una persona del hogar"
    )
    static let householdIncreaseLabel = CivicaText(
        "Add a person to household",
        es: "Agregar una persona al hogar"
    )

    /// Pairs with `utilitiesQuestion` in a 2-column row. Trimmed to
    /// a 4-word question so the chip fits the half-width column on
    /// a single line at the design-system page-title scale; the
    /// longer-form helper has been dropped from the 2-col layout
    /// since the question itself is unambiguous.
    static let elderlyOrDisabledQuestion = CivicaText(
        "Anyone 60+ or disabled?",
        es: "¿Alguien con 60+ o discapacidad?"
    )
    static let elderlyOrDisabledHelper = CivicaText(
        "Unlocks extra SNAP deductions, including uncapped shelter costs.",
        es: "Habilita deducciones adicionales de SNAP, incluyendo gastos de vivienda sin tope."
    )

    static let incomeQuestion = CivicaText(
        "Monthly household income before tax",
        es: "Ingreso mensual del hogar antes de impuestos"
    )
    static let incomeHelper = CivicaText(
        "All paychecks, gig work, unemployment, Social Security, and child support combined.",
        es: "Todos los cheques, trabajo por encargo, desempleo, Seguro Social y manutención de niños sumados."
    )

    static let rentQuestion = CivicaText(
        "Monthly rent or mortgage",
        es: "Renta o hipoteca mensual"
    )
    static let rentHelper = CivicaText(
        "Use what you actually pay each month — your share if you split.",
        es: "Usa lo que realmente pagas cada mes — tu parte si lo compartes."
    )

    /// Pairs with `elderlyOrDisabledQuestion` in a 2-column row.
    /// Question shortened from the prior multi-line version so the
    /// 2-col card stays compact.
    static let utilitiesQuestion = CivicaText(
        "Pay utilities separately?",
        es: "¿Pagas servicios aparte?"
    )
    static let utilitiesHelper = CivicaText(
        "Heat, electricity, water, gas — even just one counts.",
        es: "Calefacción, electricidad, agua, gas — incluso solo uno cuenta."
    )

    // MARK: - Yes / No toggle

    static let toggleYes = CivicaText("Yes", es: "Sí")
    static let toggleNo = CivicaText("No", es: "No")

    // MARK: - Result card

    static let resultEyebrow = CivicaText(
        "Estimated monthly benefit",
        es: "Beneficio mensual estimado"
    )
    static let resultAnnualLabel = CivicaText(
        "About",
        es: "Unos"
    )
    static let resultAnnualSuffix = CivicaText(
        "a year",
        es: "al año"
    )
    static func resultContextEligible(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english:
            return "This is an estimate — \(agency) reviews your full application and confirms the amount."
        case .spanish:
            return "Esto es una estimación — \(agency) revisa tu solicitud completa y confirma el monto."
        }
    }

    static func resultContextMinBenefit(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
        switch language {
        case .english:
            return "Under federal law, most 1–2 person households receive at least $24/month if approved. \(agency) confirms your exact amount."
        case .spanish:
            return "Bajo la ley federal, la mayoría de los hogares de 1 a 2 personas reciben al menos $24/mes si son aprobados. \(agency) confirma tu monto exacto."
        }
    }

    static let ineligibleHeadline = CivicaText(
        "Above the estimated SNAP limit",
        es: "Por encima del límite estimado de SNAP"
    )
    static let ineligibleContextGrossOver = CivicaText(
        "Your income looks higher than the federal SNAP cutoff for your household size.",
        es: "Tus ingresos parecen más altos que el límite federal de SNAP para el tamaño de tu hogar."
    )
    static let ineligibleContextNetOver = CivicaText(
        "After SNAP deductions, your net income is still above the SNAP cutoff.",
        es: "Después de las deducciones de SNAP, tu ingreso neto aún supera el límite."
    )
    static let ineligibleContextBelowMin = CivicaText(
        "Based on these numbers, the formula produces no benefit. Adjusting rent or income can change this.",
        es: "Con estos números la fórmula no produce beneficio. Cambiar la renta o el ingreso puede modificarlo."
    )
    static let bbceSoftNote = CivicaText(
        "Many states use Broad-Based Categorical Eligibility (BBCE) with higher income limits — it may still be worth applying.",
        es: "Muchos estados usan Elegibilidad Categórica Amplia (BBCE) con límites de ingresos más altos — aún puede valer la pena aplicar."
    )

    // MARK: - CTAs

    static let applyCTA = CivicaText(
        "Apply for SNAP",
        es: "Aplicar para SNAP"
    )
    static let seeTheMathLink = CivicaText(
        "See how we calculated this",
        es: "Ver cómo lo calculamos"
    )

    // MARK: - Entry card (shown on SNAPEntryView above the application card)

    static let entryCardTitle = CivicaText(
        "Estimate your benefit",
        es: "Estima tu beneficio"
    )
    static let entryCardSubtitle = CivicaText(
        "Five questions. See your monthly dollar amount before you apply.",
        es: "Cinco preguntas. Ve tu monto mensual antes de aplicar."
    )

    // MARK: - Stale-rules banner (OBBBA Q12)

    /// Headline shown above the result card when the rules-engine
    /// snapshot has passed its effective window. Surfaces staleness
    /// the engine already knows about — without this the UI would
    /// happily render a dollar amount the engine itself flagged as
    /// untrustworthy.
    static let staleRulesHeadline = CivicaText(
        "Benefit data may be outdated",
        es: "Los datos del beneficio pueden estar desactualizados"
    )
    static let staleRulesBody = CivicaText(
        "Civica's SNAP rules were last refreshed for the current fiscal year and may not reflect new federal or state updates. Use the estimate as a rough guide and confirm with your state agency.",
        es: "Las reglas de SNAP de Civica fueron actualizadas para el año fiscal actual y pueden no reflejar nuevos cambios federales o estatales. Usa la estimación como una guía aproximada y confirma con tu agencia estatal."
    )

    // MARK: - Source-citation footer (signoff defensibility)

    /// One-line provenance shown under the dollar amount on every
    /// estimator result card. Establishes the data vintage so that
    /// if a user appeals a state agency's determination, the
    /// screenshot shows the FY and source the app used. Keep this
    /// string in sync with the active rules engine's effective
    /// snapshot (currently FY26, USDA FNS COLA effective Oct 1 2025).
    static let citationFooter = CivicaText(
        "FY26 figures · USDA FNS COLA effective Oct 1, 2025",
        es: "Cifras de FY26 · COLA de USDA FNS vigente desde el 1 de octubre de 2025"
    )

    // MARK: - Footer & a11y

    static let disclaimerFooter = CivicaText(
        "This is Civica's estimate. Your state agency makes the final decision.",
        es: "Esta es la estimación de Civica. Tu agencia estatal toma la decisión final."
    )
    static let closeLabel = CivicaText(
        "Close",
        es: "Cerrar"
    )
}
