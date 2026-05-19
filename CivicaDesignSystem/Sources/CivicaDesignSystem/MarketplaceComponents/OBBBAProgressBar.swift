import SwiftUI

/// Monthly OBBBA work-hour progress bar for ABAWD-subject students.
///
/// Shows hours completed out of the 80-hour monthly requirement
/// (OBBBA §10102). Teal fill on a graphite-15% track.
public struct OBBBAProgressBar: View {

    public let hoursCompleted: Int
    public let hoursRequired: Int
    public let month: String

    public init(hoursCompleted: Int, hoursRequired: Int = 80, month: String) {
        self.hoursCompleted = hoursCompleted
        self.hoursRequired = hoursRequired
        self.month = month
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(month)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                Spacer()
                (Text("\(hoursCompleted)").font(CivicaTypography.subheadStrong)
                    + Text(" of \(hoursRequired) hours").font(CivicaTypography.body))
                    .foregroundStyle(CivicaColors.ink)
                    .monospacedDigit()
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(CivicaColors.graphite.opacity(0.15))
                        .frame(height: 12)
                    Capsule()
                        .fill(CivicaColors.accentTeal)
                        .frame(width: geo.size.width * pct, height: 12)
                }
            }
            .frame(height: 12)

            Text("Civica auto-counts hours from your verified employer. No timesheet to submit.")
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(month) work hours: \(hoursCompleted) of \(hoursRequired) completed"
        )
    }

    private var pct: CGFloat {
        guard hoursRequired > 0 else { return 0 }
        return min(1, CGFloat(hoursCompleted) / CGFloat(hoursRequired))
    }
}

#Preview {
    VStack(spacing: CivicaSpacing.xl) {
        OBBBAProgressBar(hoursCompleted: 32, month: "May")
        OBBBAProgressBar(hoursCompleted: 80, month: "April")
        OBBBAProgressBar(hoursCompleted: 0, month: "June")
    }
    .padding()
    .background(CivicaColors.paper)
}
