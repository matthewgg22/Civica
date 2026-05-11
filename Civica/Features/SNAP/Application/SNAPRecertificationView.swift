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
            Text(SNAPStatusHomeStrings.recertBody.value(in: language))
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
                .font(.system(size: 12, weight: .semibold))
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
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(CivicaColors.accentTeal)
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

    private var actionButtons: some View {
        VStack(spacing: CivicaSpacing.sm) {
            CivicaPrimaryButton(
                SNAPStatusHomeStrings.recertPrimaryAction.value(in: language),
                action: onStartRecert
            )
            CivicaSecondaryButton(
                title: SNAPStatusHomeStrings.recertSecondaryOpenDTA.value(in: language),
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
