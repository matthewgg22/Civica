import Foundation
import MapKit

final class MapGeometryStore {
    struct StateGeometry {
        let stateCode: String
        let overlays: [MKOverlay]
        let mapRect: MKMapRect
    }

    struct GeometryBundle {
        let worldLand: [MKOverlay]
        let nationalStates: [StateGeometry]
        let focusStatesByCode: [String: StateGeometry]
    }

    static let shared = MapGeometryStore()

    private var cached: GeometryBundle?

    private init() {}

    func loadIfNeeded(bundle: Bundle = .main) -> GeometryBundle? {
        if let cached { return cached }

        guard
            let worldData = dataResource(named: "world_land_110m", ext: "geojson", bundle: bundle),
            let focusData = dataResource(named: "us_states_focus", ext: "geojson", bundle: bundle),
            let nationalData = dataResource(named: "us_contiguous_national", ext: "geojson", bundle: bundle)
        else {
            return nil
        }

        do {
            let worldLand = try decodeWorldLand(from: worldData)
            let focusStates = try decodeStateGeometries(from: focusData)
            let nationalStates = try decodeStateGeometries(from: nationalData)

            let bundleValue = GeometryBundle(
                worldLand: worldLand,
                nationalStates: nationalStates,
                focusStatesByCode: Dictionary(uniqueKeysWithValues: focusStates.map { ($0.stateCode, $0) })
            )
            cached = bundleValue
            return bundleValue
        } catch {
            return nil
        }
    }

    private func dataResource(named: String, ext: String, bundle: Bundle) -> Data? {
        let preferredPath = "MapAssets/\(named)"
        if let url = bundle.url(forResource: preferredPath, withExtension: ext) {
            return try? Data(contentsOf: url)
        }
        if let url = bundle.url(forResource: named, withExtension: ext) {
            return try? Data(contentsOf: url)
        }
        return nil
    }

    private func decodeWorldLand(from data: Data) throws -> [MKOverlay] {
        let objects = try MKGeoJSONDecoder().decode(data)
        var overlays: [MKOverlay] = []

        for object in objects {
            guard let feature = object as? MKGeoJSONFeature else { continue }
            overlays.append(contentsOf: overlaysForGeometries(feature.geometry))
        }

        return overlays
    }

    private func decodeStateGeometries(from data: Data) throws -> [StateGeometry] {
        let objects = try MKGeoJSONDecoder().decode(data)
        var states: [StateGeometry] = []

        for object in objects {
            guard let feature = object as? MKGeoJSONFeature else { continue }
            let properties = parseProperties(feature.properties)
            guard
                let stateCode = (properties["state_code"] as? String)?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .uppercased(),
                !stateCode.isEmpty
            else {
                continue
            }

            let overlays = overlaysForGeometries(feature.geometry)
            guard !overlays.isEmpty else { continue }

            var mapRect = overlays[0].boundingMapRect
            for overlay in overlays.dropFirst() {
                mapRect = mapRect.union(overlay.boundingMapRect)
            }

            states.append(
                StateGeometry(
                    stateCode: stateCode,
                    overlays: overlays,
                    mapRect: mapRect
                )
            )
        }

        return states.sorted { $0.stateCode < $1.stateCode }
    }

    private func overlaysForGeometries(_ geometries: [MKGeoJSONObject]) -> [MKOverlay] {
        var overlays: [MKOverlay] = []

        for geometry in geometries {
            if let polygon = geometry as? MKPolygon {
                overlays.append(polygon)
            } else if let multiPolygon = geometry as? MKMultiPolygon {
                overlays.append(multiPolygon)
            }
        }

        return overlays
    }

    private func parseProperties(_ data: Data?) -> [String: Any] {
        guard
            let data,
            let object = try? JSONSerialization.jsonObject(with: data),
            let dictionary = object as? [String: Any]
        else {
            return [:]
        }
        return dictionary
    }
}
