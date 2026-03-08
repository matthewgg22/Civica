import Foundation
import OSLog
#if canImport(Supabase)
import Supabase
#endif

enum SupabaseTable {
    static let profiles = "profiles"
}

struct ProfileRow: Codable, Identifiable, Sendable {
    let id: UUID
    var email: String?
    var fullName: String?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case fullName = "full_name"
        case updatedAt = "updated_at"
    }

    init(id: UUID, email: String? = nil, fullName: String? = nil, updatedAt: Date? = nil) {
        self.id = id
        self.email = email
        self.fullName = fullName
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        fullName = try container.decodeIfPresent(String.self, forKey: .fullName)

        if let rawTimestamp = try container.decodeIfPresent(String.self, forKey: .updatedAt) {
            updatedAt = PostgresTimestampCodec.decode(rawTimestamp)
        } else if let directDate = try container.decodeIfPresent(Date.self, forKey: .updatedAt) {
            updatedAt = directDate
        } else {
            updatedAt = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(email, forKey: .email)
        try container.encodeIfPresent(fullName, forKey: .fullName)

        if let updatedAt {
            try container.encode(PostgresTimestampCodec.encode(updatedAt), forKey: .updatedAt)
        } else {
            try container.encodeNil(forKey: .updatedAt)
        }
    }
}

enum DatabaseServiceError: LocalizedError {
    case sdkMissing
    case invalidAmount

    var errorDescription: String? {
        switch self {
        case .sdkMissing:
            return "Supabase SDK is not installed. Add package dependency to enable database calls."
        case .invalidAmount:
            return "Invalid input for database operation."
        }
    }
}

final class DatabaseService {
    private let client: AppSupabaseClient
    private let logger = Logger(subsystem: "VoteNow", category: "DatabaseService")

    init(client: AppSupabaseClient = SupabaseClientProvider.shared.client) {
        self.client = client
    }

    // MARK: Generic CRUD

    func select<T: Decodable>(
        from table: String,
        columns: String = "*",
        limit: Int? = nil
    ) async throws -> [T] {
        #if canImport(Supabase)
        do {
            if let limit {
                return try await client
                    .from(table)
                    .select(columns)
                    .limit(limit)
                    .execute()
                    .value
            } else {
                return try await client
                    .from(table)
                    .select(columns)
                    .execute()
                    .value
            }
        } catch {
            logger.error("DB select failed table=\(table, privacy: .public) columns=\(columns, privacy: .public) limit=\(String(describing: limit), privacy: .public) error=\(error.localizedDescription, privacy: .public)")
            throw error
        }
        #else
        _ = table
        _ = columns
        _ = limit
        throw DatabaseServiceError.sdkMissing
        #endif
    }

    @discardableResult
    func insert<Payload: Encodable, Result: Decodable>(
        into table: String,
        values: Payload,
        returning: Result.Type
    ) async throws -> Result {
        #if canImport(Supabase)
        do {
            return try await client
                .from(table)
                .insert(values)
                .select()
                .single()
                .execute()
                .value
        } catch {
            logger.error("DB insert failed table=\(table, privacy: .public) error=\(error.localizedDescription, privacy: .public)")
            throw error
        }
        #else
        _ = table
        _ = values
        _ = returning
        throw DatabaseServiceError.sdkMissing
        #endif
    }

    @discardableResult
    func update<Payload: Encodable, Result: Decodable, FilterValue: PostgrestFilterValue>(
        table: String,
        values: Payload,
        whereEquals column: String,
        value: FilterValue,
        returning: Result.Type
    ) async throws -> Result {
        #if canImport(Supabase)
        do {
            return try await client
                .from(table)
                .update(values)
                .eq(column, value: value)
                .select()
                .single()
                .execute()
                .value
        } catch {
            logger.error("DB update failed table=\(table, privacy: .public) filterColumn=\(column, privacy: .public) error=\(error.localizedDescription, privacy: .public)")
            throw error
        }
        #else
        _ = table
        _ = values
        _ = column
        _ = value
        _ = returning
        throw DatabaseServiceError.sdkMissing
        #endif
    }

    func delete<FilterValue: PostgrestFilterValue>(
        from table: String,
        whereEquals column: String,
        value: FilterValue
    ) async throws {
        #if canImport(Supabase)
        do {
            _ = try await client
                .from(table)
                .delete()
                .eq(column, value: value)
                .execute()
        } catch {
            logger.error("DB delete failed table=\(table, privacy: .public) filterColumn=\(column, privacy: .public) error=\(error.localizedDescription, privacy: .public)")
            throw error
        }
        #else
        _ = table
        _ = column
        _ = value
        throw DatabaseServiceError.sdkMissing
        #endif
    }

    // MARK: Typed helpers (example)

    func fetchProfiles(limit: Int = 25) async throws -> [ProfileRow] {
        logger.debug("Fetching profiles with limit=\(limit)")
        return try await select(from: SupabaseTable.profiles, limit: limit)
    }

    @discardableResult
    func upsertProfile(_ profile: ProfileRow) async throws -> ProfileRow {
        logger.debug("Upserting profile \(profile.id.uuidString, privacy: .public)")
        #if canImport(Supabase)
        do {
            return try await client
                .from(SupabaseTable.profiles)
                .upsert(profile)
                .select()
                .single()
                .execute()
                .value
        } catch {
            logger.error("DB upsert failed table=\(SupabaseTable.profiles, privacy: .public) profileID=\(profile.id.uuidString, privacy: .public) error=\(error.localizedDescription, privacy: .public)")
            throw error
        }
        #else
        _ = profile
        throw DatabaseServiceError.sdkMissing
        #endif
    }
}

enum PostgresTimestampCodec {
    private static let withFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let withoutFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func decode(_ rawValue: String) -> Date? {
        withFractional.date(from: rawValue) ?? withoutFractional.date(from: rawValue)
    }

    static func encode(_ date: Date) -> String {
        withFractional.string(from: date)
    }
}
