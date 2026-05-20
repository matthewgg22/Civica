import SwiftUI

/// Screen 04 — Apply handoff modal sheet.
///
/// Presented as a `.sheet` from Screen 03. Explains what data Civica
/// shares with Handshake, previews the post-placement loop, and hands
/// off to the external Handshake OAuth flow.
struct SNAPApplyHandoffView: View {
    @ObservedObject var vm: SNAPMarketplaceViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    /// Called when user taps "Reconnect" on a disconnected Plaid row.
    var onReconnectPlaid: (() -> Void)? = nil
    /// Called when user taps "Reconnect" on a disconnected Canvas row.
    var onReconnectCanvas: (() -> Void)? = nil

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue
    private var language: CivicaLanguage { CivicaLanguage(rawValue: languageRaw) ?? .english }

    private var plaidDateFormatted: String {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f.string(from: vm.dataSources.plaidLastVerified)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    heroBlock
                    introBlock
                    sharedCard
                    notSharedNote
                    MHairline()
                    afterApplySection
                    actionsSection
                    Spacer(minLength: 32)
                }
            }
            .background(Color.civicaPaper.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        XCloseIcon()
                    }
                    .accessibilityLabel("Close")
                    .frame(minWidth: 44, minHeight: 44)
                }
                ToolbarItem(placement: .principal) {
                    Text(SNAPMarketplaceStrings.applyNavTitle.value(in: language))
                        .font(MFont.navTitle)
                        .foregroundStyle(Color.civicaInk)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: Hero

    private var heroBlock: some View {
        Text(SNAPMarketplaceStrings.applyHeroHeadline.value(in: language))
            .font(MFont.heroHeadline)
            .foregroundStyle(Color.civicaInk)
            .lineSpacing(20 * 0.22)  // line-height 1.22
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, 16)
    }

    // MARK: Intro

    private var introBlock: some View {
        Text(SNAPMarketplaceStrings.handshakeIntro.value(in: language))
            .font(MFont.body)
            .foregroundStyle(Color.civicaGraphite)
            .lineSpacing(16 * 0.45)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
    }

    // MARK: Shared card

    private var sharedCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Plaid income — grayed out with amber dot + Reconnect when disconnected
            if vm.dataSources.plaidConnected {
                sharedRow(
                    label: SNAPMarketplaceStrings.sharedRowPlaid.value(in: language),
                    detail: "(\(plaidDateFormatted))"
                )
            } else {
                disconnectedRow(
                    label: SNAPMarketplaceStrings.sharedRowPlaid.value(in: language),
                    onReconnect: onReconnectPlaid
                )
            }

            // Canvas schedule — grayed out when Canvas is not connected
            if vm.dataSources.canvas == .connected {
                sharedRow(
                    label: SNAPMarketplaceStrings.sharedRowCanvas.value(in: language),
                    detail: nil
                )
            } else {
                disconnectedRow(
                    label: SNAPMarketplaceStrings.sharedRowCanvas.value(in: language),
                    onReconnect: onReconnectCanvas
                )
            }

            // SNAP status is always confirmed once we reach this screen
            sharedRow(
                label: SNAPMarketplaceStrings.sharedRowSnapEligible.value(in: language),
                detail: nil
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color.civicaPaper2)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .padding(.horizontal, 24)
        .padding(.bottom, 14)
    }

    private func sharedRow(label: String, detail: String?) -> some View {
        HStack(alignment: .top, spacing: 12) {
            MCheckGlyph(size: 18, color: .civicaBrick)
                .padding(.top, 1)
            Group {
                if let d = detail {
                    Text(label)
                        .font(MFont.bodySmallMedium)
                        .foregroundStyle(Color.civicaInk)
                    + Text(" \(d)")
                        .font(MFont.bodySmall)
                        .foregroundStyle(Color.civicaGraphite)
                } else {
                    Text(label)
                        .font(MFont.bodySmallMedium)
                        .foregroundStyle(Color.civicaInk)
                }
            }
            .lineSpacing(15 * 0.35)
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    // Amber-dot row shown when Plaid or Canvas is disconnected (D5).
    // Label is grayed out; "Reconnect" button appears when a reconnect handler is wired.
    private func disconnectedRow(label: String, onReconnect: (() -> Void)?) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Circle()
                .fill(Color.civicaAmber)
                .frame(width: 8, height: 8)
                .padding(.top, 1)
                .accessibilityHidden(true)

            Text(label)
                .font(MFont.bodySmallMedium)
                .foregroundStyle(Color.civicaGraphite)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let handler = onReconnect {
                Button(SNAPMarketplaceStrings.reconnect.value(in: language)) {
                    handler()
                }
                .font(MFont.metaMedium)
                .foregroundStyle(Color.civicaAmber)
                .frame(minWidth: 44, minHeight: 44)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            label + ", " + SNAPMarketplaceStrings.disconnectedSource.value(in: language)
        )
        .accessibilityHint(onReconnect != nil ? "Tap Reconnect to link your account" : "")
    }

    // MARK: Not-shared note

    private var notSharedNote: some View {
        Text(SNAPMarketplaceStrings.notSharedNote.value(in: language))
            .font(MFont.bodySmall)
            .foregroundStyle(Color.civicaGraphite)
            .lineSpacing(15 * 0.45)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 24)
            .padding(.bottom, 18)
    }

    // MARK: After-apply section

    private var afterApplySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            MCapsLabel(text: "What happens after you apply")
                .padding(.top, 18)
                .padding(.bottom, 10)

            StepRow(number: "1", text: "Handshake sends your application to the employer.")
            StepRow(number: "2", text: "If you're hired, Argyle confirms your first paycheck.")
            StepRow(number: "3", text: "We update your benefit estimate automatically and start tracking OBBBA hours.")
        }
        .padding(.bottom, 4)
    }

    // MARK: Actions

    private var actionsSection: some View {
        VStack(spacing: 0) {
            // "Continue to Handshake →" with Handshake in SemiBold
            Button {
                if let url = URL(string: "https://joinhandshake.com") {
                    openURL(url)
                }
            } label: {
                HStack(spacing: 4) {
                    Text(SNAPMarketplaceStrings.continueTo.value(in: language))
                        .font(MFont.bodySmallMedium)
                    + Text(SNAPMarketplaceStrings.handshakeBrand.value(in: language))
                        .font(.custom("HankenGrotesk-SemiBold", size: 17))
                        .kerning(-0.3)
                    + Text(SNAPMarketplaceStrings.arrowSuffix.value(in: language))
                        .font(MFont.bodySmallMedium)
                }
                .foregroundStyle(Color.civicaPaper)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(Color.civicaBrick)
                .clipShape(RoundedRectangle(cornerRadius: 3))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 24)
            .accessibilityLabel("Continue to Handshake")
            .accessibilityIdentifier("marketplace.handoff.apply_handshake")

            MTealTextLink(label: "Apply somewhere else") {
                dismiss()
            }
            .padding(.top, 14)
        }
        .padding(.top, 20)
        .padding(.bottom, 16)
    }
}

// MARK: - X Close Icon

private struct XCloseIcon: View {
    var body: some View {
        Canvas { ctx, size in
            let s = size
            var p = Path()
            p.move(to: CGPoint(x: s.width * 2/16, y: s.height * 2/16))
            p.addLine(to: CGPoint(x: s.width * 14/16, y: s.height * 14/16))
            p.move(to: CGPoint(x: s.width * 14/16, y: s.height * 2/16))
            p.addLine(to: CGPoint(x: s.width * 2/16, y: s.height * 14/16))
            ctx.stroke(p, with: .color(Color.civicaInk),
                       style: StrokeStyle(lineWidth: 2, lineCap: .round))
        }
        .frame(width: 16, height: 16)
    }
}

// MARK: - Step row

private struct StepRow: View {
    let number: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number).")
                .font(MFont.bodySmallMedium)
                .foregroundStyle(Color.civicaGraphite)
                .monospacedDigit()
                .frame(minWidth: 14, alignment: .leading)
            Text(text)
                .font(MFont.bodySmall)
                .foregroundStyle(Color.civicaInk)
                .lineSpacing(15 * 0.4)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 24)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number): \(text)")
    }
}

#if DEBUG
#Preview("Connected") {
    let previewLabel = SNAPMarketplaceStrings.tapToOpenSheet.value(in: .english)
    Text(previewLabel)
        .sheet(isPresented: .constant(true)) {
            SNAPApplyHandoffView(vm: SNAPMarketplaceViewModel())
        }
}

#Preview("Plaid disconnected") {
    let vm = SNAPMarketplaceViewModel()
    vm.dataSources.plaidConnected = false
    let previewLabel = SNAPMarketplaceStrings.tapToOpenSheet.value(in: .english)
    return Text(previewLabel)
        .sheet(isPresented: .constant(true)) {
            SNAPApplyHandoffView(
                vm: vm,
                onReconnectPlaid: { print("Reconnect Plaid tapped") }
            )
        }
}

#Preview("Canvas disconnected") {
    let vm = SNAPMarketplaceViewModel()
    vm.dataSources.canvas = .disconnected
    let previewLabel = SNAPMarketplaceStrings.tapToOpenSheet.value(in: .english)
    return Text(previewLabel)
        .sheet(isPresented: .constant(true)) {
            SNAPApplyHandoffView(
                vm: vm,
                onReconnectCanvas: { print("Reconnect Canvas tapped") }
            )
        }
}
#endif
