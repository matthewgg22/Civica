import Foundation
import UIKit

// Repository (data layer) for EBT receipts. Owns the UserDefaults cache
// and delegates network calls to EBTReceiptAPIClient.
//
// Layering: per Q1/D8, repositories own data — never UI state.
// UI state lives in EBTReceiptsStore.

// MARK: - API client protocol

protocol EBTReceiptAPIClient: Sendable {
    func uploadReceipt(
        imageData: Data,
        ocrTotalCents: Int?,
        ocrMerchant: String?,
        capturedAt: Date
    ) async throws -> EBTReceipt

    func fetchReceipts() async throws -> [EBTReceipt]
}

// MARK: - Repository

@MainActor
final class EBTReceiptsRepository: ObservableObject {
    @Published private(set) var receipts: [EBTReceipt] = []

    private let apiClient: any EBTReceiptAPIClient
    private let cacheKey = "co.civica.ebt.receipts.v1"
    private let userDefaults: UserDefaults

    init(
        apiClient: any EBTReceiptAPIClient,
        userDefaults: UserDefaults = .standard
    ) {
        self.apiClient = apiClient
        self.userDefaults = userDefaults
        receipts = loadFromCache()
    }

    // MARK: - Public interface

    func upload(image: UIImage, ocr: EBTReceiptOCRResult) async throws -> EBTReceipt {
        guard let data = image.jpegData(compressionQuality: 0.85) else {
            throw EBTReceiptRepositoryError.imageEncodingFailed
        }
        let receipt = try await apiClient.uploadReceipt(
            imageData: data,
            ocrTotalCents: ocr.totalCents,
            ocrMerchant: ocr.merchant,
            capturedAt: Date()
        )
        receipts.insert(receipt, at: 0)
        saveToCache(receipts)
        return receipt
    }

    func refresh() async throws {
        let fresh = try await apiClient.fetchReceipts()
        receipts = fresh
        saveToCache(fresh)
    }

    // MARK: - Cache (UserDefaults JSON)

    private func loadFromCache() -> [EBTReceipt] {
        guard let data = userDefaults.data(forKey: cacheKey) else { return [] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([EBTReceipt].self, from: data)) ?? []
    }

    private func saveToCache(_ receipts: [EBTReceipt]) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(receipts) else { return }
        userDefaults.set(data, forKey: cacheKey)
    }
}

// MARK: - Errors

enum EBTReceiptRepositoryError: Error, LocalizedError {
    case imageEncodingFailed

    var errorDescription: String? {
        switch self {
        case .imageEncodingFailed:
            return "Could not process the receipt image. Please try again."
        }
    }
}
