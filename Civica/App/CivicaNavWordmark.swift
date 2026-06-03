import CivicaDesignSystem
import SwiftUI

/// Inline nav-bar wordmark used on the home phases, EBT dashboard, and
/// FindHelp map. Pairs the yellow wheat sticker (a transparent-cutout
/// SVG in `civica-wheat-logo.imageset`) with the "Civica" wordmark so
/// the brand reads on every primary surface — replaces the bare
/// `.navigationTitle("Civica")` that lost the mark.
struct CivicaNavWordmark: View {
    var body: some View {
        HStack(spacing: CivicaSpacing.xs) {
            Image("civica-wheat-logo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 34, height: 34)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                .accessibilityHidden(true)
            Text("Civica")
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Civica")
        .accessibilityAddTraits(.isHeader)
    }
}

extension View {
    /// Attaches the Civica wheat + wordmark as the nav bar's principal
    /// item. Keep `.navigationTitle("Civica")` upstream of this — the
    /// system back-button label still reads from it.
    func civicaNavWordmark() -> some View {
        toolbar {
            ToolbarItem(placement: .principal) {
                CivicaNavWordmark()
            }
        }
    }

    /// Trailing wheat-only badge, no wordmark. For surfaces that own
    /// their own title (EBT Balance, Find Help map). Composes alongside
    /// existing `.topBarTrailing` items rather than replacing them.
    func civicaWheatBadge() -> some View {
        toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Image("civica-wheat-logo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 32, height: 32)
                    .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                    .accessibilityLabel("Civica")
            }
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        Color(.systemBackground)
            .navigationTitle("Civica")
            .navigationBarTitleDisplayMode(.inline)
            .civicaNavWordmark()
    }
}
#endif
