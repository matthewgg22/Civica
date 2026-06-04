import CivicaDesignSystem
import SwiftUI

// JR-4 + UD-7 + CQ-5 of the iOS product audit (2026-05-29).
//
// SNAPApprovalBannerCard is the persistent "you're approved" banner that
// appears on the Phase 3 (Enrolled) home the moment status flips to
// `.decisionApproved`. It stays put until the user either dismisses it
// or links their EBT card — whichever comes first — and then auto-clears
// for that decision cycle.
//
// Two flavors:
//   - .firstApproval: "You're approved for CalFresh" / card arrival copy.
//   - .renewal:       "You're renewed for another year" / continuity copy.
//
// Flavor selection is driven by `CivicaAppStorageKeys.hasBeenApprovedBefore`
// — set true alongside the first acknowledgment so any subsequent fire
// (after a `.recertDue → .decisionApproved` transition per CQ-5) renders
// the renewal copy.
//
// Surface posture (per audit JR-4):
//   - pineSurface fill (success-adjacent per DESIGN.md §2.1)
//   - checkmark.circle.fill in pinePrimary
//   - dignified, not celebratory — government-grade trust posture
//   - sits ABOVE the existing "your card is on the way" placeholder
//     in CivicaHomePhase3View (different roles, not a replacement)

// MARK: - Resetter service

/// Owns the transition rules that flip `approvalAcknowledged` /
/// `hasBeenApprovedBefore`. Extracted from the host view so the
/// transition logic is unit-testable against an injected `UserDefaults`
/// suite without needing a SwiftUI behavioral harness.
///
/// All writes go through this service — both the transition resets
/// (`handleTransition`) and the acknowledgment writes (`acknowledge`).
/// The view's `@AppStorage` properties observe the same keys and
/// re-render on the next runloop tick.
@MainActor
struct SNAPApprovalAcknowledgmentResetter {
    let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    /// Apply the audit's reset rules to a single status transition.
    ///
    /// Rules (per ARCH-3 + CQ-5):
    ///   - `.notStarted` (any → notStarted): fresh case — clear both
    ///     flags so the next approval renders as `.firstApproval`.
    ///   - `.recertDue → .decisionApproved`: renewal moment — clear
    ///     `approvalAcknowledged` only, so the banner re-fires with
    ///     `.renewal` copy. `hasBeenApprovedBefore` stays true.
    func handleTransition(from old: SNAPApplicationStatus, to new: SNAPApplicationStatus) {
        if new == .notStarted {
            defaults.set(false, forKey: CivicaAppStorageKeys.approvalAcknowledged)
            defaults.set(false, forKey: CivicaAppStorageKeys.hasBeenApprovedBefore)
            return
        }
        if old == .recertDue && new == .decisionApproved {
            defaults.set(false, forKey: CivicaAppStorageKeys.approvalAcknowledged)
        }
    }

    /// Mark the current approval as acknowledged. Called when the user
    /// dismisses the banner OR links their EBT card. Also stamps
    /// `hasBeenApprovedBefore` true so any future approval (after a
    /// recert cycle) renders the `.renewal` flavor.
    func acknowledge() {
        defaults.set(true, forKey: CivicaAppStorageKeys.approvalAcknowledged)
        defaults.set(true, forKey: CivicaAppStorageKeys.hasBeenApprovedBefore)
    }
}

// MARK: - Banner card

struct SNAPApprovalBannerCard: View {
    enum Flavor {
        case firstApproval
        case renewal
    }

    let flavor: Flavor
    let language: CivicaLanguage
    let onWhatThisMeans: () -> Void
    let onFindHelp: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            headerRow
            divider
            actionRows
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.pineSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityHeader)
    }

    // MARK: - Header (checkmark + headline + body + dismiss)

    private var headerRow: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: "checkmark.circle.fill")
                .imageScale(.large)
                .font(.body)
                // §2.2: positive-outcome glyph uses amber, not pine (CTA-only).
                .foregroundStyle(CivicaColors.amberPrimary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(strings.headline.value(in: language))
                    .font(CivicaTypography.cardTitle)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text(strings.bodyLine1.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if let line2 = strings.bodyLine2 {
                    Text(line2.value(in: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: CivicaSpacing.sm)
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .padding(CivicaSpacing.xs)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(SNAPApprovalBannerStrings.dismissA11y.value(in: language))
        }
    }

    private var divider: some View {
        Rectangle()
            // §2.2: decorative dividers use the dedicated hairline token.
            .fill(CivicaColors.hairline)
            .frame(height: 1)
    }

    private var actionRows: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            actionRow(
                label: SNAPApprovalBannerStrings.whatThisMeans.value(in: language),
                action: onWhatThisMeans
            )
            actionRow(
                label: strings.findHelpLink.value(in: language),
                action: onFindHelp
            )
        }
    }

    private func actionRow(label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: CivicaSpacing.xs) {
                Text(label)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Flavor-keyed string lookup

    private var strings: SNAPApprovalBannerStrings.FlavorCopy {
        switch flavor {
        case .firstApproval: return SNAPApprovalBannerStrings.firstApproval
        case .renewal:       return SNAPApprovalBannerStrings.renewal
        }
    }

    private var accessibilityHeader: String {
        let line2 = strings.bodyLine2?.value(in: language) ?? ""
        return [
            strings.headline.value(in: language),
            strings.bodyLine1.value(in: language),
            line2,
        ]
        .filter { !$0.isEmpty }
        .joined(separator: ". ")
    }
}

// MARK: - Strings

enum SNAPApprovalBannerStrings {

    struct FlavorCopy {
        let headline: CivicaText
        let bodyLine1: CivicaText
        let bodyLine2: CivicaText?
        let findHelpLink: CivicaText
    }

    static let firstApproval = FlavorCopy(
        headline: CivicaText(
            "You're approved for CalFresh",
            es: "Tu solicitud de CalFresh fue aprobada"
        ),
        bodyLine1: CivicaText(
            "Your EBT card will arrive in 3-7 days.",
            es: "Tu tarjeta EBT llegará en 3-7 días."
        ),
        bodyLine2: CivicaText(
            "When it does, link it here to see your balance.",
            es: "Cuando llegue, enlázala aquí para ver tu saldo."
        ),
        findHelpLink: CivicaText(
            "Find help while you wait",
            es: "Encuentra ayuda mientras esperas"
        )
    )

    static let renewal = FlavorCopy(
        headline: CivicaText(
            "You're renewed for another year",
            es: "Renovaste por un año más"
        ),
        bodyLine1: CivicaText(
            "Your benefits will continue without interruption.",
            es: "Tus beneficios seguirán sin interrupción."
        ),
        bodyLine2: nil,
        findHelpLink: CivicaText(
            "Find help if you need it",
            es: "Encuentra ayuda si la necesitas"
        )
    )

    static let whatThisMeans = CivicaText(
        "What this means for you",
        es: "Lo que esto significa para ti"
    )

    static let dismissA11y = CivicaText(
        "Dismiss approval banner",
        es: "Descartar aviso de aprobación"
    )
}

// MARK: - Previews

#if DEBUG
struct SNAPApprovalBannerCard_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            SNAPApprovalBannerCard(
                flavor: .firstApproval,
                language: .english,
                onWhatThisMeans: {},
                onFindHelp: {},
                onDismiss: {}
            )
            SNAPApprovalBannerCard(
                flavor: .renewal,
                language: .english,
                onWhatThisMeans: {},
                onFindHelp: {},
                onDismiss: {}
            )
        }
        .padding()
        .background(CivicaColors.paper)
    }
}
#endif
