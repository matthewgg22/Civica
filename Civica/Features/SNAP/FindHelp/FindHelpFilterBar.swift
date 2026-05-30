import CivicaDesignSystem
import SwiftUI

struct FindHelpFilterBar: View {
    @Binding var filter: FindHelpFilterState
    /// Active map layer. When `.spend` is selected the service-type
    /// chips don't apply (retailers don't carry service-type tags)
    /// so the row is hidden; the language picker stays.
    let layerSelection: FindHelpLayerSelection
    var onChange: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            if layerSelection != .spend {
                // Three segments fit the iPhone width without truncating
                // "Apply for SNAP". The fourth "Both" / "Combined"
                // category overlapped semantically with the layer toggle
                // and was dropped from the chip row in this pass; users
                // who want SNAP+Food locations can read the chip strip
                // on each row's detail sheet.
                Picker("Show", selection: serviceTypeBinding) {
                    Text("find_help.filter.all").tag(FindHelpServiceType?.none)
                    Text("find_help.filter.snap").tag(FindHelpServiceType?.some(.snapApplicationHelp))
                    Text("find_help.filter.food").tag(FindHelpServiceType?.some(.foodAssistance))
                }
                .pickerStyle(.segmented)
            }

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
                    .accessibilityHidden(true)
                Text(currentLanguageLabel(from: options))
                    .font(CivicaTypography.footnoteStrong)
                Image(systemName: "chevron.down")
                    .imageScale(.large)
                    .font(.body)
                    .accessibilityHidden(true)
            }
            .foregroundStyle(CivicaColors.pinePrimary)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.xs)
            .background(
                Capsule().stroke(CivicaColors.pinePrimary.opacity(0.4), lineWidth: 1)
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
