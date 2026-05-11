import CivicaDesignSystem
import SwiftUI

/// Apple-Maps-style persistent bottom sheet hosting the layer toggle,
/// filter bar, disclosure footer, and nearby-list rows over the map.
///
/// Replaces the old map-vs-list `viewModeToggle` segmented control —
/// the list is always one drag away instead of a mode the user has
/// to toggle into. Map keeps the screen.
///
/// Detents:
///   - peek (~190pt): disclosure footer + layer toggle + filter row
///   - medium: peek + ~4 nearby-list rows
///   - large: full scrollable list
///
/// Map remains tappable up through the .medium detent
/// (.presentationBackgroundInteraction(.enabled(upThrough: .medium))).
/// .interactiveDismissDisabled(true) keeps the sheet from dismissing
/// when dragged below its peek detent.
///
/// Peek / detail sheets attached to FindHelpRootView present ON TOP
/// of this sheet via SwiftUI's iOS 16+ sheet stacking — when the
/// peek dismisses, the bottom sheet remains in its previous detent.
struct FindHelpBottomSheet: View {
    @ObservedObject var store: FindHelpStore
    let language: CivicaLanguage
    let onLayerChanged: (FindHelpLayerSelection) -> Void
    let onFilterChanged: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            FindHelpDisclosureFooter()

            layerToggle
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.top, CivicaSpacing.md)

            FindHelpFilterBar(
                filter: $store.filter,
                layerSelection: store.layerSelection,
                onChange: onFilterChanged
            )
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.sm)

            FindHelpListView(
                locations: store.filteredLocations,
                onSelect: { store.selectLocation($0) }
            )
            .padding(.top, CivicaSpacing.md)
        }
        .background(CivicaColors.surfaceSecondary.ignoresSafeArea())
        .presentationDetents([.height(190), .medium, .large])
        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
        .interactiveDismissDisabled(true)
        .presentationDragIndicator(.visible)
    }

    /// Three-way pill — duplicated style from the previous in-line
    /// version in FindHelpRootView but moved here so the sheet is
    /// self-contained.
    private var layerToggle: some View {
        HStack(spacing: 0) {
            ForEach(FindHelpLayerSelection.allCases) { layer in
                Button {
                    store.layerSelection = layer
                    onLayerChanged(layer)
                } label: {
                    Text(layerLabel(for: layer))
                        .font(CivicaTypography.footnoteStrong)
                        .padding(.horizontal, CivicaSpacing.md)
                        .padding(.vertical, CivicaSpacing.sm)
                        .foregroundStyle(
                            layer == store.layerSelection
                                ? CivicaColors.onPrimaryText
                                : CivicaColors.brickPrimary
                        )
                        .frame(maxWidth: .infinity)
                        .background(
                            layer == store.layerSelection
                                ? CivicaColors.brickPrimary
                                : Color.clear
                        )
                }
            }
        }
        .background(CivicaColors.surfacePrimary)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(CivicaColors.brickPrimary.opacity(0.4), lineWidth: 1))
    }

    private func layerLabel(for layer: FindHelpLayerSelection) -> String {
        switch layer {
        case .findHelp: return FindHelpStrings.layerFindHelp.value(in: language)
        case .spend:    return FindHelpStrings.layerSpend.value(in: language)
        case .both:     return FindHelpStrings.layerBoth.value(in: language)
        }
    }
}
