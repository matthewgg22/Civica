import CivicaDesignSystem
import SwiftUI

// HANDOFF MobilePrivacyBoard · screen 2 — "Here's what will happen,
// in order." Four numbered steps that lay out the deletion outcome
// in plain language, then a single brick-ink primary CTA.
//
// Brand-voice rule from the board: "treats data deletion as a
// reasonable request from someone with reasonable concerns." No
// scare modal, no double-confirm, no "really really sure?" — the
// explanation IS the confirmation. Tap = done.
//
// The 4 steps from the canvas mock are calibrated to a backend-
// connected app ("we send you an email confirming," "erased from
// our servers and our backups"). Civica is currently all-on-device
// — the four-step copy is rewritten honestly: nothing is on a
// server yet, but DTA-submitted records can't be pulled back.

struct SNAPDataDeletionView: View {
    @Environment(\.dismiss) private var dismiss

    @AppStorage("co.civica.hasCompletedOnboarding")
    private var hasCompletedOnboarding: Bool = false

    @AppStorage("co.civica.recertInProgress")
    private var recertInProgress: Bool = false

    @State private var didDelete: Bool = false

    let language: CivicaLanguage

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    eyebrow
                    title
                    stepsBlock
                }
                .padding(CivicaSpacing.xl)
            }
            actionFooter
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Header

    private var eyebrow: some View {
        Text(SNAPDataDeletionStrings.eyebrow.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
    }

    private var title: some View {
        Text(SNAPDataDeletionStrings.title.value(in: language))
            .font(CivicaTypography.pageTitle)
            .foregroundStyle(CivicaColors.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Steps

    private var stepsBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            ForEach(SNAPDataDeletionStrings.steps(language: language).indices, id: \.self) { i in
                step(
                    number: i + 1,
                    title: SNAPDataDeletionStrings.steps(language: language)[i].title,
                    body: SNAPDataDeletionStrings.steps(language: language)[i].body
                )
            }
        }
    }

    private func step(number: Int, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Text("\(number)")
                .font(CivicaTypography.subheadStrong.monospacedDigit())
                .foregroundStyle(CivicaColors.brickPrimary)
                .frame(width: 22, alignment: .leading)
                .padding(.top, 1)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(body)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Action footer

    private var actionFooter: some View {
        VStack(spacing: CivicaSpacing.sm) {
            // Brick-ink primary (the canvas spec uses ink-fill with
            // paper text, signaling the seriousness without dipping
            // into destructive-red alarm).
            Button(action: performDeletion) {
                Text(SNAPDataDeletionStrings.confirm.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.paper)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .fill(CivicaColors.ink)
                    )
            }
            .accessibilityLabel(SNAPDataDeletionStrings.confirm.value(in: language))

            CivicaSecondaryButton(
                title: SNAPDataDeletionStrings.cancel.value(in: language),
                action: { dismiss() }
            )
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.top, CivicaSpacing.md)
        .padding(.bottom, CivicaSpacing.lg)
        .background(CivicaColors.paper)
        .overlay(alignment: .top) {
            Rectangle().fill(CivicaColors.hairline).frame(height: 1)
        }
    }

    // MARK: - Delete action

    private func performDeletion() {
        guard !didDelete else { return }
        didDelete = true

        // Wipe every byte. CivicaUserData.deleteEverything handles:
        // UserDefaults keys, captured documents on disk, the draft
        // store, the status store.
        CivicaUserData.deleteEverything()

        // The deletion routine clears UserDefaults but @AppStorage
        // properties hold their @State copies until the next view
        // tree refresh. Explicitly reset the two flags we care
        // about so the next launch (or dismiss-to-root re-eval)
        // routes the user to a fresh onboarding.
        hasCompletedOnboarding = false
        recertInProgress = false

        // The view tree above us reads hasCompletedOnboarding via
        // @AppStorage on CivicaRootView. Setting it to false triggers
        // a re-render to OnboardingFlowView. Dismissing this view
        // collapses the navigation stack first.
        dismiss()
    }
}

// MARK: - Strings

enum SNAPDataDeletionStrings {

    struct Step {
        let title: String
        let body: String
    }

    static let eyebrow = CivicaText(
        "Deleting your Civica data",
        es: "Eliminando tus datos de Civica"
    )
    static let title = CivicaText(
        "Here's what will happen, in order.",
        es: "Esto es lo que va a pasar, en orden."
    )
    static let confirm = CivicaText(
        "Yes, delete everything",
        es: "Sí, eliminar todo"
    )
    static let cancel = CivicaText(
        "Keep my account",
        es: "Mantener mi cuenta"
    )

    static func steps(language: CivicaLanguage) -> [Step] {
        switch language {
        case .english:
            return [
                Step(
                    title: "Right now",
                    body: "Your answers, captured documents, status, and language preference are erased from this device. The app returns to the language picker."
                ),
                Step(
                    title: "Already with the state",
                    body: "If you submitted to DTA Connect, that submission stays with the state. Civica can't pull it back — only Massachusetts DTA can change or close it. Your benefits won't change just because you delete here."
                ),
                Step(
                    title: "Civica's servers",
                    body: "Civica doesn't have a backend yet — your data hasn't left this device. When that changes, the deletion will reach our servers and backups too."
                ),
                Step(
                    title: "Reapplying later",
                    body: "You can come back any time. You'll start fresh — Civica won't recognize you, by design."
                ),
            ]
        case .spanish:
            return [
                Step(
                    title: "Ahora mismo",
                    body: "Tus respuestas, documentos capturados, estado y preferencia de idioma se borran de este dispositivo. La aplicación vuelve a la selección de idioma."
                ),
                Step(
                    title: "Lo que ya está con el estado",
                    body: "Si enviaste tu solicitud a DTA Connect, esa solicitud queda con el estado. Civica no puede recuperarla — solo el DTA de Massachusetts puede cambiarla o cerrarla. Tus beneficios no cambian por eliminar aquí."
                ),
                Step(
                    title: "Los servidores de Civica",
                    body: "Civica todavía no tiene un servidor — tus datos no han salido de este dispositivo. Cuando eso cambie, la eliminación también alcanzará nuestros servidores y respaldos."
                ),
                Step(
                    title: "Volver a solicitar más tarde",
                    body: "Puedes regresar en cualquier momento. Empezarás de cero — Civica no te reconocerá, por diseño."
                ),
            ]
        }
    }
}

#if DEBUG
struct SNAPDataDeletionView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPDataDeletionView(language: .english)
        }
    }
}
#endif
