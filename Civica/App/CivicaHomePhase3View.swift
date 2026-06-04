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

    /// Mirrors the gear toggle so the EBT dashboard auto-seeds when
    /// a reviewer is exploring the Enrolled surface via demo mode.
    @AppStorage(CivicaAppStorageKeys.demoUnlockAllPhases)
    private var demoUnlockAllPhases: Bool = false
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

    // JR-4 / UD-7 / ARCH-3 / CQ-5 (audit 2026-05-29): approval banner
    // persistence + flavor selection. `approvalAcknowledged` is set true
    // on dismiss or EBT-card link. `hasBeenApprovedBefore` drives the
    // .firstApproval vs .renewal flavor. Reset rules (handled by
    // SNAPApprovalAcknowledgmentResetter in the onChange below):
    //   - any → .notStarted: both flags clear (fresh case).
    //   - .recertDue → .decisionApproved: acknowledged clears so the
    //     renewal-flavor banner re-fires; hasBeenApprovedBefore stays.
    @AppStorage(CivicaAppStorageKeys.approvalAcknowledged)
    private var approvalAcknowledged: Bool = false
    @AppStorage(CivicaAppStorageKeys.hasBeenApprovedBefore)
    private var hasBeenApprovedBefore: Bool = false

    @State private var showingApprovalExplainer: Bool = false
    @State private var navigateToFindHelp: Bool = false

    /// IS-2 (audit 2026-05-29) — coordinated sync-degraded banner.
    /// Same pattern as `CivicaHomePhase2View`. Phase 3 only owns one
    /// remote store (`EBTBalanceStore`), so cross-store coordination
    /// can't reach the 2-failure threshold on its own; the
    /// `NWPathMonitor` offline signal is what realistically surfaces
    /// the banner here. Per-row hides stay intact.
    @StateObject private var syncBanner = CivicaSyncBannerCoordinator()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                // IS-2 (audit 2026-05-29): coordinated sync-degraded
                // banner sits above the phase tab so it's the first
                // thing the user sees when remote data is failing.
                CivicaSyncBanner(coordinator: syncBanner, language: language)

                phaseTab

                approvalBanner

                balanceHeroOrPlaceholder

                // The "Will it last?" projection now lives inside the
                // hero card itself (PROJECTED TO LAST slot, wired in
                // balanceHero via EBTBalanceInsights.projection). The
                // standalone card that previously rendered here was
                // showing the same number twice — removed.

                // Top-3 transactions preview + See-all link.
                recentActivityPreview

                // Recertify reminder — surface ahead of recert window
                // so the user has runway to gather paperwork.
                recertifyOnTimeCard

                // Dormancy nudge — only fires when card has gone unused
                // long enough that CalFresh's 9-month rule is in play.
                useItOrLoseItCard

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
        // Nav wheat removed — CivicaEBTBalanceHeroCard carries the wheat sticker now.
        .navigationDestination(isPresented: $navigateToFindHelp) {
            FindHelpRootView()
        }
        .sheet(isPresented: $showingApprovalExplainer) {
            SNAPApprovalExplainerView(language: language)
        }
        // CQ-5: apply the reset rules on every status transition. The
        // resetter writes through the same UserDefaults keys the
        // @AppStorage props above observe, so a transition causes the
        // banner to re-render on the next runloop tick.
        .onChange(of: statusStore.status) { oldValue, newValue in
            SNAPApprovalAcknowledgmentResetter().handleTransition(from: oldValue, to: newValue)
        }
        // JR-4: linking the EBT card auto-acknowledges the banner.
        // EBTBalanceStore exposes linkState as a @Published value; this
        // keeps the banner-acknowledgment concern out of the store.
        .onChange(of: ebtStore.linkState) { _, newValue in
            if newValue == .linked {
                SNAPApprovalAcknowledgmentResetter().acknowledge()
            }
        }
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
        .onAppear {
            // Demo-mode seeding: a reviewer who jumped to Phase 3 via
            // the gear toggle hasn't linked an EBT card, so the
            // dashboard would show the empty link form instead of the
            // populated balance + transaction surfaces this phase is
            // *about*. Seed an in-memory demo account so they can see
            // the real Phase 3 experience. No persistence — flipping
            // demo mode off and relaunching restores the user's actual
            // linkState.
            if demoUnlockAllPhases {
                ebtStore.seedDemoAccountIfNeeded()
            }
        }
        // IS-2 (audit 2026-05-29): bridge the EBT store's refresh
        // outcome into the sync banner coordinator. Per-row hide on
        // failure stays intact (the dashboard already shows its own
        // inline error banner via `lastRefreshError`); this signal
        // feeds the coordinated top-of-screen banner. Phase 3 only
        // owns one remote store, so reaching the 2-failure threshold
        // here requires repeated refreshes — but the `NWPathMonitor`
        // offline path still surfaces the banner on connectivity loss.
        .onChange(of: ebtStore.lastRefreshError == nil) { _, isOK in
            if isOK {
                syncBanner.registerStoreSuccess()
            } else {
                syncBanner.registerStoreFailure()
            }
        }
    }

    // MARK: - Approval banner (JR-4 / UD-7 / CQ-5)

    /// Shown the moment `.decisionApproved` lands and the user hasn't
    /// yet linked an EBT card OR dismissed the banner. Sits ABOVE the
    /// existing "card is on the way" placeholder (different roles —
    /// the banner is the celebration-substitute moment, the placeholder
    /// is the persistent link affordance).
    @ViewBuilder
    private var approvalBanner: some View {
        if statusStore.status == .decisionApproved,
           ebtStore.account == nil,
           !approvalAcknowledged {
            SNAPApprovalBannerCard(
                flavor: hasBeenApprovedBefore ? .renewal : .firstApproval,
                language: language,
                onWhatThisMeans: { showingApprovalExplainer = true },
                onFindHelp: { navigateToFindHelp = true },
                onDismiss: { SNAPApprovalAcknowledgmentResetter().acknowledge() }
            )
        }
    }

    // MARK: - Phase tab

    /// Production: locked journey indicator (.enroll ✓ + .pending ✓
    /// + .enrolled current). DEBUG with an injected change handler:
    /// free toggle for engineers / QA.
    @ViewBuilder
    private var phaseTab: some View {
        // Phase picker has moved into the gear settings sheet so it
        // never appears on the applicant-facing home. See
        // CivicaEntryView.phaseTab for the rationale.
        EmptyView()
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
            projectedThrough: projectedThroughLabel(for: account)
        )
    }

    /// Real projected-zero date computed from the account's purchases
    /// over the last 30 days. Falls back to the placeholder copy when
    /// there isn't enough signal (fewer than 3 purchases in the
    /// window) so the hero never reads an empty slot.
    private func projectedThroughLabel(for account: EBTAccount) -> String {
        let balance = (account.foodBalance as NSDecimalNumber).doubleValue
        guard let projection = EBTBalanceInsights.projection(
            balance: balance,
            transactions: account.transactions,
            nextDeposit: account.nextDeposit
        ) else {
            return CivicaPhase3Strings.projectedThroughPlaceholder.value(in: language)
        }
        let date = DateFormatter.localizedString(
            from: projection.projectedZeroDate,
            dateStyle: .medium,
            timeStyle: .none
        )
        return date
    }

    /// "Your card is on the way" placeholder for approved users who
    /// haven't yet linked an EBT card. The dark-pine hero would feel
    /// wrong here — we don't have a balance to show — so use a
    /// quieter pine-surface card that points them to the link flow.
    private var cardOnTheWayCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(CivicaPhase3Strings.unlinkedEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                // §2.2: uppercase-kerned eyebrow labels use graphite, not pine.
                .foregroundStyle(CivicaColors.graphite)
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
                            .imageScale(.large)
                            .font(.body)
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
                                .imageScale(.large)
                                .font(.body)
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

    // MARK: - Recent activity preview

    /// Top-3 transactions with a See-all link into the full EBT
    /// dashboard. Hidden when the account has no transactions so the
    /// card doesn't ship an empty "Recent activity" header.
    @ViewBuilder
    private var recentActivityPreview: some View {
        if let account = ebtStore.account, !account.transactions.isEmpty {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text(EBTBalanceStrings.recentActivityEyebrow.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                    .padding(.horizontal, CivicaSpacing.xs)

                let top = Array(account.transactions.prefix(3))
                VStack(spacing: 0) {
                    ForEach(Array(top.enumerated()), id: \.element.id) { index, txn in
                        compactTransactionRow(txn)
                        if index < top.count - 1 {
                            Divider().overlay(CivicaColors.hairline)
                        }
                    }
                    Divider().overlay(CivicaColors.hairline)
                    NavigationLink {
                        EBTBalanceRootView()
                    } label: {
                        HStack(spacing: CivicaSpacing.xs) {
                            Text(CivicaPhase3Strings.seeAllActivity.value(in: language))
                                .font(CivicaTypography.footnoteStrong)
                            Image(systemName: "chevron.right")
                                .imageScale(.small)
                                .accessibilityHidden(true)
                        }
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(CivicaSpacing.md)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
            }
        }
    }

    private func compactTransactionRow(_ txn: EBTTransaction) -> some View {
        let tint = txn.isDeposit ? CivicaColors.amberPrimary : CivicaColors.brickAccent
        return HStack(spacing: CivicaSpacing.md) {
            ZStack {
                Circle().fill(tint.opacity(0.12))
                if txn.isDeposit {
                    Image(systemName: "arrow.down")
                        .imageScale(.medium)
                        .foregroundStyle(tint)
                } else {
                    Text(txn.monogram)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(tint)
                }
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(txn.merchant)
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
                    .lineLimit(1)
                Text(shortDate(txn.date))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
            Spacer(minLength: 0)
            Text(formattedAmount(txn))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(txn.isDeposit ? CivicaColors.amberPrimary : CivicaColors.ink)
                .monospacedDigit()
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
    }

    private func shortDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return language == .spanish ? "Hoy" : "Today"
        }
        if calendar.isDateInYesterday(date) {
            return language == .spanish ? "Ayer" : "Yesterday"
        }
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f.string(from: date)
    }

    private func formattedAmount(_ txn: EBTTransaction) -> String {
        let value = (txn.amount as NSDecimalNumber).doubleValue
        let abs = Swift.abs(value)
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.maximumFractionDigits = 2
        f.minimumFractionDigits = abs < 100 && value.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
        let body = f.string(from: NSNumber(value: abs)) ?? "$\(abs)"
        return txn.isDeposit ? "+\(body)" : "-\(body)"
    }

    // MARK: - Recertify on time reminder

    /// Surfaces when the user has been approved long enough that
    /// recertification is a real planning concern, but `.recertDue`
    /// hasn't yet flipped (which has its own dedicated surface). For
    /// the demo, fires whenever Phase 3 is the home — once a real
    /// recert-date wiring lands the predicate should gate on a 60-day
    /// proximity window.
    @ViewBuilder
    private var recertifyOnTimeCard: some View {
        if ebtStore.account != nil {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: "calendar.badge.clock")
                    .imageScale(.large)
                    .font(.body)
                    // §2.2: decorative leading info glyph uses accentTeal, not pine.
                    .foregroundStyle(CivicaColors.accentTeal)
                    .frame(width: 28, alignment: .leading)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(CivicaPhase3Strings.recertifyHeadline.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(CivicaPhase3Strings.recertifyBody.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: - Use it or lose it (dormancy nudge)

    /// California removes benefits left completely unused for 9 months.
    /// Show only when the most recent purchase is older than 6 months
    /// (gives the user three months of warning). Hidden in all other
    /// cases so the home doesn't ship a noise card.
    @ViewBuilder
    private var useItOrLoseItCard: some View {
        if let account = ebtStore.account,
           let lastPurchase = account.transactions
               .filter({ !$0.isDeposit })
               .map(\.date)
               .max(),
           let sixMonthsAgo = Calendar.current.date(byAdding: .month, value: -6, to: Date()),
           lastPurchase < sixMonthsAgo {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: "hourglass")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.warningAmber)
                    .frame(width: 28, alignment: .leading)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(CivicaPhase3Strings.dormancyHeadline.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(CivicaPhase3Strings.dormancyBody.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.warningAmber.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.warningAmber.opacity(0.4), lineWidth: 1)
            )
            .accessibilityElement(children: .combine)
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
            // Account services — paired with Card security as the two
            // utility rows applicants need without drilling into the
            // full EBT dashboard.
            NavigationLink {
                EBTAccountServicesView()
            } label: {
                secondaryRowLabel(
                    icon: "phone.bubble",
                    eyebrow: CivicaPhase3Strings.accountServicesEyebrow.value(in: language),
                    link: CivicaPhase3Strings.accountServicesLink.value(in: language)
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
                            .imageScale(.large)
                            .font(.body)
                            // §2.2: decorative trailing glyph uses graphite, not pine.
                            .foregroundStyle(CivicaColors.graphite)
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
                .imageScale(.large)
                .font(.body)
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
        case .english, .mandarin, .vietnamese, .tagalog: return "Updated \(time)"
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
        case .english, .mandarin, .vietnamese, .tagalog:
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
        case .english, .mandarin, .vietnamese, .tagalog:
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
    static let accountServicesEyebrow = CivicaText("EBT account", es: "Cuenta EBT")
    static let accountServicesLink    = CivicaText("Account services", es: "Servicios de cuenta")
    static let findHelpEyebrow = CivicaText("In your neighborhood", es: "En tu vecindario")
    static let findHelpLink    = CivicaText("Find help nearby", es: "Encuentra ayuda cerca")

    // See-all CTA at the bottom of the recent-activity preview card.
    static let seeAllActivity = CivicaText(
        "See all activity",
        es: "Ver toda la actividad"
    )

    // Recertify-on-time reminder card.
    static let recertifyHeadline = CivicaText(
        "Keep your benefits — recertify on time",
        es: "Mantén tus beneficios — recertifica a tiempo"
    )
    static let recertifyBody = CivicaText(
        "CalFresh has to be renewed periodically. Civica will remind you before your deadline so your benefits don't pause.",
        es: "CalFresh debe renovarse periódicamente. Civica te recordará antes de tu fecha límite para que tus beneficios no se pausen."
    )

    // Use-it-or-lose-it dormancy nudge.
    static let dormancyHeadline = CivicaText(
        "Use it or lose it",
        es: "Úsalo o piérdelo"
    )
    static let dormancyBody = CivicaText(
        "CalFresh removes benefits left completely unused for 9 months. Use your card to keep your balance.",
        es: "CalFresh elimina los beneficios sin usar durante 9 meses. Usa tu tarjeta para conservar tu saldo."
    )
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
