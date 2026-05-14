import CivicaDesignSystem

// String table for the Check EBT Balance feature. EN/ES parity per
// HANDOFF #4. Phase 0 scaffold — copy grows with each phase.
//
// Framing note: this feature is a *demo* of what a Propel-style
// balance dashboard would look like in Civica. It does not connect
// to a real state EBT system. Disclosure copy lives here so every
// screen pulls from the same source.

enum EBTBalanceStrings {
    static let screenTitle = CivicaText(
        "EBT Balance",
        es: "Saldo de EBT"
    )
    static let placeholderBody = CivicaText(
        "Your EBT balance dashboard is coming together.",
        es: "Tu panel de saldo de EBT se está construyendo."
    )
    static let demoDisclosure = CivicaText(
        "Demo — not connected to a real EBT account.",
        es: "Demostración — no está conectado a una cuenta EBT real."
    )
}
