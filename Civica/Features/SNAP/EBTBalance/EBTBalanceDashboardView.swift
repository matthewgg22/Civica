import CivicaDesignSystem
import SwiftUI

// The linked-state dashboard for the Check EBT Balance feature — now a
// Propel-style feed: hero balance card (with locked + low-balance
// banners), spending-insights card, recent-activity list (tappable
// rows → detail sheet), deposit-schedule card, card-security row, and
// "free & discounted with EBT" + benefit-updates content sections.
//
// Phases: 1 hero card · 2 extracted view · 3 activity + refresh ·
// 4 card-lock · Tier 1/2 hyper-realism pass (this).

struct EBTBalanceDashboardView: View {
    @ObservedObject var store: EBTBalanceStore
    @ObservedObject var anomalyStore: EBTAnomalyStore
    @ObservedObject var offersStore: EBTOffersStore
    let language: CivicaLanguage
    let stateCode: String

    /// The transaction whose detail sheet is open, paired with the
    /// running balance after it posted.
    private struct TransactionDetail: Identifiable {
        let id: UUID
        let transaction: EBTTransaction
        let balanceAfter: Decimal
    }
    @State private var openDetail: TransactionDetail?
    /// Phase 2 Lane F: receipt scanner sheet state.
    @State private var isShowingReceiptScanner = false
    /// Amount of the most recent simulated deposit, shown as a
    /// transient "deposit landed" banner on the hero card. Cleared a
    /// few seconds after it posts.
    @State private var depositLanded: Decimal?
    /// Offer currently being confirmed for redemption.
    @State private var pendingRedemptionOffer: EBTOffer?

    var body: some View {
        ScrollView {
            if let account = store.account {
                let insights = EBTBalanceInsights(account: account)
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    // IS-1: refresh-failure banner. Sits ABOVE everything so
                    // users can't miss that the balance shown is stale.
                    if store.lastRefreshError != nil {
                        refreshErrorBanner
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }
                    // Anti-skimming anomaly banner — highest-severity first.
                    // Rendered above all status banners and the hero card so
                    // it can never be obscured. Lane F's "Scan receipt" button
                    // is injected BELOW spendingInsightsCard; no overlap here.
                    if !anomalyStore.activeAlerts.isEmpty {
                        EBTAnomalyBannerView(
                            alert: anomalyStore.activeAlerts[0],
                            store: anomalyStore,
                            language: language
                        )
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    // Status banners sit above the dark hero card so they
                    // can use their standard light-background styling.
                    if let landed = depositLanded {
                        banner(
                            icon: "checkmark.circle.fill",
                            text: EBTBalanceStrings.depositLandedBanner(amount: plainMoney(landed), language: language),
                            tint: CivicaColors.amberPrimary
                        )
                    }
                    if store.isCardLocked {
                        banner(icon: "lock.fill", text: EBTBalanceStrings.lockedBannerText.value(in: language))
                    }
                    if insights.isLowBalance {
                        banner(icon: "exclamationmark.circle.fill", text: EBTBalanceStrings.lowBalanceBanner.value(in: language))
                    }
                    heroCard(account, insights: insights)
                    projectionCard(account, insights: insights)
                    spendingInsightsCard(account, insights: insights)
                    // Phase 2 Lane F — receipt scanner entry point.
                    // Positioned below spending insights per plan; Lane G's
                    // anomaly banner will sit above the hero card (not here).
                    scanReceiptButton
                    if !account.transactions.isEmpty {
                        recentActivitySection(account, insights: insights)
                    }
                    depositScheduleCard(account)
                    expirationCard(insights)
                    cardSecurityRow
                    accountServicesRow
                    SavedByCivicaCard(
                        totalSavingsCents: offersStore.totalSavingsCents,
                        tallyLastUpdated: offersStore.tallyLastUpdated,
                        language: language
                    )
                    perksSection
                    newsSection
                    demoDisclosure
                    unlinkLink
                }
                .padding(CivicaSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .onAppear {
            Task {
                await offersStore.refresh(
                    packetCountyFips: nil,
                    currentCountyFips: nil,
                    stateCode: stateCode
                )
            }
        }
        .refreshable { await store.refresh() }
        .toolbar { demoToolbarMenu }
        .sheet(item: $pendingRedemptionOffer) { offer in
            EBTRedeemConfirmSheet(offer: offer, language: language) { savingsCents in
                Task { try? await offersStore.repository.recordRedemption(offerId: offer.id, savingsCents: savingsCents) }
            }
        }
        .sheet(item: $openDetail) { detail in
            EBTTransactionDetailSheet(
                transaction: detail.transaction,
                balanceAfter: detail.balanceAfter,
                language: language,
                onDone: { openDetail = nil }
            )
        }
        // Phase 2 Lane F — receipt camera sheet.
        .fullScreenCover(isPresented: $isShowingReceiptScanner) {
            EBTReceiptCaptureView { image, ocr in
                isShowingReceiptScanner = false
                // Phase 2: wire to EBTReceiptsStore when injected here.
                // For now the button surfaces the camera; store wiring is in
                // EBTReceiptCaptureSheet which callers can use directly.
                _ = (image, ocr)
            }
        }
    }

    // MARK: - IS-1 refresh error banner (audit 2026-05-29)

    /// Dismissible amber-warning banner shown above the hero card when
    /// `store.lastRefreshError != nil`. Retry is disabled while a
    /// refresh is in flight (PF-1 coalesce); the store enforces the
    /// 3s cooldown internally so the button stays interactive.
    private var refreshErrorBanner: some View {
        let asOfString = store.lastSuccessfulRefreshAt.map(shortTimestamp)
        let bodyText: String = {
            if let asOf = asOfString {
                return EBTBalanceStrings.refreshErrorBannerBody(asOf: asOf, language: language)
            }
            return EBTBalanceStrings.refreshErrorBannerNoTimestamp.value(in: language)
        }()

        return VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                Image(systemName: "exclamationmark.triangle")
                    .foregroundStyle(CivicaColors.warningAmber)
                    .accessibilityHidden(true)
                Text(bodyText)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: CivicaSpacing.sm)
                Button {
                    store.clearRefreshError()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(CivicaColors.graphite)
                        .padding(4)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(EBTBalanceStrings.refreshErrorDismiss.value(in: language))
            }
            HStack {
                Spacer(minLength: 0)
                Button {
                    Task { await store.refresh() }
                } label: {
                    HStack(spacing: CivicaSpacing.xs) {
                        if store.isRefreshing {
                            ProgressView()
                                .controlSize(.small)
                                .tint(CivicaColors.pinePrimary)
                        }
                        Text(EBTBalanceStrings.refreshErrorRetry.value(in: language))
                            .font(CivicaTypography.captionStrong)
                            .foregroundStyle(CivicaColors.pinePrimary)
                    }
                    .padding(.horizontal, CivicaSpacing.sm)
                    .padding(.vertical, 6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .strokeBorder(CivicaColors.pinePrimary, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(store.isRefreshing)
                .accessibilityLabel(EBTBalanceStrings.refreshErrorRetry.value(in: language))
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.statusWarningSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .strokeBorder(CivicaColors.warningAmber.opacity(0.4), lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
            EBTBalanceStrings.refreshErrorAccessibilityLabel(
                asOf: asOfString,
                language: language
            )
        )
    }

    /// Short-style local time, e.g. "2:30 PM". Used in the IS-1 banner.
    private func shortTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: language == .spanish ? "es" : "en")
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }

    /// IS-1 / T14: the hero "Updated …" timestamp is bolded once the
    /// snapshot is more than 5 minutes old, drawing the eye to its age.
    private func isStaleTimestamp(_ date: Date) -> Bool {
        Date().timeIntervalSince(date) > 300
    }

    // MARK: - Phase 2 Lane F — Scan receipt button

    /// Entry point for receipt capture, slotted below the spending insights card.
    /// Lane G's anomaly banner goes ABOVE the hero card (not here).
    private var scanReceiptButton: some View {
        Button {
            isShowingReceiptScanner = true
        } label: {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: "camera.viewfinder")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(width: 28, alignment: .leading)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xxs) {
                    Text(EBTReceiptStrings.scanReceiptButton.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(EBTReceiptStrings.settingsReceiptsSubtitle.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
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
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Demo controls (toolbar menu)

    // Demo/dev actions live in the nav bar rather than in the feed —
    // a real user would never see these. They stand in for real-world
    // card activity so the dashboard can be shown reacting live.
    @ToolbarContentBuilder
    private var demoToolbarMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button {
                    civicaWithAnimation(CivicaAnimation.slow) { store.simulatePurchase() }
                } label: {
                    Label(EBTBalanceStrings.simulatePurchaseButton.value(in: language), systemImage: "cart.badge.minus")
                }
                Button {
                    let amount = store.account?.nextDeposit?.amount ?? 200
                    civicaWithAnimation(CivicaAnimation.slow) { store.simulateDeposit() }
                    depositLanded = amount
                    Task {
                        try? await Task.sleep(nanoseconds: 4_500_000_000)
                        civicaWithAnimation(.default) { depositLanded = nil }
                    }
                } label: {
                    Label(EBTBalanceStrings.simulateDepositButton.value(in: language), systemImage: "arrow.down.circle")
                }
            } label: {
                Text(EBTBalanceStrings.demoMenuLabel.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
            }
        }
    }

    // MARK: - Hero balance card
    //
    // Dark pine background, wheat-gold balance amount, velocity bar.
    // Status banners (locked, low-balance, deposit landed) are rendered
    // above the card in the scroll view so they use standard light-bg
    // styling rather than fighting the dark surface.

    private func heroCard(_ account: EBTAccount, insights: EBTBalanceInsights) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(EBTBalanceStrings.balanceEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(Color.white.opacity(0.55))
                .textCase(.uppercase)
                .kerning(1.2)

            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                CivicaMoney(amount: account.foodBalance, font: CivicaTypography.display)
                    .foregroundStyle(CivicaColors.wheatPrimary)
                    .contentTransition(.numericText())
                    // MARK: - REDUCE-MOTION EXEMPT — numericText counter spring
                    // physics is tied to a specific bouncy feel (RA-4 audit
                    // 2026-05-29 explicit exception, same as estimator).
                    .animation(.spring(response: 0.25, dampingFraction: 0.8), value: account.foodBalance)
                Text(EBTBalanceStrings.balanceRemainingSuffix.value(in: language))
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(Color.white.opacity(0.55))
            }

            // Spending velocity bar — shows how far through this month's
            // benefit the user has spent. 3pt track; wheat-gold fill.
            if insights.spentPercent > 0 {
                velocityBar(insights, account: account)
            }

            Text(lastUpdatedLine(account))
                .font(isStaleTimestamp(account.lastUpdated)
                      ? CivicaTypography.footnoteStrong
                      : CivicaTypography.footnote)
                .foregroundStyle(Color.white.opacity(0.45))

            if let deposit = account.nextDeposit {
                Divider()
                    .overlay(Color.white.opacity(0.15))
                    .padding(.vertical, CivicaSpacing.xs)
                nextDepositRow(deposit)
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.pinePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .civicaAnimation(.easeInOut(duration: 0.25), value: store.isCardLocked)
        .civicaAnimation(.easeInOut(duration: 0.25), value: depositLanded)
    }

    /// 3pt progress bar showing spending velocity for the current month.
    private func velocityBar(_ insights: EBTBalanceInsights, account: EBTAccount) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.15))
                        .frame(height: 3)
                    Capsule()
                        .fill(CivicaColors.wheatPrimary.opacity(0.85))
                        .frame(width: geo.size.width * insights.spentPercent, height: 3)
                        .civicaAnimation(CivicaAnimation.standard, value: insights.spentPercent)
                }
            }
            .frame(height: 3)
            HStack {
                Text(EBTBalanceStrings.velocitySpent(
                    amount: plainMoney(insights.spentThisMonth),
                    language: language
                ))
                .font(CivicaTypography.caption)
                .foregroundStyle(Color.white.opacity(0.45))
                Spacer(minLength: CivicaSpacing.sm)
                if let deposit = account.nextDeposit {
                    Text(EBTBalanceStrings.nextDepositTiming(
                        days: daysUntil(deposit.expectedDate),
                        language: language
                    ))
                    .font(CivicaTypography.caption)
                    .foregroundStyle(Color.white.opacity(0.45))
                }
            }
        }
    }

    private func banner(icon: String, text: String, tint: Color = CivicaColors.pinePrimary) -> some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: icon)
                .foregroundStyle(tint)
                .accessibilityHidden(true)
            Text(text)
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(CivicaSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        .accessibilityElement(children: .combine)
    }

    private func nextDepositRow(_ deposit: EBTDeposit) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
            Text(EBTBalanceStrings.nextDepositLabel.value(in: language))
                .font(CivicaTypography.subhead)
                .foregroundStyle(Color.white.opacity(0.70))
            Spacer(minLength: CivicaSpacing.sm)
            CivicaMoney(amount: deposit.amount, font: CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.wheatPrimary)
            Text("· " + EBTBalanceStrings.nextDepositTiming(
                days: daysUntil(deposit.expectedDate),
                language: language
            ))
            .font(CivicaTypography.footnote)
            .foregroundStyle(Color.white.opacity(0.50))
        }
    }

    // MARK: - "Will it last?" projection card
    //
    // Below the hero balance, above the spending insights / recent
    // activity feed. Three states:
    //   * tight  — projected zero-date < next deposit, amber warning
    //   * good   — projected zero-date ≥ next deposit, pine/positive
    //   * neutral — no next deposit on file, plain ink
    // When `insights.projection == nil` (insufficient history, zero
    // balance, etc.), nothing is rendered.

    @ViewBuilder
    private func projectionCard(_ account: EBTAccount, insights: EBTBalanceInsights) -> some View {
        if let projection = insights.projection {
            let isTight = projection.isTightUntilDeposit
            let accent: Color = isTight ? CivicaColors.warningAmber : CivicaColors.pinePrimary
            let iconName = isTight ? "exclamationmark.circle.fill" : "calendar.badge.checkmark"
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: iconName)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(accent)
                    .frame(width: 28, alignment: .leading)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(EBTBalanceStrings.projectionEyebrow.value(in: language))
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .textCase(.uppercase)
                        .kerning(1.2)
                    Text(projectionBody(account: account, projection: projection))
                        .font(CivicaTypography.subhead)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isTight ? accent.opacity(0.08) : CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(
                        isTight ? accent.opacity(0.4) : CivicaColors.hairline,
                        lineWidth: 1
                    )
            )
            .accessibilityElement(children: .combine)
        }
    }

    /// Pick the right copy variant for the projection card. Tight
    /// when the zero-date falls before the next deposit; good when a
    /// deposit is on file but the runway covers it; neutral when no
    /// deposit is on file.
    private func projectionBody(
        account: EBTAccount,
        projection: EBTBalanceProjection
    ) -> String {
        let dateString = mediumDate(projection.projectedZeroDate)
        guard let deposit = account.nextDeposit else {
            return EBTBalanceStrings.projectionNeutral(
                date: dateString,
                language: language
            )
        }
        if projection.isTightUntilDeposit {
            let calendar = Calendar.current
            let gapStart = calendar.startOfDay(for: projection.projectedZeroDate)
            let gapEnd = calendar.startOfDay(for: deposit.expectedDate)
            let gapDays = max(calendar.dateComponents([.day], from: gapStart, to: gapEnd).day ?? 0, 0)
            return EBTBalanceStrings.projectionTight(
                date: dateString,
                gapDays: gapDays,
                language: language
            )
        }
        return EBTBalanceStrings.projectionGood(
            date: dateString,
            depositTiming: EBTBalanceStrings.nextDepositTiming(
                days: daysUntil(deposit.expectedDate),
                language: language
            ),
            language: language
        )
    }

    // MARK: - Spending insights

    @ViewBuilder
    private func spendingInsightsCard(_ account: EBTAccount, insights: EBTBalanceInsights) -> some View {
        if insights.spentThisMonth > 0 {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text(EBTBalanceStrings.insightsEyebrow.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)

                HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                    Text(EBTBalanceStrings.insightsSpentLabel.value(in: language))
                        .font(CivicaTypography.subhead)
                        .foregroundStyle(CivicaColors.ink)
                    Spacer(minLength: CivicaSpacing.sm)
                    CivicaMoney(amount: insights.spentThisMonth, font: CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                }

                if let runOut = insights.projectedRunOutDate {
                    Text(EBTBalanceStrings.insightsRunwayLine(
                        date: mediumDate(runOut),
                        language: language
                    ))
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
        }
    }

    // MARK: - Recent activity

    private func recentActivitySection(_ account: EBTAccount, insights: EBTBalanceInsights) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(EBTBalanceStrings.recentActivityEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
                .padding(.horizontal, CivicaSpacing.xs)

            VStack(spacing: 0) {
                ForEach(Array(account.transactions.enumerated()), id: \.element.id) { index, transaction in
                    Button {
                        openDetail = TransactionDetail(
                            id: transaction.id,
                            transaction: transaction,
                            balanceAfter: insights.runningBalanceAfter(index: index)
                        )
                    } label: {
                        transactionRow(transaction)
                    }
                    .buttonStyle(.plain)
                    if index < account.transactions.count - 1 {
                        Divider().overlay(CivicaColors.hairline)
                    }
                }
            }
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private func transactionRow(_ transaction: EBTTransaction) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            transactionAvatar(transaction)
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.merchant)
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(shortDate(transaction.date))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
            Spacer(minLength: CivicaSpacing.sm)
            transactionAmount(transaction)
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
        }
        .padding(CivicaSpacing.lg)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    // Merchant-monogram avatar (real banking apps' logo fallback);
    // deposits get a distinct down-arrow instead of a monogram.
    @ViewBuilder
    private func transactionAvatar(_ transaction: EBTTransaction) -> some View {
        let tint = transaction.isDeposit ? CivicaColors.amberPrimary : CivicaColors.brickAccent
        ZStack {
            Circle().fill(tint.opacity(0.12))
            if transaction.isDeposit {
                Image(systemName: "arrow.down")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(tint)
            } else {
                Text(transaction.monogram)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(tint)
            }
        }
        .frame(width: 36, height: 36)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func transactionAmount(_ transaction: EBTTransaction) -> some View {
        if transaction.isDeposit {
            HStack(spacing: 1) {
                Text("+")
                CivicaMoney(amount: transaction.amount, font: CivicaTypography.subheadStrong)
            }
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.amberPrimary)
        } else {
            // Negative amount — CivicaMoney renders the leading minus.
            CivicaMoney(amount: transaction.amount, font: CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
        }
    }

    // MARK: - Deposit schedule card

    private func depositScheduleCard(_ account: EBTAccount) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: "calendar")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(CivicaColors.amberPrimary)
                .frame(width: 28, alignment: .leading)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(EBTBalanceStrings.depositScheduleEyebrow.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Text(EBTBalanceStrings.depositScheduleBody(
                    dayOrdinal: ordinalDay(account.depositDayOfMonth),
                    language: language
                ))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.ink)
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

    // MARK: - Benefits expiration note

    private func expirationCard(_ insights: EBTBalanceInsights) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: "hourglass")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(CivicaColors.warningAmber)
                .frame(width: 28, alignment: .leading)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(EBTBalanceStrings.expirationEyebrow.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Text(EBTBalanceStrings.expirationBody(
                    goodThrough: monthYear(insights.benefitsGoodThrough),
                    language: language
                ))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.ink)
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

    // MARK: - Card security row

    private var cardSecurityRow: some View {
        NavigationLink {
            EBTCardLockView(store: store, language: language)
        } label: {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: store.isCardLocked ? "lock.fill" : "lock.open")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(store.isCardLocked ? CivicaColors.pinePrimary : CivicaColors.graphite)
                    .frame(width: 28, alignment: .leading)
                    .accessibilityHidden(true)
                Text(EBTBalanceStrings.securityRowTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Spacer(minLength: CivicaSpacing.sm)
                Text(store.isCardLocked
                     ? EBTBalanceStrings.securityStatusLocked.value(in: language)
                     : EBTBalanceStrings.securityStatusUnlocked.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(store.isCardLocked ? CivicaColors.pinePrimary : CivicaColors.graphite)
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
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
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Account services row (T13)

    /// Navigation entry into the CA state directory
    /// (lost card, BenefitsCal, county finder, fraud reporting).
    /// Pattern mirrors cardSecurityRow — same chevron, same surface
    /// styling, slotted into the dashboard right after card security.
    private var accountServicesRow: some View {
        NavigationLink {
            EBTAccountServicesView()
        } label: {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: "phone.bubble.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(width: 28, alignment: .leading)
                    .accessibilityHidden(true)
                Text(EBTAccountServicesStrings.screenTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
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
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Perks + news sections

    @ViewBuilder
    private var perksSection: some View {
        if case .loading = offersStore.dealsSection {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                RoundedRectangle(cornerRadius: 4).fill(CivicaColors.hairline).frame(width: 120, height: 10)
                RoundedRectangle(cornerRadius: CivicaRadius.card).fill(CivicaColors.surfacePrimary)
                    .frame(height: 100)
                    .overlay(RoundedRectangle(cornerRadius: CivicaRadius.card).strokeBorder(CivicaColors.hairline))
            }
            .redacted(reason: .placeholder)
        } else if case .freeResources(let resources) = offersStore.dealsSection {
            // Silent-honor: free resources in identical shelf structure — no visible difference to user.
            contentSection(
                eyebrow: EBTPerksStrings.freeResourcesEyebrow.value(in: language),
                rows: resources.map { r in
                    contentRow(
                        icon: freeResourceIcon(r.iconGlyph),
                        title: r.title(in: language),
                        detail: r.subtitle(in: language)
                    )
                }
            )
        } else if case .offers(let offers) = offersStore.dealsSection {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text(EBTPerksStrings.eyebrow.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                    .padding(.horizontal, CivicaSpacing.xs)

                VStack(spacing: 0) {
                    ForEach(Array(offers.enumerated()), id: \.element.id) { index, offer in
                        perksOfferRow(offer: offer)
                        if index < offers.count - 1 {
                            Divider().overlay(CivicaColors.hairline)
                        }
                    }
                }
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
            }
        } else {
            // .empty — show static fixtures as fallback.
            contentSection(
                eyebrow: EBTBalanceStrings.perksEyebrow.value(in: language),
                rows: EBTBalanceFixtures.perks.map { perk in
                    contentRow(icon: perk.iconName, title: perk.title.value(in: language), detail: perk.detail.value(in: language))
                }
            )
        }
    }

    private func freeResourceIcon(_ glyph: EBTFreeResource.IconGlyph) -> String {
        switch glyph {
        case .house: return "house.fill"
        case .phone: return "phone.fill"
        case .document: return "doc.fill"
        }
    }

    private func perksOfferRow(offer: EBTOffer) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: "tag.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(width: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(offer.name)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                if let desc = offer.description {
                    Text(desc)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text(offer.partnerName)
                    .font(CivicaTypography.caption)
                    .foregroundStyle(CivicaColors.muted)
                if offer.expectedSavingsCents > 0 {
                    Text(EBTPerksStrings.savingsCallout(
                        cents: offer.expectedSavingsCents,
                        language: language
                    ))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.warningAmber)
                }
            }
            Spacer(minLength: CivicaSpacing.sm)
            Button {
                pendingRedemptionOffer = offer
            } label: {
                Text(EBTPerksStrings.redeemButton.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .padding(.horizontal, CivicaSpacing.sm)
                    .padding(.vertical, 6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .strokeBorder(CivicaColors.pinePrimary, lineWidth: 1)
                    )
            }
        }
        .padding(CivicaSpacing.md)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(offer.name). \(offer.partnerName). \(EBTPerksStrings.redeemButton.value(in: language))")
    }

    private var newsSection: some View {
        contentSection(
            eyebrow: EBTBalanceStrings.newsEyebrow.value(in: language),
            rows: EBTBalanceFixtures.news.map { item in
                contentRow(icon: item.iconName, title: item.title.value(in: language), detail: item.detail.value(in: language))
            }
        )
    }

    private func contentSection(eyebrow: String, rows: [some View]) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(eyebrow)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
                .padding(.horizontal, CivicaSpacing.xs)

            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    row
                    if index < rows.count - 1 {
                        Divider().overlay(CivicaColors.hairline)
                    }
                }
            }
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private func contentRow(icon: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(width: 28, height: 28, alignment: .center)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(detail)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Demo disclosure + unlink

    private var demoDisclosure: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: "info.circle")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
            Text(EBTBalanceStrings.demoDisclosure.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var unlinkLink: some View {
        Button(action: { store.unlink() }) {
            Text(EBTBalanceStrings.unlinkLink.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .underline()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Formatting

    private func lastUpdatedLine(_ account: EBTAccount) -> String {
        // Within a few seconds, RelativeDateTimeFormatter renders an
        // awkward "in 0 seconds" — use a plain "just now" instead.
        if Date().timeIntervalSince(account.lastUpdated) < 10 {
            return EBTBalanceStrings.lastUpdatedJustNow.value(in: language)
        }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: language == .spanish ? "es" : "en")
        formatter.unitsStyle = .full
        let relative = formatter.localizedString(for: account.lastUpdated, relativeTo: Date())
        return EBTBalanceStrings.lastUpdatedPrefix.value(in: language) + " " + relative
    }

    private func daysUntil(_ date: Date) -> Int {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let end = calendar.startOfDay(for: date)
        return calendar.dateComponents([.day], from: start, to: end).day ?? 0
    }

    /// Compact transaction date: "Today" / "Yesterday" / "May 5".
    private func shortDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return EBTBalanceStrings.nextDepositTiming(days: 0, language: language).capitalized
        }
        if calendar.isDateInYesterday(date) {
            return language == .spanish ? "Ayer" : "Yesterday"
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: language == .spanish ? "es" : "en")
        formatter.setLocalizedDateFormatFromTemplate("MMMd")
        return formatter.string(from: date)
    }

    private func mediumDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: language == .spanish ? "es" : "en")
        formatter.setLocalizedDateFormatFromTemplate("MMMd")
        return formatter.string(from: date)
    }

    private func ordinalDay(_ day: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .ordinal
        formatter.locale = Locale(identifier: language == .spanish ? "es" : "en")
        return formatter.string(from: NSNumber(value: day)) ?? "\(day)"
    }

    private func monthYear(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: language == .spanish ? "es" : "en")
        formatter.setLocalizedDateFormatFromTemplate("MMMMy")
        return formatter.string(from: date)
    }

    /// Plain currency string for inline copy (the deposit-landed
    /// banner). Whole amounts hide cents, matching CivicaMoney.
    private func plainMoney(_ amount: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = .current
        let isWhole = (amount as NSDecimalNumber).doubleValue.truncatingRemainder(dividingBy: 1) == 0
        formatter.minimumFractionDigits = isWhole ? 0 : 2
        formatter.maximumFractionDigits = isWhole ? 0 : 2
        return formatter.string(from: amount as NSDecimalNumber) ?? "$0"
    }
}
