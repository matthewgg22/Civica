import CivicaDesignSystem
import SwiftUI

// Screen 6 — Recert refresh row for marketplace-derived data.
// DR3-10: shows Argyle-confirmed income + Canvas schedule sync date.
// Used inside the existing RecertificationCompanion packet view.
struct RecertPulledRow: View {

    enum Source {
        case argyle(employerName: String, confirmedDate: Date)
        case canvas(syncDate: Date)
        case selfReported(lastPacketDate: Date)
    }

    let label: String
    let value: String
    let source: Source

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(label)
                .font(CivicaTypography.support)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(value)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
            sourceTag
        }
        .padding(.vertical, CivicaSpacing.sm)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value). \(sourceDescription)")
    }

    // MARK: - Private

    private var sourceTag: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(sourceDotColor)
                .frame(width: 5, height: 5)
            Text(sourceTagText)
                .font(.system(size: 11))
                .foregroundStyle(CivicaColors.graphite)
        }
    }

    private var sourceDotColor: Color {
        switch source {
        case .argyle: return CivicaColors.amberPrimary
        case .canvas: return CivicaColors.amberPrimary
        case .selfReported: return CivicaColors.graphite
        }
    }

    private var sourceTagText: String {
        switch source {
        case .argyle(let employer, let date):
            return String(localized: "Pulled from Argyle · \(employer) · \(date.formatted(.dateTime.month(.abbreviated).day()))")
        case .canvas(let date):
            return String(localized: "Pulled from Canvas · synced \(date.formatted(.dateTime.month(.abbreviated).day()))")
        case .selfReported(let date):
            return String(localized: "Self-reported · last packet \(date.formatted(.dateTime.month(.abbreviated).year()))")
        }
    }

    private var sourceDescription: String {
        switch source {
        case .argyle(let employer, _): return String(localized: "Source: Argyle, \(employer)")
        case .canvas: return String(localized: "Source: Canvas LMS")
        case .selfReported: return String(localized: "Source: self-reported")
        }
    }
}

#Preview {
    VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
        RecertPulledRow(
            label: "Job income",
            value: "$1,179/mo",
            source: .argyle(employerName: "Dining Services", confirmedDate: Date())
        )
        Divider()
        RecertPulledRow(
            label: "Class schedule",
            value: "T/Th blocked · M/W/F available",
            source: .canvas(syncDate: Date())
        )
        Divider()
        RecertPulledRow(
            label: "Household size",
            value: "2 people",
            source: .selfReported(lastPacketDate: Calendar.current.date(byAdding: .month, value: -6, to: Date())!)
        )
    }
    .padding()
    .background(CivicaColors.paper)
}
