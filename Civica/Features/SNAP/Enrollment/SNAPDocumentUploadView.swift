import CivicaDesignSystem
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

// Document upload sheet shown when the navigator requests additional materials
// (packet status == .needsDocuments or .needsApplicantClarification).
//
// On appear the view fetches the user's most recent non-closed packet to get
// a packetId. It then loads the existing document list and lets the user add
// more via the system Photos picker or the document file importer (PDF/HEIC/
// PNG/JPEG). Each upload goes to POST /me/packets/:id/documents as a
// multipart/form-data request through the enrollment-api gateway.
//
// After a successful upload, `onDocumentUploaded?()` is called so the parent
// can refresh the inbox section.

struct SNAPDocumentUploadView: View {
    let language: CivicaLanguage
    var onDocumentUploaded: (() -> Void)?

    @EnvironmentObject private var enrollmentAuth: CivicaEnrollmentAuth
    @Environment(\.dismiss) private var dismiss

    @State private var activePacketId: String?
    @State private var documents: [EnrollmentDocument] = []
    @State private var selectedKind: EnrollmentDocumentKind = .photoId
    @State private var isResolvingPacket = true
    @State private var isUploading = false
    @State private var isLoadingDocuments = false
    @State private var uploadError: String?
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var showingFileImporter = false
    @State private var uploadCount = 0 // incrementing this re-triggers the document list fetch

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    if isResolvingPacket {
                        loadingView
                    } else if activePacketId != nil {
                        kindPickerSection
                        uploadButtonSection
                        if let error = uploadError {
                            errorBanner(error)
                        }
                        if isUploading {
                            uploadingRow
                        }
                        documentListSection
                    } else {
                        noActivePacketView
                    }
                }
                .padding(CivicaSpacing.md)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle(Strings.navTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(Strings.done.value(in: language)) { dismiss() }
                }
            }
        }
        .task { await resolveActivePacket() }
        .task(id: activePacketId) {
            guard activePacketId != nil else { return }
            await loadDocuments()
        }
        .task(id: uploadCount) {
            guard uploadCount > 0 else { return }
            await loadDocuments()
        }
        .onChange(of: selectedPhotoItem) { _, item in
            guard let item else { return }
            Task { await handlePhotoItem(item) }
        }
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: [
                .pdf,
                .jpeg,
                .png,
                UTType(filenameExtension: "heic") ?? .image
            ],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                Task { await handleFileURL(url) }
            case .failure(let error):
                uploadError = error.localizedDescription
            }
        }
        .disabled(isUploading)
    }

    // MARK: - Sections

    private var loadingView: some View {
        HStack {
            Spacer()
            ProgressView().tint(CivicaColors.brickPrimary)
            Spacer()
        }
        .padding(.top, CivicaSpacing.xl)
    }

    private var noActivePacketView: some View {
        VStack(spacing: CivicaSpacing.md) {
            Image(systemName: "doc.questionmark")
                .font(.system(size: 40))
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
            Text(Strings.noActivePacket.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, CivicaSpacing.xl)
    }

    private var kindPickerSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(Strings.kindLabel.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
            Menu {
                ForEach(EnrollmentDocumentKind.orderedCases, id: \.self) { kind in
                    Button(kind.displayLabel(in: language)) {
                        selectedKind = kind
                    }
                }
            } label: {
                HStack {
                    Text(selectedKind.displayLabel(in: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 13))
                        .foregroundStyle(CivicaColors.graphite)
                }
                .padding(CivicaSpacing.sm)
                .background(CivicaColors.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )
            }
            .accessibilityLabel(Strings.kindPickerA11y.value(in: language))
        }
    }

    private var uploadButtonSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(Strings.addLabel.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
            HStack(spacing: CivicaSpacing.sm) {
                PhotosPicker(
                    selection: $selectedPhotoItem,
                    matching: .any(of: [.images, .screenshots]),
                    photoLibrary: .shared()
                ) {
                    Label(Strings.fromPhotos.value(in: language), systemImage: "photo")
                        .font(CivicaTypography.subheadStrong)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, CivicaSpacing.sm)
                }
                .buttonStyle(.bordered)
                .tint(CivicaColors.brickPrimary)

                Button {
                    uploadError = nil
                    showingFileImporter = true
                } label: {
                    Label(Strings.addFile.value(in: language), systemImage: "doc")
                        .font(CivicaTypography.subheadStrong)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, CivicaSpacing.sm)
                }
                .buttonStyle(.bordered)
                .tint(CivicaColors.brickPrimary)
            }
        }
    }

    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.destructive)
            .padding(CivicaSpacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.statusErrorSurface)
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var uploadingRow: some View {
        HStack(spacing: CivicaSpacing.sm) {
            ProgressView().tint(CivicaColors.brickPrimary)
            Text(Strings.uploading.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
        }
    }

    private var documentListSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            if isLoadingDocuments {
                ProgressView()
                    .tint(CivicaColors.brickPrimary)
                    .frame(maxWidth: .infinity)
            } else if documents.isEmpty {
                Text(Strings.noDocumentsYet.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, CivicaSpacing.md)
            } else {
                Text(Strings.uploadedHeader.value(in: language))
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
                ForEach(documents) { doc in
                    documentRow(doc)
                }
            }
        }
    }

    private func documentRow(_ doc: EnrollmentDocument) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: statusIcon(doc.processingStatus))
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(statusColor(doc.processingStatus))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(doc.documentKind?.displayLabel(in: language) ?? Strings.unknownKind.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(formattedDate(doc.uploadedAt))
                    .font(CivicaTypography.caption)
                    .foregroundStyle(CivicaColors.muted)
                Text(statusLabel(doc.processingStatus))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(statusColor(doc.processingStatus))
            }
            Spacer(minLength: 0)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(doc.documentKind?.displayLabel(in: language) ?? Strings.unknownKind.value(in: language)). " +
            "\(statusLabel(doc.processingStatus)). " +
            "\(formattedDate(doc.uploadedAt))"
        )
    }

    // MARK: - Data

    private func resolveActivePacket() async {
        guard enrollmentAuth.state.isAuthenticated else {
            isResolvingPacket = false
            return
        }
        let client = enrollmentAuth.makeEnrollmentAPIClient()
        if let packets = try? await client.fetchMyPackets() {
            activePacketId = packets
                .filter { $0.status != .closed }
                .sorted { $0.createdAt > $1.createdAt }
                .first?.id
        }
        isResolvingPacket = false
    }

    private func loadDocuments() async {
        guard let packetId = activePacketId else { return }
        let client = enrollmentAuth.makeEnrollmentAPIClient()
        isLoadingDocuments = true
        defer { isLoadingDocuments = false }
        if let fetched = try? await client.fetchDocuments(packetId: packetId) {
            documents = fetched.sorted { $0.uploadedAt > $1.uploadedAt }
        }
    }

    // MARK: - Upload handlers

    private func handlePhotoItem(_ item: PhotosPickerItem) async {
        guard let packetId = activePacketId else { return }
        uploadError = nil
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                uploadError = Strings.loadError.value(in: language)
                return
            }
            let mediaType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
            await performUpload(packetId: packetId, data: data, mediaType: mediaType)
        } catch {
            uploadError = error.localizedDescription
        }
        selectedPhotoItem = nil
    }

    private func handleFileURL(_ url: URL) async {
        guard let packetId = activePacketId else { return }
        uploadError = nil
        guard url.startAccessingSecurityScopedResource() else {
            uploadError = Strings.fileAccessError.value(in: language)
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }
        do {
            let data = try Data(contentsOf: url)
            let ext = url.pathExtension.lowercased()
            let mediaType: String
            switch ext {
            case "pdf":  mediaType = "application/pdf"
            case "png":  mediaType = "image/png"
            case "heic": mediaType = "image/heic"
            default:     mediaType = "image/jpeg"
            }
            await performUpload(packetId: packetId, data: data, mediaType: mediaType)
        } catch {
            uploadError = error.localizedDescription
        }
    }

    private func performUpload(packetId: String, data: Data, mediaType: String) async {
        let client = enrollmentAuth.makeEnrollmentAPIClient()
        isUploading = true
        uploadError = nil
        defer { isUploading = false }
        do {
            _ = try await client.uploadDocument(
                packetId: packetId,
                imageData: data,
                mediaType: mediaType,
                documentKind: selectedKind,
                onDeviceQualityPassed: true
            )
            uploadCount += 1
            onDocumentUploaded?()
        } catch {
            uploadError = error.localizedDescription
        }
    }

    // MARK: - Display helpers

    private func statusIcon(_ status: EnrollmentDocumentProcessingStatus) -> String {
        switch status {
        case .uploaded:              return "clock"
        case .classifying:           return "doc.text.magnifyingglass"
        case .extracting:            return "gearshape"
        case .awaitingConfirmation:  return "hand.raised"
        case .confirmed:             return "checkmark.circle.fill"
        case .rejected:              return "xmark.circle.fill"
        }
    }

    private func statusColor(_ status: EnrollmentDocumentProcessingStatus) -> Color {
        switch status {
        case .uploaded:              return CivicaColors.graphite
        case .classifying:           return CivicaColors.warningAmber
        case .extracting:            return CivicaColors.warningAmber
        case .awaitingConfirmation:  return CivicaColors.warningAmber
        case .confirmed:             return CivicaColors.accentTeal
        case .rejected:              return CivicaColors.destructive
        }
    }

    private func statusLabel(_ status: EnrollmentDocumentProcessingStatus) -> String {
        switch status {
        case .uploaded:              return Strings.statusPending.value(in: language)
        case .classifying:           return Strings.statusProcessing.value(in: language)
        case .extracting:            return Strings.statusProcessing.value(in: language)
        case .awaitingConfirmation:  return Strings.statusAwaitingReview.value(in: language)
        case .confirmed:             return Strings.statusComplete.value(in: language)
        case .rejected:              return Strings.statusFailed.value(in: language)
        }
    }

    private func formattedDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        f.locale = language == .spanish ? Locale(identifier: "es") : Locale(identifier: "en_US")
        return f.string(from: date)
    }

    // MARK: - Strings

    private enum Strings {
        static let navTitle        = CivicaText("Upload Documents", es: "Subir documentos")
        static let done            = CivicaText("Done", es: "Listo")
        static let kindLabel       = CivicaText("Document type", es: "Tipo de documento")
        static let kindPickerA11y  = CivicaText("Select document type", es: "Seleccionar tipo de documento")
        static let addLabel        = CivicaText("Add a document", es: "Agregar un documento")
        static let fromPhotos      = CivicaText("From Photos", es: "De Fotos")
        static let addFile         = CivicaText("File", es: "Archivo")
        static let uploading       = CivicaText("Uploading…", es: "Subiendo…")
        static let uploadedHeader  = CivicaText("Uploaded documents", es: "Documentos subidos")
        static let noDocumentsYet  = CivicaText("No documents uploaded yet.", es: "Aún no se han subido documentos.")
        static let unknownKind     = CivicaText("Document", es: "Documento")
        static let statusPending   = CivicaText("Received", es: "Recibido")
        static let statusProcessing = CivicaText("Processing", es: "Procesando")
        static let statusAwaitingReview = CivicaText("Awaiting review", es: "Pendiente de revisión")
        static let statusComplete  = CivicaText("Accepted", es: "Aceptado")
        static let statusFailed    = CivicaText("Review needed", es: "Requiere revisión")
        static let loadError       = CivicaText("Could not load the selected image.", es: "No se pudo cargar la imagen seleccionada.")
        static let fileAccessError = CivicaText("Could not access the file.", es: "No se pudo acceder al archivo.")
        static let noActivePacket  = CivicaText(
            "No active application found.\nComplete and submit your application first.",
            es: "No se encontró una solicitud activa.\nCompleta y envía tu solicitud primero."
        )
    }
}

#if DEBUG
struct SNAPDocumentUploadView_Previews: PreviewProvider {
    static var previews: some View {
        SNAPDocumentUploadView(language: .english)
            .environmentObject(CivicaEnrollmentAuth())
        SNAPDocumentUploadView(language: .spanish)
            .environmentObject(CivicaEnrollmentAuth())
    }
}
#endif
