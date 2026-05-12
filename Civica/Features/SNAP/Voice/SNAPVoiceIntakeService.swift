import AVFoundation
import Combine
import FoundationModels
import Foundation
import Speech

// Voice intake orchestrator for the SNAP flow. Owns the microphone, the
// SFSpeechRecognizer transcription pipeline, and two LanguageModelSession
// instances (one for step-specific extraction, one for the always-on
// distress pass). Audio buffers are released on utterance end — the
// service never retains PCM beyond the active transcribe call.
//
// Public surface:
//   • state            — UI-observable VoiceIntakeState
//   • partialTranscript — live transcript while listening (UI hint)
//   • updates          — AsyncStream<VoiceIntakeUpdate> of extraction events
//   • startListening(forStep:) — begin a new utterance window
//   • stopListening()  — finalize the current utterance and run extraction
//   • cancel()         — abort without running extraction
//
// The service is created per consumer view and disposed when that view
// goes away. There should never be two instances active at once.

@available(iOS 26.0, *)
enum VoiceIntakeState: Equatable {
    case idle
    case listening
    case processing
    case error(SNAPVoiceIntakeError)
    case unavailable(reason: String)
}

@available(iOS 26.0, *)
enum VoiceIntakeUpdate {
    case partialTranscript(String)
    case finalTranscript(String)
    case extracted(any SNAPDraftPatchProducing, DistressSignalExtraction)
    case failed(SNAPVoiceIntakeError)
}

@available(iOS 26.0, *)
@MainActor
final class SNAPVoiceIntakeService: ObservableObject {

    @Published private(set) var state: VoiceIntakeState = .idle
    @Published private(set) var partialTranscript: String = ""

    var updates: AsyncStream<VoiceIntakeUpdate> { updatesStream }

    private let updatesStream: AsyncStream<VoiceIntakeUpdate>
    private let updatesContinuation: AsyncStream<VoiceIntakeUpdate>.Continuation

    private let audioEngine = AVAudioEngine()
    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    private var currentStep: SNAPDraftStep?
    private var finalTranscriptText: String = ""

    private var stepSession: LanguageModelSession?
    private var distressSession: LanguageModelSession?

    init() {
        var continuation: AsyncStream<VoiceIntakeUpdate>.Continuation!
        self.updatesStream = AsyncStream { continuation = $0 }
        self.updatesContinuation = continuation

        self.speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
        configureSessions()
    }

    deinit {
        updatesContinuation.finish()
    }

    private func configureSessions() {
        let availability = SystemLanguageModel.default.availability
        switch availability {
        case .available:
            stepSession = LanguageModelSession()
            distressSession = LanguageModelSession()
        case .unavailable(let reason):
            state = .unavailable(reason: describe(reason))
        @unknown default:
            state = .unavailable(reason: "unknown")
        }
    }

    private func describe(_ reason: SystemLanguageModel.Availability.UnavailableReason) -> String {
        switch reason {
        case .deviceNotEligible: return "device not eligible"
        case .appleIntelligenceNotEnabled: return "Apple Intelligence is off"
        case .modelNotReady: return "model not ready yet"
        @unknown default: return "unknown"
        }
    }

    // MARK: - Public API

    func startListening(forStep step: SNAPDraftStep) async {
        guard case .idle = state else { return }
        guard stepSession != nil, distressSession != nil else {
            updatesContinuation.yield(.failed(.modelUnavailable(reason: "session not initialized")))
            return
        }

        currentStep = step
        partialTranscript = ""
        finalTranscriptText = ""

        do {
            try await requestPermissions()
            try startAudio()
            state = .listening
        } catch let err as SNAPVoiceIntakeError {
            state = .error(err)
            updatesContinuation.yield(.failed(err))
        } catch {
            let mapped = SNAPVoiceIntakeError.audioEngineFailed(underlying: error.localizedDescription)
            state = .error(mapped)
            updatesContinuation.yield(.failed(mapped))
        }
    }

    func stopListening() async {
        guard case .listening = state else { return }
        let transcript = await finalizeAudio()
        guard !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            state = .idle
            return
        }
        updatesContinuation.yield(.finalTranscript(transcript))
        state = .processing
        await runExtraction(transcript: transcript)
        state = .idle
    }

    func cancel() async {
        guard case .listening = state else { return }
        _ = await finalizeAudio()
        state = .idle
    }

    // MARK: - Permissions

    private func requestPermissions() async throws {
        let mic = AVAudioApplication.shared.recordPermission
        if mic == .denied {
            throw SNAPVoiceIntakeError.permissionDenied(.microphone)
        }
        if mic == .undetermined {
            let granted = await AVAudioApplication.requestRecordPermission()
            if !granted { throw SNAPVoiceIntakeError.permissionDenied(.microphone) }
        }

        let speech = SFSpeechRecognizer.authorizationStatus()
        if speech == .denied || speech == .restricted {
            throw SNAPVoiceIntakeError.permissionDenied(.speechRecognition)
        }
        if speech == .notDetermined {
            let status: SFSpeechRecognizerAuthorizationStatus = await withCheckedContinuation { cont in
                SFSpeechRecognizer.requestAuthorization { cont.resume(returning: $0) }
            }
            if status != .authorized {
                throw SNAPVoiceIntakeError.permissionDenied(.speechRecognition)
            }
        }
    }

    // MARK: - Audio + ASR

    private func startAudio() throws {
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers])
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        guard let recognizer = speechRecognizer, recognizer.isAvailable else {
            throw SNAPVoiceIntakeError.asrFailed(underlying: "recognizer unavailable")
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = true
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            Task { @MainActor in
                if let result {
                    let text = result.bestTranscription.formattedString
                    self.partialTranscript = text
                    self.updatesContinuation.yield(.partialTranscript(text))
                    if result.isFinal {
                        self.finalTranscriptText = text
                    }
                }
                if let error {
                    let mapped = SNAPVoiceIntakeError.asrFailed(underlying: error.localizedDescription)
                    self.state = .error(mapped)
                    self.updatesContinuation.yield(.failed(mapped))
                }
            }
        }
    }

    private func finalizeAudio() async -> String {
        if audioEngine.isRunning {
            audioEngine.inputNode.removeTap(onBus: 0)
            audioEngine.stop()
        }
        recognitionRequest?.endAudio()
        recognitionTask?.finish()

        // Give the recognizer a brief window to emit a final result.
        for _ in 0..<10 {
            if !finalTranscriptText.isEmpty { break }
            try? await Task.sleep(nanoseconds: 50_000_000)
        }

        let result = finalTranscriptText.isEmpty ? partialTranscript : finalTranscriptText

        recognitionTask = nil
        recognitionRequest = nil
        partialTranscript = ""
        finalTranscriptText = ""
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        return result
    }

    // MARK: - LLM extraction

    private func runExtraction(transcript: String) async {
        guard let step = currentStep, let stepSession, let distressSession else { return }

        let stepPrompt = SNAPVoicePrompts.stepPrompt(for: step, transcript: transcript)
        let distressPrompt = SNAPVoicePrompts.distressPrompt(transcript: transcript)

        do {
            async let patch = extract(step: step, prompt: stepPrompt, session: stepSession)
            async let distress = distressSession.respond(to: distressPrompt, generating: DistressSignalExtraction.self).content
            let (patchResult, distressResult) = try await (patch, distress)
            updatesContinuation.yield(.extracted(patchResult, distressResult))
        } catch {
            let mapped = SNAPVoiceIntakeError.extractionFailed(underlying: error.localizedDescription)
            updatesContinuation.yield(.failed(mapped))
        }
    }

    private func extract(step: SNAPDraftStep, prompt: String, session: LanguageModelSession) async throws -> any SNAPDraftPatchProducing {
        switch step {
        case .whereApplyingFrom:
            return try await session.respond(to: prompt, generating: WhereApplyingFromExtraction.self).content
        case .householdBasics:
            return try await session.respond(to: prompt, generating: HouseholdBasicsExtraction.self).content
        case .applicantAge:
            return try await session.respond(to: prompt, generating: ApplicantAgeExtraction.self).content
        case .addressContact:
            return try await session.respond(to: prompt, generating: AddressContactExtraction.self).content
        case .income:
            return try await session.respond(to: prompt, generating: IncomeExtraction.self).content
        case .studentStatus:
            return try await session.respond(to: prompt, generating: StudentStatusExtraction.self).content
        case .expenses:
            return try await session.respond(to: prompt, generating: ExpensesExtraction.self).content
        case .documentsChecklist:
            return try await session.respond(to: prompt, generating: DocumentsChecklistExtraction.self).content
        case .reviewDraft:
            return ReviewDraftExtraction(placeholder: nil)
        case .nextSteps:
            return NextStepsExtraction(placeholder: nil)
        }
    }
}
