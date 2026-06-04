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
                        zh: "准备一份备用工资单(PDF 或照片)"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "save-county-number",
                    title: CivicaText(
                        "Save your county number to your phone",
                        es: "Guarda el número de tu condado en tu teléfono",
                        zh: "把你所在 county 的电话保存到手机里"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "look-up-timeline",
                    title: CivicaText(
                        "Look up your case's expected timeline",
                        es: "Consulta el plazo esperado para tu caso",
                        zh: "查一下你的案件预计要多久"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "set-day-30-reminder",
                    title: CivicaText(
                        "Set a reminder for day 30 to follow up",
                        es: "Pon un recordatorio para el día 30 para dar seguimiento",
                        zh: "设一个第 30 天的提醒,方便跟进"
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
                        zh: "打开收件箱,看一下这次的要求"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "gather-requested-docs",
                    title: CivicaText(
                        "Gather the documents the county asked for",
                        es: "Reúne los documentos que el condado pidió",
                        zh: "把 county 要的文件准备好"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "upload-via-portal",
                    title: CivicaText(
                        "Upload them through the state portal",
                        es: "Súbelos a través del portal estatal",
                        zh: "通过州政府网站上传这些文件"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "save-county-confirmation",
                    title: CivicaText(
                        "Save the county's confirmation for your records",
                        es: "Guarda la confirmación del condado para tu registro",
                        zh: "保存好 county 的确认回执,以备查阅"
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
                        zh: "在安静的地方测试一下手机的通话音质"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "gather-interview-docs",
                    title: CivicaText(
                        "Gather your documents within arm's reach",
                        es: "Ten tus documentos a la mano",
                        zh: "把要用的文件放在手边"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "charge-phone",
                    title: CivicaText(
                        "Charge your phone the night before",
                        es: "Carga tu teléfono la noche anterior",
                        zh: "前一天晚上把手机充满电"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "set-15-min-before-alarm",
                    title: CivicaText(
                        "Set an alarm 15 minutes before the call",
                        es: "Pon una alarma 15 minutos antes de la llamada",
                        zh: "在通话前 15 分钟设一个闹钟"
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
                        zh: "把案件号存到你能找得到的地方"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "set-day-30-reminder",
                    title: CivicaText(
                        "Set a reminder for day 30 to follow up",
                        es: "Pon un recordatorio para el día 30 para dar seguimiento",
                        zh: "设一个第 30 天的提醒,方便跟进"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "look-up-appeal-window",
                    title: CivicaText(
                        "Look up your appeal window — just in case",
                        es: "Consulta tu plazo de apelación — por si acaso",
                        zh: "查一下你的申诉期限 —— 以防万一"
                    )
                ),
                SNAPDailyChecklistItem(
                    slug: "save-county-number",
                    title: CivicaText(
                        "Save your county number to your phone",
                        es: "Guarda el número de tu condado en tu teléfono",
                        zh: "把你所在 county 的电话保存到手机里"
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
        case (.pickDocument, .english), (.pickDocument, .vietnamese), (.pickDocument, .tagalog):                 return "Attach a file"
        case (.pickDocument, .mandarin):                 return "添加文件"
        case (.pickDocument, .spanish):                 return "Adjuntar un archivo"
        case (.saveContact, .english), (.saveContact, .vietnamese), (.saveContact, .tagalog):                  return "Add to Contacts"
        case (.saveContact, .mandarin):                  return "添加到通讯录"
        case (.saveContact, .spanish):                  return "Añadir a Contactos"
        case (.openTimelineSheet, .english), (.openTimelineSheet, .vietnamese), (.openTimelineSheet, .tagalog):            return "Open the timeline"
        case (.openTimelineSheet, .mandarin):            return "查看时间线"
        case (.openTimelineSheet, .spanish):            return "Abrir el cronograma"
        case (.addCalendarReminderDaysOut, .english), (.addCalendarReminderDaysOut, .vietnamese), (.addCalendarReminderDaysOut, .tagalog):   return "Add to Calendar"
        case (.addCalendarReminderDaysOut, .mandarin):   return "添加到日历"
        case (.addCalendarReminderDaysOut, .spanish):   return "Añadir al Calendario"
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
                title: calendarEventTitle(language: language),
                daysOut: days,
                onComplete: onComplete
            )
            .ignoresSafeArea()
        }
    }

    private func calendarEventTitle(language: CivicaLanguage) -> String {
        switch language {
        case .spanish: return "Seguimiento del SNAP con el condado"
        case .mandarin: return "就 SNAP 申请跟进 county"
        case .english, .vietnamese, .tagalog: return "Follow up with the county on SNAP"
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
        case .english, .vietnamese, .tagalog:
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
        case .mandarin:
            return [
                .init(title: "已提交",
                      body: "你的申请已经送到 county 那边。大多数文件会在 1 个工作日内被收下。"),
                .init(title: "审核中",
                      body: "案件工作人员会核对你的文件,并记下缺少的内容。这一步通常要 7 到 14 天。"),
                .init(title: "面谈",
                      body: "county 会打电话进行一次 15 分钟的资格面谈,一般在提交后 2 周内。"),
                .init(title: "决定",
                      body: "按联邦规定,决定会在提交后 30 天内出来(加急/紧急案件是 7 天)。"),
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
        }
    }

    private var title: String {
        switch language {
        case .english, .vietnamese, .tagalog: return "What to expect from the county"
        case .mandarin: return "county 接下来会怎么做"
        case .spanish: return "Lo que puedes esperar del condado"
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
                    Button(doneLabel(for: language)) {
                        onClose()
                        dismiss()
                    }
                    .foregroundStyle(CivicaColors.pinePrimary)
                }
            }
        }
    }

    private func doneLabel(for language: CivicaLanguage) -> String {
        switch language {
        case .spanish: return "Listo"
        case .mandarin: return "完成"
        case .english, .vietnamese, .tagalog: return "Done"
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
        zh: "在 county 审核期间 —— 你今天可以做的事"
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
