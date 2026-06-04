import CivicaDesignSystem
import SwiftUI

// IS-4 / IS-5 + UD-3 of the iOS product audit (2026-05-29). Single
// soft-ineligibility component reused by both the SNAP benefit
// estimator and the conversation screener. Replaces the prior red
// destructive verdict card with a warm-but-honest amber surface plus
// three explicit next-step rows so a user reading "the system says no"
// always has forward motion.
//
// Copy review pending: every CivicaText below carries an EN string
// from the audit spec and a best-effort ES translation. Native-speaker
// review is requested before this lands in front of users — the card
// is the highest-emotion moment in the SNAP flow and Spanish parity
// has to be exact, not approximate.

struct SNAPSoftIneligibilityCard: View {

    let verdictReason: CivicaText
    let language: CivicaLanguage
    let onApplyAnyway: () -> Void
    let onFindHelp: () -> Void
    // Renamed from onTalkNavigator per UD-6 — we don't promise a real
    // navigator handoff until that wire-up actually exists; the row
    // surfaces the state portal instead.
    let onOpenStatePortal: () -> Void

    @State private var isExpanded: Bool = false

    /// Word-count threshold above which the "See more" affordance is
    /// rendered. Estimator + conversation reasons today sit well below
    /// 30 words; the toggle is an honest escape hatch for any future
    /// rules-engine output that runs longer without forcing GeometryReader
    /// truncation probing.
    private static let longReasonWordThreshold = 30

    private var reasonText: String {
        verdictReason.value(in: language)
    }

    private var reasonIsLong: Bool {
        reasonText.split(whereSeparator: { $0.isWhitespace }).count > Self.longReasonWordThreshold
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            headerBlock
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.top, CivicaSpacing.lg)
                .padding(.bottom, CivicaSpacing.md)

            actionRow(
                title: SNAPSoftIneligibilityStrings.applyAnywayAction,
                accessibilityHint: SNAPSoftIneligibilityStrings.applyAnywayHint,
                action: onApplyAnyway
            )
            hairline
            actionRow(
                title: SNAPSoftIneligibilityStrings.findHelpAction,
                accessibilityHint: SNAPSoftIneligibilityStrings.findHelpHint,
                action: onFindHelp
            )
            hairline
            actionRow(
                title: SNAPSoftIneligibilityStrings.openStatePortalAction,
                accessibilityHint: SNAPSoftIneligibilityStrings.openStatePortalHint,
                action: onOpenStatePortal
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .fill(CivicaColors.statusWarningSurface)
        )
        .accessibilityElement(children: .contain)
    }

    // MARK: - Header

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPSoftIneligibilityStrings.headline.value(in: language))
                .font(CivicaTypography.cardTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            Text(reasonText)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .lineLimit(reasonIsLong && !isExpanded ? 4 : nil)
                .fixedSize(horizontal: false, vertical: true)

            if reasonIsLong {
                Button {
                    isExpanded.toggle()
                } label: {
                    Text(
                        (isExpanded
                            ? SNAPSoftIneligibilityStrings.seeLess
                            : SNAPSoftIneligibilityStrings.seeMore
                        ).value(in: language)
                    )
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(
                    (isExpanded
                        ? SNAPSoftIneligibilityStrings.seeLess
                        : SNAPSoftIneligibilityStrings.seeMore
                    ).value(in: language)
                )
            }

            Text(SNAPSoftIneligibilityStrings.confidenceLine.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, CivicaSpacing.xs)
        }
    }

    // MARK: - Action row

    private func actionRow(
        title: CivicaText,
        accessibilityHint: CivicaText,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: CivicaSpacing.md) {
                Text(title.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title.value(in: language))
        .accessibilityHint(accessibilityHint.value(in: language))
        .accessibilityAddTraits(.isButton)
    }

    private var hairline: some View {
        Rectangle()
            .fill(CivicaColors.hairline)
            .frame(height: 1)
            .padding(.horizontal, CivicaSpacing.lg)
    }
}

// MARK: - Strings

/// Copy is load-bearing — these strings are what someone in food
/// crisis reads when the system says "no." Per the audit (Principle
/// 1.3, honesty about uncertainty), the headline must read "may not
/// qualify" (probabilistic) rather than "doesn't qualify" (absolute),
/// and the confidence line MUST stay verbatim — it's what makes the
/// card honest about the estimator/screener being an estimate.
///
/// Spanish translations are best-effort author drafts and tagged for
/// native-speaker review before user-facing release.
enum SNAPSoftIneligibilityStrings {

    // TODO(copy-review): native Spanish-speaker review of every entry
    // in this namespace before merge. The card is the highest-emotion
    // moment in SNAP — translation quality here affects user trust.

    static let headline = CivicaText(
        "You may not qualify today — but situations change, and there are a few things worth trying.",
        es: "Es posible que hoy no califiques — pero las situaciones cambian, y hay algunas cosas que vale la pena intentar.",
        zh: "你今天可能不符合资格 —— 但情况会变,有几件事值得试一试。",
        vi: "Hôm nay bạn có thể không đủ điều kiện — nhưng hoàn cảnh thay đổi, và có vài điều đáng thử."
    )

    static let confidenceLine = CivicaText(
        "Based on what you told us. The county makes the final decision.",
        es: "Según lo que nos dijiste. El condado toma la decisión final.",
        zh: "根据你告诉我们的信息。最终决定由县里做出。",
        vi: "Dựa trên những gì bạn cho chúng tôi biết. County đưa ra quyết định cuối cùng."
    )

    static let applyAnywayAction = CivicaText(
        "Apply anyway — the county may approve",
        es: "Aplica de todos modos — el condado podría aprobar",
        zh: "无论如何先申请 —— 县里可能会批准",
        vi: "Cứ nộp đơn — county vẫn có thể chấp thuận"
    )

    static let findHelpAction = CivicaText(
        "Find food while you sort this out",
        es: "Encuentra comida mientras resuelves esto",
        zh: "在你处理这件事的同时先找到食物",
        vi: "Tìm thực phẩm trong lúc bạn giải quyết việc này"
    )

    static let openStatePortalAction = CivicaText(
        "Open the state portal for help",
        es: "Abre el portal estatal para obtener ayuda",
        zh: "打开州政府网站寻求帮助",
        vi: "Mở cổng thông tin tiểu bang để được giúp đỡ"
    )

    // Accessibility hints — supplemental context for VoiceOver users
    // beyond the row label. Kept short per Apple HIG.
    static let applyAnywayHint = CivicaText(
        "Starts the SNAP application — the county makes the final decision.",
        es: "Inicia la solicitud de SNAP — el condado toma la decisión final.",
        zh: "开始 SNAP 申请 —— 最终决定由县里做出。",
        vi: "Bắt đầu nộp đơn SNAP — county đưa ra quyết định cuối cùng."
    )

    static let findHelpHint = CivicaText(
        "Opens the food-help map filtered to nearby pantries.",
        es: "Abre el mapa de ayuda alimentaria filtrado a despensas cercanas.",
        zh: "打开食物援助地图,筛选附近的食物银行。",
        vi: "Mở bản đồ trợ giúp thực phẩm đã lọc theo các kho thực phẩm gần đây."
    )

    static let openStatePortalHint = CivicaText(
        "Opens the state benefits portal in a Safari sheet.",
        es: "Abre el portal estatal de beneficios en una hoja de Safari.",
        zh: "在 Safari 窗口中打开州福利网站。",
        vi: "Mở cổng phúc lợi tiểu bang trong một cửa sổ Safari."
    )

    static let seeMore = CivicaText(
        "See more",
        es: "Ver más",
        zh: "查看更多",
        vi: "Xem thêm"
    )

    static let seeLess = CivicaText(
        "See less",
        es: "Ver menos",
        zh: "收起",
        vi: "Thu gọn"
    )

    /// Registered for the EN/ES parity test. Add new entries here when
    /// adding a new CivicaText above.
    static let all: [CivicaText] = [
        headline,
        confidenceLine,
        applyAnywayAction,
        findHelpAction,
        openStatePortalAction,
        applyAnywayHint,
        findHelpHint,
        openStatePortalHint,
        seeMore,
        seeLess,
    ]
}

#if DEBUG
struct SNAPSoftIneligibilityCard_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: CivicaSpacing.lg) {
                SNAPSoftIneligibilityCard(
                    verdictReason: CivicaText(
                        "Your income looks higher than the federal SNAP cutoff for your household size.",
                        es: "Tus ingresos parecen más altos que el límite federal de SNAP para el tamaño de tu hogar.",
                        zh: "按你家庭人数算,你的收入看起来高于联邦 SNAP 的上限。",
                        vi: "Thu nhập của bạn có vẻ cao hơn mức giới hạn SNAP liên bang cho số người trong hộ của bạn."
                    ),
                    language: .english,
                    onApplyAnyway: {},
                    onFindHelp: {},
                    onOpenStatePortal: {}
                )

                SNAPSoftIneligibilityCard(
                    verdictReason: CivicaText(
                        "Basándonos en lo que nos contaste sobre tus ingresos, el tamaño de tu hogar, y los gastos que reportaste, la fórmula federal no produce un beneficio mensual estimado. Esto no significa que no califiques — el condado puede considerar factores adicionales que esta calculadora no ve.",
                        es: "Basándonos en lo que nos contaste sobre tus ingresos, el tamaño de tu hogar, y los gastos que reportaste, la fórmula federal no produce un beneficio mensual estimado. Esto no significa que no califiques — el condado puede considerar factores adicionales que esta calculadora no ve.",
                        zh: "根据你告诉我们的收入、家庭人数和报告的支出,联邦公式算不出每月预估福利。这并不代表你不符合资格 —— 县里可能会考虑这个计算器看不到的其他因素。",
                        vi: "Dựa trên những gì bạn cho chúng tôi biết về thu nhập, số người trong hộ và các khoản chi bạn khai báo, công thức liên bang không tính ra mức trợ cấp hằng tháng ước tính. Điều này không có nghĩa là bạn không đủ điều kiện — county có thể xem xét những yếu tố khác mà công cụ tính này không thấy được."
                    ),
                    language: .spanish,
                    onApplyAnyway: {},
                    onFindHelp: {},
                    onOpenStatePortal: {}
                )
            }
            .padding()
        }
        .background(CivicaColors.paper)
    }
}
#endif
