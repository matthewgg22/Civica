import CivicaDesignSystem
import SwiftUI

// HANDOFF — recertification surface for the .recertDue status.
//
// SNAP recertification: every 12 months for most MA households,
// 24 months for elderly/disabled households. DTA mails a notice
// roughly 45 days before the due date. Miss it and benefits stop
// on the last day of the month.
//
// Design brief: urgent without panic. Tell the user what's happening
// (recertification = reapplying), why it matters (benefits stop),
// what they'll need (compact 4-row checklist), and give them one
// strong primary CTA into the screener plus a quiet escape hatch to
// DTA Connect for users who'd rather finish in the state portal.
//
// Wiring: CivicaRootView routes to this view when status is
// .recertDue. The deadline date is passed in by the caller — for
// v1 that's the store milestone for .recertDue (the date the user
// or backend set the status). When inbound-notice ingestion ships,
// the real DTA-issued due date overrides.

struct SNAPRecertificationView: View {
    @ObservedObject var statusStore: SNAPApplicationStatusStore
    let language: CivicaLanguage
    let deadline: Date?
    let onStartRecert: () -> Void
    let onOpenDTAConnect: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                whyMattersSection
                whatYoullNeedSection
                findHelpLink
                actionButtons
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            deadlineBadge
            Text(SNAPStatusHomeStrings.recertTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .accessibilityAddTraits(.isHeader)
                .fixedSize(horizontal: false, vertical: true)
            Text(SNAPStatusHomeStrings.recertBody(
                stateCode: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode,
                language: language
            ))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Small amber pill at the top of the header. Reads "Due by May 28"
    /// when we have a date, or "Due soon" as a generic urgency cue.
    private var deadlineBadge: some View {
        HStack(spacing: CivicaSpacing.xs) {
            Image(systemName: "clock.fill")
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.warningAmber)
                .accessibilityHidden(true)
            Text(deadlineLine)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.warningAmber)
                .textCase(.uppercase)
                .kerning(1.2)
        }
        .padding(.horizontal, CivicaSpacing.md)
        .padding(.vertical, CivicaSpacing.xs)
        .background(CivicaColors.warningAmber.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.pill))
        .accessibilityLabel(deadlineLine)
    }

    private var whyMattersSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPStatusHomeStrings.recertWhyMattersHeading.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            Text(SNAPStatusHomeStrings.recertWhyMattersBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(CivicaSpacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
        }
    }

    private var whatYoullNeedSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPStatusHomeStrings.recertWhatYoullNeedHeading.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            VStack(spacing: 0) {
                checklistRow(SNAPStatusHomeStrings.recertNeedIncome.value(in: language))
                Divider().background(CivicaColors.hairline)
                checklistRow(SNAPStatusHomeStrings.recertNeedHousehold.value(in: language))
                Divider().background(CivicaColors.hairline)
                checklistRow(SNAPStatusHomeStrings.recertNeedExpenses.value(in: language))
                Divider().background(CivicaColors.hairline)
                checklistRow(SNAPStatusHomeStrings.recertNeedAddress.value(in: language))
            }
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private func checklistRow(_ label: String) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: "checkmark.circle")
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.amberPrimary)
                .frame(width: 22, alignment: .leading)
                .padding(.top, 2)
                .accessibilityHidden(true)
            Text(label)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
    }

    /// Recertification is the second-most-common moment a user reaches
    /// for a SNAP navigator (after a denial). Surfacing the map filtered
    /// to SNAP application help here, between the checklist and the
    /// primary CTAs, gives users a real path to a human if the
    /// in-app flow stalls.
    private var findHelpLink: some View {
        NavigationLink {
            FindHelpRootView(
                initialFilter: FindHelpFilterState(
                    serviceType: .snapApplicationHelp,
                    languageCode: nil
                )
            )
        } label: {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: "person.2.fill")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(width: 28, alignment: .leading)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPStatusHomeStrings.findHelpApplicationLinkTitle.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(SNAPStatusHomeStrings.findHelpApplicationLinkSubtitle.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityHint(SNAPStatusHomeStrings.findHelpApplicationLinkSubtitle.value(in: language))
    }

    private var actionButtons: some View {
        VStack(spacing: CivicaSpacing.sm) {
            CivicaPrimaryButton(
                SNAPStatusHomeStrings.recertPrimaryAction.value(in: language),
                action: onStartRecert
            )
            CivicaSecondaryButton(
                title: SNAPStatusHomeStrings.recertSecondaryOpenPortal(
                    stateCode: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode,
                    language: language
                ),
                action: onOpenDTAConnect
            )
        }
        .padding(.top, CivicaSpacing.md)
    }

    // MARK: - Deadline formatting

    private var deadlineLine: String {
        guard let deadline else {
            return SNAPStatusHomeStrings.recertDueSoon.value(in: language)
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        formatter.locale = language == .spanish
            ? Locale(identifier: "es")
            : Locale(identifier: "en_US")
        return SNAPStatusHomeStrings.recertDueLine(
            formattedDate: formatter.string(from: deadline),
            language: language
        )
    }
}

#if DEBUG
struct SNAPRecertificationView_Previews: PreviewProvider {
    static var previews: some View {
        let store = SNAPApplicationStatusStore()
        store.advance(to: .recertDue)
        return Group {
            NavigationStack {
                SNAPRecertificationView(
                    statusStore: store,
                    language: .english,
                    deadline: Calendar.current.date(byAdding: .day, value: 18, to: Date()),
                    onStartRecert: {},
                    onOpenDTAConnect: {}
                )
            }
            .previewDisplayName("With deadline")

            NavigationStack {
                SNAPRecertificationView(
                    statusStore: store,
                    language: .spanish,
                    deadline: nil,
                    onStartRecert: {},
                    onOpenDTAConnect: {}
                )
            }
            .previewDisplayName("Spanish · no deadline")
        }
    }
}
#endif
