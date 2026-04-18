import Foundation
import PassKit

@MainActor
final class ApplePayDonationManager: NSObject, ObservableObject {
    enum DonationError: LocalizedError {
        case invalidAmount
        case merchantIdentifierMissing
        case applePayUnavailable
        case cannotPresentSheet
        case userCancelled
        case tokenProcessingFailed

        var errorDescription: String? {
            switch self {
            case .invalidAmount:
                return "Enter a donation amount between $1 and $500."
            case .merchantIdentifierMissing:
                return "Apple Pay is not configured yet. Missing APPLE_PAY_MERCHANT_ID."
            case .applePayUnavailable:
                return "Apple Pay is unavailable on this device."
            case .cannotPresentSheet:
                return "Could not open Apple Pay. Please try again."
            case .userCancelled:
                return "Donation canceled."
            case .tokenProcessingFailed:
                return "We couldn't process this donation yet. Please try again."
            }
        }
    }

    @Published var isProcessing = false
    @Published var successMessage: String?
    @Published var errorMessage: String?

    private let supportedNetworks: [PKPaymentNetwork] = [.amex, .masterCard, .visa, .discover]
    private var pendingAmount: Decimal = 0
    private var continuation: CheckedContinuation<Void, Error>?
    private var authorizationOutcome: Result<Void, Error>?

    func canMakePayments() -> Bool {
        PKPaymentAuthorizationController.canMakePayments(usingNetworks: supportedNetworks)
    }

    func startDonation(amount: Decimal) async {
        guard !isProcessing else { return }
        isProcessing = true
        successMessage = nil
        errorMessage = nil

        do {
            try validateAmount(amount)
            try await presentApplePaySheet(for: amount)
            successMessage = "Thank you for supporting voting access."
        } catch {
            errorMessage = (error as? DonationError)?.localizedDescription ?? error.localizedDescription
        }

        isProcessing = false
    }

    private func validateAmount(_ amount: Decimal) throws {
        guard amount >= 1, amount <= 500 else {
            throw DonationError.invalidAmount
        }
    }

    private func merchantIdentifier() throws -> String {
        guard let merchantID = Bundle.main.object(forInfoDictionaryKey: "APPLE_PAY_MERCHANT_ID") as? String,
              !merchantID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw DonationError.merchantIdentifierMissing
        }
        return merchantID
    }

    private func buildRequest(amount: Decimal) throws -> PKPaymentRequest {
        guard canMakePayments() else {
            throw DonationError.applePayUnavailable
        }

        let merchantID = try merchantIdentifier()
        let request = PKPaymentRequest()
        request.merchantIdentifier = merchantID
        request.supportedNetworks = supportedNetworks
        if #available(iOS 17.0, *) {
            request.merchantCapabilities = [.threeDSecure]
        } else {
            request.merchantCapabilities = [.capability3DS]
        }
        request.countryCode = StripePaymentSheetConfig.merchantCountryCode
        request.currencyCode = "USD"

        let amountNumber = NSDecimalNumber(decimal: amount)
        request.paymentSummaryItems = [
            PKPaymentSummaryItem(label: "Civica Donation", amount: amountNumber, type: .final),
            PKPaymentSummaryItem(label: "Total", amount: amountNumber, type: .final)
        ]
        return request
    }

    private func presentApplePaySheet(for amount: Decimal) async throws {
        let request = try buildRequest(amount: amount)
        pendingAmount = amount
        authorizationOutcome = nil

        let controller = PKPaymentAuthorizationController(paymentRequest: request)
        controller.delegate = self

        let didPresent = await withCheckedContinuation { continuation in
            controller.present { presented in
                continuation.resume(returning: presented)
            }
        }

        guard didPresent else {
            throw DonationError.cannotPresentSheet
        }

        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
        }
    }

    // Placeholder processor for local testing; real payment capture must run server-side.
    func processPaymentToken(_ token: PKPaymentToken, amount: Decimal) async throws {
        _ = token
        _ = amount
        try await Task.sleep(nanoseconds: 350_000_000)
    }
}

extension ApplePayDonationManager: PKPaymentAuthorizationControllerDelegate {
    nonisolated func paymentAuthorizationController(
        _ controller: PKPaymentAuthorizationController,
        didAuthorizePayment payment: PKPayment,
        handler completion: @escaping (PKPaymentAuthorizationResult) -> Void
    ) {
        Task { @MainActor in
            do {
                try await processPaymentToken(payment.token, amount: pendingAmount)
                authorizationOutcome = .success(())
                completion(PKPaymentAuthorizationResult(status: .success, errors: nil))
            } catch {
                authorizationOutcome = .failure(error)
                completion(PKPaymentAuthorizationResult(status: .failure, errors: nil))
            }
        }
    }

    nonisolated func paymentAuthorizationControllerDidFinish(_ controller: PKPaymentAuthorizationController) {
        controller.dismiss {
            Task { @MainActor in
                let outcome = self.authorizationOutcome ?? .failure(DonationError.userCancelled)
                self.authorizationOutcome = nil
                guard let continuation = self.continuation else { return }
                self.continuation = nil
                continuation.resume(with: outcome)
            }
        }
    }
}
