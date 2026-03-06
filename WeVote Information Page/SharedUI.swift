//
//  SharedUI.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//

import SwiftUI
import UIKit

func localizedCatalogString(
    _ key: String,
    tableName: String,
    locale: Locale,
    fallback: String
) -> String {
    let localeIdentifier = locale.identifier.replacingOccurrences(of: "_", with: "-")
    var candidateCodes: [String] = []

    if !localeIdentifier.isEmpty {
        candidateCodes.append(localeIdentifier)
        if let languageSubtag = localeIdentifier.split(separator: "-").first {
            candidateCodes.append(String(languageSubtag))
        }
    }

    if let languageCode = locale.language.languageCode?.identifier {
        candidateCodes.append(languageCode)
    }

    candidateCodes.append("en")

    var seen = Set<String>()
    let uniqueCandidates = candidateCodes.filter { seen.insert($0).inserted }

    for code in uniqueCandidates {
        guard let path = Bundle.main.path(forResource: code, ofType: "lproj"),
              let bundle = Bundle(path: path) else {
            continue
        }

        let localized = bundle.localizedString(forKey: key, value: nil, table: tableName)
        if localized != key {
            return localized
        }
    }

    let mainBundleValue = Bundle.main.localizedString(forKey: key, value: nil, table: tableName)
    if mainBundleValue != key {
        return mainBundleValue
    }

    return fallback
}

extension Notification.Name {
    static let toggleWhyVoteOverlay = Notification.Name("toggleWhyVoteOverlay")
}

private enum WhyVoteOverlayUserInfoKey {
    static let originX = "originX"
    static let originY = "originY"
}

private enum WhyVoteSpreadOrigin {
    static let yOffset: CGFloat = 12
}

private struct FramePreferenceKey: PreferenceKey {
    static var defaultValue: CGRect = .zero
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        let next = nextValue()
        if next != .zero {
            value = next
        }
    }
}

private struct ReportFrameModifier: ViewModifier {
    let coordinateSpace: CoordinateSpace

    func body(content: Content) -> some View {
        content.background(
            GeometryReader { geo in
                Color.clear.preference(
                    key: FramePreferenceKey.self,
                    value: geo.frame(in: coordinateSpace)
                )
            }
        )
    }
}

private extension View {
    func reportFrame(in coordinateSpace: CoordinateSpace) -> some View {
        modifier(ReportFrameModifier(coordinateSpace: coordinateSpace))
    }
}

struct PageHeader: View {
    let title: Text
    var iconSize: CGFloat = 56
    @State private var iconFrameInSpreadSpace: CGRect = .zero

    init(title: Text, iconSize: CGFloat = 56) {
        self.title = title
        self.iconSize = iconSize
    }

    init(title: String, iconSize: CGFloat = 56) {
        self.title = Text(verbatim: title)
        self.iconSize = iconSize
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Button {
                guard iconFrameInSpreadSpace != .zero else { return }
                let origin = CGPoint(
                    x: iconFrameInSpreadSpace.midX,
                    y: iconFrameInSpreadSpace.maxY + WhyVoteSpreadOrigin.yOffset
                )
                NotificationCenter.default.post(
                    name: .toggleWhyVoteOverlay,
                    object: nil,
                    userInfo: [
                        WhyVoteOverlayUserInfoKey.originX: origin.x,
                        WhyVoteOverlayUserInfoKey.originY: origin.y
                    ]
                )
            } label: {
                VoteNowLogoIcon(size: iconSize)
                    .frame(width: iconSize, height: iconSize)
                    .fixedSize(horizontal: true, vertical: true)
                    .reportFrame(in: .named("SpreadSpace"))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Toggle Why Vote overlay")

            title
                .font(.largeTitle)
                .fontWeight(.bold)
                .lineLimit(1)
                .minimumScaleFactor(0.84)
                .padding(.top, 2)
                .frame(minHeight: iconSize, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
        .onPreferenceChange(FramePreferenceKey.self) { newFrame in
            guard newFrame != .zero else { return }
            guard newFrame != iconFrameInSpreadSpace else { return }
            DispatchQueue.main.async {
                iconFrameInSpreadSpace = newFrame
            }
        }
    }
}

struct VoteNowLogoIcon: View {
    var size: CGFloat = 50
    var backgroundColor: Color = Color(red: 0.68, green: 0.84, blue: 0.90) // #ADD7E5-ish icon tone
    var stripeColor: Color = Color(red: 223.0 / 255.0, green: 88.0 / 255.0, blue: 69.0 / 255.0) // #DF5845
    var cornerRadiusScale: CGFloat = 0.24
    var borderColor: Color = VoteNowColors.surfaceWhite.opacity(0.9)
    var borderWidth: CGFloat = 0.6
    var shadowColor: Color = VoteNowColors.primaryText.opacity(0.14)

    var body: some View {
        let stripeScaleY: CGFloat = size < 30 ? 0.95 : 0.80
        let stripeScaleX: CGFloat = 0.80
        let motifWidth = size * 0.82
        let barHeight = max(2.4, size * 0.072)
        let gap = size * 0.045
        let topWidth = motifWidth * 0.56
        let iconCornerRadius = size * cornerRadiusScale

        ZStack {
            RoundedRectangle(cornerRadius: iconCornerRadius, style: .continuous)
                .fill(backgroundColor)

            VStack(spacing: gap) {
                topStripe(width: topWidth, height: barHeight, containerWidth: motifWidth)
                topStripe(width: topWidth, height: barHeight, containerWidth: motifWidth)
                topStripe(width: topWidth, height: barHeight, containerWidth: motifWidth)
                bottomStripe(width: motifWidth, height: barHeight)
                bottomStripe(width: motifWidth, height: barHeight)
                bottomStripe(width: motifWidth, height: barHeight)
            }
            .frame(width: motifWidth, height: barHeight * 6 + gap * 5)
            .scaleEffect(x: stripeScaleX, y: stripeScaleY, anchor: .center)
        }
        .frame(width: size, height: size)
        .overlay(
            RoundedRectangle(cornerRadius: iconCornerRadius, style: .continuous)
                .stroke(borderColor, lineWidth: borderWidth)
        )
        .shadow(color: shadowColor, radius: 2.5, x: 0, y: 1.2)
    }

    @ViewBuilder
    private func topStripe(width: CGFloat, height: CGFloat, containerWidth: CGFloat) -> some View {
        HStack {
            Spacer(minLength: 0)
            Rectangle()
                .fill(stripeColor)
                .frame(width: width, height: height)
        }
        .frame(width: containerWidth, alignment: .trailing)
    }

    @ViewBuilder
    private func bottomStripe(width: CGFloat, height: CGFloat) -> some View {
        Rectangle()
            .fill(stripeColor)
            .frame(width: width, height: height)
    }
}

extension VoteNowLogoIcon {
    static let tabBarUIImage: UIImage = {
        let renderer = ImageRenderer(content: VoteNowLogoIcon(size: 28))
        renderer.scale = UIScreen.main.scale
        return (renderer.uiImage ?? UIImage()).withRenderingMode(.alwaysOriginal)
    }()

    static let tabBarBarsUIImage: UIImage = {
        let renderer = ImageRenderer(content: VoteNowTabBarsIcon(size: 28))
        renderer.scale = UIScreen.main.scale
        return (renderer.uiImage ?? UIImage()).withRenderingMode(.alwaysOriginal)
    }()
}

private struct VoteNowTabBarsIcon: View {
    var size: CGFloat = 28
    var color: Color = Color(red: 223.0 / 255.0, green: 88.0 / 255.0, blue: 69.0 / 255.0)
    var horizontalStretch: CGFloat = 1.5

    var body: some View {
        let canvasWidth = size * horizontalStretch
        let motifWidth = canvasWidth * 0.76
        let barHeight = max(2.0, size * 0.10)
        let spacing = max(1.0, size * 0.048)
        let topWidth = motifWidth * 0.56

        VStack(spacing: spacing) {
            topStripe(width: topWidth, height: barHeight, containerWidth: motifWidth)
            topStripe(width: topWidth, height: barHeight, containerWidth: motifWidth)
            topStripe(width: topWidth, height: barHeight, containerWidth: motifWidth)

            Rectangle()
                .fill(color)
                .frame(width: motifWidth, height: barHeight)
            Rectangle()
                .fill(color)
                .frame(width: motifWidth, height: barHeight)
            Rectangle()
                .fill(color)
                .frame(width: motifWidth, height: barHeight)
        }
        .frame(width: motifWidth)
        .frame(width: canvasWidth, height: size, alignment: .center)
    }

    @ViewBuilder
    private func topStripe(
        width: CGFloat,
        height: CGFloat,
        containerWidth: CGFloat
    ) -> some View {
        HStack {
            Spacer(minLength: 0)
            Rectangle()
                .fill(color)
                .frame(width: width, height: height)
        }
        .frame(width: containerWidth, alignment: .trailing)
    }
}

struct WhyVoteFloodOverlay: View {
    @Binding var isPresented: Bool
    var originInSpreadSpace: CGPoint?

    private let floodColor = Color(red: 173.0 / 255.0, green: 215.0 / 255.0, blue: 229.0 / 255.0) // #ADD7E5
    private let accent = Color(red: 223.0 / 255.0, green: 88.0 / 255.0, blue: 69.0 / 255.0) // #DF5845
    private let logoSize: CGFloat = 50
    private let headerHorizontalPadding: CGFloat = 16
    // Matches page layout: outer content padding (16) + header top padding (4).
    private let headerTopPadding: CGFloat = 20
    private let duration: Double = 0.86
    private let directionalBias: CGFloat = 0.06
    private let softness: CGFloat = 2.5
    @State private var spread: CGFloat = 0.001
    @State private var resolvedOriginInSpreadSpace: CGPoint?

    var body: some View {
        GeometryReader { geo in
            let frameInSpreadSpace = geo.frame(in: .named("SpreadSpace"))
            let fallbackInSpreadSpace = CGPoint(
                x: frameInSpreadSpace.minX + headerHorizontalPadding + (logoSize / 2),
                y: frameInSpreadSpace.minY + headerTopPadding + (logoSize / 2)
            )
            let spreadSpaceOrigin = resolvedOriginInSpreadSpace ?? originInSpreadSpace ?? fallbackInSpreadSpace
            let localOrigin = CGPoint(
                x: spreadSpaceOrigin.x - frameInSpreadSpace.minX,
                y: spreadSpaceOrigin.y - frameInSpreadSpace.minY
            )

            ZStack(alignment: .topLeading) {
                floodColor
                    .mask {
                        WhyVoteDirectionalRevealMask(
                            origin: localOrigin,
                            progress: spread,
                            direction: CGVector(dx: 1.0, dy: 0.0), // nearly uniform spread
                            bias: directionalBias,
                            softness: softness
                        )
                    }
                    .ignoresSafeArea()

                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .center, spacing: 12) {
                        Button {
                            withAnimation(.easeOut(duration: max(0.2, duration * 0.5))) {
                                spread = 0.001
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + max(0.2, duration * 0.5)) {
                                isPresented = false
                            }
                        } label: {
                            VoteNowLogoIcon(
                                size: logoSize,
                                backgroundColor: .white, // inverse from blue -> white
                                stripeColor: accent,
                                borderColor: .white.opacity(0.9),
                                shadowColor: .black.opacity(0.14)
                            )
                            .frame(width: logoSize, height: logoSize)
                            .fixedSize(horizontal: true, vertical: true)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Close Why Vote overlay")

                        Text("Why Vote?")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .lineLimit(1)
                            .frame(height: logoSize, alignment: .center)
                            .foregroundColor(accent)
                            .opacity(spread > 0.65 ? 1 : 0)

                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, headerHorizontalPadding)
                    .padding(.top, headerTopPadding)

                    WhyVoteView()
                        .opacity(spread > 0.72 ? 1 : 0)
                }
            }
            .contentShape(Rectangle())
            .onAppear {
                spread = 0.001
                resolvedOriginInSpreadSpace = nil
                DispatchQueue.main.async {
                    if let provided = originInSpreadSpace, provided != .zero {
                        resolvedOriginInSpreadSpace = provided
                    } else {
                        resolvedOriginInSpreadSpace = fallbackInSpreadSpace
                    }
                    withAnimation(.easeInOut(duration: duration)) {
                        spread = 1.0
                    }
                }
            }
        }
    }
}

struct WhyCallFloodOverlay: View {
    @Binding var isPresented: Bool
    var originInSpreadSpace: CGPoint?
    var onStartCalling: () -> Void = {}

    private let floodColor = Color(red: 173.0 / 255.0, green: 215.0 / 255.0, blue: 229.0 / 255.0)
    private let accent = Color(red: 223.0 / 255.0, green: 88.0 / 255.0, blue: 69.0 / 255.0)
    private let logoSize: CGFloat = 50
    private let headerHorizontalPadding: CGFloat = 16
    private let headerTopPadding: CGFloat = 4
    private let duration: Double = 0.86
    private let directionalBias: CGFloat = 0.06
    private let softness: CGFloat = 2.5
    @State private var spread: CGFloat = 0.001
    @State private var resolvedOriginInSpreadSpace: CGPoint?

    var body: some View {
        GeometryReader { geo in
            let frameInSpreadSpace = geo.frame(in: .named("SpreadSpace"))
            let fallbackInSpreadSpace = CGPoint(
                x: frameInSpreadSpace.minX + headerHorizontalPadding + (logoSize / 2),
                y: frameInSpreadSpace.minY + headerTopPadding + (logoSize / 2)
            )
            let spreadSpaceOrigin = resolvedOriginInSpreadSpace ?? originInSpreadSpace ?? fallbackInSpreadSpace
            let localOrigin = CGPoint(
                x: spreadSpaceOrigin.x - frameInSpreadSpace.minX,
                y: spreadSpaceOrigin.y - frameInSpreadSpace.minY
            )

            ZStack(alignment: .topLeading) {
                floodColor
                    .mask {
                        WhyVoteDirectionalRevealMask(
                            origin: localOrigin,
                            progress: spread,
                            direction: CGVector(dx: 1.0, dy: 0.0),
                            bias: directionalBias,
                            softness: softness
                        )
                    }
                    .ignoresSafeArea()

                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .center, spacing: 12) {
                        Button {
                            withAnimation(.easeOut(duration: max(0.2, duration * 0.5))) {
                                spread = 0.001
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + max(0.2, duration * 0.5)) {
                                isPresented = false
                            }
                        } label: {
                            VoteNowLogoIcon(
                                size: logoSize,
                                backgroundColor: .white,
                                stripeColor: accent,
                                borderColor: .white.opacity(0.9),
                                shadowColor: .black.opacity(0.14)
                            )
                            .frame(width: logoSize, height: logoSize)
                            .fixedSize(horizontal: true, vertical: true)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Close Why Call overlay")

                        Text("Why Call")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .lineLimit(1)
                            .frame(height: logoSize, alignment: .center)
                            .foregroundColor(accent)
                            .opacity(spread > 0.65 ? 1 : 0)

                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, headerHorizontalPadding)
                    .padding(.top, headerTopPadding)

                    WhyCallView(content: .live) {
                        withAnimation(.easeOut(duration: max(0.2, duration * 0.5))) {
                            spread = 0.001
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + max(0.2, duration * 0.5)) {
                            isPresented = false
                            onStartCalling()
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .opacity(spread > 0.72 ? 1 : 0)
                }
            }
            .contentShape(Rectangle())
            .onAppear {
                spread = 0.001
                resolvedOriginInSpreadSpace = nil
                DispatchQueue.main.async {
                    if let provided = originInSpreadSpace, provided != .zero {
                        resolvedOriginInSpreadSpace = provided
                    } else {
                        resolvedOriginInSpreadSpace = fallbackInSpreadSpace
                    }
                    withAnimation(.easeInOut(duration: duration)) {
                        spread = 1.0
                    }
                }
            }
        }
    }
}

struct WhyCallStat: Identifiable, Hashable {
    let id = UUID()
    let value: String
    let title: String
    let body: String
}

struct WhyCallReason: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let body: String
}

struct WhyCallContent: Hashable {
    let eyebrow: String
    let title: String
    let intro: String
    let context: String
    let stats: [WhyCallStat]
    let reasons: [WhyCallReason]
    let note: String
    let primaryCTA: String

    static let live = WhyCallContent(
        eyebrow: "Research-backed",
        title: "Why call?",
        intro: "Calling your reps is a fast, personal way to put your opinion on the record while a decision is still live.",
        context: "Most Americans do not contact Congress in a given year. Surveys suggest only about one in five to one in four people reach out annually, and email is more common than calling. Even so, calling remains one of the fastest, most direct ways to make your view known before a hearing, vote, or other key legislative moment.",
        stats: [
            WhyCallStat(
                value: "21.7%–23%",
                title: "Most people do not reach out",
                body: "Recent survey findings suggest only a minority of Americans contact Congress or other elected officials in a given year."
            ),
            WhyCallStat(
                value: "86%",
                title: "Calls matter when it's live",
                body: "Phone calls have some or a lot of influence when a member is undecided."
            ),
            WhyCallStat(
                value: "20% vs 1%",
                title: "Personal beats copied",
                body: "Personalized messages are much more influential than identical form messages."
            ),
            WhyCallStat(
                value: "Tracked by offices",
                title: "Your view gets logged",
                body: "Congressional offices track which issues are most salient and where constituents stand."
            )
        ],
        reasons: [
            WhyCallReason(
                title: "Your voice becomes visible",
                body: "A call helps your opinion get counted as constituent input."
            ),
            WhyCallReason(
                title: "Personal beats generic",
                body: "Your own words carry more weight than a canned message."
            ),
            WhyCallReason(
                title: "Local impact matters",
                body: "The strongest calls explain how the issue affects you, your family, or your community."
            )
        ],
        note: "Based on findings from Pew Research Center, the Congressional Management Foundation, and academic research on congressional constituent contact.",
        primaryCTA: "Start Calling Reps!"
    )
}

struct WhyCallView: View {
    let content: WhyCallContent
    let onStartCalling: () -> Void

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                WhyCallHero(content: content)

                Text(content.context)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(cardBackground)
                    .overlay(cardBorder)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                VStack(alignment: .leading, spacing: 10) {
                    Text("What research shows")
                        .font(.headline)
                        .foregroundStyle(.primary)

                    ForEach(content.stats) { stat in
                        WhyCallStatCard(stat: stat)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Why calling matters")
                        .font(.headline)
                        .foregroundStyle(.primary)

                    ForEach(content.reasons) { reason in
                        WhyCallReasonCard(reason: reason)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 20)
        }
        .safeAreaInset(edge: .bottom) {
            WhyCallBottomCTA(note: content.note, title: content.primaryCTA, action: onStartCalling)
        }
    }

    private var cardBackground: some ShapeStyle {
        Color(uiColor: .secondarySystemBackground).opacity(0.92)
    }

    private var cardBorder: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
    }
}

private struct WhyCallHero: View {
    let content: WhyCallContent

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(content.eyebrow.uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(VoteNowColors.mutedText)

            Text(content.title)
                .font(.title.bold())
                .foregroundStyle(.primary)

            Text(content.intro)
                .font(.body)
                .foregroundStyle(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct WhyCallStatCard: View {
    let stat: WhyCallStat

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(stat.value)
                .font(.title2.weight(.bold))
                .foregroundStyle(VoteNowColors.primaryCTA)
            Text(stat.title)
                .font(.headline)
                .foregroundStyle(.primary)
            Text(stat.body)
                .font(.body)
                .foregroundStyle(.primary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemBackground).opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}

private struct WhyCallReasonCard: View {
    let reason: WhyCallReason

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(reason.title)
                .font(.headline)
                .foregroundStyle(.primary)
            Text(reason.body)
                .font(.body)
                .foregroundStyle(.primary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemBackground).opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}

private struct WhyCallBottomCTA: View {
    let note: String
    let title: String
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(note)
                .font(.footnote)
                .foregroundStyle(VoteNowColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)

            Button(action: action) {
                Text(title)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(VoteNowPrimaryCTAButtonStyle())
            .accessibilityLabel("Start Calling Reps")
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 10)
        .background(
            Rectangle()
                .fill(Color(uiColor: .systemBackground).opacity(0.96))
                .ignoresSafeArea(edges: .bottom)
        )
    }
}

struct WhyCallView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            WhyCallView(content: .live, onStartCalling: {})
                .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
                .previewDisplayName("Default")

            WhyCallView(content: .live, onStartCalling: {})
                .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
                .preferredColorScheme(.dark)
                .previewDisplayName("Dark")

            WhyCallView(content: .live, onStartCalling: {})
                .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
                .environment(\.sizeCategory, .accessibilityExtraExtraExtraLarge)
                .previewDisplayName("AXXXL")
        }
    }
}

/// Directionally biased reveal shape:
/// r(theta) = baseRadius(t) * (1 + bias * cos(theta - theta0)) * superellipse(theta)
private struct WhyVoteDirectionalRevealMask: Shape {
    var origin: CGPoint
    var progress: CGFloat
    var direction: CGVector
    var bias: CGFloat
    var softness: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        guard rect.width > 0, rect.height > 0 else { return Path() }

        let t = max(0, min(1, progress))
        let eased = 1 - pow(1 - t, 3)
        let theta0 = atan2(direction.dy, direction.dx)
        let maxBaseRadius = requiredBaseRadiusToCover(rect: rect, theta0: theta0)
        let base = maxBaseRadius * eased
        let n = max(1.4, softness)
        let sampleCount = 260

        var path = Path()
        var first: CGPoint?
        var previous: CGPoint?

        for i in 0...sampleCount {
            let theta = (CGFloat(i) / CGFloat(sampleCount)) * 2 * .pi
            let r = directionalRadius(theta: theta, base: base, theta0: theta0, n: n)
            let point = CGPoint(x: origin.x + r * cos(theta), y: origin.y + r * sin(theta))

            if first == nil {
                first = point
                previous = point
                path.move(to: point)
            } else if let prev = previous {
                let mid = CGPoint(x: (prev.x + point.x) * 0.5, y: (prev.y + point.y) * 0.5)
                path.addQuadCurve(to: mid, control: prev)
                previous = point
            }
        }

        path.closeSubpath()
        return path
    }

    private func directionalRadius(theta: CGFloat, base: CGFloat, theta0: CGFloat, n: CGFloat) -> CGFloat {
        let b = max(-0.9, min(0.9, bias))
        let directionalFactor = max(0.12, 1 + b * cos(theta - theta0))
        let c = abs(cos(theta))
        let s = abs(sin(theta))
        let superellipseFactor = pow(pow(c, n) + pow(s, n), -1 / n)
        return base * directionalFactor * superellipseFactor
    }

    private func requiredBaseRadiusToCover(rect: CGRect, theta0: CGFloat) -> CGFloat {
        let corners = [
            CGPoint(x: rect.minX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.maxY),
            CGPoint(x: rect.minX, y: rect.maxY)
        ]
        let n = max(1.4, softness)
        let b = max(-0.9, min(0.9, bias))
        var required: CGFloat = 0

        for corner in corners {
            let dx = corner.x - origin.x
            let dy = corner.y - origin.y
            let distance = hypot(dx, dy)
            let theta = atan2(dy, dx)

            let directionalFactor = max(0.12, 1 + b * cos(theta - theta0))
            let c = abs(cos(theta))
            let s = abs(sin(theta))
            let superellipseFactor = pow(pow(c, n) + pow(s, n), -1 / n)
            let factor = max(0.08, directionalFactor * superellipseFactor)

            required = max(required, distance / factor)
        }

        return required * 1.05
    }
}
