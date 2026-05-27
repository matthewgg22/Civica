import CivicaDesignSystem
import SwiftUI

// Mounts the SNAP enrollment orchestrator and chains the verdict +
// packet-PDF views together. Replaces the legacy
// SNAPEligibilityIntroView wrapper for the Civica target — the
// legacy view depends on SNAPApplicationViewModel which carries
// VoteNow-specific address / prefill plumbing the new flow doesn't
// need.
//
// Flow:
//   1. Mount SNAPApplicationFlowOrchestratorView
//   2. On "Generate my application packet" → evaluate locally,
//      record into the status store (which routes the user to the
//      returning-user-home on subsequent launches), push the
//      decision-math view
//   3. From the math view's "Continue" CTA → push the packet view
//   4. The packet view's "Done for now" dismisses the whole chain

struct CivicaSNAPFlowView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var generatedDraft: SNAPApplicationDraft?
    @State private var verdict: SNAPEligibilityResult?
    @State private var presentingVerdict: Bool = false
    @State private var presentingPacket: Bool = false
    /// Draft held while the user completes phone sign-in before packet generation.
    @State private var pendingDraft: SNAPApplicationDraft?
    @State private var showingSignIn: Bool = false

    @EnvironmentObject private var statusStore: SNAPApplicationStatusStore
    @EnvironmentObject private var enrollmentAuth: CivicaEnrollmentAuth

    /// True when the user is here as part of a recertification rather
    /// than a first-time application. Drives the inline banner that
    /// explains "this is your recert" and primes any future per-step
    /// copy adjustments. Status-store advancement on completion also
    /// clears the recert-in-progress flag at the root.
    @AppStorage("co.civica.recertInProgress")
    private var isRecertInProgress: Bool = false

    /// One-time first-entry buddy modal flag. Auto-presents the buddy
    /// 3-panel intro the very first time a user opens the apply flow;
    /// after dismissal the banner stays as the persistent re-entry path.
    @AppStorage("co.civica.buddy.hasSeenApplyIntro")
    private var hasSeenBuddyIntro: Bool = false
    @State private var showingBuddyIntro: Bool = false

    /// Persisted "invited buddy" state. Empty strings mean no buddy
    /// yet. Set by the dummy invite form so the banner and the modal
    /// can render an invited state until backend wire-up replaces this
    /// with the real /buddy/invite response.
    @AppStorage("co.civica.buddy.name")
    private var buddyName: String = ""
    @AppStorage("co.civica.buddy.contact")
    private var buddyContact: String = ""

    let language: CivicaLanguage
    let recertMode: Bool

    init(language: CivicaLanguage, recertMode: Bool = false) {
        self.language = language
        self.recertMode = recertMode
    }

    var body: some View {
        VStack(spacing: 0) {
            if recertMode {
                recertBanner
            }
            buddyBanner
            SNAPApplicationFlowOrchestratorView(
                viewModel: SNAPApplicationFlowOrchestratorViewModel(),
                language: language,
                onGeneratePacket: { draft in
                    if enrollmentAuth.state.isAuthenticated {
                        runGeneratePacket(draft)
                    } else {
                        pendingDraft = draft
                        showingSignIn = true
                    }
                },
                onDismiss: { dismiss() }
            )
        }
        .navigationTitle("SNAP")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // First entry: present the 3-panel buddy intro once, then
            // never again. The banner stays as the persistent re-entry
            // path for users who skipped or dismissed the modal.
            if !hasSeenBuddyIntro {
                showingBuddyIntro = true
            }
        }
        .sheet(isPresented: $showingBuddyIntro, onDismiss: {
            hasSeenBuddyIntro = true
        }) {
            BuddyApplyIntroView(
                language: language,
                buddyName: $buddyName,
                buddyContact: $buddyContact,
                onDismiss: {
                    hasSeenBuddyIntro = true
                    showingBuddyIntro = false
                }
            )
        }
        // When auth succeeds (e.g. inside the sign-in sheet), handle the pending draft.
        .onChange(of: enrollmentAuth.state) { _, newState in
            if newState.isAuthenticated, let draft = pendingDraft {
                pendingDraft = nil
                showingSignIn = false
                runGeneratePacket(draft)
            }
        }
        .sheet(isPresented: $showingSignIn, onDismiss: {
            // User cancelled sign-in — discard the pending draft.
            pendingDraft = nil
        }) {
            SNAPPhoneSignInView(auth: enrollmentAuth, language: language)
        }
        // Both destinations registered at the same NavigationStack level —
        // nesting a second navigationDestination inside the first destination's
        // view body is unsupported in iOS 17+ and causes navigation freezes.
        .navigationDestination(isPresented: $presentingVerdict) {
            if let verdict {
                SNAPDecisionMathView(
                    result: verdict,
                    language: language,
                    onContinue: { presentingPacket = true },
                    draft: generatedDraft
                )
            }
        }
        .navigationDestination(isPresented: $presentingPacket) {
            if let draft = generatedDraft {
                SNAPApplicationPacketView(
                    draft: draft,
                    language: language,
                    onClose: {
                        presentingPacket = false
                        presentingVerdict = false
                        dismiss()
                    }
                )
            }
        }
    }

    // MARK: - Packet generation

    private func runGeneratePacket(_ draft: SNAPApplicationDraft) {
        let result = SNAPLocalEligibilityEvaluator.evaluate(draft)
        statusStore.recordEligibilityResult(result)
        if recertMode { isRecertInProgress = false }
        generatedDraft = draft
        verdict = result
        presentingVerdict = true

        // Submit to the enrollment API in the background.
        // This is best-effort — a failure must never block the local UX.
        let client = enrollmentAuth.makeEnrollmentAPIClient()
        let stateCode = draft.whereApplying.stateCode?.uppercased() ?? "CA"
        Task {
            do {
                let packet = try await client.createPacket(stateCode: stateCode)
                _ = try await client.submitPacket(packetId: packet.id)
                SNAPAnalytics.trackSubmitted()
            } catch {
                // Intentional no-op: enrollment API is additive persistence.
                // The applicant's local flow continues unaffected.
            }
        }
    }

    /// Persistent buddy invite banner above the orchestrator. Two
    /// states:
    ///   • Pre-invite: pine-tinted CTA inviting the user to add a
    ///     buddy. Tap → opens the 3-panel intro modal.
    ///   • Post-invite: pine-tinted confirmation showing the buddy's
    ///     name + a checkmark, anchoring the relationship in the UI.
    ///     Tap → re-opens the modal so the user can manage / re-share.
    private var buddyBanner: some View {
        Button {
            showingBuddyIntro = true
        } label: {
            HStack(alignment: .center, spacing: CivicaSpacing.sm) {
                Image(systemName: buddyName.isEmpty ? "person.2.fill" : "person.2.badge.gearshape.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(width: 36, height: 36)
                    .background(
                        Circle().fill(CivicaColors.pinePrimary.opacity(0.14))
                    )
                    .overlay(alignment: .topTrailing) {
                        if !buddyName.isEmpty {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(CivicaColors.pinePrimary)
                                .background(Circle().fill(CivicaColors.pineSurface))
                                .offset(x: 4, y: -2)
                        }
                    }
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(buddyName.isEmpty
                         ? CivicaSNAPFlowStrings.buddyBannerTitle.value(in: language)
                         : CivicaSNAPFlowStrings.buddyBannerInvitedTitle(name: buddyName, language: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(buddyName.isEmpty
                         ? CivicaSNAPFlowStrings.buddyBannerBody.value(in: language)
                         : CivicaSNAPFlowStrings.buddyBannerInvitedBody.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.pineSurface)
            .overlay(alignment: .bottom) {
                Rectangle().fill(CivicaColors.hairline).frame(height: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    /// Inline banner above the orchestrator when the user is here
    /// for a recertification. Tells them prior answers are pre-
    /// populated and that they only need to change what changed.
    private var recertBanner: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundStyle(CivicaColors.pinePrimary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(CivicaSNAPFlowStrings.recertBannerTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(CivicaSNAPFlowStrings.recertBannerBody.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.amberSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(CivicaColors.hairline).frame(height: 1)
        }
    }
}

enum CivicaSNAPFlowStrings {
    static let recertBannerTitle = CivicaText(
        "You're recertifying",
        es: "Estás recertificando"
    )
    static let recertBannerBody = CivicaText(
        "Your previous answers are pre-filled — change only what's different since last time.",
        es: "Tus respuestas anteriores están pre-llenadas — cambia solo lo que sea diferente desde la última vez."
    )

    // MARK: Buddy banner + first-entry modal

    static let buddyBannerTitle = CivicaText(
        "Loop in a buddy",
        es: "Incluye a un compañero"
    )
    static let buddyBannerBody = CivicaText(
        "Share progress with someone you trust — they'll see deadlines and what's left to do.",
        es: "Comparte tu progreso con alguien de confianza — verá las fechas límite y lo que falta."
    )

    static let buddyModalEyebrow = CivicaText(
        "BETTER WITH HELP",
        es: "MEJOR CON AYUDA"
    )
    static let buddyModalTitle = CivicaText(
        "Don't go through this alone",
        es: "No pases por esto solo"
    )
    static let buddyModalSubtitle = CivicaText(
        "Add a family member, friend, or navigator so someone else knows what's next.",
        es: "Agrega a un familiar, amigo o asesor para que alguien más sepa qué sigue."
    )
    static let buddyStep1Title = CivicaText(
        "You start the application",
        es: "Tú comienzas la solicitud"
    )
    static let buddyStep1Body = CivicaText(
        "Walk through SNAP at your own pace. Your buddy never sees your private documents.",
        es: "Avanza por SNAP a tu ritmo. Tu compañero nunca verá tus documentos privados."
    )
    static let buddyStep2Title = CivicaText(
        "They get a private link",
        es: "Reciben un enlace privado"
    )
    static let buddyStep2Body = CivicaText(
        "We send a one-time invite by text or email. They tap it to follow along — no app install required.",
        es: "Enviamos una invitación única por mensaje o correo. La tocan para seguir el proceso — sin instalar una app."
    )
    static let buddyStep3Title = CivicaText(
        "They see what's due, when",
        es: "Ven qué falta y cuándo"
    )
    static let buddyStep3Body = CivicaText(
        "Status, upcoming deadlines, and what documents are still needed — so they can nudge you or help you gather things.",
        es: "Estado, próximas fechas límite y qué documentos faltan — para que te recuerden o te ayuden a reunir cosas."
    )
    static let buddyModalPrimaryCTA = CivicaText(
        "Add a buddy now",
        es: "Agregar un compañero ahora"
    )
    static let buddyModalSecondaryCTA = CivicaText(
        "Maybe later",
        es: "Quizás después"
    )
    static let buddyModalComingSoon = CivicaText(
        "Demo build — invites are simulated. Backend wire-up ships next.",
        es: "Versión de demostración — las invitaciones son simuladas. La conexión al servidor llega pronto."
    )

    // Banner — invited state
    static func buddyBannerInvitedTitle(name: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "\(name) is following along"
        case .spanish: return "\(name) está siguiendo el proceso"
        }
    }
    static let buddyBannerInvitedBody = CivicaText(
        "Tap to re-share the invite link or manage your buddy.",
        es: "Toca para volver a compartir el enlace o administrar tu compañero."
    )

    // Invite form
    static let buddyFormTitle = CivicaText(
        "Add a buddy",
        es: "Agregar un compañero"
    )
    static let buddyFormSubtitle = CivicaText(
        "We'll send them a one-time private link. They can open it on any phone — no Civica account needed.",
        es: "Les enviaremos un enlace privado de un solo uso. Pueden abrirlo desde cualquier teléfono — sin cuenta de Civica."
    )
    static let buddyFormNameLabel = CivicaText(
        "Their name",
        es: "Su nombre"
    )
    static let buddyFormNamePlaceholder = CivicaText(
        "e.g. Maria",
        es: "p. ej. María"
    )
    static let buddyFormChannelLabel = CivicaText(
        "How should we reach them?",
        es: "¿Cómo los contactamos?"
    )
    static let buddyFormChannelSMS = CivicaText(
        "Text",
        es: "Mensaje"
    )
    static let buddyFormChannelEmail = CivicaText(
        "Email",
        es: "Correo"
    )
    static let buddyFormContactPlaceholderSMS = CivicaText(
        "(555) 555-0123",
        es: "(555) 555-0123"
    )
    static let buddyFormContactPlaceholderEmail = CivicaText(
        "maria@example.com",
        es: "maria@ejemplo.com"
    )
    static let buddyFormSendCTA = CivicaText(
        "Send invite",
        es: "Enviar invitación"
    )
    static let buddyFormPrivacyNote = CivicaText(
        "They'll only see your application status, deadlines, and what's left to do — never your documents, income details, or address.",
        es: "Solo verán el estado de tu solicitud, las fechas límite y lo que falta — nunca tus documentos, ingresos ni dirección."
    )

    // Invite sent
    static func buddyInviteSentTitle(name: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Invite sent to \(name)"
        case .spanish: return "Invitación enviada a \(name)"
        }
    }
    static let buddyInviteSentBody = CivicaText(
        "They'll get a one-time link to follow along. You can re-send it any time from this screen.",
        es: "Recibirán un enlace único para seguir el proceso. Puedes reenviarlo en cualquier momento desde esta pantalla."
    )
    static let buddyInviteSentLinkLabel = CivicaText(
        "Their private invite link",
        es: "Su enlace privado de invitación"
    )
    static let buddyInviteSentShareCTA = CivicaText(
        "Share invite link",
        es: "Compartir enlace de invitación"
    )
    static let buddyInviteSentDoneCTA = CivicaText(
        "Back to my application",
        es: "Volver a mi solicitud"
    )
    static let buddyInviteSentRemoveCTA = CivicaText(
        "Remove buddy",
        es: "Quitar compañero"
    )
}

// MARK: - Buddy intro + invite flow (dummy demo)

/// Three-panel visual story explaining the buddy system. Auto-presents
/// the first time a user enters the SNAP apply flow; thereafter
/// re-openable from the persistent banner.
///
/// Push navigation inside the sheet:
///   Intro → InviteForm → InviteSent
///
/// The CTAs are end-to-end functional in the demo sense: tapping
/// "Add a buddy now" pushes a real form, "Send invite" persists the
/// dummy buddy via @AppStorage and shows a success screen with a real
/// iOS share-sheet on a stub link. Backend wire-up (POST /buddy/invite)
/// replaces the SimulatedBuddyService stub when that lands.
private struct BuddyApplyIntroView: View {
    let language: CivicaLanguage
    @Binding var buddyName: String
    @Binding var buddyContact: String
    let onDismiss: () -> Void

    @Environment(\.dismiss) private var dismiss

    /// On re-entry with an existing buddy, jump straight to the sent
    /// screen so the user can re-share or remove. Set on appear so the
    /// NavigationStack push animation runs naturally.
    @State private var deepLinkToSent: Bool = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    header
                    stepsCard
                    ctaStack
                    comingSoonNote
                }
                .padding(CivicaSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        onDismiss()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(CivicaColors.graphite.opacity(0.6))
                    }
                    .accessibilityLabel("Close")
                }
            }
            .navigationDestination(isPresented: $deepLinkToSent) {
                BuddyInviteSentView(
                    language: language,
                    buddyName: $buddyName,
                    buddyContact: $buddyContact,
                    onDone: {
                        onDismiss()
                        dismiss()
                    }
                )
            }
            .onAppear {
                if !buddyName.isEmpty {
                    deepLinkToSent = true
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: "person.2.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(width: 56, height: 56)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                            .fill(CivicaColors.pinePrimary.opacity(0.14))
                    )
                    .accessibilityHidden(true)
                Spacer()
            }
            Text(CivicaSNAPFlowStrings.buddyModalEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .kerning(1.2)
            Text(CivicaSNAPFlowStrings.buddyModalTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(CivicaSNAPFlowStrings.buddyModalSubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var stepsCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            stepRow(
                number: 1,
                icon: "pencil.and.list.clipboard",
                title: CivicaSNAPFlowStrings.buddyStep1Title.value(in: language),
                body: CivicaSNAPFlowStrings.buddyStep1Body.value(in: language)
            )
            Divider().background(CivicaColors.hairline)
            stepRow(
                number: 2,
                icon: "link",
                title: CivicaSNAPFlowStrings.buddyStep2Title.value(in: language),
                body: CivicaSNAPFlowStrings.buddyStep2Body.value(in: language)
            )
            Divider().background(CivicaColors.hairline)
            stepRow(
                number: 3,
                icon: "checklist",
                title: CivicaSNAPFlowStrings.buddyStep3Title.value(in: language),
                body: CivicaSNAPFlowStrings.buddyStep3Body.value(in: language)
            )
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func stepRow(number: Int, icon: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            ZStack {
                Circle()
                    .fill(CivicaColors.pinePrimary)
                    .frame(width: 32, height: 32)
                Text("\(number)")
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText)
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                HStack(spacing: CivicaSpacing.xs) {
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .accessibilityHidden(true)
                    Text(title)
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                }
                Text(body)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number). \(title). \(body)")
    }

    private var ctaStack: some View {
        VStack(spacing: CivicaSpacing.sm) {
            NavigationLink {
                BuddyInviteFormView(
                    language: language,
                    buddyName: $buddyName,
                    buddyContact: $buddyContact,
                    onDone: {
                        onDismiss()
                        dismiss()
                    }
                )
            } label: {
                Text(CivicaSNAPFlowStrings.buddyModalPrimaryCTA.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .fill(CivicaColors.pinePrimary)
                    )
            }
            .buttonStyle(.plain)
            Button {
                onDismiss()
                dismiss()
            } label: {
                Text(CivicaSNAPFlowStrings.buddyModalSecondaryCTA.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.plain)
        }
    }

    private var comingSoonNote: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: "info.circle")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
            Text(CivicaSNAPFlowStrings.buddyModalComingSoon.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Buddy invite form (dummy)

/// Name + channel + contact form for the dummy invite flow. On
/// "Send invite" simulates a 700ms RPC round-trip with a progress
/// spinner, writes the buddy to @AppStorage, and pushes the success
/// screen. No real network call; backend wire-up swaps the sleep for
/// a POST /buddy/invite.
private struct BuddyInviteFormView: View {
    enum Channel: String, CaseIterable, Identifiable {
        case sms, email
        var id: String { rawValue }
    }

    let language: CivicaLanguage
    @Binding var buddyName: String
    @Binding var buddyContact: String
    let onDone: () -> Void

    @State private var nameDraft: String = ""
    @State private var contactDraft: String = ""
    @State private var channel: Channel = .sms
    @State private var isSending: Bool = false
    @State private var navigateToSent: Bool = false

    private var canSend: Bool {
        !nameDraft.trimmingCharacters(in: .whitespaces).isEmpty &&
        !contactDraft.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text(CivicaSNAPFlowStrings.buddyFormSubtitle.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                nameField
                channelPicker
                contactField
                privacyNote
                sendButton
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(CivicaSNAPFlowStrings.buddyFormTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $navigateToSent) {
            BuddyInviteSentView(
                language: language,
                buddyName: $buddyName,
                buddyContact: $buddyContact,
                onDone: onDone
            )
        }
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(CivicaSNAPFlowStrings.buddyFormNameLabel.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
            TextField(
                CivicaSNAPFlowStrings.buddyFormNamePlaceholder.value(in: language),
                text: $nameDraft
            )
            .textContentType(.name)
            .padding(CivicaSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .fill(CivicaColors.surfaceSecondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private var channelPicker: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(CivicaSNAPFlowStrings.buddyFormChannelLabel.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
            Picker("Channel", selection: $channel) {
                Text(CivicaSNAPFlowStrings.buddyFormChannelSMS.value(in: language)).tag(Channel.sms)
                Text(CivicaSNAPFlowStrings.buddyFormChannelEmail.value(in: language)).tag(Channel.email)
            }
            .pickerStyle(.segmented)
            .onChange(of: channel) { _, _ in contactDraft = "" }
        }
    }

    private var contactField: some View {
        TextField(
            channel == .sms
                ? CivicaSNAPFlowStrings.buddyFormContactPlaceholderSMS.value(in: language)
                : CivicaSNAPFlowStrings.buddyFormContactPlaceholderEmail.value(in: language),
            text: $contactDraft
        )
        .keyboardType(channel == .sms ? .phonePad : .emailAddress)
        .textContentType(channel == .sms ? .telephoneNumber : .emailAddress)
        .autocapitalization(.none)
        .padding(CivicaSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .fill(CivicaColors.surfaceSecondary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var privacyNote: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "lock.shield")
                .foregroundStyle(CivicaColors.pinePrimary)
                .accessibilityHidden(true)
            Text(CivicaSNAPFlowStrings.buddyFormPrivacyNote.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.pineSurface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private var sendButton: some View {
        Button {
            sendInvite()
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                if isSending {
                    ProgressView()
                        .tint(CivicaColors.onPrimaryText)
                }
                Text(CivicaSNAPFlowStrings.buddyFormSendCTA.value(in: language))
            }
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.onPrimaryText)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .fill(canSend ? CivicaColors.pinePrimary : CivicaColors.pinePrimaryDisabled)
            )
        }
        .buttonStyle(.plain)
        .disabled(!canSend || isSending)
    }

    private func sendInvite() {
        let trimmedName = nameDraft.trimmingCharacters(in: .whitespaces)
        let trimmedContact = contactDraft.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty, !trimmedContact.isEmpty else { return }
        isSending = true
        // Simulated round-trip — replace with POST /buddy/invite when
        // the iOS side of buddy wire-up lands.
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 700_000_000)
            buddyName = trimmedName
            buddyContact = trimmedContact
            isSending = false
            navigateToSent = true
        }
    }
}

// MARK: - Buddy invite sent (dummy)

/// Success surface. Displays the buddy's name, a stub invite link with
/// a real iOS ShareLink so the share sheet actually opens, and a
/// "Remove buddy" path that clears the @AppStorage bindings. The link
/// itself is a deterministic stub keyed on the saved contact —
/// good enough for screenshots / demos without making any real network
/// call. Replace with the gateway's returned `invite_url` once
/// POST /buddy/invite is wired up.
private struct BuddyInviteSentView: View {
    let language: CivicaLanguage
    @Binding var buddyName: String
    @Binding var buddyContact: String
    let onDone: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var inviteLink: URL {
        // Deterministic stub. Hash the contact so the link looks
        // unique per buddy without exposing the actual PII in the path.
        let token = String(abs(buddyContact.hashValue), radix: 36).prefix(10)
        return URL(string: "https://civica.app/b/\(token)")!
    }

    private var shareMessage: String {
        switch language {
        case .english:
            return "Hey \(buddyName) — I'm applying for SNAP through Civica and could use a buddy to help me stay on top of deadlines. Tap this private link to follow along: \(inviteLink.absoluteString)"
        case .spanish:
            return "Hola \(buddyName) — Estoy solicitando SNAP a través de Civica y me ayudaría tener un compañero pendiente de las fechas. Toca este enlace privado para seguir el proceso: \(inviteLink.absoluteString)"
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                successHeader
                linkCard
                shareButton
                Divider().padding(.vertical, CivicaSpacing.sm)
                doneButton
                removeButton
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
    }

    private var successHeader: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 44))
                .foregroundStyle(CivicaColors.pinePrimary)
                .accessibilityHidden(true)
            Text(CivicaSNAPFlowStrings.buddyInviteSentTitle(name: buddyName, language: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(CivicaSNAPFlowStrings.buddyInviteSentBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, CivicaSpacing.sm)
    }

    private var linkCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(CivicaSNAPFlowStrings.buddyInviteSentLinkLabel.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)
            HStack {
                Text(inviteLink.absoluteString)
                    .font(CivicaTypography.footnoteStrong.monospaced())
                    .foregroundStyle(CivicaColors.ink)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
                Image(systemName: "link")
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .accessibilityHidden(true)
            }
            .padding(CivicaSpacing.md)
            .background(CivicaColors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private var shareButton: some View {
        ShareLink(item: shareMessage, subject: Text("Civica buddy invite")) {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "square.and.arrow.up")
                Text(CivicaSNAPFlowStrings.buddyInviteSentShareCTA.value(in: language))
            }
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.onPrimaryText)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .fill(CivicaColors.pinePrimary)
            )
        }
    }

    private var doneButton: some View {
        Button {
            onDone()
        } label: {
            Text(CivicaSNAPFlowStrings.buddyInviteSentDoneCTA.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .strokeBorder(CivicaColors.pinePrimary, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private var removeButton: some View {
        Button(role: .destructive) {
            buddyName = ""
            buddyContact = ""
            dismiss()
        } label: {
            Text(CivicaSNAPFlowStrings.buddyInviteSentRemoveCTA.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.brickAccent)
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.plain)
    }
}

#if DEBUG
struct CivicaSNAPFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            CivicaSNAPFlowView(language: .english)
                .environmentObject(SNAPApplicationStatusStore())
        }
    }
}
#endif
