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
        "Seven quick questions. The result updates as you change your answers.",
        es: "Siete preguntas rápidas. El resultado se actualiza al cambiar tus respuestas."
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

    static let employmentIncomeQuestion = CivicaText(
        "Does anyone in your household earn wages or self-employment income?",
        es: "¿Alguien en tu hogar recibe salario o ingreso por trabajo independiente?"
    )
    static let employmentIncomeHelper = CivicaText(
        "Employment income qualifies for a 20% deduction. SSI, Social Security, and unemployment do not.",
        es: "El ingreso laboral califica para una deducción del 20%. SSI, Seguro Social y desempleo no califican."
    )

    static let utilitiesQuestion = CivicaText(
        "Which utilities does your household pay separately from rent?",
        es: "¿Qué servicios públicos paga tu hogar aparte de la renta?"
    )
    static let utilitiesHelper = CivicaText(
        "This determines your Standard Utility Allowance (SUA), a fixed deduction set by Massachusetts.",
        es: "Esto determina tu Subsidio Estándar de Servicios Públicos (SUA), una deducción fija de Massachusetts."
    )
    static let suaTierHeat = CivicaText("Heat or AC", es: "Calor/AC")
    static let suaTierOther = CivicaText("Other utils", es: "Otros serv.")
    static let suaTierPhone = CivicaText("Phone only", es: "Solo teléfono")
    static let suaTierNone = CivicaText("None", es: "Ninguno")

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
        "Most people who match this estimate qualify. Your state confirms the final amount.",
        es: "La mayoría de quienes coinciden con esta estimación califican. Tu estado confirma el monto final."
    )
    static let resultContextMinBenefit = CivicaText(
        "Small households are guaranteed a $24 minimum monthly benefit.",
        es: "Los hogares pequeños tienen garantizado un beneficio mensual mínimo de $24."
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
    static let resultSoftAssumptionNote = CivicaText(
        "Based on federal SNAP rules. Your actual benefit may differ — your state agency applies its own rules and verifies your information.",
        es: "Basado en las reglas federales de SNAP. Tu beneficio real puede variar — tu agencia estatal aplica sus propias reglas y verifica tu información."
    )
    static let resultAbawdNote = CivicaText(
        "Note: If anyone in your household is 18–52, able-bodied, and not working at least 80 hours/month, ABAWD work requirements may affect eligibility. Your state agency verifies this — Civica cannot confirm waiver status.",
        es: "Nota: Si alguien en tu hogar tiene entre 18 y 52 años, está en buenas condiciones de salud y no trabaja al menos 80 horas al mes, los requisitos de trabajo de ABAWD pueden afectar la elegibilidad. Tu agencia estatal lo verifica — Civica no puede confirmar el estado de exención."
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
        "Seven questions. See your monthly dollar amount before you apply.",
        es: "Siete preguntas. Ve tu monto mensual antes de aplicar."
    )

    // MARK: - Footer & a11y

    static let disclaimerFooter = CivicaText(
        "This estimate uses federal SNAP rules and does not account for state-specific adjustments, household expenses not listed above, or eligibility categories your state may apply. It is not an official benefit determination.",
        es: "Esta estimación usa las reglas federales de SNAP y no considera ajustes específicos del estado, gastos del hogar no listados arriba, ni categorías de elegibilidad que tu estado pueda aplicar. No es una determinación oficial de beneficios."
    )
    static let closeLabel = CivicaText(
        "Close",
        es: "Cerrar"
    )
}
