import CivicaDesignSystem
import PhotosUI
import SwiftUI

/// Bottom sheet for logging a single work session.
///
/// Captures: date, hours, activity type, employer name (optional),
/// notes (optional), and an optional pay-stub/employer-letter attachment
/// (reuses the existing document upload pipeline via `uploadDocument`).
///
/// On save: POSTs to /me/work-requirements/:packetId/hours.
/// If a document was picked, it is uploaded first and the returned
/// document_id is included in the work-hours entry.
struct AddWorkSessionSheet: View {

    let packetId: String
    let apiClient: (any EnrollmentAPIClient)?
    let onSaved: (LogWorkHoursResponse) -> Void

    init(
        packetId: String = "",
        apiClient: (any EnrollmentAPIClient)? = nil,
        onSaved: @escaping (LogWorkHoursResponse) -> Void = { _ in }
    ) {
        self.packetId = packetId
        self.apiClient = apiClient
        self.onSaved = onSaved
    }

    @Environment(\.dismiss) private var dismiss

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    @State private var workDate = Date()
    @State private var hoursText = ""
    @State private var activityType: WorkActivityType = .work
    @State private var employerName = ""
    @State private var notes = ""

    // Photo picker state
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var pickedImageData: Data?
    @State private var uploadedDocumentId: String?

    @State private var isSaving = false
    @State private var saveError: String?

    private var hoursValue: Double? {
        Double(hoursText.trimmingCharacters(in: .whitespaces))
    }

    private var canSave: Bool {
        guard let h = hoursValue else { return false }
        return h > 0 && h <= 24 && !isSaving
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    datePicker
                    hoursField
                    activityTypePicker
                    employerField
                    documentPicker
                    notesField

                    if let error = saveError {
                        Text(error)
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.brickAccent)
                    }

                    saveButton
                    Spacer(minLength: CivicaSpacing.xl)
                }
                .padding(CivicaSpacing.xl)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle(WorkHoursStrings.addSheetTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(WorkHoursStrings.cancelButton.value(in: language)) {
                        dismiss()
                    }
                    .foregroundStyle(CivicaColors.pinePrimary)
                }
            }
        }
    }

    // MARK: - Form fields

    private var datePicker: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            fieldLabel(WorkHoursStrings.dateLabel.value(in: language))
            DatePicker(
                "",
                selection: $workDate,
                in: ...Date(),
                displayedComponents: .date
            )
            .labelsHidden()
            .tint(CivicaColors.pinePrimary)
        }
    }

    private var hoursField: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            fieldLabel(WorkHoursStrings.hoursLabel.value(in: language))
            TextField(WorkHoursStrings.hoursPlaceholder.value(in: language), text: $hoursText)
                .keyboardType(.decimalPad)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .padding(CivicaSpacing.md)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )
        }
    }

    private var activityTypePicker: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            fieldLabel(WorkHoursStrings.activityTypeLabel.value(in: language))
            Picker("", selection: $activityType) {
                ForEach(WorkActivityType.allCases) { type in
                    Text(language == .spanish ? type.displayLabelES : type.displayLabel)
                        .tag(type)
                }
            }
            .pickerStyle(.segmented)
            .tint(CivicaColors.pinePrimary)
        }
    }

    private var employerField: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            fieldLabel(WorkHoursStrings.employerLabel.value(in: language))
            TextField("", text: $employerName)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .padding(CivicaSpacing.md)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )
        }
    }

    private var documentPicker: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            fieldLabel(WorkHoursStrings.attachPaystub.value(in: language))
            Text(WorkHoursStrings.attachPaystubSubtitle.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            if uploadedDocumentId != nil {
                HStack(spacing: CivicaSpacing.xs) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(CivicaColors.pinePrimary)
                    Text(WorkHoursStrings.docAttached.value(in: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.pinePrimary)
                }
            } else {
                PhotosPicker(
                    selection: $selectedPhotoItem,
                    matching: .images
                ) {
                    HStack(spacing: CivicaSpacing.xs) {
                        Image(systemName: "paperclip")
                        Text(WorkHoursStrings.attachPaystub.value(in: language))
                            .font(CivicaTypography.body)
                    }
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 44)
                    .background(CivicaColors.pinePrimary.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
                }
                .onChange(of: selectedPhotoItem) { _, newItem in
                    Task { await loadPickedPhoto(newItem) }
                }
            }
        }
    }

    private var notesField: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            fieldLabel(WorkHoursStrings.notesLabel.value(in: language))
            TextField("", text: $notes, axis: .vertical)
                .lineLimit(3...6)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .padding(CivicaSpacing.md)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )
        }
    }

    private var saveButton: some View {
        Button {
            Task { await save() }
        } label: {
            Group {
                if isSaving {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(CivicaColors.onPrimaryText)
                } else {
                    Text(WorkHoursStrings.saveSession.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                }
            }
            .foregroundStyle(CivicaColors.onPrimaryText)
            .frame(maxWidth: .infinity)
            .frame(minHeight: 56)
        }
        .background(canSave ? CivicaColors.pinePrimary : CivicaColors.graphite.opacity(0.3))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
        .disabled(!canSave)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.graphite)
    }

    // MARK: - Actions

    private func loadPickedPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        if let data = try? await item.loadTransferable(type: Data.self) {
            pickedImageData = data
        }
    }

    private func save() async {
        guard let api = apiClient, let hours = hoursValue else { return }
        isSaving = true
        saveError = nil
        defer { isSaving = false }

        do {
            // Upload document first if one was picked but not yet uploaded
            if let imageData = pickedImageData, uploadedDocumentId == nil {
                let doc = try await api.uploadDocument(
                    packetId: packetId,
                    imageData: imageData,
                    mediaType: "image/jpeg",
                    documentKind: .paystub,
                    onDeviceQualityPassed: true
                )
                uploadedDocumentId = doc.id
            }

            let dateStr = workDateString()
            let request = LogWorkHoursRequest(
                work_date: dateStr,
                hours: hours,
                activity_type: activityType.rawValue,
                employer_name: employerName.isEmpty ? nil : employerName,
                document_id: uploadedDocumentId,
                notes: notes.isEmpty ? nil : notes
            )

            let result = try await api.logWorkHours(packetId: packetId, request: request)
            onSaved(result)
            dismiss()
        } catch {
            saveError = WorkHoursStrings.saveError.value(in: language) + " \(error.localizedDescription)"
        }
    }

    private func workDateString() -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: workDate)
    }
}

// MARK: - Preview

#if DEBUG
#Preview("Empty form") {
    AddWorkSessionSheet()
}

#Preview("With mock client") {
    AddWorkSessionSheet(
        packetId: "mock-packet-123",
        apiClient: MockEnrollmentAPIClient()
    )
}

#Preview("Spanish") {
    AddWorkSessionSheet(
        packetId: "mock-packet-123",
        apiClient: MockEnrollmentAPIClient()
    )
    .onAppear {
        UserDefaults.standard.set(CivicaLanguage.spanish.rawValue,
                                  forKey: CivicaLanguage.defaultStorageKey)
    }
}
#endif
