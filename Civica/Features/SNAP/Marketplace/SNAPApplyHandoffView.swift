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
                    Text("Apply")
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
        Text("Apply to Dining Services through Handshake")
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
        Text("Handshake is your campus's official jobs platform. Civica passes your verified income and class schedule so you don't re-enter them.")
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
            sharedRow(label: "Income verified by Plaid", detail: "(May 12)")
            sharedRow(label: "Class schedule from Canvas", detail: nil)
            sharedRow(label: "SNAP-eligible status confirmed", detail: nil)
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

    // MARK: Not-shared note

    private var notSharedNote: some View {
        Text("Handshake will see only what's needed for your application. Civica does not share your benefit amount.")
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
                    Text("Continue to ")
                        .font(MFont.bodySmallMedium)
                    + Text("Handshake")
                        .font(.custom("HankenGrotesk-SemiBold", size: 17))
                        .kerning(-0.3)
                    + Text(" \u{2192}")
                        .font(MFont.bodySmallMedium)
                }
                .foregroundStyle(Color.civicaPaper)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Color.civicaBrick)
                .clipShape(RoundedRectangle(cornerRadius: 3))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 24)
            .accessibilityLabel("Continue to Handshake")

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
#Preview {
    Text("Tap to open sheet")
        .sheet(isPresented: .constant(true)) {
            SNAPApplyHandoffView(vm: SNAPMarketplaceViewModel())
        }
}
#endif
