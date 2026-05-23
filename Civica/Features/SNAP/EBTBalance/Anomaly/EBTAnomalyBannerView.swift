import CivicaDesignSystem
import SwiftUI

// Compact inline banner for the most-severe active anomaly alert.
// Shown at the top of EBTBalanceDashboardView (above the hero card)
// when EBTAnomalyStore.activeAlerts is non-empty.
//
// Color semantics:
//   .high   → brick-tinted background (danger; Civica target only)
//   .medium → amber-tinted background (warning)
//   .low    → subtle ink-tinted (informational)
//
// Tapping the banner body opens EBTAnomalyDetailView as a sheet.
// The "Dismiss" button removes the alert from the store without
// navigating.

struct EBTAnomalyBannerView: View {
    let alert: EBTAnomalyAlert
    @ObservedObject var store: EBTAnomalyStore
    let language: CivicaLanguage

    @State private var isDetailPresented = false

    var body: some View {
        Button {
            isDetailPresented = true
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: iconName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(tint)
                    .accessibilityHidden(true)

                Text(alert.bannerCopy.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        store.dismiss(alert)
                    }
                } label: {
                    Text(EBTAnomalyStrings.dismissCTA.value(in: language))
                        .font(CivicaTypography.caption)
                        .foregroundStyle(CivicaColors.graphite)
                }
                .buttonStyle(.plain)
            }
            .padding(CivicaSpacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(backgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Tap to see details and take action")
        .sheet(isPresented: $isDetailPresented) {
            EBTAnomalyDetailView(alert: alert, store: store, language: language)
        }
    }

    // MARK: - Styling

    private var tint: Color {
        switch alert.severity {
        case .high:   return CivicaColors.brickAccent
        case .medium: return CivicaColors.warningAmber
        case .low:    return CivicaColors.graphite
        }
    }

    private var backgroundColor: Color {
        tint.opacity(0.12)
    }

    private var iconName: String {
        switch alert.kind {
        case .velocityBurst:     return "bolt.fill"
        case .transactionFlood:  return "exclamationmark.triangle.fill"
        case .crossStateUse:     return "location.slash.fill"
        }
    }
}
