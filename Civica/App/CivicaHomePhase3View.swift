import CivicaDesignSystem
import SwiftUI

// Phase 3 (Enrolled) of the three-phase main screen, from the May
// 2026 design pack. Rendered by CivicaRootView.rootSurface when
// status is .decisionApproved — the user has been approved for
// CalFresh and is the relationship moves from "applicant" to
// "recipient." The EBT balance card replaces the apply hero as the
// new center of gravity.
//
// Recert flow: the recert banner surfaces conditionally inside this
// view when within the recert window (per memory: ~30-45 days out).
// Once status flips to .recertDue, the existing routing in
// CivicaRootView.rootSurface still wins — that branch routes to
// SNAPRecertificationView or RecertCompanionRoot. So this view only
// renders the "approved + currently enrolled" main-screen state,
// not the recert-due main-screen state.
//
// Wiring state (May 2026): visual matches the design pack. EBT
// balance pulls from a @StateObject EBTBalanceStore so the hero
// reflects real account data when linked. Inbound messages row
// gates on a flag — wire to a real messages-inbox store once that
// ships. The map preview is a static SF Symbol icon at the trailing
// edge of the find-help row, not a live mini-map — the live preview
// belongs in FindHelpRootView, not on the home.

struct CivicaHomePhase3View: View {
    @ObservedObject var statusStore: SNAPApplicationStatusStore
    let language: CivicaLanguage
    let onOpenExternalPortal: () -> Void

    /// Optional handler so a DEBUG `CivicaPhaseTab` can swap the
    /// rendered phase from outside this view. Production ignores.
    var onDebugPhaseChange: ((CivicaPhase) -> Void)? = nil

    // MARK: - HIDDEN UNTIL BACKEND
    //
    // TODO wiring: replace with real messages-inbox store once that
    // ships. Defaults hide the row in production (never shows a fake
    // row to the user). Ledger: docs/runbooks/wiring-todo.md (audit IS-7).
    var unreadMessageCount: Int = 0
    var mostRecentMessageSender: String = ""
    var mostRecentMessageTopic: String = ""

    // EBT data — sourced from the same store the dashboard uses so
    // the hero reflects whatever the user sees inside the EBT root.
    @StateObject private var ebtStore: EBTBalanceStore = EBTBalanceStore()

    // IS-8 (audit 2026-05-29): true on first render, flipped false at
    // the end of the `.task` below. While true AND `ebtStore.account`
    // is nil, the EBT hero slot renders a shimmered skeleton instead
    // of jumping straight to the "card on the way" placeholder — so
    // returning users with a linked card don't see the placeholder
    // flash before the real balance hero resolves.
    @State private var isFirstPaintLoading: Bool = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                phaseTab

                balanceHeroOrPlaceholder

                if unreadMessageCount > 0 {
                    CivicaActionRow(
                        icon: "envelope",
                        primary: CivicaPhase3Strings
                            .unreadMessagesHeadline(count: unreadMessageCount, language: language),
                        secondary: messagesSecondary,
                        action: onOpenExternalPortal
                    )
                }

                recertBanner

                hairline

                secondaryRows

                Spacer(minLength: CivicaSpacing.xl)
                privacyFooterLink
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            // IS-8: one-shot first-paint settle. The EBT store
            // initializes synchronously, so the skeleton only renders
            // for the brief window before the next render pass picks
            // up the resolved account — that's by design (per audit
            // IS-8: "if the data loads in <100ms the skeleton is
            // barely visible, which is fine"). Yield so the first
            // body() completes before flipping the flag.
            await Task.yield()
            isFirstPaintLoading = false
        }
    }

    // MARK: - Phase tab

    /// Production: locked journey indicator (.enroll ✓ + .pending ✓
    /// + .enrolled current). DEBUG with an injected change handler:
    /// free toggle for engineers / QA.
    @ViewBuilder
    private var phaseTab: some View {
        #if DEBUG
        if let onDebugPhaseChange {
            CivicaPhaseTab(current: .enrolled, onChange: onDebugPhaseChange)
        } else {
            CivicaPhaseTab(lockedJourneyAt: .enrolled)
        }
        #else
        CivicaPhaseTab(lockedJourneyAt: .enrolled)
        #endif
    }

    // MARK: - EBT balance hero (or fallback)

    @ViewBuilder
    private var balanceHeroOrPlaceholder: some View {
        if let account = ebtStore.account {
            balanceHero(for: account)
        } else if isFirstPaintLoading {
            // IS-8: skeleton slot for the EBT hero card while the
            // first-paint load resolves. Matches the dashboard's
            // existing shimmer pattern so the two surfaces feel of a
            // piece.
            VStack(spacing: CivicaSpacing.lg) {
                CivicaSkeletonRow(height: 96, cornerRadius: CivicaRadius.card)
                CivicaSkeletonRow(height: 56)
            }
        } else {
            NavigationLink {
                EBTBalanceRootView()
            } label: {
                cardOnTheWayCard
            }
            .buttonStyle(.plain)
        }
    }

    private func balanceHero(for account: EBTAccount) -> some View {
        let dollars = (account.foodBalance as NSDecimalNumber).intValue
        let centsDecimal = (account.foodBalance - Decimal(dollars)) * 100
        let cents = (centsDecimal as NSDecimalNumber).intValue
        return CivicaEBTBalanceHeroCard(
            balanceDollars: dollars,
            balanceCents: cents,
            updatedTimestamp: updatedLabel(for: account.lastUpdated),
            nextDepositAmount: formattedNextDeposit(account),
            nextDepositDate: formattedNextDepositDate(account),
            projectedThrough: CivicaPhase3Strings.projectedThroughPlaceholder.value(in: language)
        )
    }

    /// "Your card is on the way" placeholder for approved users who
    /// haven't yet linked an EBT card. The dark-pine hero would feel
    /// wrong here — we don't have a balance to show — so use a
    /// quieter pine-surface card that points them to the link flow.
    private var cardOnTheWayCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(CivicaPhase3Strings.unlinkedEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.pinePrimary)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(CivicaPhase3Strings.unlinkedHeadline.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(CivicaPhase3Strings.unlinkedBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: CivicaSpacing.sm) {
                Text(CivicaPhase3Strings.unlinkedCTA.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                Image(systemName: "arrow.right")
                    .foregroundStyle(CivicaColors.pinePrimary)
            }
            .padding(.top, CivicaSpacing.xs)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.pineSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private func updatedLabel(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return CivicaPhase3Strings.updatedPrefix(time: formatter.string(from: date), language: language)
    }

    private func formattedNextDeposit(_ account: EBTAccount) -> String {
        guard let deposit = account.nextDeposit else { return "—" }
        let amount = (deposit.amount as NSDecimalNumber).doubleValue
        // IS-6 (audit 2026-05-29): "$%.2f" so the next-deposit line
        // renders dollars+cents, matching the hero balance directly
        // above it (which shows e.g. "$194.00"). "$%.0f" stripped the
        // cents and read as a visible mismatch on the same EBT card.
        return String(format: "$%.2f", amount)
    }

    private func formattedNextDepositDate(_ account: EBTAccount) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        let date = account.nextDeposit?.expectedDate ?? Date().addingTimeInterval(60 * 60 * 24 * 14)
        return formatter.string(from: date)
    }

    // MARK: - Recert banner (conditional)

    @ViewBuilder
    private var recertBanner: some View {
        if let dueDate = statusStore.timestamp(for: .recertDue) {
            let interval = dueDate.timeIntervalSinceNow
            let days = Int(interval / 86400)
            if days > 0 && days <= 45 {
                NavigationLink {
                    RecertCompanionRoot()
                } label: {
                    HStack(spacing: CivicaSpacing.md) {
                        Image(systemName: "clock.arrow.circlepath")
                            .font(.system(size: 22))
                            .foregroundStyle(CivicaColors.warningAmber)
                            .frame(width: 36, height: 36)
                            .background(
                                Circle()
                                    .fill(CivicaColors.warningAmber.opacity(0.16))
                            )
                            .accessibilityHidden(true)
                        // JR-5 (audit 2026-05-29): banner leads with continuity
                        // reassurance ("Renew your CalFresh — we'll pre-fill what we
                        // have"), demotes the deadline countdown to a metadata line.
                        // Recert is a renewal moment for an already-approved user,
                        // not a fresh-application threat — the headline now mirrors
                        // that reality.
                        VStack(alignment: .leading, spacing: 2) {
                            Text(CivicaPhase3Strings.recertEyebrow.value(in: language))
                                .font(CivicaTypography.captionStrong)
                                .foregroundStyle(CivicaColors.warningAmber)
                                .textCase(.uppercase)
                                .kerning(1.2)
                            Text(CivicaPhase3Strings.recertHeadline.value(in: language))
                                .font(CivicaTypography.subheadStrong)
                                .foregroundStyle(CivicaColors.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(CivicaPhase3Strings.recertDueIn(date: dueDate, days: days, language: language))
                                .font(CivicaTypography.footnote)
                                .foregroundStyle(CivicaColors.graphite)
                        }
                        Spacer(minLength: CivicaSpacing.sm)
                        HStack(spacing: 4) {
                            Text(CivicaPhase3Strings.recertStartCTA.value(in: language))
                                .font(CivicaTypography.subheadStrong)
                                .foregroundStyle(CivicaColors.warningAmber)
                            Image(systemName: "arrow.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(CivicaColors.warningAmber)
                        }
                    }
                    .padding(CivicaSpacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(CivicaColors.statusWarningSurface)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Secondary rows

    private var hairline: some View {
        Rectangle()
            .fill(CivicaColors.hairline)
            .frame(height: 1)
            .padding(.vertical, CivicaSpacing.xs)
    }

    private var secondaryRows: some View {
        VStack(alignment: .leading, spacing: 0) {
            // IA-3 (audit 2026-05-29): row routes to EBTCardLockView
            // (lock/freeze, report lost, change PIN) — a distinct dest
            // from the hero balance card, not a second entry to it.
            NavigationLink {
                EBTCardLockView(store: ebtStore, language: language)
            } label: {
                secondaryRowLabel(
                    icon: "lock.shield",
                    eyebrow: CivicaPhase3Strings.cardServicesEyebrow.value(in: language),
                    link: EBTBalanceStrings.lockScreenTitle.value(in: language)
                )
            }
            .buttonStyle(.plain)
            Rectangle()
                .fill(CivicaColors.hairline)
                .frame(height: 1)
            NavigationLink {
                FindHelpRootView()
            } label: {
                secondaryRowLabel(
                    icon: "fork.knife",
                    eyebrow: CivicaPhase3Strings.findHelpEyebrow.value(in: language),
                    link: CivicaPhase3Strings.findHelpLink.value(in: language),
                    trailing: AnyView(
                        Image(systemName: "mappin.circle")
                            .font(.system(size: 22))
                            .foregroundStyle(CivicaColors.pinePrimary)
                            .accessibilityHidden(true)
                    )
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func secondaryRowLabel(
        icon: String,
        eyebrow: String,
        link: String,
        trailing: AnyView? = nil
    ) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundStyle(CivicaColors.ink)
                .frame(width: 32, alignment: .leading)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(eyebrow)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                Text(link)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
            }
            Spacer(minLength: CivicaSpacing.sm)
            if let trailing {
                trailing
            } else {
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, CivicaSpacing.md)
        .padding(.horizontal, CivicaSpacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(eyebrow). \(link)")
    }

    // MARK: - Action row labels

    private var messagesSecondary: String? {
        let parts = [mostRecentMessageSender, mostRecentMessageTopic]
            .filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    // MARK: - Privacy footer

    private var privacyFooterLink: some View {
        NavigationLink {
            SNAPDataPrivacyView(language: language)
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "lock.shield")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                Text(CivicaEntryStrings.privacyLink.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .underline()
                Text(CivicaEntryStrings.publicBenefitTag.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite.opacity(0.6))
                Spacer(minLength: 0)
            }
            .padding(.vertical, CivicaSpacing.sm)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Strings

enum CivicaPhase3Strings {
    // Unlinked card placeholder
    static let unlinkedEyebrow = CivicaText(
        "CalFresh",
        es: "CalFresh"
    )
    static let unlinkedHeadline = CivicaText(
        "Your EBT card is on the way",
        es: "Tu tarjeta EBT está en camino"
    )
    static let unlinkedBody = CivicaText(
        "Cards usually arrive within 3-7 days. Once it does, link it here to see your balance and recent activity.",
        es: "Las tarjetas usualmente llegan en 3-7 días. Cuando llegue, enlázala aquí para ver tu saldo y actividad reciente."
    )
    static let unlinkedCTA = CivicaText(
        "Link your EBT card",
        es: "Enlaza tu tarjeta EBT"
    )

    // Updated timestamp prefix
    static func updatedPrefix(time: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Updated \(time)"
        case .spanish: return "Actualizado \(time)"
        }
    }

    static let projectedThroughPlaceholder = CivicaText(
        "this cycle",
        es: "este ciclo"
    )

    // Recert banner
    static let recertEyebrow = CivicaText(
        "Recertification",
        es: "Recertificación"
    )
    /// JR-5 (audit 2026-05-29): continuity-led headline. Recert is renewal
    /// for an already-approved user; lead with the lighter lift, not the
    /// deadline. The deadline countdown still renders below as metadata.
    static let recertHeadline = CivicaText(
        "Renew your CalFresh — we'll pre-fill what we have",
        es: "Renueva tu CalFresh — usaremos los datos que ya tenemos"
    )
    static func recertDueIn(date: Date, days: Int, language: CivicaLanguage) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        let dateStr = formatter.string(from: date)
        switch language {
        case .english:
            return days == 1
                ? "Due \(dateStr) · 1 day"
                : "Due \(dateStr) · \(days) days"
        case .spanish:
            return days == 1
                ? "Vence \(dateStr) · 1 día"
                : "Vence \(dateStr) · \(days) días"
        }
    }
    static let recertStartCTA = CivicaText("Start", es: "Empezar")

    // Action row
    static func unreadMessagesHeadline(count: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english:
            return count == 1 ? "1 new message" : "\(count) new messages"
        case .spanish:
            return count == 1 ? "1 mensaje nuevo" : "\(count) mensajes nuevos"
        }
    }

    // Secondary rows
    // IA-3 (audit 2026-05-29): activityEyebrow/activityLink removed.
    // The row that used them duplicated the hero card's destination
    // (both went to EBTBalanceRootView). Replaced by a card-services
    // row routing to EBTCardLockView — the link string reuses
    // EBTBalanceStrings.lockScreenTitle so the two surfaces stay in
    // sync if the lock screen's name changes.
    static let cardServicesEyebrow = CivicaText("EBT card", es: "Tarjeta EBT")
    static let findHelpEyebrow = CivicaText("In your neighborhood", es: "En tu vecindario")
    static let findHelpLink    = CivicaText("Find help nearby", es: "Encuentra ayuda cerca")
}

#if DEBUG
struct CivicaHomePhase3View_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            CivicaHomePhase3View(
                statusStore: SNAPApplicationStatusStore(),
                language: .english,
                onOpenExternalPortal: {}
            )
        }
    }
}
#endif
