import Foundation
import CoreLocation

actor PoliticalGeographyService {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func enrich(coordinate: CLLocationCoordinate2D, stateCode: String?) async -> PoliticalGeography? {
        let normalizedState = stateCode?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased() ?? ""

        guard let endpoint = endpointURL(for: coordinate) else {
            return fallback(stateCode: normalizedState)
        }

        do {
            var request = URLRequest(url: endpoint)
            request.timeoutInterval = 6
            request.httpMethod = "GET"
            request.setValue("application/json", forHTTPHeaderField: "Accept")

            let (data, response) = try await session.data(for: request)
            guard
                let http = response as? HTTPURLResponse,
                (200...299).contains(http.statusCode),
                let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                return fallback(stateCode: normalizedState)
            }

            let countyName = countyName(from: payload)
            let district = congressionalDistrict(from: payload, stateCode: normalizedState)

            guard !normalizedState.isEmpty else {
                return nil
            }

            return PoliticalGeography(
                stateCode: normalizedState,
                countyName: countyName,
                congressionalDistrict: district
            )
        } catch {
            return fallback(stateCode: normalizedState)
        }
    }

    private func endpointURL(for coordinate: CLLocationCoordinate2D) -> URL? {
        var components = URLComponents(string: "https://geocoding.geo.census.gov/geocoder/geographies/coordinates")
        components?.queryItems = [
            URLQueryItem(name: "x", value: String(format: "%.6f", coordinate.longitude)),
            URLQueryItem(name: "y", value: String(format: "%.6f", coordinate.latitude)),
            URLQueryItem(name: "benchmark", value: "Public_AR_Current"),
            URLQueryItem(name: "vintage", value: "Current_Current"),
            URLQueryItem(name: "format", value: "json")
        ]
        return components?.url
    }

    private func countyName(from payload: [String: Any]) -> String? {
        guard
            let result = payload["result"] as? [String: Any],
            let geographies = result["geographies"] as? [String: Any]
        else {
            return nil
        }

        for (key, value) in geographies {
            guard key.lowercased().contains("count") else { continue }
            guard
                let rows = value as? [[String: Any]],
                let first = rows.first
            else {
                continue
            }

            if let name = first["NAME"] as? String, !name.isEmpty {
                return name
            }
            if let namelsad = first["NAMELSAD"] as? String, !namelsad.isEmpty {
                return namelsad
            }
        }

        return nil
    }

    private func congressionalDistrict(from payload: [String: Any], stateCode: String) -> String? {
        guard
            let result = payload["result"] as? [String: Any],
            let geographies = result["geographies"] as? [String: Any]
        else {
            return nil
        }

        for (key, value) in geographies {
            guard key.lowercased().contains("congressional") else { continue }
            guard
                let rows = value as? [[String: Any]],
                let first = rows.first
            else {
                continue
            }

            let candidates: [String?] = [
                first["CD118"] as? String,
                first["DISTRICT"] as? String,
                first["BASENAME"] as? String,
                first["GEOID"] as? String
            ]

            for candidate in candidates {
                if let label = districtLabel(from: candidate, stateCode: stateCode) {
                    return label
                }
            }
        }

        return nil
    }

    private func districtLabel(from raw: String?, stateCode: String) -> String? {
        guard
            let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines),
            !raw.isEmpty,
            !stateCode.isEmpty
        else {
            return nil
        }

        let digits = raw.filter(\.isNumber)
        guard !digits.isEmpty else { return nil }

        let districtDigits: String
        if digits.count >= 2 {
            districtDigits = String(digits.suffix(2))
        } else {
            districtDigits = digits
        }

        if districtDigits == "00" {
            return "\(stateCode)-AL"
        }

        if let districtInt = Int(districtDigits) {
            return "\(stateCode)-\(districtInt)"
        }

        return nil
    }

    private func fallback(stateCode: String) -> PoliticalGeography? {
        guard !stateCode.isEmpty else { return nil }
        return PoliticalGeography(
            stateCode: stateCode,
            countyName: nil,
            congressionalDistrict: nil
        )
    }
}
