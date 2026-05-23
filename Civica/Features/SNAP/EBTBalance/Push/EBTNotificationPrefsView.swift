import CivicaDesignSystem
import SwiftUI

// User-facing notification preferences for the EBT Push surface.
// Reached from the EBT Balance dashboard ("Notification settings"
// row) per plan §4.4.
//
// Form rows:
//   - per-category toggles (deposit, low balance, perks, recert)
//   - quiet hours: two .hourAndMinute DatePickers (start, end)
//
// Every change writes through EBTNotificationPrefsStore which
// persists to UserDefaults and POSTs to the gateway. No "Save"
// button — toggles commit immediately, matching iOS Settings UX.

struct EBTNotificationPrefsView: View {
    @ObservedObject var store: EBTNotificationPrefsStore
    let language: CivicaLanguage

    var body: some View {
        Form {
            Section {
                toggleRow(
                    title: EBTPushStrings.depositToggle,
                    help: EBTPushStrings.depositToggleHelp,
                    isOn: $store.depositOn
                )
                toggleRow(
                    title: EBTPushStrings.lowBalanceToggle,
                    help: EBTPushStrings.lowBalanceToggleHelp,
                    isOn: $store.lowBalanceOn
                )
                toggleRow(
                    title: EBTPushStrings.perksToggle,
                    help: EBTPushStrings.perksToggleHelp,
                    isOn: $store.perksOn
                )
                toggleRow(
                    title: EBTPushStrings.recertToggle,
                    help: EBTPushStrings.recertToggleHelp,
                    isOn: $store.recertOn
                )
            }

            Section {
                Text(EBTPushStrings.quietHoursLabel.value(in: language))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                DatePicker(
                    EBTPushStrings.quietStartLabel.value(in: language),
                    selection: Binding(
                        get: { Self.date(fromMinutes: store.quietStartMinutes) },
                        set: { store.quietStartMinutes = Self.minutes(from: $0) }
                    ),
                    displayedComponents: .hourAndMinute
                )

                DatePicker(
                    EBTPushStrings.quietEndLabel.value(in: language),
                    selection: Binding(
                        get: { Self.date(fromMinutes: store.quietEndMinutes) },
                        set: { store.quietEndMinutes = Self.minutes(from: $0) }
                    ),
                    displayedComponents: .hourAndMinute
                )
            } header: {
                Text(EBTPushStrings.quietHoursSectionTitle.value(in: language))
            }
        }
        .navigationTitle(EBTPushStrings.prefsScreenTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func toggleRow(title: CivicaText, help: CivicaText, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title.value(in: language))
                Text(help.value(in: language))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Minutes-since-midnight ⇄ Date conversion

    /// Convert minutes-since-midnight to a Date today at that wall-clock
    /// time. DatePicker(.hourAndMinute) only consumes the hour+minute
    /// components so the day part is irrelevant.
    static func date(fromMinutes minutes: Int) -> Date {
        let hour = max(0, min(23, minutes / 60))
        let minute = max(0, min(59, minutes % 60))
        var comps = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        comps.hour = hour
        comps.minute = minute
        return Calendar.current.date(from: comps) ?? Date()
    }

    static func minutes(from date: Date) -> Int {
        let comps = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (comps.hour ?? 0) * 60 + (comps.minute ?? 0)
    }
}

#Preview {
    NavigationStack {
        EBTNotificationPrefsView(
            store: EBTNotificationPrefsStore(),
            language: .english
        )
    }
}
