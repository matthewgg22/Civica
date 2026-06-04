import CivicaDesignSystem
import SwiftUI
import UIKit

// HANDOFF FormErrorBoard: "Failure has its own design surface."
//
// When a captured document fails the on-device quality gate
// (boundary not detected, too blurry, dark, or bright), name the
// failure precisely, show what we got, and offer two routes: retake,
// or keep this photo and let the DTA caseworker ask for a clearer
// one. Never just "Error."
//
// The board's third route ("type the amounts in instead") doesn't
// apply to Civica's current flow -- income numbers were already
// collected upstream in SNAPIncomeFlow. The paystub capture here is
// for state verification, not for extracting numbers we don't have.
// So we honor the board's structure with two routes, not three.
//
// Rendered as a .sheet from SNAPDocumentsChecklistFlowView after a
// failed quality check. Dismissing the sheet returns to the checklist
// with the captured image still recorded -- the user chose to keep
// the marginal photo.

struct SNAPDocumentRetryView: View {
    let capturedImage: UIImage
    let quality: SNAPDocumentQualityResult
    let documentType: SNAPDocumentType
    let language: CivicaLanguage
    let onRetake: () -> Void
    let onKeepAnyway: () -> Void
    let onUseDifferentDocument: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            eyebrowAndTitle

            imagePreview

            reasonBanner

            tipsCard

            Spacer(minLength: 0)
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.top, CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(CivicaColors.paper.ignoresSafeArea())
        .safeAreaInset(edge: .bottom) {
            actionStack
                .padding(.horizontal, CivicaSpacing.xl)
                .padding(.vertical, CivicaSpacing.md)
                .background(CivicaColors.paper.ignoresSafeArea(edges: .bottom))
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Sections

    private var eyebrowAndTitle: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPDocumentRetryStrings.eyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(SNAPDocumentRetryStrings.title.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var imagePreview: some View {
        ZStack(alignment: .topLeading) {
            Image(uiImage: capturedImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(maxWidth: .infinity)
                .frame(height: 120)
                .clipped()
            Rectangle()
                .fill(.black.opacity(0.18))
            Text(SNAPDocumentRetryStrings.previewBadge.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.paper)
                .textCase(.uppercase)
                .kerning(1.5)
                .padding(.horizontal, CivicaSpacing.sm)
                .padding(.vertical, 3)
                .background(.black.opacity(0.45))
                .clipShape(Capsule())
                .padding(CivicaSpacing.sm)
        }
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .accessibilityLabel(SNAPDocumentRetryStrings.previewAccessibility.value(in: language))
    }

    private var reasonBanner: some View {
        // Text VStack hugs its own height; the pine accent bar is a
        // LEADING-EDGE OVERLAY (not an HStack sibling). The previous
        // layout used a flexible `Rectangle().frame(width: 4)` as a
        // sibling — a Shape with no height is infinitely flexible
        // vertically, so it stretched the banner to the full proposed
        // height, producing the giant empty box device QA flagged.
        VStack(alignment: .leading, spacing: 2) {
            Text(headlineReason)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text(detailedReason)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(CivicaSpacing.md)
        .padding(.leading, CivicaSpacing.sm)   // room for the stripe
        .background(CivicaColors.surfacePrimary)
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2)
                .fill(CivicaColors.pinePrimary)
                .frame(width: 4)
                .padding(.vertical, CivicaSpacing.sm)
                .accessibilityHidden(true)
        }
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.pinePrimary.opacity(0.25), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(headlineReason). \(detailedReason)")
    }

    private var tipsCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPDocumentRetryStrings.tipsLabel.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            VStack(alignment: .leading, spacing: 4) {
                ForEach(SNAPDocumentRetryStrings.tips(language: language), id: \.self) { tip in
                    HStack(alignment: .top, spacing: CivicaSpacing.xs) {
                        Text("·")
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.graphite)
                            .accessibilityHidden(true)
                        Text(tip)
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var actionStack: some View {
        VStack(spacing: CivicaSpacing.xs) {
            Button(action: onRetake) {
                Text(SNAPDocumentRetryStrings.retakeCTA.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.paper)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.sm)
                    .background(CivicaColors.pinePrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            }
            .buttonStyle(.plain)

            Button(action: onKeepAnyway) {
                Text(SNAPDocumentRetryStrings.keepAnywayCTA.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.sm)
                    .background(CivicaColors.surfacePrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .strokeBorder(CivicaColors.ink.opacity(0.2), lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)

            Button(action: onUseDifferentDocument) {
                Text(SNAPDocumentRetryStrings.differentDocumentCTA.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, CivicaSpacing.xs)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(
                SNAPDocumentRetryStrings.differentDocumentCTA
                    .value(in: language)
                    .replacingOccurrences(of: "→", with: "")
                    .trimmingCharacters(in: .whitespaces)
            )
        }
    }

    // MARK: - Failure copy

    /// Maps the first rejection reason to a short headline. Multiple
    /// reasons collapse to the most-actionable one (boundary first
    /// because nothing else matters if we can't find the document at
    /// all).
    private var headlineReason: String {
        if quality.rejections.contains(.boundaryNotDetected) {
            return SNAPDocumentRetryStrings.reasonBoundary.value(in: language)
        }
        if quality.rejections.contains(.tooBlurry) {
            return SNAPDocumentRetryStrings.reasonBlurry.value(in: language)
        }
        if quality.rejections.contains(.tooDark) {
            return SNAPDocumentRetryStrings.reasonDark.value(in: language)
        }
        if quality.rejections.contains(.tooBright) {
            return SNAPDocumentRetryStrings.reasonBright.value(in: language)
        }
        return SNAPDocumentRetryStrings.reasonGeneric.value(in: language)
    }

    private var detailedReason: String {
        if quality.rejections.contains(.boundaryNotDetected) {
            return SNAPDocumentRetryStrings.detailBoundary.value(in: language)
        }
        if quality.rejections.contains(.tooBlurry) {
            return SNAPDocumentRetryStrings.detailBlurry.value(in: language)
        }
        if quality.rejections.contains(.tooDark) {
            return SNAPDocumentRetryStrings.detailDark.value(in: language)
        }
        if quality.rejections.contains(.tooBright) {
            return SNAPDocumentRetryStrings.detailBright.value(in: language)
        }
        return SNAPDocumentRetryStrings.detailGeneric.value(in: language)
    }
}

// MARK: - Strings

enum SNAPDocumentRetryStrings {

    static let eyebrow = CivicaText(
        "Photo · what we got",
        es: "Foto · lo que recibimos",
        zh: "照片 · 我们收到的",
        vi: "Ảnh · những gì chúng tôi nhận được",
        tl: "Larawan · ang natanggap namin"
    )
    static let title = CivicaText(
        "We couldn't read it clearly.",
        es: "No la pudimos leer claramente.",
        zh: "我们没办法看清楚。",
        vi: "Chúng tôi không đọc rõ được.",
        tl: "Hindi namin ito mabasa nang malinaw."
    )

    static let whatWeGotLabel = CivicaText(
        "Your photo",
        es: "Tu foto",
        zh: "你的照片",
        vi: "Ảnh của bạn",
        tl: "Ang larawan mo"
    )
    static let previewBadge = CivicaText(
        "Hard to read",
        es: "Difícil de leer",
        zh: "难以辨认",
        vi: "Khó đọc",
        tl: "Mahirap basahin"
    )
    static let previewAccessibility = CivicaText(
        "The photo you just took. Marked as hard to read by Civica's on-device check.",
        es: "La foto que acabas de tomar. Marcada como difícil de leer por la verificación local de Civica.",
        zh: "你刚刚拍的照片。Civica 本地检查标记为难以辨认。",
        vi: "Ảnh bạn vừa chụp. Được kiểm tra ngay trên máy của Civica đánh dấu là khó đọc.",
        tl: "Ang larawang katatapos mo lang kunan. Minarkahan bilang mahirap basahin ng on-device na pagsusuri ng Civica."
    )

    static let tipsLabel = CivicaText(
        "What usually helps",
        es: "Lo que suele ayudar",
        zh: "通常有帮助的做法",
        vi: "Những cách thường có ích",
        tl: "Ang madalas na nakakatulong"
    )
    static let retakeCTA = CivicaText(
        "Take another photo",
        es: "Tomar otra foto",
        zh: "再拍一张",
        vi: "Chụp lại ảnh khác",
        tl: "Kumuha ng bagong larawan"
    )
    static let keepAnywayCTA = CivicaText(
        "Keep this photo anyway",
        es: "Quedarme con esta foto",
        zh: "仍然保留这张照片",
        vi: "Vẫn giữ ảnh này",
        tl: "Panatilihin pa rin ang larawang ito"
    )
    static let differentDocumentCTA = CivicaText(
        "Skip and use a different document →",
        es: "Saltar y usar otro documento →",
        zh: "跳过并使用其他文件 →",
        vi: "Bỏ qua và dùng giấy tờ khác →",
        tl: "Laktawan at gumamit ng ibang dokumento →"
    )

    // MARK: - Reason headlines (one per rejection mode)

    static let reasonBoundary = CivicaText(
        "We couldn't find the edges of the document",
        es: "No encontramos los bordes del documento",
        zh: "我们找不到文件的边缘",
        vi: "Chúng tôi không tìm thấy các mép của giấy tờ",
        tl: "Hindi namin makita ang mga gilid ng dokumento"
    )
    static let reasonBlurry = CivicaText(
        "The photo came out too blurry",
        es: "La foto salió muy borrosa",
        zh: "照片拍得太模糊了",
        vi: "Ảnh chụp ra quá mờ",
        tl: "Masyadong malabo ang lumabas na larawan"
    )
    static let reasonDark = CivicaText(
        "The photo is too dark",
        es: "La foto está muy oscura",
        zh: "照片太暗了",
        vi: "Ảnh quá tối",
        tl: "Masyadong madilim ang larawan"
    )
    static let reasonBright = CivicaText(
        "There's too much glare on the photo",
        es: "Hay demasiado reflejo en la foto",
        zh: "照片上反光太多了",
        vi: "Ảnh bị chói sáng quá nhiều",
        tl: "Masyadong maraming silaw sa larawan"
    )
    static let reasonGeneric = CivicaText(
        "Something looked off about this photo",
        es: "Algo no se ve bien en esta foto",
        zh: "这张照片看起来有点不对劲",
        vi: "Có gì đó không ổn với ảnh này",
        tl: "May mukhang hindi tama sa larawang ito"
    )

    // MARK: - Reason details

    static let detailBoundary = CivicaText(
        "All four corners of the document need to be in frame. Try placing it on a dark surface so the edges stand out.",
        es: "Las cuatro esquinas del documento deben estar en el cuadro. Intenta ponerlo sobre una superficie oscura para que se vean los bordes.",
        zh: "文件的四个角都要在画面里。试着把它放在深色的桌面上,这样边缘会更清楚。",
        vi: "Cả bốn góc của giấy tờ phải nằm trong khung hình. Thử đặt nó lên bề mặt tối để các mép nổi rõ.",
        tl: "Kailangang nasa frame lahat ng apat na sulok ng dokumento. Subukan itong ilagay sa madilim na ibabaw para lumitaw ang mga gilid."
    )
    static let detailBlurry = CivicaText(
        "The text and numbers came back too unclear to verify. Hold the phone steady and tap the screen to focus before snapping.",
        es: "El texto y los números se ven muy poco claros. Sujeta el teléfono firme y toca la pantalla para enfocar antes de tomar la foto.",
        zh: "文字和数字太模糊,没办法核对。把手机拿稳,拍之前点一下屏幕对焦。",
        vi: "Chữ và số chụp ra quá mờ nên không kiểm tra được. Giữ điện thoại thật chắc và chạm vào màn hình để lấy nét trước khi chụp.",
        tl: "Masyadong malabo ang mga teksto at numero para ma-verify. Hawakan nang matatag ang telepono at i-tap ang screen para mag-focus bago kumuha."
    )
    static let detailDark = CivicaText(
        "Move to brighter light, or turn on your phone's flashlight before retaking.",
        es: "Muévete a un lugar con más luz, o enciende la linterna de tu teléfono antes de tomarla de nuevo.",
        zh: "换到光线更亮的地方,或者重拍前打开手机的手电筒。",
        vi: "Hãy chuyển đến chỗ sáng hơn, hoặc bật đèn pin điện thoại trước khi chụp lại.",
        tl: "Lumipat sa mas maliwanag na ilaw, o buksan ang flashlight ng telepono mo bago kumuha ulit."
    )
    static let detailBright = CivicaText(
        "Sunlight or a lamp shining directly on the document washes out the text. Try a softer angle or step into the shade.",
        es: "La luz directa del sol o una lámpara apaga el texto. Intenta un ángulo más suave o muévete a la sombra.",
        zh: "阳光或台灯直射文件会让文字看不清。换个柔和一点的角度,或者挪到阴影里。",
        vi: "Ánh nắng hoặc đèn chiếu thẳng vào giấy tờ sẽ làm mờ chữ. Thử một góc dịu hơn hoặc bước vào chỗ râm.",
        tl: "Ang sikat ng araw o lampara na tumatama nang direkta sa dokumento ay nagpaparusot ng teksto. Subukan ang mas malambot na anggulo o pumunta sa lilim."
    )
    static let detailGeneric = CivicaText(
        "Civica's on-device check flagged the photo. Retake or keep it and the caseworker will let us know if it's good enough.",
        es: "La verificación local de Civica marcó la foto. Vuelve a tomarla o quédate con ella y el asesor nos dirá si es suficiente.",
        zh: "Civica 的本地检查标记了这张照片。你可以重拍,或者保留它 —— 案件管理员会告诉我们是否够用。",
        vi: "Phần kiểm tra ngay trên máy của Civica đã đánh dấu ảnh này. Bạn có thể chụp lại hoặc giữ nó — nhân viên phụ trách hồ sơ sẽ cho chúng tôi biết nếu ảnh đủ rõ.",
        tl: "Minarkahan ng on-device na pagsusuri ng Civica ang larawan. Kumuha ulit o panatilihin ito at sasabihin sa amin ng caseworker kung sapat na ito."
    )

    // MARK: - Tips (always shown)

    static func tips(language: CivicaLanguage) -> [String] {
        switch language {
        case .english:
            return [
                "Place the document on a dark surface — a kitchen table works.",
                "Tap the screen to focus before snapping.",
                "Make sure all four corners are in frame.",
                "Daylight or a phone flashlight is better than a lamp.",
            ]
        case .tagalog:
            return [
                "Ilagay ang dokumento sa madilim na ibabaw — pwede na ang mesa sa kusina.",
                "I-tap ang screen para mag-focus bago kumuha.",
                "Siguraduhing nasa frame lahat ng apat na sulok.",
                "Mas maganda ang liwanag ng araw o flashlight ng telepono kaysa lampara.",
            ]
        case .mandarin:
            return [
                "把文件放在深色的桌面上 —— 厨房桌子就可以。",
                "拍之前点一下屏幕对焦。",
                "确认四个角都在画面里。",
                "自然光或手机手电筒比台灯效果更好。",
            ]
        case .spanish:
            return [
                "Pon el documento sobre una superficie oscura — la mesa de la cocina funciona.",
                "Toca la pantalla para enfocar antes de tomar la foto.",
                "Asegúrate de que las cuatro esquinas estén en el cuadro.",
                "La luz del día o la linterna del teléfono funcionan mejor que una lámpara.",
            ]
        case .vietnamese:
            return [
                "Đặt giấy tờ lên bề mặt tối — bàn bếp là được.",
                "Chạm vào màn hình để lấy nét trước khi chụp.",
                "Đảm bảo cả bốn góc đều nằm trong khung hình.",
                "Ánh sáng ban ngày hoặc đèn pin điện thoại tốt hơn đèn bàn.",
            ]
        }
    }
}

#if DEBUG
struct SNAPDocumentRetryView_Previews: PreviewProvider {
    static var previews: some View {
        let placeholder = UIGraphicsImageRenderer(size: CGSize(width: 400, height: 280)).image { ctx in
            UIColor(red: 0.20, green: 0.18, blue: 0.16, alpha: 1).setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 400, height: 280))
        }
        return NavigationStack {
            SNAPDocumentRetryView(
                capturedImage: placeholder,
                quality: SNAPDocumentQualityResult(
                    passed: false,
                    rejections: [.tooBlurry],
                    blurScore: 2.0,
                    luminance: 0.45
                ),
                documentType: .proofOfIncome,
                language: .english,
                onRetake: {},
                onKeepAnyway: {},
                onUseDifferentDocument: {}
            )
        }
    }
}
#endif
