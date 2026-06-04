import CivicaDesignSystem
import SwiftUI

// JR-4 of the iOS product audit (2026-05-29).
//
// Read-only "what being on CalFresh means for you" page presented as a
// sheet from `SNAPApprovalBannerCard`'s "What this means for you" action.
// Short, factual, non-celebratory — household-budget impact, EBT usage,
// work-requirements reminder. Mirrors the pattern of SNAPDataPrivacyView
// (informational sheet, no state, dismissable).

struct SNAPApprovalExplainerView: View {
    let language: CivicaLanguage
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    headerBlock
                    bullet(
                        title: SNAPApprovalExplainerStrings.budgetTitle,
                        body: SNAPApprovalExplainerStrings.budgetBody
                    )
                    bullet(
                        title: SNAPApprovalExplainerStrings.ebtTitle,
                        body: SNAPApprovalExplainerStrings.ebtBody
                    )
                    bullet(
                        title: SNAPApprovalExplainerStrings.workTitle,
                        body: SNAPApprovalExplainerStrings.workBody
                    )
                    bullet(
                        title: SNAPApprovalExplainerStrings.renewalTitle,
                        body: SNAPApprovalExplainerStrings.renewalBody
                    )
                    Spacer(minLength: CivicaSpacing.lg)
                }
                .padding(CivicaSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle(SNAPApprovalExplainerStrings.navTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(SNAPApprovalExplainerStrings.doneCTA.value(in: language)) {
                        dismiss()
                    }
                }
            }
        }
    }

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPApprovalExplainerStrings.headerTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .accessibilityAddTraits(.isHeader)
            Text(SNAPApprovalExplainerStrings.headerBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func bullet(title: CivicaText, body: CivicaText) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(title.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            Text(body.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

enum SNAPApprovalExplainerStrings {
    static let navTitle = CivicaText("CalFresh", es: "CalFresh", zh: "CalFresh", vi: "CalFresh")
    static let doneCTA = CivicaText("Done", es: "Listo", zh: "完成", vi: "Xong", tl: "Tapos na")

    static let headerTitle = CivicaText(
        "What being on CalFresh means",
        es: "Lo que significa estar en CalFresh",
        zh: "加入 CalFresh 意味着什么",
        vi: "Tham gia CalFresh nghĩa là gì",
        tl: "Ano ang ibig sabihin ng pagiging nasa CalFresh"
    )
    static let headerBody = CivicaText(
        "A short overview of how CalFresh works day-to-day so you know what to expect.",
        es: "Un resumen breve de cómo funciona CalFresh día a día para que sepas qué esperar.",
        zh: "简单介绍 CalFresh 的日常运作方式,让你知道接下来会怎样。",
        vi: "Tóm tắt ngắn gọn cách CalFresh hoạt động hằng ngày để bạn biết những gì sẽ xảy ra.",
        tl: "Maikling pagtanaw kung paano gumagana ang CalFresh araw-araw para alam mo kung ano ang aasahan."
    )

    static let budgetTitle = CivicaText(
        "Your monthly food budget",
        es: "Tu presupuesto mensual para comida",
        zh: "你每月的食物预算",
        vi: "Ngân sách thực phẩm hằng tháng của bạn",
        tl: "Ang iyong buwanang budget para sa pagkain"
    )
    static let budgetBody = CivicaText(
        "Your CalFresh benefit is loaded onto your EBT card every month on the same date. It's calculated from your household size, income, and certain expenses.",
        es: "Tu beneficio de CalFresh se carga en tu tarjeta EBT cada mes en la misma fecha. Se calcula según el tamaño de tu hogar, ingresos y ciertos gastos.",
        zh: "你的 CalFresh 福利每个月在同一天打入你的 EBT 卡。金额根据你的家庭人数、收入和部分支出计算。",
        vi: "Trợ cấp CalFresh của bạn được nạp vào thẻ EBT mỗi tháng vào cùng một ngày. Số tiền được tính dựa trên số người trong hộ gia đình, thu nhập và một số chi phí của bạn.",
        tl: "Ang iyong benepisyo sa CalFresh ay nilalagay sa iyong EBT card kada buwan sa parehong petsa. Kinukwenta ito batay sa laki ng iyong household, kita, at ilang gastusin."
    )

    static let ebtTitle = CivicaText(
        "Using your EBT card",
        es: "Cómo usar tu tarjeta EBT",
        zh: "使用你的 EBT 卡",
        vi: "Sử dụng thẻ EBT của bạn",
        tl: "Paggamit ng iyong EBT card"
    )
    static let ebtBody = CivicaText(
        "Use it like a debit card at most grocery stores and many farmers' markets. It covers groceries and seeds — not hot prepared food, alcohol, or non-food items.",
        es: "Úsala como una tarjeta de débito en la mayoría de las tiendas y muchos mercados de agricultores. Cubre alimentos y semillas — no comida caliente preparada, alcohol ni artículos no alimentarios.",
        zh: "在大多数超市和许多农夫市场,可以像借记卡一样使用。可以买食品和种子 — 不能买热食、酒类或非食品商品。",
        vi: "Dùng nó như một thẻ ghi nợ tại hầu hết các cửa hàng tạp hóa và nhiều chợ nông sản. Thẻ chi trả cho thực phẩm và hạt giống — không dùng cho thức ăn nóng đã chế biến, rượu bia hay các mặt hàng phi thực phẩm.",
        tl: "Gamitin ito tulad ng debit card sa karamihan ng grocery store at maraming farmers' market. Saklaw nito ang groceries at buto ng halaman — hindi mainit na lutong pagkain, alak, o mga bagay na hindi pagkain."
    )

    static let workTitle = CivicaText(
        "Work and reporting",
        es: "Trabajo y reportes",
        zh: "工作和上报",
        vi: "Việc làm và báo cáo",
        tl: "Trabaho at pag-uulat"
    )
    static let workBody = CivicaText(
        "If your income or household size changes, report it to your county. Some adults have work requirements — your approval notice will say if that applies to you.",
        es: "Si tus ingresos o el tamaño de tu hogar cambian, repórtalo a tu condado. Algunos adultos tienen requisitos de trabajo — tu aviso de aprobación indicará si te aplica.",
        zh: "如果你的收入或家庭人数发生变化,请向你所在的 county 上报。部分成年人有工作要求 — 你的批准通知会说明是否适用于你。",
        vi: "Nếu thu nhập hoặc số người trong hộ gia đình của bạn thay đổi, hãy báo cáo cho county của bạn. Một số người trưởng thành có yêu cầu về việc làm — thông báo phê duyệt của bạn sẽ cho biết điều đó có áp dụng cho bạn hay không.",
        tl: "Kung magbago ang iyong kita o laki ng household, iulat ito sa iyong county. May ilang adult na may work requirements — sasabihin sa iyong approval notice kung naaangkop ito sa iyo."
    )

    static let renewalTitle = CivicaText(
        "Renewing each year",
        es: "Renovación cada año",
        zh: "每年续办",
        vi: "Gia hạn mỗi năm",
        tl: "Pag-renew kada taon"
    )
    static let renewalBody = CivicaText(
        "Your benefits last about a year before you renew. We'll remind you when it's time and pre-fill what we already have.",
        es: "Tus beneficios duran aproximadamente un año antes de la renovación. Te recordaremos cuando sea el momento y pre-llenaremos lo que ya tenemos.",
        zh: "你的福利大约持续一年,之后需要续办。到时候我们会提醒你,并预先填好已有的信息。",
        vi: "Trợ cấp của bạn kéo dài khoảng một năm trước khi bạn cần gia hạn. Chúng tôi sẽ nhắc bạn khi đến hạn và điền sẵn những thông tin chúng tôi đã có.",
        tl: "Tumatagal ng mga isang taon ang iyong benepisyo bago mag-renew. Paaalalahanan ka namin kapag panahon na at iro-fill na namin nang maaga ang nasa amin na."
    )
}

#if DEBUG
struct SNAPApprovalExplainerView_Previews: PreviewProvider {
    static var previews: some View {
        SNAPApprovalExplainerView(language: .english)
    }
}
#endif