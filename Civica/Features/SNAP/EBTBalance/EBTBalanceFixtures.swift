import Foundation

// Seeded demo data for the Check EBT Balance feature. Civica does not
// connect to a real state EBT system; this fixture stands in for what
// a linked CalFresh account would return so the dashboard is fully
// walkable.
//
// Timestamps are generated relative to "now" each time the account is
// built, so a pull-to-refresh naturally re-stamps the "last updated"
// line and the transaction dates — the illusion of live data without
// a backend.

enum EBTBalanceFixtures {
    /// The demo CalFresh account. Food-only (no cash aid), a next
    /// deposit a few days out, and a short categorized transaction
    /// history.
    ///
    /// - Parameter updatedSecondsAgo: how long ago the balance was
    ///   "last read". Defaults to 2 minutes for a first load; a
    ///   refresh passes a few seconds so the trust line reads fresh.
    static func demoAccount(updatedSecondsAgo: TimeInterval = 120) -> EBTAccount {
        let now = Date()
        let nextDepositDate = Calendar.current.date(byAdding: .day, value: 4, to: now) ?? now
        return EBTAccount(
            foodBalance: Decimal(string: "76.12") ?? 0,
            cashBalance: nil,
            lastUpdated: now.addingTimeInterval(-updatedSecondsAgo),
            nextDeposit: EBTDeposit(amount: 232, expectedDate: nextDepositDate),
            depositDayOfMonth: Calendar.current.component(.day, from: nextDepositDate),
            transactions: demoTransactions(now: now)
        )
    }

    /// Recent purchases + the last deposit, newest first. Dates are
    /// offsets from `now` so they re-stamp on refresh.
    private static func demoTransactions(now: Date) -> [EBTTransaction] {
        let calendar = Calendar.current
        func daysAgo(_ days: Int) -> Date {
            calendar.date(byAdding: .day, value: -days, to: now) ?? now
        }
        let entries: [(String, String, Int, EBTTransactionCategory)] = [
            ("Walmart Supercenter", "-23.60", 0, .groceries),
            ("Grocery Outlet", "-18.42", 1, .groceries),
            ("Northgate Market", "-31.07", 3, .groceries),
            ("Farmers Market — Alameda", "-12.00", 5, .farmersMarket),
            ("Target", "-9.18", 6, .other),
            ("CalFresh deposit", "232.00", 9, .deposit),
            ("Food 4 Less", "-27.85", 12, .groceries),
        ]
        return entries.map { merchant, amount, days, category in
            EBTTransaction(
                id: UUID(),
                merchant: merchant,
                amount: Decimal(string: amount) ?? 0,
                date: daysAgo(days),
                category: category
            )
        }
    }

    // MARK: - Demo simulation

    /// A fresh purchase for the spend-simulation demo control: a random
    /// merchant + plausible amount, dated now. Negative amount.
    static func randomDemoPurchase() -> EBTTransaction {
        let options: [(String, ClosedRange<Double>, EBTTransactionCategory)] = [
            ("Walmart Supercenter", 12...45, .groceries),
            ("Trader Joe's", 18...58, .groceries),
            ("Northgate Market", 9...38, .groceries),
            ("Farmers Market — Alameda", 6...22, .farmersMarket),
            ("Food 4 Less", 14...50, .groceries),
            ("7-Eleven", 3...14, .other),
        ]
        let pick = options.randomElement() ?? options[0]
        let raw = Double.random(in: pick.1)
        let rounded = (raw * 100).rounded() / 100
        return EBTTransaction(
            id: UUID(),
            merchant: pick.0,
            amount: Decimal(-rounded),
            date: Date(),
            category: pick.2
        )
    }

    /// A fresh CalFresh deposit for the deposit-simulation demo
    /// control, dated now. Positive amount.
    static func demoDepositTransaction(amount: Decimal) -> EBTTransaction {
        EBTTransaction(
            id: UUID(),
            merchant: "CalFresh deposit",
            amount: amount,
            date: Date(),
            category: .deposit
        )
    }

    // MARK: - "Free & discounted with EBT" perks (Tier 2)

    /// Real California / federal programs open to EBT cardholders.
    /// Informational only — no in-app destination in the demo.
    static let perks: [EBTPerk] = [
        EBTPerk(
            id: UUID(),
            iconName: "building.columns.fill",
            title: CivicaText("Museums for All", es: "Museos para todos", zh: "全民博物馆", vi: "Bảo tàng cho mọi người"),
            detail: CivicaText(
                "Free or $3 admission at 1,200+ museums, zoos, and science centers when you show your EBT card.",
                es: "Entrada gratis o de $3 en más de 1,200 museos, zoológicos y centros de ciencia mostrando tu tarjeta EBT.",
                zh: "出示你的 EBT 卡,即可在 1,200 多家博物馆、动物园和科学中心免费入场或仅需 $3。",
                vi: "Vào cửa miễn phí hoặc $3 tại hơn 1.200 bảo tàng, vườn thú và trung tâm khoa học khi bạn xuất trình thẻ EBT."
            )
        ),
        EBTPerk(
            id: UUID(),
            iconName: "wifi",
            title: CivicaText("Low-cost internet & phone", es: "Internet y teléfono de bajo costo", zh: "低价网络和电话", vi: "Internet và điện thoại giá rẻ"),
            detail: CivicaText(
                "The federal Lifeline program lowers your monthly internet or phone bill if you receive CalFresh.",
                es: "El programa federal Lifeline reduce tu factura mensual de internet o teléfono si recibes CalFresh.",
                zh: "如果你领取 CalFresh,联邦 Lifeline 项目可以降低你每月的网络或电话费。",
                vi: "Nếu bạn nhận CalFresh, chương trình liên bang Lifeline giúp giảm hóa đơn internet hoặc điện thoại hằng tháng của bạn."
            )
        ),
        EBTPerk(
            id: UUID(),
            iconName: "leaf.fill",
            title: CivicaText("Market Match", es: "Market Match", zh: "Market Match", vi: "Market Match"),
            detail: CivicaText(
                "Doubles your CalFresh dollars on fresh fruits and vegetables at participating California farmers markets.",
                es: "Duplica tus dólares de CalFresh en frutas y verduras frescas en los mercados de agricultores participantes de California.",
                zh: "在加州参与的农夫市场买新鲜水果和蔬菜,你的 CalFresh 金额可以翻倍。",
                vi: "Nhân đôi số tiền CalFresh của bạn khi mua trái cây và rau tươi tại các chợ nông sản tham gia ở California."
            )
        ),
        EBTPerk(
            id: UUID(),
            iconName: "cart.fill",
            title: CivicaText("Discounted grocery delivery", es: "Entrega de comida con descuento", zh: "折扣食品配送", vi: "Giao thực phẩm giá ưu đãi"),
            detail: CivicaText(
                "EBT cardholders qualify for a discounted Amazon and Walmart+ membership and can pay for groceries online with EBT.",
                es: "Los titulares de EBT califican para una membresía con descuento de Amazon y Walmart+, y pueden pagar comida en línea con EBT.",
                zh: "EBT 持卡人可享受 Amazon 和 Walmart+ 会员折扣,并能用 EBT 在线支付食品费用。",
                vi: "Người có thẻ EBT được hưởng giá ưu đãi cho thành viên Amazon và Walmart+, và có thể trả tiền thực phẩm trực tuyến bằng EBT."
            )
        ),
    ]

    // MARK: - Benefit news / updates (Tier 2)

    static let news: [EBTNewsItem] = [
        EBTNewsItem(
            id: UUID(),
            iconName: "calendar.badge.clock",
            title: CivicaText("Keep your benefits — recertify on time", es: "Mantén tus beneficios — recertifica a tiempo", zh: "保住你的福利 — 按时重新认证", vi: "Giữ trợ cấp của bạn — tái xác nhận đúng hạn"),
            detail: CivicaText(
                "CalFresh has to be renewed periodically. Civica will remind you before your deadline so your benefits don't pause.",
                es: "CalFresh debe renovarse periódicamente. Civica te recordará antes de tu fecha límite para que tus beneficios no se detengan.",
                zh: "CalFresh 需要定期续期。Civica 会在截止日期前提醒你,这样你的福利不会中断。",
                vi: "CalFresh phải được gia hạn định kỳ. Civica sẽ nhắc bạn trước hạn chót để trợ cấp của bạn không bị tạm dừng."
            )
        ),
        EBTNewsItem(
            id: UUID(),
            iconName: "exclamationmark.shield.fill",
            title: CivicaText("Protect your card from theft", es: "Protege tu tarjeta del robo", zh: "保护你的卡不被盗刷", vi: "Bảo vệ thẻ của bạn khỏi bị đánh cắp"),
            detail: CivicaText(
                "EBT card skimming is on the rise. Keep your card locked when you're not shopping — California can replace stolen benefits in limited cases.",
                es: "El robo de datos de tarjetas EBT está aumentando. Mantén tu tarjeta bloqueada cuando no estés comprando — California puede reemplazar beneficios robados en casos limitados.",
                zh: "EBT 卡盗刷事件正在增多。不购物时把卡锁起来 — 加州在有限情况下可以补发被盗的福利。",
                vi: "Tình trạng đánh cắp dữ liệu thẻ EBT đang gia tăng. Hãy khóa thẻ khi bạn không mua sắm — California có thể cấp lại trợ cấp bị đánh cắp trong một số trường hợp giới hạn."
            )
        ),
    ]
}
