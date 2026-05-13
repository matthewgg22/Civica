import Foundation

// User-visible copy for the SNAP benefit estimator. Every string is
// keyed for English + Spanish per HANDOFF #4 Spanish parity gate.
// Structure mirrors SNAPDecisionMathStrings.swift.

enum SNAPBenefitEstimatorStrings {

    // MARK: - Header

    static let pageTitle = CivicaText(
        "Estimate your SNAP benefit",
        es: "Estima tu beneficio de SNAP"
    )
    static let pageSubtitle = CivicaText(
        "Five quick questions. The result updates as you change your answers.",
        es: "Cinco preguntas rápidas. El resultado se actualiza al cambiar tus respuestas."
    )

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

    static let elderlyOrDisabledQuestion = CivicaText(
        "Anyone 60 or older, or with a disability?",
        es: "¿Alguien de 60 años o más, o con una discapacidad?"
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

    static let utilitiesQuestion = CivicaText(
        "Do you pay utilities separately from rent?",
        es: "¿Pagas servicios públicos aparte de la renta?"
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
    static let resultContextEligible = CivicaText(
        "This is an estimate — Massachusetts DTA reviews your full application and confirms the amount.",
        es: "Esto es una estimación — el DTA de Massachusetts revisa tu solicitud completa y confirma el monto."
    )
    static let resultContextMinBenefit = CivicaText(
        "Under federal law, most 1–2 person households receive at least $24/month if approved. DTA confirms your exact amount.",
        es: "Bajo la ley federal, la mayoría de los hogares de 1 a 2 personas reciben al menos $24/mes si son aprobados. El DTA confirma tu monto exacto."
    )

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
