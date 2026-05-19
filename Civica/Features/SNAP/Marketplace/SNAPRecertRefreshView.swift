import SwiftUI

/// Screen 06 — Recertification refresh.
///
/// 6-month touchpoint. Shows what Civica already has (pulled from record)
/// and the two small things the user needs to do. Links to the interview
/// prep flow via the existing RecertCompanion / PracticeSessionView.
struct SNAPRecertRefreshView: View {
    @ObservedObject var vm: SNAPMarketplaceViewModel
    var onSubmit: () -> Void
    var onSaveForLater: () -> Void
    var onInterviewPrep: () -> Void

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue
    private var language: CivicaLanguage { CivicaLanguage(rawValue: languageRaw) ?? .english }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                heroBlock
                MHairline()
                pulledSection
                MHairline()
                needsInputSection
                MHairline()
                interviewPrepSection
                actionsSection
                Spacer(minLength: 32)
            }
        }
        .background(Color.civicaPaper.ignoresSafeArea())
        .navigationTitle(SNAPMarketplaceStrings.recertNavTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Hero

    private var heroBlock: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(vm.recertByFormatted)
                .font(MFont.capsLabel)
                .foregroundStyle(Color.civicaGraphite)
                .kerning(1.5)
                .padding(.horizontal, 24)
                .padding(.bottom, 8)

            Text(SNAPMarketplaceStrings.packetReady.value(in: language))
                .font(MFont.heroHeadline)
                .foregroundStyle(Color.civicaInk)
                .padding(.horizontal, 24)
        }
        .padding(.top, 10)
        .padding(.bottom, 14)
    }

    // MARK: Pulled from record

    private var pulledSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            MCapsLabel(text: "Pulled from your record")
                .padding(.top, 14)
                .padding(.bottom, 4)

            ForEach(Array(vm.recertification.pulled.enumerated()), id: \.element.id) { idx, item in
                PulledRow(label: item.label, source: item.source)
                if idx < vm.recertification.pulled.count - 1 {
                    MHairline()
                }
            }
        }
    }

    // MARK: Needs your input

    private var needsInputSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            MCapsLabel(text: "Needs your input")
                .padding(.top, 14)
                .padding(.bottom, 4)

            ForEach(Array(vm.recertification.needsInput.enumerated()), id: \.element.id) { idx, item in
                InputRow(label: item.label, subLabel: item.subLabel)
                if idx < vm.recertification.needsInput.count - 1 {
                    MHairline()
                }
            }
        }
    }

    // MARK: Interview prep

    private var interviewPrepSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            MCapsLabel(text: "Interview prep")
                .padding(.top, 14)
                .padding(.bottom, 8)

            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(SNAPMarketplaceStrings.practiceInterview.value(in: language))
                        .font(MFont.bodySmallMedium)
                        .foregroundStyle(Color.civicaInk)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(SNAPMarketplaceStrings.interviewDuration.value(in: language))
                        .font(MFont.meta)
                        .foregroundStyle(Color.civicaGraphite)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Small brick "Start" button
                Button {
                    onInterviewPrep()
                } label: {
                    Text(SNAPMarketplaceStrings.startButton.value(in: language))
                        .font(MFont.regular(14).weight(.medium))
                        .foregroundStyle(Color.civicaPaper)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color.civicaBrick)
                        .clipShape(RoundedRectangle(cornerRadius: 3))
                        .fixedSize()
                }
                .buttonStyle(.plain)
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityLabel("Start interview prep")
            }
            .padding(16)
            .background(Color.civicaPaper2)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .padding(.horizontal, 24)
        }
    }

    // MARK: Actions

    private var actionsSection: some View {
        VStack(spacing: 0) {
            MBrickButton(label: "Submit refreshed packet") {
                onSubmit()
            }
            .accessibilityLabel("Submit refreshed packet")

            MTealTextLink(label: "Save and finish later") {
                onSaveForLater()
            }
            .padding(.top, 14)
        }
        .padding(.top, 16)
        .padding(.bottom, 10)
    }
}

// MARK: - Pulled row

private struct PulledRow: View {
    let label: String
    let source: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 12) {
                MCheckGlyph(size: 18, color: .civicaBrick)
                Text(label)
                    .font(MFont.bodySmallMedium)
                    .foregroundStyle(Color.civicaInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(source)
                .font(MFont.meta)
                .foregroundStyle(Color.civicaGraphite)
                .padding(.leading, 30)
                .padding(.top, 4)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label), \(source)")
    }
}

// MARK: - Input row

private struct InputRow: View {
    let label: String
    let subLabel: String?

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            // U+2731 HEAVY ASTERISK bullet
            Text("\u{2731}")
                .font(.custom("HankenGrotesk-SemiBold", size: 16))
                .foregroundStyle(Color.civicaBrick)
                .frame(width: 18)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 0) {
                if let sub = subLabel {
                    // "Upload latest utility bill (optional)"
                    Group {
                        Text(label + " ")
                            .font(MFont.bodySmallMedium)
                            .foregroundStyle(Color.civicaInk)
                        + Text(sub)
                            .font(MFont.bodySmall)
                            .foregroundStyle(Color.civicaGraphite)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text(label)
                        .font(MFont.bodySmallMedium)
                        .foregroundStyle(Color.civicaInk)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            MChevron()
        }
        .padding(.horizontal, 24)
        .frame(minHeight: 44)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label + (subLabel != nil ? " \(subLabel!)" : ""))
        .accessibilityHint("Tap to \(label.lowercased())")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Preview

#if DEBUG
#Preview {
    NavigationStack {
        SNAPRecertRefreshView(
            vm: SNAPMarketplaceViewModel(),
            onSubmit: {},
            onSaveForLater: {},
            onInterviewPrep: {}
        )
    }
}
#endif
