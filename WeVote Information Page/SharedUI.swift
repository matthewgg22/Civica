//
//  SharedUI.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//

import SwiftUI
import UIKit
import LinkPresentation

enum CivicaLaunchFeatures {
    // Share actions are parked for future features.
    static let shareActionsEnabled = false
    // MAPC is parked for this launch; keep only the current script flow visible.
    static let mapcEnabled = false
    static let mapcPipelineV3FlagKey = "mapc_pipeline_v3_enabled"

    static func resolvedMAPCV3Enabled(
        userDefaults: UserDefaults = .standard,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> Bool {
        guard mapcEnabled else { return false }

        if let boolValue = userDefaults.object(forKey: mapcPipelineV3FlagKey) as? Bool {
            return boolValue
        }
        if let stringValue = userDefaults.string(forKey: mapcPipelineV3FlagKey),
           let parsed = parseBooleanFlag(stringValue) {
            return parsed
        }
        if let envValue = environment[mapcPipelineV3FlagKey],
           let parsed = parseBooleanFlag(envValue) {
            return parsed
        }
        return mapcEnabled
    }

    private static func parseBooleanFlag(_ rawValue: String) -> Bool? {
        let normalized = rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if ["1", "true", "yes", "on"].contains(normalized) { return true }
        if ["0", "false", "no", "off"].contains(normalized) { return false }
        return nil
    }
}

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
    static let openHowToVoteMailInBallot = Notification.Name("openHowToVoteMailInBallot")
    static let openMailInBallotRequest = Notification.Name("openMailInBallotRequest")
    static let openVotingStepsTab = Notification.Name("openVotingStepsTab")
    static let openMyInfoPanel = Notification.Name("openMyInfoPanel")
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

private struct MyInfoLongPressModifier: ViewModifier {
    let minimumDuration: Double
    @GestureState private var isPressing = false
    @State private var showActivationRing = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressing ? 0.97 : 1.0)
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(
                        CivicaColors.primaryCTA.opacity(showActivationRing ? 0.76 : (isPressing ? 0.34 : 0)),
                        lineWidth: showActivationRing ? 2 : 1
                    )
                    .padding(-2)
            }
            .animation(.easeOut(duration: 0.14), value: isPressing)
            .animation(.easeOut(duration: 0.2), value: showActivationRing)
            .contentShape(Rectangle())
            .simultaneousGesture(
                LongPressGesture(minimumDuration: minimumDuration)
                    .updating($isPressing) { current, state, _ in
                        state = current
                    }
                    .onEnded { _ in
                        let feedback = UIImpactFeedbackGenerator(style: .rigid)
                        feedback.prepare()
                        feedback.impactOccurred(intensity: 0.95)

                        showActivationRing = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
                            showActivationRing = false
                        }
                        NotificationCenter.default.post(name: .openMyInfoPanel, object: nil)
                    }
            )
    }
}

extension View {
    func opensMyInfoPanelOnLongPress(minimumDuration: Double = 0.8) -> some View {
        modifier(MyInfoLongPressModifier(minimumDuration: minimumDuration))
    }

    @ViewBuilder
    func opensMyInfoPanelOnLongPress(
        when isEnabled: Bool,
        minimumDuration: Double = 0.8
    ) -> some View {
        if isEnabled {
            opensMyInfoPanelOnLongPress(minimumDuration: minimumDuration)
        } else {
            self
        }
    }
}

struct PageHeader: View {
    @Environment(\.locale) private var locale
    let title: Text
    var iconSize: CGFloat = 56
    var enableWhyVoteTap: Bool = false
    @State private var iconFrameInSpreadSpace: CGRect = .zero

    init(title: Text, iconSize: CGFloat = 56, enableWhyVoteTap: Bool = false) {
        self.title = title
        self.iconSize = iconSize
        self.enableWhyVoteTap = enableWhyVoteTap
    }

    init(title: String, iconSize: CGFloat = 56, enableWhyVoteTap: Bool = false) {
        self.title = Text(verbatim: title)
        self.iconSize = iconSize
        self.enableWhyVoteTap = enableWhyVoteTap
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            if enableWhyVoteTap {
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
                    CivicaLogoIcon(size: iconSize)
                        .frame(width: iconSize, height: iconSize)
                        .fixedSize(horizontal: true, vertical: true)
                        .reportFrame(in: .named("SpreadSpace"))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(
                    localizedCatalogString(
                        "app.accessibility.why_vote.toggle",
                        tableName: "AppShell",
                        locale: locale,
                        fallback: "Toggle Why Vote overlay"
                    )
                )
            } else {
                CivicaLogoIcon(size: iconSize)
                    .frame(width: iconSize, height: iconSize)
                    .fixedSize(horizontal: true, vertical: true)
                    .accessibilityHidden(true)
            }

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

struct CivicaLogoIcon: View {
    var size: CGFloat = 50
    var backgroundColor: Color = CivicaColors.softBlue
    var stripeColor: Color = CivicaColors.softRed
    var cornerRadiusScale: CGFloat = 0.24
    var borderColor: Color = CivicaColors.iconOnPrimaryBorder
    var borderWidth: CGFloat = 0.6
    var shadowColor: Color = CivicaColors.primaryText.opacity(0.14)

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

extension CivicaLogoIcon {
    static let tabBarUIImage: UIImage = {
        let renderer = ImageRenderer(content: CivicaLogoIcon(size: 28))
        renderer.scale = UIScreen.main.scale
        return (renderer.uiImage ?? UIImage()).withRenderingMode(.alwaysOriginal)
    }()

    static let tabBarBarsUIImage: UIImage = {
        let renderer = ImageRenderer(content: VoteNowTabBarsIcon(size: 22))
        renderer.scale = UIScreen.main.scale
        return (renderer.uiImage ?? UIImage()).withRenderingMode(.alwaysOriginal)
    }()
}

// Deprecation shim: keep CivicaLogoIcon name compiling while call sites migrate.
typealias VoteNowLogoIcon = CivicaLogoIcon

private struct VoteNowTabBarsIcon: View {
    var size: CGFloat = 28
    var color: Color = CivicaColors.softRed
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
    @Environment(\.locale) private var locale
    @Binding var isPresented: Bool
    var originInSpreadSpace: CGPoint?

    @State private var dynamicFloodColor: Color = CivicaColors.brandSoftBlue
    private let accent = CivicaColors.softRed
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
                dynamicFloodColor
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
                            CivicaLogoIcon(
                                size: logoSize,
                                backgroundColor: CivicaColors.iconOnPrimarySurface,
                                stripeColor: accent,
                                borderColor: CivicaColors.iconOnPrimaryBorder,
                                shadowColor: CivicaColors.shadowSoft
                            )
                            .frame(width: logoSize, height: logoSize)
                            .fixedSize(horizontal: true, vertical: true)
                            .voteNowPillDualOrbit(
                                redColor: CivicaColors.ctaRed.opacity(0.94),
                                blueColor: CivicaColors.ctaBlue.opacity(0.88),
                                strokeThickness: 2.4,
                                loopDuration: 5.2,
                                glowIntensity: 0.22,
                                idleOpacity: 0,
                                borderInset: 0,
                                segmentLength: 0.50,
                                separatorThickness: 0,
                                sliceFadeFactor: 0.93,
                                speedVariance: 0,
                                pathStyle: .roundedRect(cornerRadius: logoSize * 0.24)
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(
                            localizedCatalogString(
                                "app.accessibility.why_vote.close",
                                tableName: "AppShell",
                                locale: locale,
                                fallback: "Close Why Vote overlay"
                            )
                        )

                        Text(
                            localizedCatalogString(
                                "app.why_vote.overlay.title",
                                tableName: "AppShell",
                                locale: locale,
                                fallback: "Why Vote?"
                            )
                        )
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .lineLimit(1)
                            .frame(height: logoSize, alignment: .center)
                            .foregroundColor(CivicaColors.onPrimaryText)
                            .opacity(spread > 0.65 ? 1 : 0)

                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, headerHorizontalPadding)
                    .padding(.top, headerTopPadding)

                    WhyVoteView { cueColor in
                        withAnimation(.easeInOut(duration: 0.22)) {
                            dynamicFloodColor = cueColor
                        }
                    }
                        .opacity(spread > 0.72 ? 1 : 0)
                }
            }
            .contentShape(Rectangle())
            .onAppear {
                spread = 0.001
                resolvedOriginInSpreadSpace = nil
                dynamicFloodColor = CivicaColors.brandSoftBlue
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
    @Environment(\.locale) private var locale
    @Binding var isPresented: Bool
    var originInSpreadSpace: CGPoint?
    var onStartCalling: () -> Void = {}

    private let floodColor = CivicaColors.brandSoftBlue
    private let accent = CivicaColors.softRed
    private let logoSize: CGFloat = 50
    private let headerHorizontalPadding: CGFloat = 16
    private let headerTopPadding: CGFloat = 10
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
                            CivicaLogoIcon(
                                size: logoSize,
                                backgroundColor: CivicaColors.iconOnPrimarySurface,
                                stripeColor: accent,
                                borderColor: CivicaColors.iconOnPrimaryBorder,
                                shadowColor: CivicaColors.shadowSoft
                            )
                            .frame(width: logoSize, height: logoSize)
                            .fixedSize(horizontal: true, vertical: true)
                            .voteNowPillDualOrbit(
                                redColor: CivicaColors.ctaRed.opacity(0.94),
                                blueColor: CivicaColors.ctaBlue.opacity(0.88),
                                strokeThickness: 2.4,
                                loopDuration: 5.2,
                                glowIntensity: 0.22,
                                idleOpacity: 0,
                                borderInset: 0,
                                segmentLength: 0.50,
                                separatorThickness: 0.2,
                                sliceFadeFactor: 0.93,
                                speedVariance: 0,
                                pathStyle: .roundedRect(cornerRadius: logoSize * 0.24)
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(
                            localizedCatalogString(
                                "app.accessibility.why_call.close",
                                tableName: "AppShell",
                                locale: locale,
                                fallback: "Close Why Call overlay"
                            )
                        )

                        Text(
                            localizedCatalogString(
                                "app.why_call.overlay.title",
                                tableName: "AppShell",
                                locale: locale,
                                fallback: "Why calls reps"
                            )
                        )
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
    let title: String
    let intro: String
    let context: String
    let stats: [WhyCallStat]
    let reasons: [WhyCallReason]
    let note: String
    let primaryCTA: String

    static let live = WhyCallContent(
        title: "",
        intro: "",
        context: "Calls are a fast way to show what matters in your community before key votes.",
        stats: [
            WhyCallStat(
                value: "Only 23% of constituents call their reps annually",
                title: "",
                body: "When fewer people call, each call carries more signal."
            ),
            WhyCallStat(
                value: "86% report calls influence undecided members",
                title: "",
                body: "Calls help offices understand which issues are urgent, widespread, and personal."
            ),
            WhyCallStat(
                value: "20% vs 1% response impact",
                title: "",
                body: "Personalized calls are more likely to stand out than form messages."
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
        note: "",
        primaryCTA: "Start Calling Reps!"
    )
}

struct WhyCallView: View {
    @Environment(\.locale) private var locale
    let content: WhyCallContent
    let onStartCalling: () -> Void
    @State private var showFeedbackSheet = false

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                WhyCallHero(content: content)

                VStack(alignment: .leading, spacing: 10) {
                    Text(
                        localizedCatalogString(
                            "app.why_call.impact.header",
                            tableName: "AppShell",
                            locale: locale,
                            fallback: "Impact of Calling your Reps"
                        )
                    )
                        .font(.headline)
                        .foregroundStyle(.primary)

                    ForEach(content.stats) { stat in
                        WhyCallStatCard(stat: stat)
                    }
                }

                WhyCallBottomCTA(
                    note: "",
                    title: localizedCatalogString(
                        "app.issue_call.action.call_now",
                        tableName: "AppShell",
                        locale: locale,
                        fallback: "Call your rep now"
                    ),
                    action: onStartCalling
                )

                feedbackButton
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 20)
        }
        .sheet(isPresented: $showFeedbackSheet) {
            NavigationStack {
                FeedbackView()
            }
        }
    }

    private var feedbackButton: some View {
        Button {
            showFeedbackSheet = true
        } label: {
            Label(
                localizedCatalogString(
                    "app.how_to_vote.section.feedback",
                    tableName: "AppShell",
                    locale: locale,
                    fallback: "Feedback"
                ),
                systemImage: "bubble.left.and.bubble.right.fill"
            )
            .font(.subheadline.weight(.semibold))
            .foregroundColor(CivicaColors.primaryCTA)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(CivicaColors.surfaceWhite)
            .clipShape(Capsule(style: .continuous))
            .overlay(
                Capsule(style: .continuous)
                    .stroke(CivicaColors.primaryCTA.opacity(0.34), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct WhyCallHero: View {
    let content: WhyCallContent

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !content.title.isEmpty {
                Text(content.title)
                    .font(.title.bold())
                    .foregroundStyle(.primary)
            }

            if !content.intro.isEmpty {
                Text(content.intro)
                    .font(.body)
                    .foregroundStyle(.primary)
            }
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
                .foregroundStyle(CivicaColors.primaryCTA)
            if !stat.title.isEmpty {
                Text(stat.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
            }
            Text(stat.body)
                .font(.body)
                .foregroundStyle(.primary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaColors.cardCornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaColors.cardCornerRadius, style: .continuous)
                .stroke(CivicaColors.primaryText.opacity(0.08), lineWidth: 1)
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
        .background(CivicaColors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaColors.cardCornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaColors.cardCornerRadius, style: .continuous)
                .stroke(CivicaColors.primaryText.opacity(0.08), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}

private struct WhyCallBottomCTA: View {
    @Environment(\.locale) private var locale
    let note: String
    let title: String
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !note.isEmpty {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(CivicaColors.mutedText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button(action: action) {
                Text(title)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(CivicaPrimaryCTAButtonStyle())
            .accessibilityLabel(
                localizedCatalogString(
                    "app.accessibility.issue_call.start",
                    tableName: "AppShell",
                    locale: locale,
                    fallback: "Start Calling Reps"
                )
            )
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 10)
    }
}

struct WhyCallView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            WhyCallView(content: .live, onStartCalling: {})
                .background(CivicaColors.brandSoftBlue.ignoresSafeArea())
                .previewDisplayName("Default")

            WhyCallView(content: .live, onStartCalling: {})
                .background(CivicaColors.brandSoftBlue.ignoresSafeArea())
                .preferredColorScheme(.dark)
                .previewDisplayName("Dark")

            WhyCallView(content: .live, onStartCalling: {})
                .background(CivicaColors.brandSoftBlue.ignoresSafeArea())
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

enum VoteNowShareCardType: String {
    case election
    case registration
    case mapv
    case civic
}

enum VoteNowShareTarget: String {
    case election
    case registration
    case mapv
    case civic
}

struct VoteNowShareCardPayload {
    let cardType: VoteNowShareCardType
    let target: VoteNowShareTarget
    let title: String
    let subtitle: String
    let cta: String
    let badge: String?
    let campaign: String?
    let details: [URLQueryItem]

    init(
        cardType: VoteNowShareCardType,
        target: VoteNowShareTarget,
        title: String,
        subtitle: String,
        cta: String,
        badge: String? = nil,
        campaign: String? = nil,
        details: [URLQueryItem] = []
    ) {
        self.cardType = cardType
        self.target = target
        self.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        self.subtitle = subtitle.trimmingCharacters(in: .whitespacesAndNewlines)
        self.cta = cta.trimmingCharacters(in: .whitespacesAndNewlines)
        self.badge = badge?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.campaign = campaign?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.details = details
    }

    var shareURL: URL? {
        let configuredBase = (
            Bundle.main.object(forInfoDictionaryKey: "SHARE_WEB_BASE_URL") as? String
        )?.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallbackBase = (
            Bundle.main.object(forInfoDictionaryKey: "CIVIC_API_BASE_URL") as? String
        )?.trimmingCharacters(in: .whitespacesAndNewlines)
        let base = (configuredBase?.isEmpty == false ? configuredBase : fallbackBase) ?? "https://votenow-botr.onrender.com"
        let normalizedBase = base.hasSuffix("/") ? String(base.dropLast()) : base

        guard var components = URLComponents(string: "\(normalizedBase)/share/\(cardType.rawValue)") else {
            return nil
        }

        var items: [URLQueryItem] = [URLQueryItem(name: "target", value: target.rawValue)]
        if let campaign, !campaign.isEmpty {
            items.append(URLQueryItem(name: "campaign", value: limited(campaign, max: 80)))
        }

        for item in details {
            guard let value = item.value?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty else {
                continue
            }
            items.append(URLQueryItem(name: item.name, value: limited(value, max: 140)))
        }

        components.queryItems = items
        return components.url
    }

    var deepLinkURL: URL? {
        var components = URLComponents()
        components.scheme = "votenow"

        switch target {
        case .election:
            components.host = "election"
            var electionItems = details.filter {
                ["eid", "type", "day", "state", "state_name"].contains($0.name)
            }
            electionItems.append(URLQueryItem(name: "title", value: limited(title, max: 120)))
            components.queryItems = electionItems
        case .registration:
            components.host = "registration"
        case .mapv:
            components.host = "mapv"
        case .civic:
            components.host = "civic"
        }

        return components.url
    }

    var shareMessage: String {
        [title, subtitle]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " - ")
    }

    private func limited(_ value: String, max: Int) -> String {
        if value.count <= max { return value }
        return String(value.prefix(max))
    }
}

enum VoteNowShareComposer {
    static func activityItems(for payload: VoteNowShareCardPayload) -> [Any] {
        var items: [Any] = []
        if !payload.shareMessage.isEmpty {
            items.append(payload.shareMessage)
        }
        items.append(VoteNowShareActivityItemSource(payload: payload))
        return items
    }
}

final class VoteNowShareActivityItemSource: NSObject, UIActivityItemSource {
    private let payload: VoteNowShareCardPayload

    init(payload: VoteNowShareCardPayload) {
        self.payload = payload
        super.init()
    }

    func activityViewControllerPlaceholderItem(_ activityViewController: UIActivityViewController) -> Any {
        payload.shareURL ?? payload.deepLinkURL ?? URL(string: "https://votenow.app")!
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        itemForActivityType activityType: UIActivity.ActivityType?
    ) -> Any? {
        payload.shareURL ?? payload.deepLinkURL ?? payload.shareMessage
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        subjectForActivityType activityType: UIActivity.ActivityType?
    ) -> String {
        payload.title
    }

    func activityViewControllerLinkMetadata(_ activityViewController: UIActivityViewController) -> LPLinkMetadata? {
        let metadata = LPLinkMetadata()
        metadata.title = payload.title
        metadata.originalURL = payload.shareURL
        metadata.url = payload.shareURL

        let previewImage = VoteNowSharePreviewRenderer.image(for: payload)
        metadata.imageProvider = NSItemProvider(object: previewImage)
        metadata.iconProvider = NSItemProvider(object: VoteNowSharePreviewRenderer.logoImage)
        return metadata
    }
}

private enum VoteNowSharePreviewRenderer {
    static let logoImage: UIImage = {
        if let icons = Bundle.main.infoDictionary?["CFBundleIcons"] as? [String: Any],
           let primaryIcon = icons["CFBundlePrimaryIcon"] as? [String: Any],
           let iconFiles = primaryIcon["CFBundleIconFiles"] as? [String],
           let iconName = iconFiles.last,
           let icon = UIImage(named: iconName) {
            return icon
        }
        return CivicaLogoIcon.tabBarUIImage
    }()

    static func image(for payload: VoteNowShareCardPayload) -> UIImage {
        let size = CGSize(width: 1200, height: 630)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            let cg = context.cgContext
            drawBackground(for: payload.cardType, in: CGRect(origin: .zero, size: size), context: cg)

            let isRegistrationCard = payload.cardType == .registration
            let horizontalInset: CGFloat = isRegistrationCard ? 40 : 56
            let topInset: CGFloat = isRegistrationCard ? 28 : 40
            let baseLogoSize: CGFloat = 144
            let logoScale: CGFloat
            switch payload.cardType {
            case .election, .registration:
                logoScale = 1.25
            case .mapv, .civic:
                logoScale = 1.0
            }
            let logoSize: CGFloat = baseLogoSize * logoScale
            let logoRect = CGRect(
                x: size.width - horizontalInset - logoSize,
                y: topInset,
                width: logoSize,
                height: logoSize
            )

            let bandHeight: CGFloat = isRegistrationCard ? 142 : 164
            let bandRect = CGRect(x: 0, y: size.height - bandHeight, width: size.width, height: bandHeight)
            cg.setFillColor(UIColor(white: 1.0, alpha: 0.18).cgColor)
            cg.fill(bandRect)

            let hasBadge = (payload.badge?.isEmpty == false)
            if let badge = payload.badge, !badge.isEmpty {
                let badgeHeight: CGFloat = isRegistrationCard ? 50 : 44
                drawChip(
                    text: badge,
                    in: CGRect(
                        x: horizontalInset,
                        y: topInset,
                        width: logoRect.minX - horizontalInset - 24,
                        height: badgeHeight
                    ),
                    fill: UIColor(white: 1.0, alpha: 0.22),
                    textColor: .white
                )
            }

            let titleTop = hasBadge ? (topInset + (isRegistrationCard ? 58 : 62)) : topInset
            let titleBottomPadding: CGFloat = isRegistrationCard ? 8 : 16
            let titleRect = CGRect(
                x: horizontalInset,
                y: titleTop,
                width: logoRect.minX - horizontalInset - 24,
                height: bandRect.minY - titleTop - titleBottomPadding
            )
            drawText(
                payload.title,
                font: titleFont(for: payload.title),
                color: .white,
                rect: titleRect,
                lineBreak: .byWordWrapping
            )

            let ctaWidth: CGFloat = isRegistrationCard ? 240 : 276
            let ctaRect = CGRect(
                x: size.width - horizontalInset - ctaWidth,
                y: bandRect.minY + (bandHeight - 54) / 2,
                width: ctaWidth,
                height: 54
            )

            drawText(
                payload.subtitle,
                font: subtitleFont(for: payload.subtitle),
                color: UIColor(white: 0.96, alpha: 0.98),
                rect: CGRect(
                    x: horizontalInset,
                    y: bandRect.minY + (isRegistrationCard ? 18 : 24),
                    width: ctaRect.minX - horizontalInset - 20,
                    height: bandHeight - (isRegistrationCard ? 36 : 48)
                ),
                lineBreak: .byWordWrapping
            )

            drawChip(
                text: payload.cta,
                in: ctaRect,
                fill: UIColor(red: 0.88, green: 0.34, blue: 0.23, alpha: 1.0),
                textColor: .white
            )

            let logoPath = UIBezierPath(roundedRect: logoRect, cornerRadius: logoSize * (28.0 / 144.0))
            cg.saveGState()
            logoPath.addClip()
            logoImage.draw(in: logoRect)
            cg.restoreGState()

            UIColor(white: 1.0, alpha: 0.42).setStroke()
            logoPath.lineWidth = 2
            logoPath.stroke()

            drawText(
                "Civica",
                font: UIFont.systemFont(ofSize: 32, weight: .bold),
                color: UIColor(white: 1.0, alpha: 0.98),
                rect: CGRect(x: logoRect.minX, y: logoRect.maxY + 8, width: logoRect.width, height: 36),
                lineBreak: .byTruncatingTail,
                alignment: .center
            )
        }
    }

    private static func titleFont(for title: String) -> UIFont {
        let count = title.count
        if count <= 22 { return UIFont.systemFont(ofSize: 82, weight: .heavy) }
        if count <= 40 { return UIFont.systemFont(ofSize: 72, weight: .bold) }
        return UIFont.systemFont(ofSize: 62, weight: .bold)
    }

    private static func subtitleFont(for subtitle: String) -> UIFont {
        let count = subtitle.count
        if count <= 75 { return UIFont.systemFont(ofSize: 38, weight: .semibold) }
        return UIFont.systemFont(ofSize: 34, weight: .semibold)
    }

    private static func drawBackground(
        for type: VoteNowShareCardType,
        in rect: CGRect,
        context: CGContext
    ) {
        let colors: [UIColor]
        switch type {
        case .election:
            colors = [UIColor(red: 0.08, green: 0.23, blue: 0.66, alpha: 1), UIColor(red: 0.28, green: 0.63, blue: 0.93, alpha: 1)]
        case .registration:
            colors = [UIColor(red: 0.04, green: 0.40, blue: 0.49, alpha: 1), UIColor(red: 0.16, green: 0.74, blue: 0.62, alpha: 1)]
        case .mapv:
            colors = [UIColor(red: 0.14, green: 0.33, blue: 0.52, alpha: 1), UIColor(red: 0.42, green: 0.57, blue: 0.78, alpha: 1)]
        case .civic:
            colors = [UIColor(red: 0.11, green: 0.20, blue: 0.45, alpha: 1), UIColor(red: 0.28, green: 0.48, blue: 0.87, alpha: 1)]
        }

        guard let gradient = CGGradient(
            colorsSpace: CGColorSpaceCreateDeviceRGB(),
            colors: colors.map { $0.cgColor } as CFArray,
            locations: [0.0, 1.0]
        ) else {
            context.setFillColor(colors.first?.cgColor ?? UIColor.darkGray.cgColor)
            context.fill(rect)
            return
        }

        context.drawLinearGradient(
            gradient,
            start: CGPoint(x: rect.minX, y: rect.minY),
            end: CGPoint(x: rect.maxX, y: rect.maxY),
            options: []
        )
    }

    private static func drawChip(
        text: String,
        in rect: CGRect,
        fill: UIColor,
        textColor: UIColor
    ) {
        let path = UIBezierPath(roundedRect: rect, cornerRadius: rect.height / 2)
        fill.setFill()
        path.fill()

        let font = UIFont.systemFont(ofSize: rect.height >= 48 ? 25 : 24, weight: .semibold)
        let textHeight = ceil(font.lineHeight)
        let verticalInset = max(4, (rect.height - textHeight) / 2)
        drawText(
            text,
            font: font,
            color: textColor,
            rect: rect.insetBy(dx: 16, dy: verticalInset),
            lineBreak: .byTruncatingTail,
            alignment: .center
        )
    }

    private static func drawText(
        _ text: String,
        font: UIFont,
        color: UIColor,
        rect: CGRect,
        lineBreak: NSLineBreakMode,
        alignment: NSTextAlignment = .left
    ) {
        guard !text.isEmpty else { return }
        let style = NSMutableParagraphStyle()
        style.alignment = alignment
        style.lineBreakMode = lineBreak

        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: style
        ]

        (text as NSString).draw(
            with: rect,
            options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine],
            attributes: attributes,
            context: nil
        )
    }
}
