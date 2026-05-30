import CivicaDesignSystem
import SwiftUI
import UIKit

// Founder-only export surface for the manual concierge call workflow
// (Interview Navigator Feature 3). Reads the local device's state —
// contact phone + TCPA consent timestamp, scheduled interview date,
// estimated monthly benefit — and produces a single-row CSV the
// operator can AirDrop or email to themselves for Airtable logging.
//
// One row max because v1 Civica tracks a single SNAP application
// per device. Gated on:
//   • TCPA consent has been granted (tcpaConsentAt != nil)
//   • Interview is scheduled and dated (interviewScheduledFor != nil)
//   • The scheduled date is within the next 72 hours
//
// Surface is reached via a hidden long-press gesture on the waiting-
// room footer + a numeric PIN (AdminPIN.current). Not a security
// boundary — see AdminPIN.swift for threat model.

struct AdminInterviewExportView: View {
    let language: CivicaLanguage
    let onDismiss: () -> Void

    @State private var enteredPIN: String = ""
    @State private var isUnlocked: Bool = false
    @State private var row: ExportRow?
    @State private var csvFileURL: URL?
    @State private var showShareSheet: Bool = false

    struct ExportRow {
        let phoneE164: String
        let interviewDatetimeLocal: String
        let language: String
        let monthlyBenefitEstimate: String
    }

    var body: some View {
        NavigationStack {
            Group {
                if isUnlocked {
                    unlockedBody
                } else {
                    pinEntryBody
                }
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle("Civica · Admin")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close", action: onDismiss)
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .accessibilityLabel("Close admin export")
                }
            }
        }
    }

    // MARK: - PIN entry

    private var pinEntryBody: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            Text("Enter operator PIN")
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            Text("This surface is for the Civica founder + concierge team. It exports the upcoming-interview list for manual outreach.")
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            SecureField("PIN", text: $enteredPIN)
                .keyboardType(.numberPad)
                .padding(CivicaSpacing.md)
                .frame(minHeight: 56)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )

            CivicaPrimaryButton("Unlock", action: attemptUnlock)
            Spacer()
        }
        .padding(CivicaSpacing.xl)
    }

    private func attemptUnlock() {
        guard enteredPIN == AdminPIN.current else {
            enteredPIN = ""
            return
        }
        isUnlocked = true
        row = loadCurrentRow()
    }

    // MARK: - Unlocked body

    @ViewBuilder
    private var unlockedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text("Upcoming interview (next 72 hours)")
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)

                if let row {
                    rowCard(row)
                    CivicaPrimaryButton("Share CSV", action: prepareAndShareCSV)
                } else {
                    Text("No row to export. The current device either hasn't granted TCPA consent, has no scheduled interview date, or the interview is more than 72 hours away.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(CivicaSpacing.xl)
        }
        .sheet(isPresented: $showShareSheet) {
            if let csvFileURL {
                ShareSheet(activityItems: [csvFileURL])
            }
        }
    }

    private func rowCard(_ row: ExportRow) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            labeledLine("Phone", row.phoneE164)
            labeledLine("Interview", row.interviewDatetimeLocal)
            labeledLine("Language", row.language)
            labeledLine("Monthly benefit est.", row.monthlyBenefitEstimate)
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

    private func labeledLine(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(0.8)
                .frame(width: 140, alignment: .leading)
            Text(value)
                .font(CivicaTypography.body.monospacedDigit())
                .foregroundStyle(CivicaColors.ink)
        }
    }

    // MARK: - Data loading

    private func loadCurrentRow() -> ExportRow? {
        let draftStore = SNAPApplicationDraftStore()
        let statusStore = SNAPApplicationStatusStore()
        let estimatorStore = SNAPEstimatorResultStore()

        guard let draft = draftStore.load()?.draft else { return nil }
        guard let consentDate = draft.contact.tcpaConsentAt, consentDate <= Date() else { return nil }
        guard let phoneRaw = draft.contact.phone, !phoneRaw.isEmpty else { return nil }
        guard let interviewDate = statusStore.interviewScheduledFor else { return nil }

        let window = Date().addingTimeInterval(72 * 60 * 60)
        guard interviewDate >= Date() && interviewDate <= window else { return nil }

        let digits = USPhoneFormatter.digits(phoneRaw)
        let phoneE164 = digits.count == 10 ? "+1\(digits)" : digits

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone.current
        let interviewISO = formatter.string(from: interviewDate)

        let monthlyBenefit = estimatorStore.load()?.monthlyBenefit
        let monthlyDisplay: String
        if let monthlyBenefit {
            monthlyDisplay = "$\(NSDecimalNumber(decimal: monthlyBenefit).intValue)"
        } else {
            monthlyDisplay = ""
        }

        return ExportRow(
            phoneE164: phoneE164,
            interviewDatetimeLocal: interviewISO,
            language: language.rawValue,
            monthlyBenefitEstimate: monthlyDisplay
        )
    }

    // MARK: - CSV share

    private func prepareAndShareCSV() {
        guard let row else { return }
        let header = "phone_e164,interview_datetime_local,language,monthly_benefit_est\n"
        let body = [
            row.phoneE164,
            row.interviewDatetimeLocal,
            row.language,
            row.monthlyBenefitEstimate
        ].map(csvEscape).joined(separator: ",")
        let csv = header + body + "\n"

        let filename = "civica-interview-\(Int(Date().timeIntervalSince1970)).csv"
        let url = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(filename)
        do {
            try csv.write(to: url, atomically: true, encoding: .utf8)
            csvFileURL = url
            showShareSheet = true
        } catch {
            csvFileURL = nil
        }
    }

    private func csvEscape(_ field: String) -> String {
        if field.contains(",") || field.contains("\"") || field.contains("\n") {
            return "\"" + field.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return field
    }
}

// MARK: - UIActivityViewController wrapper

private struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

#if DEBUG
struct AdminInterviewExportView_Previews: PreviewProvider {
    static var previews: some View {
        AdminInterviewExportView(language: .english, onDismiss: {})
    }
}
#endif
