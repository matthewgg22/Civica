import Foundation
#if canImport(StripePaymentSheet)
import StripePaymentSheet
#endif

enum StripePaymentSheetConfig {
    // PaymentSheet Apple Pay placeholders for "Support Americans Vote!".
    // Use these when building PaymentSheet.Configuration.applePay.
    static let merchantId = "merchant.org.votenow"
    static let merchantCountryCode = "US"
}

#if canImport(StripePaymentSheet)
extension PaymentSheet.Configuration {
    static func voteNowDonationConfiguration() -> PaymentSheet.Configuration {
        var configuration = PaymentSheet.Configuration()
        configuration.merchantDisplayName = "Civica"
        configuration.applePay = .init(
            merchantId: StripePaymentSheetConfig.merchantId,
            merchantCountryCode: StripePaymentSheetConfig.merchantCountryCode
        )
        return configuration
    }
}
#endif
