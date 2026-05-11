import CivicaDesignSystem
import SwiftUI

struct FindHelpFilterBar: View {
    @Binding var filter: FindHelpFilterState
    var onChange: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Picker("Show", selection: serviceTypeBinding) {
                Text("find_help.filter.all").tag(FindHelpServiceType?.none)
                Text("find_help.filter.snap").tag(FindHelpServiceType?.some(.snapApplicationHelp))
                Text("find_help.filter.food").tag(FindHelpServiceType?.some(.foodAssistance))
                Text("find_help.filter.both").tag(FindHelpServiceType?.some(.both))
            }
            .pickerStyle(.segmented)

            languagePicker
        }
    }

    private var serviceTypeBinding: Binding<FindHelpServiceType?> {
        Binding(
            get: { filter.serviceType },
            set: { newValue in
                filter.serviceType = newValue
                onChange()
            }
        )
    }

    @ViewBuilder
    private var languagePicker: some View {
        let options: [(label: String, code: String?)] = [
            (NSLocalizedString("find_help.filter.language.any", comment: "Any language menu option"), nil),
            ("English", "en"),
            ("Español", "es"),
            ("中文", "zh-Hans"),
            ("Português", "pt"),
            ("Kreyòl ayisyen", "ht"),
            ("Tiếng Việt", "vi")
        ]
        Menu {
            ForEach(options, id: \.label) { option in
                Button(option.label) {
                    filter.languageCode = option.code
                    onChange()
                }
            }
        } label: {
            HStack(spacing: CivicaSpacing.xs) {
                Image(systemName: "globe")
                Text(currentLanguageLabel(from: options))
                    .font(CivicaTypography.footnoteStrong)
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(CivicaColors.brickPrimary)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.xs)
            .background(
                Capsule().stroke(CivicaColors.brickPrimary.opacity(0.4), lineWidth: 1)
            )
        }
    }

    private func currentLanguageLabel(from options: [(label: String, code: String?)]) -> String {
        guard let code = filter.languageCode else {
            return NSLocalizedString("find_help.filter.language.any", comment: "Any language menu option")
        }
        return options.first(where: { $0.code == code })?.label ?? code
    }
}
