import CivicaDesignSystem
import SwiftUI
import UIKit

// Inline document-scan affordance for any question screen that wants to
// offer "scan a doc to autofill this answer." Mirrors the existing
// paystub-suggestion pattern in SNAPIncomeFlow.GrossIncomeEntryMode:
// the applicant always remains the source of truth — the scan just
// suggests, the applicant accepts or overrides.
//
// Used by Waves A-D of the BenefitsCal-parity document-assist plan:
//   • Wave A — rent (lease)
//   • Wave B — utility (bill)
//   • Wave C — DOB (photo ID)
//   • Wave D — liquid resources (bank statement)
//
// Visual:
//   "Or scan your [lease] to autofill" pine-text button + viewfinder
//   glyph, mounted below the typed input on each question. On tap
//   opens the existing SNAPDocumentCameraView; on extract, hands the
//   parsed values back to the caller via onExtracted so the parent
//   view can surface the suggestion card.
//
// Hidden entirely on devices without Foundation Models / Apple
// Intelligence available, so the existing typed-input UX stays
// uncluttered there.

struct SNAPInlineDocScanCTA: View {
    /// Which document type the camera should treat the capture as —
    /// drives the extractor's prompt routing in
    /// `SNAPOnDeviceExtractor.extract(image:capturedAs:)`.
    let documentType: SNAPDocumentType
    /// User-visible label, e.g. "Scan your lease to autofill" or
    /// "Use your ID to fill DOB."
    let ctaLabel: String
    /// Caller receives the typed extraction result. The parent decides
    /// what to do with each non-nil field — usually surface as a
    /// suggestion card with "Use this / Keep what I typed."
    let onExtracted: (SNAPInlineDocScanResult) -> Void

    @State private var presentingCamera: Bool = false
    @State private var isExtracting: Bool = false

    var body: some View {
        if isAvailable {
            content
        } else {
            EmptyView()
        }
    }

    private var isAvailable: Bool {
        SNAPOnDeviceExtractor.isAvailable
    }

    private var content: some View {
        Button {
            presentingCamera = true
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: isExtracting
                    ? "wand.and.stars"
                    : "viewfinder.circle")
                    .imageScale(.medium)
                    .accessibilityHidden(true)
                Text(ctaLabel)
                    .font(CivicaTypography.footnoteStrong)
                if isExtracting {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .controlSize(.mini)
                        .tint(CivicaColors.pinePrimary)
                }
                Spacer(minLength: 0)
            }
            .foregroundStyle(CivicaColors.pinePrimary)
            .padding(.vertical, CivicaSpacing.xs)
        }
        .buttonStyle(.plain)
        .disabled(isExtracting)
        .accessibilityLabel(ctaLabel)
        .fullScreenCover(isPresented: $presentingCamera) {
            SNAPDocumentCameraView(
                onCaptured: { image, _ in
                    presentingCamera = false
                    runExtraction(image: image)
                },
                onCancel: {
                    presentingCamera = false
                }
            )
            .ignoresSafeArea()
        }
    }

    private func runExtraction(image: UIImage) {
        guard #available(iOS 26, *) else { return }
        isExtracting = true
        Task { @MainActor in
            defer { isExtracting = false }
            do {
                let result = try await SNAPOnDeviceExtractor.extract(
                    image: image,
                    capturedAs: documentType
                )
                let other = result.extractedOther ?? [:]
                let parsed = SNAPInlineDocScanResult(
                    primaryAmount: other["amount"],
                    address: other["address"],
                    dateOfBirth: other["date_of_birth"],
                    zipCode: other["zip"],
                    rawConfidence: result.extractionConfidence
                )
                onExtracted(parsed)
            } catch {
                // Demo-friendly: a failed extraction just no-ops so
                // the user can continue typing. The captured photo
                // is NOT persisted from this inline button — that's
                // the documents-step's job, not this affordance's.
            }
        }
    }
}

/// Typed projection of the on-device extractor result for inline
/// per-question scanning. Each field is the parsed-decimal /
/// plain-string shape the question screens can drop straight into
/// their existing text bindings.
struct SNAPInlineDocScanResult {
    /// Primary money amount on the doc (rent, utility total, balance).
    /// Plain decimal string like "1400.50", no $ / commas.
    let primaryAmount: String?
    /// Address printed on the doc (e.g. service address on a utility bill).
    let address: String?
    /// ISO 8601 date string (YYYY-MM-DD) for documents that carry a DOB.
    let dateOfBirth: String?
    /// ZIP code printed on the doc.
    let zipCode: String?
    /// Extractor's self-reported confidence in the result.
    let rawConfidence: Double

    /// Parses `primaryAmount` into a Decimal for callers that want to
    /// validate / clamp the suggestion before surfacing it.
    var primaryAmountDecimal: Decimal? {
        guard let raw = primaryAmount?.trimmingCharacters(in: .whitespaces),
              !raw.isEmpty,
              let value = Decimal(string: raw) else { return nil }
        return value
    }

    /// Parses `dateOfBirth` into a Date for callers that want to drop
    /// into a Date-typed binding (e.g. applicant DOB).
    var dateOfBirthDate: Date? {
        guard let raw = dateOfBirth?.trimmingCharacters(in: .whitespaces),
              !raw.isEmpty else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.date(from: raw)
    }
}
