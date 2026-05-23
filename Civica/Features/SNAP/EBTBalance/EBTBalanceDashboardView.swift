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
    let language: CivicaLanguage

    /// The transaction whose detail sheet is open, paired with the
    /// running balance after it posted.
    private struct TransactionDetail: Identifiable {
        let id: UUID
        let transaction: EBTTransaction
        let balanceAfter: Decimal
    }
    @State private var openDetail: TransactionDetail?
    /// Amount of the most recent simulated deposit, shown as a
    /// transient "deposit landed" banner on the hero card. Cleared a
    /// few seconds after it posts.
    @State private var depositLanded: Decimal?

    var body: some View {
        ScrollView {
            if let account = store.account {
                let insights = EBTBalanceInsights(account: account)
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
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
                    if !account.transactions.isEmpty {
                        recentActivitySection(account, insights: insights)
                    }
                    depositScheduleCard(account)
                    expirationCard(insights)
                    cardSecurityRow
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
        .refreshable { await store.refresh() }
        .toolbar { demoToolbarMenu }
        .sheet(item: $openDetail) { detail in
            EBTTransactionDetailSheet(
                transaction: detail.transaction,
                balanceAfter: detail.balanceAfter,
                language: language,
                onDone: { openDetail = nil }
            )
        }
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
                    withAnimation(.easeInOut(duration: 0.3)) { store.simulatePurchase() }
                } label: {
                    Label(EBTBalanceStrings.simulatePurchaseButton.value(in: language), systemImage: "cart.badge.minus")
                }
                Button {
                    let amount = store.account?.nextDeposit?.amount ?? 200
                    withAnimation(.easeInOut(duration: 0.3)) { store.simulateDeposit() }
                    depositLanded = amount
                    Task {
                        try? await Task.sleep(nanoseconds: 4_500_000_000)
                        withAnimation { depositLanded = nil }
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
                CivicaMoney(amount: account.foodBalance, font: CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.wheatPrimary)
                    .contentTransition(.numericText())
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
                .font(CivicaTypography.footnote)
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
        .animation(.easeInOut(duration: 0.25), value: store.isCardLocked)
        .animation(.easeInOut(duration: 0.25), value: depositLanded)
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
                        .animation(CivicaAnimation.standard, value: insights.spentPercent)
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

    // MARK: - Perks + news sections

    private var perksSection: some View {
        contentSection(
            eyebrow: EBTBalanceStrings.perksEyebrow.value(in: language),
            rows: EBTBalanceFixtures.perks.map { perk in
                contentRow(icon: perk.iconName, title: perk.title.value(in: language), detail: perk.detail.value(in: language))
            }
        )
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
