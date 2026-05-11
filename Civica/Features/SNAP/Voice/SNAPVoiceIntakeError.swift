import Foundation

// Errors surface to the mic button as a transient state plus a short
// userMessage; the bigger flow is never blocked because the typed
// fallback (manual entry) is always available.
enum SNAPVoiceIntakeError: Error, Equatable {
    enum Permission: Equatable {
        case microphone
        case speechRecognition
    }

    case permissionDenied(Permission)
    case modelUnavailable(reason: String)
    case asrFailed(underlying: String)
    case extractionFailed(underlying: String)
    case audioEngineFailed(underlying: String)
    case cancelled

    var userMessage: String {
        switch self {
        case .permissionDenied(.microphone):
            return "Microphone access is off. Tap to open Settings."
        case .permissionDenied(.speechRecognition):
            return "Speech recognition is off. Tap to open Settings."
        case .modelUnavailable(let reason):
            return "Voice fill is unavailable on this device: \(reason)."
        case .asrFailed:
            return "We could not transcribe that. Try again."
        case .extractionFailed:
            return "Could not understand. Try saying it differently."
        case .audioEngineFailed:
            return "Microphone is not available right now."
        case .cancelled:
            return "Voice fill was cancelled."
        }
    }

    static func == (lhs: SNAPVoiceIntakeError, rhs: SNAPVoiceIntakeError) -> Bool {
        switch (lhs, rhs) {
        case (.permissionDenied(let a), .permissionDenied(let b)): return a == b
        case (.modelUnavailable(let a), .modelUnavailable(let b)): return a == b
        case (.asrFailed(let a), .asrFailed(let b)): return a == b
        case (.extractionFailed(let a), .extractionFailed(let b)): return a == b
        case (.audioEngineFailed(let a), .audioEngineFailed(let b)): return a == b
        case (.cancelled, .cancelled): return true
        default: return false
        }
    }
}
