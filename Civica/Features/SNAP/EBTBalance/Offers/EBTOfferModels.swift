import Foundation

// Data model for the EBT offer-moment platform.
//
// Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md.
// Wire format mirrors apps/enrollment-api/src/routes/me-offers.ts —
// keep the snake_case JSON keys in sync via CodingKeys.

/// A partner offer eligible to be shown to the user, as returned by
/// `GET /me/offers`. Ranked + valid_until-stamped by the gateway's
/// resolver split (distress / county / catalog / ranker).
struct EBTOffer: Codable, Equatable, Identifiable {
    let offerId: String
    let name: String
    let partnerName: String
    let category: String
    let description: String?
    let countyFipsList: [String]
    let expectedSavingsCents: Int
    let startAt: Date?
    let endAt: Date?
    let tier: Tier
    let stateCode: String
    let categoryTags: [String]
    let merchantId: String?
    /// ISO timestamp: min(offer.end_at, now + 5min). On tap, iOS verifies
    /// `now < validUntil` and refetches via `GET /me/offers/:id` if stale.
    let validUntil: Date
    /// Resolver score, 0..1 range. Surfaced for debugging only; not shown
    /// in the UI.
    let score: Double

    var id: String { offerId }

    enum Tier: String, Codable {
        case top
        case standard
        case none
    }

    enum CodingKeys: String, CodingKey {
        case offerId = "offer_id"
        case name
        case partnerName = "partner_name"
        case category
        case description
        case countyFipsList = "county_fips_list"
        case expectedSavingsCents = "expected_savings_cents"
        case startAt = "start_at"
        case endAt = "end_at"
        case tier
        case stateCode = "state_code"
        case categoryTags = "category_tags"
        case merchantId = "merchant_id"
        case validUntil = "valid_until"
        case score
    }
}

/// A free-resource row returned by `GET /me/offers` when the user has an
/// active distress flag. Renders in the EXACT same shelf as offers per
/// design D7 (silent-honor swap); user cannot tell from the UI that they
/// were segmented.
struct EBTFreeResource: Codable, Equatable, Identifiable {
    let resourceId: String
    let iconGlyph: IconGlyph
    /// English + Spanish strings come pre-split from the gateway. iOS picks
    /// per the active CivicaLanguage. Per Civica voice rules, both must
    /// always be present.
    let titleEn: String
    let titleEs: String
    let subtitleEn: String
    let subtitleEs: String
    let action: Action

    var id: String { resourceId }

    enum IconGlyph: String, Codable {
        case house
        case phone
        case document
    }

    enum Action: Codable, Equatable {
        case findhelpHelpDirectory
        case externalURL(URL)

        enum CodingKeys: String, CodingKey { case kind, url }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            let kind = try c.decode(String.self, forKey: .kind)
            switch kind {
            case "findhelp_helpdirectory":
                self = .findhelpHelpDirectory
            case "external_url":
                let raw = try c.decode(String.self, forKey: .url)
                guard let url = URL(string: raw) else {
                    throw DecodingError.dataCorruptedError(
                        forKey: .url,
                        in: c,
                        debugDescription: "Invalid URL: \(raw)"
                    )
                }
                self = .externalURL(url)
            default:
                throw DecodingError.dataCorruptedError(
                    forKey: .kind,
                    in: c,
                    debugDescription: "Unknown free-resource action kind: \(kind)"
                )
            }
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case .findhelpHelpDirectory:
                try c.encode("findhelp_helpdirectory", forKey: .kind)
            case .externalURL(let url):
                try c.encode("external_url", forKey: .kind)
                try c.encode(url.absoluteString, forKey: .url)
            }
        }
    }

    enum CodingKeys: String, CodingKey {
        case resourceId = "resource_id"
        case iconGlyph = "icon_glyph"
        case titleEn = "title_en"
        case titleEs = "title_es"
        case subtitleEn = "subtitle_en"
        case subtitleEs = "subtitle_es"
        case action
    }

    // MARK: - Dashboard back-compat
    //
    // The existing perksSection in EBTBalanceDashboardView maps each
    // free-resource row to `contentRow(icon:title:detail:)` reading `.name`
    // and `.description`. These computed properties keep that closure
    // compiling against the new bilingual wire format. Future iteration:
    // make these language-aware by threading CivicaLanguage through the
    // dashboard's row-builder.

    /// English title — back-compat for the existing perksSection closure.
    /// Lane C follow-up turn will replace this with a language-aware
    /// `localizedTitle(in:)` once the dashboard renders free-resources rows
    /// with their own brick-themed builder.
    var name: String { titleEn }

    /// English subtitle — same back-compat rationale as `name`.
    var description: String? { subtitleEn.isEmpty ? nil : subtitleEn }

    /// Language-aware title.
    func title(in language: CivicaLanguage) -> String {
        language == .spanish ? titleEs : titleEn
    }

    /// Language-aware subtitle.
    func subtitle(in language: CivicaLanguage) -> String {
        language == .spanish ? subtitleEs : subtitleEn
    }
}

/// Response shape of `GET /me/offers`. Either `offers` is non-empty and
/// `freeResources` is nil, OR `offers` is empty and `freeResources` is
/// populated (distress-honor path). The iOS perks card branches on which.
struct EBTOffersResponse: Codable, Equatable {
    let offers: [EBTOffer]
    let freeResources: [EBTFreeResource]?
    let meta: Meta

    struct Meta: Codable, Equatable {
        let stateCode: String
        let servedCount: Int
        let freeResourcesCount: Int
        let validUntilWindowMinutes: Int

        enum CodingKeys: String, CodingKey {
            case stateCode = "state_code"
            case servedCount = "served_count"
            case freeResourcesCount = "free_resources_count"
            case validUntilWindowMinutes = "valid_until_window_minutes"
        }
    }

    enum CodingKeys: String, CodingKey {
        case offers
        case freeResources = "free_resources"
        case meta
    }
}

/// Response shape of `POST /me/redemptions`. Anti-inflation `capped`
/// flag tells the UI whether the user's attested amount was reduced to
/// the offer's per-event ceiling.
struct EBTRedemptionResponse: Codable, Equatable {
    let status: String
    let redemptionId: String?
    let savingsCents: Int?
    let totalSavingsCents: Int?
    let capped: Bool?

    enum CodingKeys: String, CodingKey {
        case status
        case redemptionId = "redemption_id"
        case savingsCents = "savings_cents"
        case totalSavingsCents = "total_savings_cents"
        case capped
    }
}

/// Body for `POST /me/offers/events`. Impression and click events; the
/// redeem path goes through `POST /me/redemptions` instead.
struct EBTOfferEvent: Codable, Equatable {
    let offerId: String
    let eventType: EventType
    let countyFips: String?
    let occurredAt: Date

    enum EventType: String, Codable {
        case impression
        case click
    }

    enum CodingKeys: String, CodingKey {
        case offerId = "offer_id"
        case eventType = "event_type"
        case countyFips = "county_fips"
        case occurredAt = "occurred_at"
    }
}
