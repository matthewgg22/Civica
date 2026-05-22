import CivicaDesignSystem
import SwiftUI

// Benefit Calendar — a month-at-a-glance view of all dates that
// matter to the user's SNAP case: deposits, interviews, and the
// recertification deadline.
//
// The calendar doesn't connect to any store directly; callers pass
// the relevant dates as optionals. This keeps the view composable
// from both the approved screen and the returning-user home.
//
// Event semantics:
//   deposit      → wheatPrimary  (money moment)
//   interview    → pinePrimary   (action required)
//   recertDue    → warningAmber  (deadline — miss it = lapse)

struct SNAPBenefitCalendarView: View {
    let depositDate: Date?
    let interviewDate: Date?
    let recertDueDate: Date?
    let language: CivicaLanguage

    @State private var displayedMonth: Date = Date()

    private var calendar: Calendar { .current }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                monthGrid
                upcomingSection
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(language == .spanish ? "Mi calendario" : "My Calendar")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Month grid

    private var monthGrid: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            monthNavHeader
            legendRow
            dayOfWeekHeader
            daysGrid
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var monthNavHeader: some View {
        HStack {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    displayedMonth = calendar.date(byAdding: .month, value: -1, to: displayedMonth) ?? displayedMonth
                }
            } label: {
                Image(systemName: "chevron.left")
                    .foregroundStyle(CivicaColors.graphite)
                    .padding(CivicaSpacing.sm)
            }
            Spacer()
            Text(monthYearString(displayedMonth))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
            Spacer()
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    displayedMonth = calendar.date(byAdding: .month, value: 1, to: displayedMonth) ?? displayedMonth
                }
            } label: {
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .padding(CivicaSpacing.sm)
            }
        }
    }

    private var legendRow: some View {
        HStack(spacing: CivicaSpacing.lg) {
            if depositDate != nil {
                legendItem(color: CivicaColors.wheatPrimary, label: language == .spanish ? "Depósito" : "Deposit")
            }
            if interviewDate != nil {
                legendItem(color: CivicaColors.pinePrimary, label: language == .spanish ? "Entrevista" : "Interview")
            }
            if recertDueDate != nil {
                legendItem(color: CivicaColors.warningAmber, label: language == .spanish ? "Recertificación" : "Recert due")
            }
        }
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(label)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
        }
    }

    private var dayOfWeekHeader: some View {
        let labels = language == .spanish
            ? ["D", "L", "M", "X", "J", "V", "S"]
            : ["S", "M", "T", "W", "T", "F", "S"]
        return HStack(spacing: 0) {
            ForEach(labels.indices, id: \.self) { i in
                Text(labels[i])
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var daysGrid: some View {
        let days = calendarDays(for: displayedMonth)
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
            ForEach(days.indices, id: \.self) { i in
                let entry = days[i]
                CalendarDayCell(
                    entry: entry,
                    depositDate: depositDate,
                    interviewDate: interviewDate,
                    recertDueDate: recertDueDate
                )
            }
        }
    }

    // MARK: - Upcoming events

    @ViewBuilder
    private var upcomingSection: some View {
        let events = upcomingEvents
        if !events.isEmpty {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text(language == .spanish ? "Próximos eventos" : "Upcoming")
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                    .padding(.horizontal, CivicaSpacing.xs)

                VStack(spacing: 0) {
                    ForEach(events.indices, id: \.self) { i in
                        eventRow(events[i])
                        if i < events.count - 1 {
                            Divider().overlay(CivicaColors.hairline)
                        }
                    }
                }
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
            }
        }
    }

    private func eventRow(_ event: BenefitEvent) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            dateBadge(date: event.date, color: event.color)
            VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(event.detail)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
            Spacer(minLength: CivicaSpacing.sm)
            Text(event.badge)
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(event.color)
                .padding(.horizontal, CivicaSpacing.sm)
                .padding(.vertical, 3)
                .background(event.color.opacity(0.10))
                .clipShape(Capsule())
        }
        .padding(CivicaSpacing.lg)
        .accessibilityElement(children: .combine)
    }

    private func dateBadge(date: Date, color: Color) -> some View {
        VStack(spacing: 1) {
            Text("\(calendar.component(.day, from: date))")
                .font(CivicaTypography.cardTitle)
                .foregroundStyle(color)
                .lineLimit(1)
            Text(monthAbbrev(date))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(color.opacity(0.75))
                .textCase(.uppercase)
        }
        .frame(width: 38)
        .padding(.vertical, CivicaSpacing.xs)
        .background(color.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
    }

    // MARK: - Data helpers

    struct BenefitEvent {
        let date: Date
        let title: String
        let detail: String
        let badge: String
        let color: Color
    }

    private var upcomingEvents: [BenefitEvent] {
        let today = calendar.startOfDay(for: Date())
        var events: [BenefitEvent] = []

        if let d = depositDate, calendar.startOfDay(for: d) >= today {
            let days = daysUntil(d)
            events.append(BenefitEvent(
                date: d,
                title: language == .spanish ? "Depósito CalFresh" : "SNAP Deposit",
                detail: language == .spanish ? "\(days) días" : "\(days) day\(days == 1 ? "" : "s") away",
                badge: language == .spanish ? "Depósito" : "Deposit",
                color: CivicaColors.wheatPrimary
            ))
        }
        if let d = interviewDate, calendar.startOfDay(for: d) >= today {
            let days = daysUntil(d)
            events.append(BenefitEvent(
                date: d,
                title: language == .spanish ? "Entrevista telefónica" : "Phone Interview",
                detail: language == .spanish ? "DTA · en \(days) días" : "DTA · in \(days) day\(days == 1 ? "" : "s")",
                badge: language == .spanish ? "Entrevista" : "Interview",
                color: CivicaColors.pinePrimary
            ))
        }
        if let d = recertDueDate, calendar.startOfDay(for: d) >= today {
            let days = daysUntil(d)
            events.append(BenefitEvent(
                date: d,
                title: language == .spanish ? "Fecha límite de recertificación" : "Recert Deadline",
                detail: language == .spanish
                    ? "Los beneficios terminan si no se renueva · en \(days) días"
                    : "Benefits lapse if not done · in \(days) days",
                badge: language == .spanish ? "Acción" : "Action",
                color: CivicaColors.warningAmber
            ))
        }

        return events.sorted { $0.date < $1.date }
    }

    struct CalendarDay: Identifiable {
        let id: Int
        let day: Int?          // nil = blank padding cell
        let date: Date?
        let isToday: Bool
        let isPast: Bool
    }

    private func calendarDays(for month: Date) -> [CalendarDay] {
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: month))!
        let weekdayOfFirst = (calendar.component(.weekday, from: startOfMonth) - 1 + 7) % 7
        let daysInMonth = calendar.range(of: .day, in: .month, for: startOfMonth)!.count
        let today = calendar.startOfDay(for: Date())

        var cells: [CalendarDay] = []
        for i in 0..<weekdayOfFirst {
            cells.append(CalendarDay(id: -i - 1, day: nil, date: nil, isToday: false, isPast: false))
        }
        for d in 1...daysInMonth {
            let date = calendar.date(byAdding: .day, value: d - 1, to: startOfMonth)!
            let startOfDay = calendar.startOfDay(for: date)
            cells.append(CalendarDay(
                id: d,
                day: d,
                date: date,
                isToday: startOfDay == today,
                isPast: startOfDay < today
            ))
        }
        return cells
    }

    private func daysUntil(_ date: Date) -> Int {
        let start = calendar.startOfDay(for: Date())
        let end = calendar.startOfDay(for: date)
        return max(calendar.dateComponents([.day], from: start, to: end).day ?? 0, 0)
    }

    private func monthYearString(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: language == .spanish ? "es" : "en")
        f.setLocalizedDateFormatFromTemplate("MMMMy")
        return f.string(from: date)
    }

    private func monthAbbrev(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: language == .spanish ? "es" : "en")
        f.setLocalizedDateFormatFromTemplate("MMM")
        return f.string(from: date)
    }
}

// MARK: - Day cell

private struct CalendarDayCell: View {
    let entry: SNAPBenefitCalendarView.CalendarDay
    let depositDate: Date?
    let interviewDate: Date?
    let recertDueDate: Date?

    private var calendar: Calendar { .current }

    private var eventColor: Color? {
        guard let date = entry.date else { return nil }
        let day = calendar.startOfDay(for: date)
        if let d = depositDate, calendar.startOfDay(for: d) == day { return CivicaColors.wheatPrimary }
        if let d = interviewDate, calendar.startOfDay(for: d) == day { return CivicaColors.pinePrimary }
        if let d = recertDueDate, calendar.startOfDay(for: d) == day { return CivicaColors.warningAmber }
        return nil
    }

    var body: some View {
        ZStack {
            if let color = eventColor {
                RoundedRectangle(cornerRadius: 7)
                    .fill(color.opacity(0.12))
            } else if entry.isToday {
                RoundedRectangle(cornerRadius: 7)
                    .fill(CivicaColors.pinePrimary)
            }

            if let day = entry.day {
                VStack(spacing: 2) {
                    Text("\(day)")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(
                            entry.isToday ? Color.white :
                            eventColor != nil ? eventColor! :
                            entry.isPast ? CivicaColors.muted : CivicaColors.ink
                        )
                    if let color = eventColor {
                        Circle().fill(color).frame(width: 4, height: 4)
                    } else {
                        Color.clear.frame(width: 4, height: 4)
                    }
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(entry.day == nil)
        .accessibilityLabel(entry.date.map { formattedDate($0) } ?? "")
    }

    private func formattedDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        return f.string(from: date)
    }
}

#if DEBUG
struct SNAPBenefitCalendarView_Previews: PreviewProvider {
    static var previews: some View {
        let cal = Calendar.current
        NavigationStack {
            SNAPBenefitCalendarView(
                depositDate: cal.date(byAdding: .day, value: 12, to: Date()),
                interviewDate: cal.date(byAdding: .day, value: 5, to: Date()),
                recertDueDate: cal.date(byAdding: .month, value: 11, to: Date()),
                language: .english
            )
        }
    }
}
#endif
