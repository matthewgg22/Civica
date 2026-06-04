import CivicaDesignSystem
import Contacts
import ContactsUI
import EventKit
import EventKitUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// PLACEHOLDER CONTENT — UD-2 SME review pending.
// Real content authored by CBO advisor (Project Bread / Dave Guarino
// reference). See docs/runbooks/recert-companion-rollout.md (or
// wherever the SME review lands).
//
// JR-1 of the iOS product audit (2026-05-29). Adds a status-aware
// "things you can do today" card to the Phase 2 (Pending) home — 3-5
// items the user can act on while the county reviews. Per the audit's
// guard rail, copy is reassuring rather than urgency-framed
// ("things you can do today", never "things you must do") and the list
// stays at most 5 items per status.
//
// Persistence: each item's checked state is stored under
// `\(CivicaAppStorageKeys.dailyChecklistPrefix).<status-raw>.<item-slug>`.
// Keys are scoped to the status sub-state, so a status transition
// renders a fresh set of items without erasing the previously-checked
// state for the prior status — return-trips to that status restore it.

// MARK: - Item

/// One row in the daily checklist. `slug` is the stable identifier used
/// to form the `@AppStorage` key (kebab-case, no spaces) and must not
/// change once shipped — renaming a slug orphans existing user state.
struct SNAPDailyChecklistItem: Identifiable, Equatable, Sendable {
    let slug: String
    let title: CivicaText

    var id: String { slug }
}

/// What an item lets the applicant *do*, beyond just ticking it off.
/// Each case opens a native iOS sheet so the action feels real and the
/// applicant isn't asked to context-switch to a different app.
///
/// Slugs are mapped to actions in `SNAPDailyChecklist.action(for:)`.
/// Items without an action just behave as a tap-to-check row.
enum SNAPDailyChecklistAction: Equatable, Sendable {
    /// Open the system document picker to attach a file / photo from
    /// Files. The selection itself is discarded today — the affordance
    /// matters more than the persistence for this demo surface.
    case pickDocument
    /// Open the contacts editor pre-filled with the county's name +
    /// phone number so the applicant taps Save and it lands in their
    /// address book. No Contacts permission required — the editor is
    /// a sandboxed UI from Apple.
    case saveContact(name: String, phone: String)
    /// Present the existing "How to prepare for what's next" sheet so
    /// the applicant can read through the timeline detail in place.
    case openTimelineSheet
    /// Open the system calendar event editor pre-filled with a Civica
    /// follow-up reminder N days out. Apple's editor handles the
    /// permission prompt and lets the user adjust the date.
    case addCalendarReminderDaysOut(Int)
}

// MARK: - Item catalog

enum SNAPDailyChecklist {

    /// Status-aware item set. Statuses outside the supported sub-states
    /// return an empty list — the card is gated on a non-empty set by
    /// `CivicaHomePhase2View`, so an unsupported status simply hides it.
    ///
    /// Per the audit guard rail, every status returns ≤ 5 items.
    static func items(for status: SNAPApplicationStatus) -> [SNAPDailyChecklistItem] {
        switch status {
        case .submittedToState:
            return [
                SNAPDailyChecklistItem(
                    slug: "gather-backup-paystub",
                    title: CivicaText(
                        "Gather a backup pay stub (PDF or photo)",
                        es: "Reúne un comprobante de pago de respaldo (PDF o foto)",
                        vi: "Chuẩn bị một bảng lương dự phòng (PDF hoặc ảnh)"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "save-county-number",
                    title: CivicaText(
                        "Save your county number to your phone",
                        es: "Guarda el número de tu condado en tu teléfono",
                        vi: "Lưu số điện thoại của county vào điện thoại của bạn"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "look-up-timeline",
                    title: CivicaText(
                        "Look up your case's expected timeline",
                        es: "Consulta el plazo esperado para tu caso",
                        vi: "Tra cứu thời gian dự kiến cho hồ sơ của bạn"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "set-day-30-reminder",
                    title: CivicaText(
                        "Set a reminder for day 30 to follow up",
                        es: "Pon un recordatorio para el día 30 para dar seguimiento",
                        vi: "Đặt lời nhắc vào ngày 30 để theo dõi"
                    )
                ),
            ]
        case .documentsRequested:
            return [
                SNAPDailyChecklistItem(
                    slug: "open-inbox",
                    title: CivicaText(
                        "Open your inbox and read the request",
                        es: "Abre tu bandeja y lee la solicitud",
                        vi: "Mở hộp thư của bạn và đọc yêu cầu"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "gather-requested-docs",
                    title: CivicaText(
                        "Gather the documents the county asked for",
                        es: "Reúne los documentos que el condado pidió",
                        vi: "Chuẩn bị các giấy tờ mà county đã yêu cầu"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "upload-via-portal",
                    title: CivicaText(
                        "Upload them through the state portal",
                        es: "Súbelos a través del portal estatal",
                        vi: "Tải chúng lên qua cổng thông tin của tiểu bang"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "save-county-confirmation",
                    title: CivicaText(
                        "Save the county's confirmation for your records",
                        es: "Guarda la confirmación del condado para tu registro",
                        vi: "Lưu lại xác nhận của county để làm hồ sơ của bạn"
                    )
                ),
            ]
        case .interviewScheduled:
            return [
                SNAPDailyChecklistItem(
                    slug: "test-phone-audio",
                    title: CivicaText(
                        "Test your phone's audio in a quiet spot",
                        es: "Prueba el audio de tu teléfono en un lugar tranquilo",
                        vi: "Kiểm tra âm thanh điện thoại của bạn ở nơi yên tĩnh"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "gather-interview-docs",
                    title: CivicaText(
                        "Gather your documents within arm's reach",
                        es: "Ten tus documentos a la mano",
                        vi: "Để các giấy tờ của bạn trong tầm tay"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "charge-phone",
                    title: CivicaText(
                        "Charge your phone the night before",
                        es: "Carga tu teléfono la noche anterior",
                        vi: "Sạc điện thoại của bạn vào tối hôm trước"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "set-15-min-before-alarm",
                    title: CivicaText(
                        "Set an alarm 15 minutes before the call",
                        es: "Pon una alarma 15 minutos antes de la llamada",
                        vi: "Đặt báo thức 15 phút trước cuộc gọi"
                    )
                ),
            ]
        case .interviewCompleted:
            return [
                SNAPDailyChecklistItem(
                    slug: "save-case-number",
                    title: CivicaText(
                        "Save your case number somewhere you'll find it",
                        es: "Guarda tu número de caso donde lo puedas encontrar",
                        vi: "Lưu số hồ sơ của bạn ở nơi bạn sẽ tìm thấy nó"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "set-day-30-reminder",
                    title: CivicaText(
                        "Set a reminder for day 30 to follow up",
                        es: "Pon un recordatorio para el día 30 para dar seguimiento",
                        vi: "Đặt lời nhắc vào ngày 30 để theo dõi"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "look-up-appeal-window",
                    title: CivicaText(
                        "Look up your appeal window — just in case",
                        es: "Consulta tu plazo de apelación — por si acaso",
                        vi: "Tra cứu thời hạn kháng cáo của bạn — để phòng khi cần"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "save-county-number",
                    title: CivicaText(
                        "Save your county number to your phone",
                        es: "Guarda el número de tu condado en tu teléfono",
                        vi: "Lưu số điện thoại của county vào điện thoại của bạn"
                    )
                ),
            ]
        default:
            return []
        }
    }

    /// Full `@AppStorage` key for one item under one status — exposed so
    /// tests and the SwiftUI view share the same key formation.
    static func storageKey(status: SNAPApplicationStatus, slug: String) -> String {
        "\(CivicaAppStorageKeys.dailyChecklistPrefix).\(status.rawValue).\(slug)"
    }

    /// Maps a slug to the native iOS action that backs it. Slugs without
    /// an action are pure tap-to-check rows. Phone numbers / county
    /// names below are placeholders until SNAPAgencyDirectory wires in
    /// per-county data — the editor lets the user edit before saving.
    static func action(for slug: String) -> SNAPDailyChecklistAction? {
        switch slug {
        case "gather-backup-paystub",
             "gather-requested-docs",
             "gather-interview-docs",
             "save-county-confirmation":
            return .pickDocument
        case "save-county-number":
            // California-default placeholder; the user can edit name +
            // number in the contact editor before tapping Save.
            return .saveContact(name: "County SNAP office", phone: "+18772850808")
        case "look-up-timeline":
            return .openTimelineSheet
        case "set-day-30-reminder":
            return .addCalendarReminderDaysOut(30)
        default:
            return nil
        }
    }
}

// MARK: - Card

struct SNAPDailyChecklistCard: View {
    let status: SNAPApplicationStatus
    let language: CivicaLanguage

    private var items: [SNAPDailyChecklistItem] {
        SNAPDailyChecklist.items(for: status)
    }

    var body: some View {
        if items.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                Text(SNAPDailyChecklistStrings.cardTitle.value(in: language))
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
                    .accessibilityAddTraits(.isHeader)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                    ForEach(items) { item in
                        SNAPDailyChecklistRow(
                            status: status,
                            item: item,
                            language: language
                        )
                    }
                }
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .fill(CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .stroke(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }
}

// MARK: - Row

private struct SNAPDailyChecklistRow: View {
    let status: SNAPApplicationStatus
    let item: SNAPDailyChecklistItem
    let language: CivicaLanguage

    @AppStorage private var checked: Bool
    @State private var presentingAction: SNAPDailyChecklistAction?

    init(status: SNAPApplicationStatus, item: SNAPDailyChecklistItem, language: CivicaLanguage) {
        self.status = status
        self.item = item
        self.language = language
        let key = SNAPDailyChecklist.storageKey(status: status, slug: item.slug)
        self._checked = AppStorage(wrappedValue: false, key)
    }

    private var action: SNAPDailyChecklistAction? {
        SNAPDailyChecklist.action(for: item.slug)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Button {
                checked.toggle()
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.md) {
                    Image(systemName: checked ? "checkmark.circle.fill" : "circle")
                        // Title-class sizing — body-class circles read
                        // anemic next to multi-line item text and made
                        // the column hard to scan. Title3 puts the
                        // glyph at ~26pt visual width.
                        .font(.title3)
                        .foregroundStyle(checked ? CivicaColors.pinePrimary : CivicaColors.graphite.opacity(0.6))
                        .frame(width: 28, alignment: .leading)
                        .accessibilityHidden(true)
                    Text(item.title.value(in: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(checked ? CivicaColors.graphite.opacity(0.7) : CivicaColors.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(item.title.value(in: language))
            .accessibilityAddTraits(checked ? [.isButton, .isSelected] : .isButton)

            // Real-action CTA, indented under the checkbox column.
            // Tapping fires the native iOS sheet for the item's slug.
            if let action {
                Button {
                    presentingAction = action
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: actionIcon(for: action))
                            .imageScale(.small)
                            .accessibilityHidden(true)
                        Text(actionCTA(for: action, language: language))
                            .font(CivicaTypography.footnoteStrong)
                    }
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .padding(.leading, 28 + CivicaSpacing.md)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(actionCTA(for: action, language: language))
            }
        }
        .sheet(item: $presentingAction) { action in
            SNAPDailyChecklistActionPresenter(action: action, language: language) {
                presentingAction = nil
                if !checked { checked = true }
            }
        }
    }

    private func actionIcon(for action: SNAPDailyChecklistAction) -> String {
        switch action {
        case .pickDocument:                 return "doc.fill.badge.plus"
        case .saveContact:                  return "person.crop.circle.badge.plus"
        case .openTimelineSheet:            return "calendar.badge.clock"
        case .addCalendarReminderDaysOut:   return "bell.badge"
        }
    }

    private func actionCTA(for action: SNAPDailyChecklistAction, language: CivicaLanguage) -> String {
        switch (action, language) {
        case (.pickDocument, .english), (.pickDocument, .mandarin), (.pickDocument, .tagalog):                 return "Attach a file"
        case (.pickDocument, .spanish):                 return "Adjuntar un archivo"
        case (.pickDocument, .vietnamese):              return "Đính kèm một tệp"
        case (.saveContact, .english), (.saveContact, .mandarin), (.saveContact, .tagalog):                  return "Add to Contacts"
        case (.saveContact, .spanish):                  return "Añadir a Contactos"
        case (.saveContact, .vietnamese):               return "Thêm vào Danh bạ"
        case (.openTimelineSheet, .english), (.openTimelineSheet, .mandarin), (.openTimelineSheet, .tagalog):            return "Open the timeline"
        case (.openTimelineSheet, .spanish):            return "Abrir el cronograma"
        case (.openTimelineSheet, .vietnamese):         return "Mở dòng thời gian"
        case (.addCalendarReminderDaysOut, .english), (.addCalendarReminderDaysOut, .mandarin), (.addCalendarReminderDaysOut, .tagalog):   return "Add to Calendar"
        case (.addCalendarReminderDaysOut, .spanish):   return "Añadir al Calendario"
        case (.addCalendarReminderDaysOut, .vietnamese): return "Thêm vào Lịch"
        }
    }
}

extension SNAPDailyChecklistAction: Identifiable {
    var id: String {
        switch self {
        case .pickDocument:                 return "pickDocument"
        case .saveContact(let n, let p):    return "saveContact:\(n):\(p)"
        case .openTimelineSheet:            return "openTimelineSheet"
        case .addCalendarReminderDaysOut(let d): return "addCalendarReminderDaysOut:\(d)"
        }
    }
}

// MARK: - Action presenter

/// Sheet dispatcher — picks the right UIViewControllerRepresentable
/// wrapper for the action and dismisses on completion.
private struct SNAPDailyChecklistActionPresenter: View {
    let action: SNAPDailyChecklistAction
    let language: CivicaLanguage
    let onComplete: () -> Void

    var body: some View {
        switch action {
        case .pickDocument:
            DocumentPickerRepresentable(onComplete: onComplete)
                .ignoresSafeArea()
        case .saveContact(let name, let phone):
            ContactEditorRepresentable(prefilledName: name, prefilledPhone: phone, onComplete: onComplete)
                .ignoresSafeArea()
        case .openTimelineSheet:
            // Lightweight inline timeline sheet — the rich
            // SNAPWhatHappensNextSheet depends on `statusStore` +
            // `onMessageNavigator`, which the checklist row doesn't
            // have. The summary is the same vocabulary the timeline
            // header on Phase 2 uses, so it lands consistently.
            SNAPDailyChecklistTimelineSheet(language: language, onClose: onComplete)
        case .addCalendarReminderDaysOut(let days):
            CalendarEventRepresentable(
                title: language == .spanish
                    ? "Seguimiento del SNAP con el condado"
                    : language == .vietnamese
                        ? "Theo dõi SNAP với county"
                        : "Follow up with the county on SNAP",
                daysOut: days,
                onComplete: onComplete
            )
            .ignoresSafeArea()
        }
    }
}

// MARK: - Inline timeline sheet

/// Read-only summary of the four county-side milestones. Independent
/// of the full Phase 2 timeline sheet so the daily checklist row can
/// present it without needing a status store or navigator-message
/// callback.
private struct SNAPDailyChecklistTimelineSheet: View {
    let language: CivicaLanguage
    let onClose: () -> Void

    @Environment(\.dismiss) private var dismiss

    private struct Step {
        let title: String
        let body: String
    }

    private var steps: [Step] {
        switch language {
        case .english, .mandarin, .tagalog:
            return [
                .init(title: "Submitted",
                      body: "Your application is with the county. Most files are picked up within 1 business day."),
                .init(title: "In review",
                      body: "A caseworker checks your documents and notes anything missing. This usually takes 7 to 14 days."),
                .init(title: "Interview",
                      body: "The county calls for a 15-minute eligibility interview, usually within 2 weeks of submission."),
                .init(title: "Decision",
                      body: "By federal rule a decision lands within 30 days of submission (7 days for expedited / emergency cases)."),
            ]
        case .spanish:
            return [
                .init(title: "Enviado",
                      body: "Tu solicitud está con el condado. La mayoría de los archivos se reciben en 1 día hábil."),
                .init(title: "En revisión",
                      body: "Un trabajador del caso revisa tus documentos y anota lo que falta. Suele tomar de 7 a 14 días."),
                .init(title: "Entrevista",
                      body: "El condado llama para una entrevista de elegibilidad de 15 minutos, usualmente dentro de 2 semanas tras enviar."),
                .init(title: "Decisión",
                      body: "Por regla federal, la decisión llega en 30 días tras enviar (7 días en casos urgentes)."),
            ]
        case .vietnamese:
            return [
                .init(title: "Đã nộp",
                      body: "Đơn của bạn đã được gửi đến county. Hầu hết các tệp được tiếp nhận trong vòng 1 ngày làm việc."),
                .init(title: "Đang xem xét",
                      body: "Một nhân viên phụ trách hồ sơ kiểm tra giấy tờ của bạn và ghi chú những gì còn thiếu. Việc này thường mất 7 đến 14 ngày."),
                .init(title: "Phỏng vấn",
                      body: "County gọi điện để phỏng vấn xét điều kiện trong 15 phút, thường trong vòng 2 tuần kể từ khi nộp."),
                .init(title: "Quyết định",
                      body: "Theo quy định liên bang, quyết định sẽ có trong vòng 30 ngày kể từ khi nộp (7 ngày đối với các trường hợp khẩn cấp / cần xử lý nhanh)."),
            ]
        }
    }

    private var title: String {
        switch language {
        case .english, .mandarin, .tagalog: return "What to expect from the county"
        case .spanish: return "Lo que puedes esperar del condado"
        case .vietnamese: return "Những gì bạn có thể mong đợi từ county"
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    ForEach(Array(steps.enumerated()), id: \.offset) { _, step in
                        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                            Text(step.title)
                                .font(CivicaTypography.sectionHeader)
                                .foregroundStyle(CivicaColors.ink)
                            Text(step.body)
                                .font(CivicaTypography.body)
                                .foregroundStyle(CivicaColors.graphite)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(CivicaSpacing.xl)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(language == .spanish ? "Listo" : language == .vietnamese ? "Xong" : "Done") {
                        onClose()
                        dismiss()
                    }
                    .foregroundStyle(CivicaColors.pinePrimary)
                }
            }
        }
    }
}

// MARK: - UIViewControllerRepresentable bridges

/// System Files picker. Accepts any item type — we don't persist the
/// selection; the affordance + system UI is the whole point.
private struct DocumentPickerRepresentable: UIViewControllerRepresentable {
    let onComplete: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onComplete: onComplete) }

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let types: [UTType] = [.pdf, .image, .text, .item]
        let vc = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        vc.allowsMultipleSelection = false
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onComplete: () -> Void
        init(onComplete: @escaping () -> Void) { self.onComplete = onComplete }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            onComplete()
        }
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            onComplete()
        }
    }
}

/// Contacts editor for a brand-new contact. No Contacts permission
/// required because CNContactViewController.forNewContact ships its
/// own sandboxed UI that the user explicitly saves.
private struct ContactEditorRepresentable: UIViewControllerRepresentable {
    let prefilledName: String
    let prefilledPhone: String
    let onComplete: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onComplete: onComplete) }

    func makeUIViewController(context: Context) -> UINavigationController {
        let contact = CNMutableContact()
        contact.organizationName = prefilledName
        contact.phoneNumbers = [
            CNLabeledValue(label: CNLabelPhoneNumberMain, value: CNPhoneNumber(stringValue: prefilledPhone))
        ]
        let editor = CNContactViewController(forNewContact: contact)
        editor.delegate = context.coordinator
        editor.allowsActions = false
        return UINavigationController(rootViewController: editor)
    }

    func updateUIViewController(_ uiViewController: UINavigationController, context: Context) {}

    final class Coordinator: NSObject, CNContactViewControllerDelegate {
        let onComplete: () -> Void
        init(onComplete: @escaping () -> Void) { self.onComplete = onComplete }

        func contactViewController(_ viewController: CNContactViewController, didCompleteWith contact: CNContact?) {
            onComplete()
        }
    }
}

/// Calendar event editor pre-filled with a Civica follow-up event N
/// days out. EKEventEditViewController handles the WriteOnlyAccess
/// permission prompt internally.
private struct CalendarEventRepresentable: UIViewControllerRepresentable {
    let title: String
    let daysOut: Int
    let onComplete: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onComplete: onComplete) }

    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let store = EKEventStore()
        let editor = EKEventEditViewController()
        editor.eventStore = store

        let event = EKEvent(eventStore: store)
        event.title = title
        event.notes = "Reminder set from Civica to check on your SNAP application."
        let startDate = Calendar.current.date(byAdding: .day, value: daysOut, to: Date()) ?? Date()
        event.startDate = startDate
        event.endDate = startDate.addingTimeInterval(30 * 60)
        event.isAllDay = false
        editor.event = event
        editor.editViewDelegate = context.coordinator
        return editor
    }

    func updateUIViewController(_ uiViewController: EKEventEditViewController, context: Context) {}

    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let onComplete: () -> Void
        init(onComplete: @escaping () -> Void) { self.onComplete = onComplete }

        func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
            onComplete()
        }
    }
}

// MARK: - Strings

enum SNAPDailyChecklistStrings {
    static let cardTitle = CivicaText(
        "While the county reviews — things you can do today",
        es: "Mientras el condado revisa — cosas que puedes hacer hoy",
        vi: "Trong khi county xem xét — những việc bạn có thể làm hôm nay"
    )
}

#if DEBUG
struct SNAPDailyChecklistCard_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: CivicaSpacing.lg) {
                SNAPDailyChecklistCard(status: .submittedToState, language: .english)
                SNAPDailyChecklistCard(status: .documentsRequested, language: .english)
                SNAPDailyChecklistCard(status: .interviewScheduled, language: .spanish)
            }
            .padding()
        }
        .background(CivicaColors.paper)
    }
}
#endif
