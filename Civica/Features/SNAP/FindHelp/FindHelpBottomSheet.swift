import CivicaDesignSystem
import SwiftUI

/// Apple-Maps-style persistent bottom drawer hosting the layer toggle,
/// filter bar, disclosure footer, and nearby-list rows over the map.
///
/// Implemented as an ordinary overlay view (not a `.sheet` presentation)
/// so it exits in sync with the navigation-pop transition rather than
/// running its own independent dismiss animation. Drag the grab handle
/// or the header area to snap between three heights:
///   - peek  (~210 pt): grab handle + disclosure + layer toggle + filter
///   - medium (~45 %): peek + ~4 list rows
///   - large  (~82 %): full scrollable list
///
/// The list scrolls independently — drag the header area to resize the
/// drawer, scroll the list to navigate within it.
struct FindHelpBottomSheet: View {
    /// Minimum visible height — grab handle + disclosure row +
    /// layer toggle + subtitle line + filter bar (segmented picker +
    /// language menu, two rows). Never collapses below this.
    private static let peekHeight: CGFloat = 280
    private static let cornerRadius: CGFloat = 16

    @ObservedObject var store: FindHelpStore
    let language: CivicaLanguage
    let onLayerChanged: (FindHelpLayerSelection) -> Void
    let onFilterChanged: () -> Void

    /// Peek/detail sheets still live here so they present from the
    /// nearest view context without any sheet-stacking conflicts.
    @State private var detailLocation: FindHelpLocation?

    // MARK: - Drawer height state

    @State private var drawerHeight: CGFloat = Self.peekHeight
    /// Live offset while a drag is in flight. Separate from
    /// `drawerHeight` so the committed height is always a clean snap.
    @GestureState private var dragDelta: CGFloat = 0

    private var screenHeight: CGFloat { UIScreen.main.bounds.height }
    private var mediumHeight: CGFloat { screenHeight * 0.45 }
    private var largeHeight:  CGFloat { screenHeight * 0.82 }
    private var detents: [CGFloat] { [Self.peekHeight, mediumHeight, largeHeight] }

    /// Clamped display height during and after drag.
    private var displayHeight: CGFloat {
        min(largeHeight, max(Self.peekHeight, drawerHeight - dragDelta))
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // ── Header: grab handle + controls ──────────────────────
            // The whole header block captures drag so the user can
            // resize by pulling anywhere on the visible strip when the
            // drawer is at peek / medium height.
            VStack(spacing: 0) {
                grabHandle

                FindHelpDisclosureFooter()

                layerToggle
                    .padding(.horizontal, CivicaSpacing.lg)
                    .padding(.top, CivicaSpacing.md)

                Text(layerSubtitle(for: store.layerSelection))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, CivicaSpacing.lg)
                    .padding(.top, CivicaSpacing.xs)

                if store.layerSelection == .findHelp {
                    FindHelpFilterBar(
                        filter: $store.filter,
                        layerSelection: store.layerSelection,
                        onChange: onFilterChanged
                    )
                    .padding(.horizontal, CivicaSpacing.lg)
                    .padding(.top, CivicaSpacing.sm)
                }
            }
            .contentShape(Rectangle())
            .gesture(resizeDrag)

            // ── List: scrolls freely, not part of drag target ───────
            FindHelpListView(
                locations: store.filteredLocations,
                selectedLocationId: store.selectedLocation?.id,
                onSelect: { store.selectLocation($0) }
            )
            .padding(.top, CivicaSpacing.md)
        }
        .frame(height: displayHeight, alignment: .top)
        .frame(maxWidth: .infinity)
        .background(CivicaColors.surfaceSecondary.ignoresSafeArea(edges: .bottom))
        .clipShape(
            UnevenRoundedRectangle(
                topLeadingRadius: Self.cornerRadius,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: Self.cornerRadius
            )
        )
        .shadow(color: .black.opacity(0.10), radius: 10, y: -3)
        .sheet(item: $store.selectedLocation) { location in
            FindHelpPeekSheet(
                location: location,
                language: language,
                onViewDetails: {
                    detailLocation = location
                    store.clearSelection()
                }
            )
        }
        .sheet(item: $detailLocation) { location in
            FindHelpLocationDetailSheet(location: location, sources: store.sources)
        }
    }

    // MARK: - Grab handle

    private var grabHandle: some View {
        Capsule()
            .fill(CivicaColors.hairline)
            .frame(width: 36, height: 5)
            .padding(.vertical, CivicaSpacing.sm)
            .frame(maxWidth: .infinity)
    }

    // MARK: - Drag gesture

    private var resizeDrag: some Gesture {
        DragGesture(minimumDistance: 4)
            .updating($dragDelta) { value, state, _ in
                state = value.translation.height
            }
            .onEnded { value in
                // Use predicted end so a fast flick snaps past the
                // current detent even if the finger lifts early.
                let predicted = drawerHeight - value.predictedEndTranslation.height
                let snapped = nearestDetent(to: predicted)
                withAnimation(.spring(response: 0.32, dampingFraction: 0.72)) {
                    drawerHeight = snapped
                }
            }
    }

    private func nearestDetent(to height: CGFloat) -> CGFloat {
        detents.min(by: { abs($0 - height) < abs($1 - height) }) ?? Self.peekHeight
    }

    // MARK: - Layer toggle

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
                                : CivicaColors.pinePrimary
                        )
                        .frame(maxWidth: .infinity)
                        .background(
                            layer == store.layerSelection
                                ? CivicaColors.pinePrimary
                                : Color.clear
                        )
                }
            }
        }
        .background(CivicaColors.surfacePrimary)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(CivicaColors.pinePrimary.opacity(0.4), lineWidth: 1))
    }

    private func layerLabel(for layer: FindHelpLayerSelection) -> String {
        switch layer {
        case .findHelp: return FindHelpStrings.layerFindHelp.value(in: language)
        case .spend:    return FindHelpStrings.layerSpend.value(in: language)
        case .both:     return FindHelpStrings.layerBoth.value(in: language)
        }
    }

    private func layerSubtitle(for layer: FindHelpLayerSelection) -> String {
        switch layer {
        case .findHelp: return FindHelpStrings.layerFindHelpSubtitle.value(in: language)
        case .spend:    return FindHelpStrings.layerSpendSubtitle.value(in: language)
        case .both:     return FindHelpStrings.layerBothSubtitle.value(in: language)
        }
    }
}
