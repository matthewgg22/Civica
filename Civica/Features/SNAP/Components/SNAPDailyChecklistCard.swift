import CivicaDesignSystem
import SwiftUI

// PLACEHOLDER CONTENT — UD-2 SME review pending.
// Real content authored by CBO advisor (Project Bread / Dave Guarino
// reference). See docs/runbooks/recert-companion-rollout.md (or
// wherever the SME review lands).
//
// JR-1 of the iOS product audit (2026-05-29). Adds a status-aware
// "things you can do today" card to the Phase 2 (Pending) home — 3-5
// items the user can act on while the county reviews. Per the audit's
// guard rail, copy is reassuring rather than urgency-framed
// ("things you can do today", never "things you must do") and the list
// stays at most 5 items per status.
//
// Persistence: each item's checked state is stored under
// `\(CivicaAppStorageKeys.dailyChecklistPrefix).<status-raw>.<item-slug>`.
// Keys are scoped to the status sub-state, so a status transition
// renders a fresh set of items without erasing the previously-checked
// state for the prior status — return-trips to that status restore it.

// MARK: - Item

/// One row in the daily checklist. `slug` is the stable identifier used
/// to form the `@AppStorage` key (kebab-case, no spaces) and must not
/// change once shipped — renaming a slug orphans existing user state.
struct SNAPDailyChecklistItem: Identifiable, Equatable, Sendable {
    let slug: String
    let title: CivicaText

    var id: String { slug }
}

// MARK: - Item catalog

enum SNAPDailyChecklist {

    /// Status-aware item set. Statuses outside the supported sub-states
    /// return an empty list — the card is gated on a non-empty set by
    /// `CivicaHomePhase2View`, so an unsupported status simply hides it.
    ///
    /// Per the audit guard rail, every status returns ≤ 5 items.
    static func items(for status: SNAPApplicationStatus) -> [SNAPDailyChecklistItem] {
        switch status {
        case .submittedToState:
            return [
                SNAPDailyChecklistItem(
                    slug: "gather-backup-paystub",
                    title: CivicaText(
                        "Gather a backup pay stub (PDF or photo)",
                        es: "Reúne un comprobante de pago de respaldo (PDF o foto)"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "save-county-number",
                    title: CivicaText(
                        "Save your county number to your phone",
                        es: "Guarda el número de tu condado en tu teléfono"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "look-up-timeline",
                    title: CivicaText(
                        "Look up your case's expected timeline",
                        es: "Consulta el plazo esperado para tu caso"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "set-day-30-reminder",
                    title: CivicaText(
                        "Set a reminder for day 30 to follow up",
                        es: "Pon un recordatorio para el día 30 para dar seguimiento"
                    )
                ),
            ]
        case .documentsRequested:
            return [
                SNAPDailyChecklistItem(
                    slug: "open-inbox",
                    title: CivicaText(
                        "Open your inbox and read the request",
                        es: "Abre tu bandeja y lee la solicitud"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "gather-requested-docs",
                    title: CivicaText(
                        "Gather the documents the county asked for",
                        es: "Reúne los documentos que el condado pidió"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "upload-via-portal",
                    title: CivicaText(
                        "Upload them through the state portal",
                        es: "Súbelos a través del portal estatal"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "save-county-confirmation",
                    title: CivicaText(
                        "Save the county's confirmation for your records",
                        es: "Guarda la confirmación del condado para tu registro"
                    )
                ),
            ]
        case .interviewScheduled:
            return [
                SNAPDailyChecklistItem(
                    slug: "test-phone-audio",
                    title: CivicaText(
                        "Test your phone's audio in a quiet spot",
                        es: "Prueba el audio de tu teléfono en un lugar tranquilo"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "gather-interview-docs",
                    title: CivicaText(
                        "Gather your documents within arm's reach",
                        es: "Ten tus documentos a la mano"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "charge-phone",
                    title: CivicaText(
                        "Charge your phone the night before",
                        es: "Carga tu teléfono la noche anterior"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "set-15-min-before-alarm",
                    title: CivicaText(
                        "Set an alarm 15 minutes before the call",
                        es: "Pon una alarma 15 minutos antes de la llamada"
                    )
                ),
            ]
        case .interviewCompleted:
            return [
                SNAPDailyChecklistItem(
                    slug: "save-case-number",
                    title: CivicaText(
                        "Save your case number somewhere you'll find it",
                        es: "Guarda tu número de caso donde lo puedas encontrar"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "set-day-30-reminder",
                    title: CivicaText(
                        "Set a reminder for day 30 to follow up",
                        es: "Pon un recordatorio para el día 30 para dar seguimiento"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "look-up-appeal-window",
                    title: CivicaText(
                        "Look up your appeal window — just in case",
                        es: "Consulta tu plazo de apelación — por si acaso"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "save-county-number",
                    title: CivicaText(
                        "Save your county number to your phone",
                        es: "Guarda el número de tu condado en tu teléfono"
                    )
                ),
            ]
        default:
            return []
        }
    }

    /// Full `@AppStorage` key for one item under one status — exposed so
    /// tests and the SwiftUI view share the same key formation.
    static func storageKey(status: SNAPApplicationStatus, slug: String) -> String {
        "\(CivicaAppStorageKeys.dailyChecklistPrefix).\(status.rawValue).\(slug)"
    }
}

// MARK: - Card

struct SNAPDailyChecklistCard: View {
    let status: SNAPApplicationStatus
    let language: CivicaLanguage

    private var items: [SNAPDailyChecklistItem] {
        SNAPDailyChecklist.items(for: status)
    }

    var body: some View {
        if items.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                Text(SNAPDailyChecklistStrings.cardTitle.value(in: language))
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
                    .accessibilityAddTraits(.isHeader)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                    ForEach(items) { item in
                        SNAPDailyChecklistRow(
                            status: status,
                            item: item,
                            language: language
                        )
                    }
                }
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .fill(CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .stroke(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }
}

// MARK: - Row

private struct SNAPDailyChecklistRow: View {
    let status: SNAPApplicationStatus
    let item: SNAPDailyChecklistItem
    let language: CivicaLanguage

    @AppStorage private var checked: Bool

    init(status: SNAPApplicationStatus, item: SNAPDailyChecklistItem, language: CivicaLanguage) {
        self.status = status
        self.item = item
        self.language = language
        let key = SNAPDailyChecklist.storageKey(status: status, slug: item.slug)
        self._checked = AppStorage(wrappedValue: false, key)
    }

    var body: some View {
        Button {
            checked.toggle()
        } label: {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: checked ? "checkmark.square.fill" : "square")
                    .font(.system(size: 20))
                    .foregroundStyle(checked ? CivicaColors.pinePrimary : CivicaColors.graphite)
                    .frame(width: 22, alignment: .leading)
                    .padding(.top, 1)
                    .accessibilityHidden(true)
                Text(item.title.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(checked ? CivicaColors.graphite : CivicaColors.ink)
                    .strikethrough(checked, color: CivicaColors.graphite)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(item.title.value(in: language))
        .accessibilityAddTraits(checked ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Strings

enum SNAPDailyChecklistStrings {
    static let cardTitle = CivicaText(
        "While the county reviews — things you can do today",
        es: "Mientras el condado revisa — cosas que puedes hacer hoy"
    )
}

#if DEBUG
struct SNAPDailyChecklistCard_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: CivicaSpacing.lg) {
                SNAPDailyChecklistCard(status: .submittedToState, language: .english)
                SNAPDailyChecklistCard(status: .documentsRequested, language: .english)
                SNAPDailyChecklistCard(status: .interviewScheduled, language: .spanish)
            }
            .padding()
        }
        .background(CivicaColors.paper)
    }
}
#endif
