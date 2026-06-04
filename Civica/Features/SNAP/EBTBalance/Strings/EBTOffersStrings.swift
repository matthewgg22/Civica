import CivicaDesignSystem

// Live-offer + "Saved by Civica" tally + free-resources copy for the EBT
// offer-moment platform (per ceo-plans/2026-05-26-ebt-offer-moment-platform.md).
//
// Every CivicaText in this namespace MUST have both .en and .es. The
// EBTStringParityTests CI guard fails the build otherwise.
//
// Voice rules (DESIGN.md §10):
//   - "you" not third-person bureaucratic
//   - estimates are estimates — "Self-reported" co-present on the tally
//   - no urgency patterns — no countdowns, no "only N left"
//   - factual-utility push template per D6

enum EBTOffersStrings {
    // MARK: - "Saved by Civica" tally surface (E1)

    /// Uppercase caption-strong eyebrow above the tally card.
    static let savedByCivicaEyebrow = CivicaText(
        "Saved by Civica",
        es: "Ahorrado con Civica",
        zh: "通过 Civica 节省",
        vi: "Tiết kiệm cùng Civica"
    )

    /// Co-present qualifier next to the dollar amount per DESIGN.md §10.2
    /// honesty-about-uncertainty. NEVER hide this; it's the entire reason
    /// the surface reads as government-grade vs consumer-rewards.
    static let savedSelfReported = CivicaText(
        "Self-reported",
        es: "Auto-reportado",
        zh: "自行报告",
        vi: "Bạn tự báo cáo"
    )

    /// Subtext: "Since you joined in {month}". Renderer formats the month
    /// at display time; the literal is the prefix only.
    static let savedSinceYouJoined = CivicaText(
        "Since you joined in",
        es: "Desde que te uniste en",
        zh: "自你加入以来于",
        vi: "Từ khi bạn tham gia vào"
    )

    /// Empty-state when the user has no recorded redemptions yet.
    /// Calm, no shaming.
    static let savedEmptyState = CivicaText(
        "$0.00",
        es: "$0,00",
        zh: "$0.00",
        vi: "$0.00"
    )
    static let savedEmptyStateSubtext = CivicaText(
        "Redeem your first deal to start saving with Civica.",
        es: "Canjea tu primera oferta para empezar a ahorrar con Civica.",
        zh: "兑换你的第一个优惠,开始通过 Civica 省钱。",
        vi: "Đổi ưu đãi đầu tiên của bạn để bắt đầu tiết kiệm cùng Civica."
    )

    // MARK: - Live offers card

    /// Eyebrow when offers exist for the user's area.
    static let dealsNearYouEyebrow = CivicaText(
        "Deals near you",
        es: "Ofertas cerca de ti",
        zh: "你附近的优惠",
        vi: "Ưu đãi gần bạn"
    )

    /// Eyebrow + body when the catalog has nothing for the user's county.
    /// Calm, no apology.
    static let dealsEmptyTitle = CivicaText(
        "We're bringing deals to your area soon",
        es: "Pronto traeremos ofertas a tu zona",
        zh: "我们很快会把优惠带到你所在的地区",
        vi: "Chúng tôi sắp mang ưu đãi đến khu vực của bạn"
    )

    static let dealsEmptyBody = CivicaText(
        "In the meantime, your perks below are open to every CalFresh household.",
        es: "Mientras tanto, los beneficios de abajo están abiertos a todos los hogares con CalFresh.",
        zh: "在此期间,下方的福利向所有 CalFresh 家庭开放。",
        vi: "Trong lúc đó, các ưu đãi bên dưới dành cho mọi hộ gia đình CalFresh."
    )

    /// Per-offer footnote co-located with the redemption window per
    /// DESIGN.md §10.2 "estimates are estimates" + §10.3 no urgency.
    /// Renderer fills the date literal.
    static let offerThroughDatePrefix = CivicaText(
        "Through",
        es: "Hasta el",
        zh: "截至",
        vi: "Đến hết"
    )

    /// Optional "Estimated savings" footnote on the OfferDetailView.
    static let estimatedSavingsLabel = CivicaText(
        "Estimated savings",
        es: "Ahorro estimado",
        zh: "预计节省",
        vi: "Tiết kiệm ước tính"
    )

    static let estimatedSavingsDisclaimer = CivicaText(
        "Estimate · partner-reported",
        es: "Estimado · reportado por el comercio",
        zh: "预估 · 由合作商家报告",
        vi: "Ước tính · do đối tác báo cáo"
    )

    /// Tap-action label on an offer row. Outcomes-not-mechanics per §10.4.
    static let offerSeeDetailsCTA = CivicaText(
        "See details",
        es: "Ver detalles",
        zh: "查看详情",
        vi: "Xem chi tiết"
    )

    static let offerGetDirectionsCTA = CivicaText(
        "Get directions",
        es: "Cómo llegar",
        zh: "获取路线",
        vi: "Xem đường đi"
    )

    /// Secondary text-link that opens the SelfAttestRedemptionSheet.
    static let offerIRedeemedThisCTA = CivicaText(
        "I redeemed this",
        es: "Canjeé esta oferta",
        zh: "我兑换了这个优惠",
        vi: "Tôi đã đổi ưu đãi này"
    )

    // MARK: - SelfAttestRedemptionSheet (E2)

    static let selfAttestTitle = CivicaText(
        "Did you redeem this offer?",
        es: "¿Canjeaste esta oferta?",
        zh: "你兑换了这个优惠吗?",
        vi: "Bạn đã đổi ưu đãi này chưa?"
    )

    static let selfAttestAmountLabel = CivicaText(
        "How much did you save?",
        es: "¿Cuánto ahorraste?",
        zh: "你节省了多少?",
        vi: "Bạn đã tiết kiệm bao nhiêu?"
    )

    /// "Up to $X.XX" cap disclaimer (anti-inflation). Renderer fills the
    /// amount; this is the prefix.
    static let selfAttestCapPrefix = CivicaText(
        "Up to",
        es: "Hasta",
        zh: "最多",
        vi: "Tối đa"
    )

    static let selfAttestCapSuffix = CivicaText(
        "(the offer's max)",
        es: "(el máximo de la oferta)",
        zh: "(优惠的上限)",
        vi: "(mức tối đa của ưu đãi)"
    )

    static let selfAttestYesCTA = CivicaText(
        "Yes, I redeemed",
        es: "Sí, lo canjeé",
        zh: "是的,我兑换了",
        vi: "Có, tôi đã đổi"
    )

    static let selfAttestNotNowCTA = CivicaText(
        "Not now",
        es: "Ahora no",
        zh: "暂时不用",
        vi: "Để sau"
    )

    /// Toast / inline confirmation after a successful self-attest write.
    static let selfAttestSuccess = CivicaText(
        "Saved.",
        es: "Guardado.",
        zh: "已保存。",
        vi: "Đã lưu."
    )

    static let selfAttestCappedNotice = CivicaText(
        "Adjusted to match the offer's per-deal maximum.",
        es: "Ajustado al máximo por oferta.",
        zh: "已调整为该优惠的单次最高限额。",
        vi: "Đã điều chỉnh theo mức tối đa cho mỗi lần đổi của ưu đãi."
    )

    // MARK: - Errors

    static let offerExpiredTitle = CivicaText(
        "This deal just ended",
        es: "Esta oferta acaba de terminar",
        zh: "这个优惠刚刚结束",
        vi: "Ưu đãi này vừa kết thúc"
    )

    static let offerExpiredBody = CivicaText(
        "Here are similar deals near you.",
        es: "Aquí hay ofertas similares cerca de ti.",
        zh: "以下是你附近的类似优惠。",
        vi: "Đây là những ưu đãi tương tự gần bạn."
    )

    static let staleDataFooter = CivicaText(
        "Last updated",
        es: "Última actualización",
        zh: "最后更新",
        vi: "Cập nhật lần cuối"
    )

    // MARK: - Curated list for EBTStringParityTests

    /// CI gate: every CivicaText above must appear here. Adding a new
    /// string without also adding it here will cause parity drift to slip
    /// past the en/es guard.
    static let all: [CivicaText] = [
        savedByCivicaEyebrow,
        savedSelfReported,
        savedSinceYouJoined,
        savedEmptyState,
        savedEmptyStateSubtext,
        dealsNearYouEyebrow,
        dealsEmptyTitle,
        dealsEmptyBody,
        offerThroughDatePrefix,
        estimatedSavingsLabel,
        estimatedSavingsDisclaimer,
        offerSeeDetailsCTA,
        offerGetDirectionsCTA,
        offerIRedeemedThisCTA,
        selfAttestTitle,
        selfAttestAmountLabel,
        selfAttestCapPrefix,
        selfAttestCapSuffix,
        selfAttestYesCTA,
        selfAttestNotNowCTA,
        selfAttestSuccess,
        selfAttestCappedNotice,
        offerExpiredTitle,
        offerExpiredBody,
        staleDataFooter,
    ]
}

// MARK: - Free Resources (distress visible-honor swap, E3)

enum EBTFreeResourcesStrings {
    /// Uppercase caption-strong eyebrow. TYPOGRAPHICALLY IDENTICAL to
    /// `dealsNearYouEyebrow` — that's the entire silent-honor contract.
    /// Renderer uses the same captionStrong + kerning 1.2 + uppercase
    /// styling. Only the literal differs.
    static let freeResourcesEyebrow = CivicaText(
        "Free resources",
        es: "Recursos gratuitos",
        zh: "免费资源",
        vi: "Tài nguyên miễn phí"
    )

    static let all: [CivicaText] = [
        freeResourcesEyebrow,
    ]
}
