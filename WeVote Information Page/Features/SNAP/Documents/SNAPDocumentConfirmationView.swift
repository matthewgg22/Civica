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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                header
                if let paystub = extraction.extractedPaystub {
                    paystubFields(paystub)
                } else {
                    nonPaystubFallback
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
            Text("Does this look right?")
                .font(CivicaTypography.cardTitle)
                .foregroundColor(CivicaColors.ink)
            Text("We read these from your photo. Tap 'Fix something' if anything is off.")
                .font(CivicaTypography.subhead)
                .foregroundColor(CivicaColors.graphite)
        }
    }

    private func paystubFields(_ paystub: SNAPPaystub) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            field("Employer", paystub.employerName)
            field("Pay period", "\(paystub.payPeriodStart) — \(paystub.payPeriodEnd)")
            if let payDate = paystub.payDate {
                field("Pay date", payDate)
            }
            field("Gross pay (this period)", "$\(paystub.grossPayPeriod)")
            field("Net pay (this period)", "$\(paystub.netPayPeriod)")
            if let hours = paystub.hoursWorkedInPeriod {
                field("Hours worked", "\(hours)")
            }
            if let rate = paystub.hourlyRate {
                field("Hourly rate", "$\(rate)/hr")
            }
            if !paystub.deductions.isEmpty {
                deductionsList(paystub.deductions)
            }
            if let ytd = paystub.grossPayYTD {
                field("Gross year-to-date", "$\(ytd)")
            }
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private var nonPaystubFallback: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text("We saw a \(extraction.classification.documentType.rawValue.replacingOccurrences(of: "_", with: " "))")
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.ink)
            Text("Thanks — we'll keep it on file. We'll only read paystubs in detail for now.")
                .font(CivicaTypography.subhead)
                .foregroundColor(CivicaColors.graphite)
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private func deductionsList(_ deductions: [SNAPPaystubDeduction]) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text("Deductions")
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
            Text("A few things to double-check:")
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.ink)
            ForEach(extraction.validationFlags) { flag in
                HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                    Image(systemName: severityIcon(flag.severity))
                        .foregroundColor(severityColor(flag.severity))
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
                Text("Fix something")
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
                Text("Looks right")
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
