import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: confirmation UI for an extracted paystub.
//
// This view is the trust boundary: every extracted field is shown
// back to the user with the option to correct before the data flows
// into the rules engine. LLM extraction occasionally misreads a digit;
// surfacing for confirmation keeps the system honest.
//
// Phase E renders paystub fields read-only with a "Looks right" / "Fix
// something" pair of actions. Phase E+1 wires up inline editing for
// each field that lands corrections back to the backend.

struct SNAPDocumentConfirmationView: View {
    let extraction: SNAPExtractionResult
    let onConfirm: () -> Void
    let onCorrect: () -> Void

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                header
                if let paystub = extraction.extractedPaystub {
                    paystubFields(paystub)
                } else {
                    nonPaystubFallback
                }
                HStack {
                    Spacer(minLength: 0)
                    CivicaAIBadge()
                }
                if !extraction.validationFlags.isEmpty {
                    validationFlagsSection
                }
                actionRow
            }
            .padding(CivicaSpacing.lg)
        }
        .background(CivicaColors.paper)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPDocumentConfirmationStrings.title.value(in: language))
                .font(CivicaTypography.cardTitle)
                .foregroundColor(CivicaColors.ink)
            Text(SNAPDocumentConfirmationStrings.subtitle.value(in: language))
                .font(CivicaTypography.subhead)
                .foregroundColor(CivicaColors.graphite)
        }
    }

    private func paystubFields(_ paystub: SNAPPaystub) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            field(SNAPDocumentConfirmationStrings.employerLabel.value(in: language), paystub.employerName)
            field(SNAPDocumentConfirmationStrings.payPeriodLabel.value(in: language), "\(paystub.payPeriodStart) — \(paystub.payPeriodEnd)")
            if let payDate = paystub.payDate {
                field(SNAPDocumentConfirmationStrings.payDateLabel.value(in: language), payDate)
            }
            field(SNAPDocumentConfirmationStrings.grossPayLabel.value(in: language), "$\(paystub.grossPayPeriod)")
            field(SNAPDocumentConfirmationStrings.netPayLabel.value(in: language), "$\(paystub.netPayPeriod)")
            if let hours = paystub.hoursWorkedInPeriod {
                field(SNAPDocumentConfirmationStrings.hoursWorkedLabel.value(in: language), "\(hours)")
            }
            if let rate = paystub.hourlyRate {
                field(SNAPDocumentConfirmationStrings.hourlyRateLabel.value(in: language), "$\(rate)\(SNAPDocumentConfirmationStrings.hourlyRateSuffix.value(in: language))")
            }
            if !paystub.deductions.isEmpty {
                deductionsList(paystub.deductions)
            }
            if let ytd = paystub.grossPayYTD {
                field(SNAPDocumentConfirmationStrings.grossYearToDateLabel.value(in: language), "$\(ytd)")
            }
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private var nonPaystubFallback: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPDocumentConfirmationStrings.documentTypeAcknowledgement(
                rawType: extraction.classification.documentType.rawValue,
                language: language
            ))
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.ink)
            Text(SNAPDocumentConfirmationStrings.stoppedReading.value(in: language))
                .font(CivicaTypography.subhead)
                .foregroundColor(CivicaColors.graphite)
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private func deductionsList(_ deductions: [SNAPPaystubDeduction]) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPDocumentConfirmationStrings.deductionsHeading.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.ink)
            ForEach(deductions, id: \.labelAsPrinted) { d in
                HStack {
                    Text(d.labelAsPrinted)
                        .font(CivicaTypography.subhead)
                        .foregroundColor(CivicaColors.ink)
                    Spacer()
                    Text("$\(d.amount)")
                        .font(CivicaTypography.subhead)
                        .foregroundColor(CivicaColors.graphite)
                }
            }
        }
        .padding(.top, CivicaSpacing.xs)
    }

    private var validationFlagsSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPDocumentConfirmationStrings.doubleCheckHeading.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.ink)
            ForEach(extraction.validationFlags) { flag in
                HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                    Image(systemName: severityIcon(flag.severity))
                        .foregroundColor(severityColor(flag.severity))
                        .accessibilityHidden(true)
                    Text(flag.messageEn)
                        .font(CivicaTypography.footnote)
                        .foregroundColor(CivicaColors.ink)
                }
            }
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.statusWarningSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
    }

    private var actionRow: some View {
        HStack(spacing: CivicaSpacing.md) {
            Button(action: onCorrect) {
                Text(SNAPDocumentConfirmationStrings.fixSomething.value(in: language))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.sm)
                    .background(CivicaColors.secondaryButtonFill)
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .strokeBorder(CivicaColors.secondaryButtonBorder)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                    .foregroundColor(CivicaColors.ink)
            }
            Button(action: onConfirm) {
                Text(SNAPDocumentConfirmationStrings.looksRight.value(in: language))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.sm)
                    .background(CivicaColors.brickPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                    .foregroundColor(CivicaColors.onPrimaryText)
            }
        }
    }

    private func field(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(CivicaTypography.subhead)
                .foregroundColor(CivicaColors.graphite)
            Spacer()
            Text(value)
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.ink)
                .multilineTextAlignment(.trailing)
        }
    }

    private func severityIcon(_ severity: String) -> String {
        switch severity {
        case "blocker": return "xmark.octagon.fill"
        case "warning": return "exclamationmark.triangle.fill"
        default: return "info.circle.fill"
        }
    }

    private func severityColor(_ severity: String) -> Color {
        switch severity {
        case "blocker": return CivicaColors.destructive
        case "warning": return CivicaColors.warningAmber
        default: return CivicaColors.neutralStatus
        }
    }
}
