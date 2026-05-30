import SwiftUI

/// First-paint skeleton placeholder for a row-shaped slot. Matches the
/// shimmer/redaction pattern previously used inside EBTBalanceDashboardView
/// so the main home screens (Phase 2/3) feel cohesive while their `.task`
/// blocks fetch live state.
///
/// Animation is suppressed when `accessibilityReduceMotion` is on — the
/// row simply renders as a static hairline-filled rectangle in that mode.
public struct CivicaSkeletonRow: View {
    private let height: CGFloat
    private let cornerRadius: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = -1

    public init(height: CGFloat = 56, cornerRadius: CGFloat = CivicaRadius.control) {
        self.height = height
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(CivicaColors.hairline)
            .frame(height: height)
            .overlay(
                GeometryReader { proxy in
                    LinearGradient(
                        colors: [
                            .clear,
                            CivicaColors.surfacePrimary.opacity(0.6),
                            .clear
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: proxy.size.width * 0.6)
                    .offset(x: phase * proxy.size.width)
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .accessibilityHidden(true)
            .onAppear {
                guard !reduceMotion else { return }
                // Non-token duration (1.2 linear, infinite shimmer loop).
                civicaWithAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                    phase = 1.2
                }
            }
    }
}

#if DEBUG
struct CivicaSkeletonRow_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: CivicaSpacing.lg) {
            CivicaSkeletonRow()
            CivicaSkeletonRow()
            CivicaSkeletonRow()
        }
        .padding()
        .background(CivicaColors.paper)
    }
}
#endif
