import SwiftUI
import MapKit

struct NationalInsetDescriptor: Codable, Identifiable {
    let id: String
    let anchor: [Double]
    let scale: Double
    let label: String
    let geometryKey: String
    let badgeText: String?

    var anchorX: CGFloat { CGFloat(anchor[safe: 0] ?? 0.5) }
    var anchorY: CGFloat { CGFloat(anchor[safe: 1] ?? 0.5) }
}

struct NationalInsetsOverlayView: View {
    let descriptors: [NationalInsetDescriptor]
    let selectedStateCode: String?
    let onTapState: ((String) -> Void)?
    private static let outlinesByCode: [String: InsetOutline] = loadInsetOutlines()

    init(
        descriptors: [NationalInsetDescriptor] = NationalInsetsOverlayView.loadDescriptors(),
        selectedStateCode: String? = nil,
        onTapState: ((String) -> Void)? = nil
    ) {
        self.descriptors = descriptors
        self.selectedStateCode = selectedStateCode?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        self.onTapState = onTapState
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(descriptors) { descriptor in
                    insetOutline(for: descriptor)
                        .position(
                            x: geometry.size.width * descriptor.anchorX,
                            y: geometry.size.height * descriptor.anchorY
                        )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .allowsHitTesting(onTapState != nil)
    }

    @ViewBuilder
    private func insetOutline(for descriptor: NationalInsetDescriptor) -> some View {
        if let outline = Self.outlinesByCode[descriptor.geometryKey] {
            let scale = CGFloat(max(descriptor.scale, 0.40))
            let width = 88 * scale
            let height = 62 * scale
            let normalizedCode = descriptor.geometryKey.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            let isSelected = normalizedCode == selectedStateCode
            let fillColor = isSelected
                ? Color(USStateOverlayStyle.brandBlue).opacity(0.92)
                : Color(USStateOverlayStyle.nationalStateFill).opacity(0.96)
            let strokeColor = isSelected
                ? Color(USStateOverlayStyle.brandRed).opacity(0.98)
                : Color(USStateOverlayStyle.nationalStateBorder).opacity(0.95)
            let lineWidth: CGFloat = isSelected ? 1.4 : 1.0

            InsetOutlineShape(outline: outline)
                .fill(fillColor)
                .overlay(
                    InsetOutlineShape(outline: outline)
                        .stroke(strokeColor, lineWidth: lineWidth)
                )
                .frame(width: width, height: height)
                .shadow(color: Color.black.opacity(0.14), radius: 1.2, x: 0, y: 0.8)
                .contentShape(Rectangle())
                .onTapGesture {
                    onTapState?(normalizedCode)
                }
        }
    }

    private static func loadDescriptors(bundle: Bundle = .main) -> [NationalInsetDescriptor] {
        let candidateNames = ["MapAssets/national_insets", "national_insets"]

        for name in candidateNames {
            if let url = bundle.url(forResource: name, withExtension: "json"),
               let data = try? Data(contentsOf: url),
               let decoded = try? JSONDecoder().decode([String: NationalInsetPayload].self, from: data) {
                return decoded
                    .map { key, value in
                        NationalInsetDescriptor(
                            id: key,
                            anchor: value.anchor,
                            scale: value.scale,
                            label: value.label,
                            geometryKey: value.geometryKey,
                            badgeText: value.badgeText
                        )
                    }
                    .sorted { $0.id < $1.id }
            }
        }

        return []
    }

    private static func loadInsetOutlines() -> [String: InsetOutline] {
        guard let geometryBundle = MapGeometryStore.shared.loadIfNeeded() else {
            return [:]
        }

        let targetCodes = ["AK", "HI", "PR", "GU", "VI", "AS", "MP"]
        var outlines: [String: InsetOutline] = [:]
        for code in targetCodes {
            guard let stateGeometry = geometryBundle.focusStatesByCode[code] else { continue }
            guard let outline = InsetOutline(stateGeometry: stateGeometry) else { continue }
            outlines[code] = outline
        }
        return outlines
    }

    private struct InsetOutline {
        let bounds: MKMapRect
        let rings: [[MKMapPoint]]

        init?(stateGeometry: MapGeometryStore.StateGeometry) {
            let extractedRings = Self.extractRings(from: stateGeometry.overlays)
            guard !extractedRings.isEmpty else { return nil }
            self.bounds = stateGeometry.mapRect
            self.rings = extractedRings
        }

        func path(in rect: CGRect) -> Path {
            guard bounds.size.width > 0, bounds.size.height > 0 else { return Path() }

            let scaleX = rect.width / bounds.size.width
            let scaleY = rect.height / bounds.size.height
            let scale = min(scaleX, scaleY)
            let contentWidth = bounds.size.width * scale
            let contentHeight = bounds.size.height * scale
            let originX = rect.midX - (contentWidth / 2)
            let originY = rect.midY - (contentHeight / 2)

            var path = Path()
            for ring in rings where !ring.isEmpty {
                path.move(to: point(for: ring[0], scale: scale, originX: originX, originY: originY))
                for point in ring.dropFirst() {
                    path.addLine(to: self.point(for: point, scale: scale, originX: originX, originY: originY))
                }
                path.closeSubpath()
            }
            return path
        }

        private func point(for mapPoint: MKMapPoint, scale: CGFloat, originX: CGFloat, originY: CGFloat) -> CGPoint {
            CGPoint(
                x: originX + CGFloat(mapPoint.x - bounds.origin.x) * scale,
                y: originY + CGFloat(mapPoint.y - bounds.origin.y) * scale
            )
        }

        private static func extractRings(from overlays: [MKOverlay]) -> [[MKMapPoint]] {
            var rings: [[MKMapPoint]] = []
            for overlay in overlays {
                if let polygon = overlay as? MKPolygon {
                    if let ring = ring(from: polygon) {
                        rings.append(ring)
                    }
                } else if let multiPolygon = overlay as? MKMultiPolygon {
                    for polygon in multiPolygon.polygons {
                        if let ring = ring(from: polygon) {
                            rings.append(ring)
                        }
                    }
                }
            }
            return rings
        }

        private static func ring(from polygon: MKPolygon) -> [MKMapPoint]? {
            let count = polygon.pointCount
            guard count > 1 else { return nil }
            let pointer = polygon.points()
            return (0..<count).map { pointer[$0] }
        }
    }

    private struct InsetOutlineShape: Shape {
        let outline: InsetOutline

        func path(in rect: CGRect) -> Path {
            outline.path(in: rect)
        }
    }

    private struct NationalInsetPayload: Codable {
        let anchor: [Double]
        let scale: Double
        let label: String
        let geometryKey: String
        let badgeText: String?
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        guard indices.contains(index) else { return nil }
        return self[index]
    }
}
