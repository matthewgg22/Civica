import MapKit
import UIKit

/// Color + glyph + cached teardrop image for every pin category on the
/// FindHelp map. Lifted out of `FindHelpAnnotationView` so the table
/// has a single home; the annotation view becomes a thin consumer.
///
/// Pin colors by (record_kind, service_type / retailer_category):
///   • Help directory + SNAP application help → Brick #9C3A24
///   • Help directory + Food assistance       → Teal  #2A6F66
///   • Help directory + Both                  → Graphite #3A342E
///   • EBT retailer  + Supermarket            → Teal-deep #1F4F4A
///   • EBT retailer  + Small grocer           → Amber #B5762A
///   • EBT retailer  + Farmers market         → Green #3B6B33
///   • EBT retailer  + Co-op                  → Indigo #3D4E6E
///   • EBT retailer  + Restaurant RMP         → Brick #9C3A24
///
/// Glyphs are SF Symbols rendered in paper-cream inside the bulb.
///
/// Teardrop renders are cached in a static `[String: UIImage]` keyed
/// by `categoryKey`. There are 8 unique combinations, so the cache
/// stops growing after the first time each appears on screen — at
/// 24k-row scale (CA) this avoids re-rasterizing the same path
/// hundreds of times per pan/zoom as annotation views are recycled.
enum FindHelpPinPalette {
    static let teardropSize = CGSize(width: 28, height: 35)
    static let paperColor = UIColor(red: 0xF5/255, green: 0xF2/255, blue: 0xEC/255, alpha: 1)
    static let graphite = UIColor(red: 0x3A/255, green: 0x34/255, blue: 0x2E/255, alpha: 1)
    /// Lighter graphite used only for MIXED-category cluster pins on
    /// the map. The single-pin graphite above is too dark to read
    /// against dark-mode map tiles when applied to MKMarkerAnnotation
    /// View's rounded-rect marker; this lifts the cluster off the tile
    /// without changing the teardrop fill semantics for individual
    /// help-directory "both" pins.
    static let mixedClusterColor = UIColor(red: 0x6E/255, green: 0x66/255, blue: 0x5E/255, alpha: 1)

    private static let brickColor = UIColor(red: 0x9C/255, green: 0x3A/255, blue: 0x24/255, alpha: 1)
    private static let tealColor = UIColor(red: 0x2A/255, green: 0x6F/255, blue: 0x66/255, alpha: 1)
    private static let tealDeepColor = UIColor(red: 0x1F/255, green: 0x4F/255, blue: 0x4A/255, alpha: 1)
    private static let amberColor = UIColor(red: 0xB5/255, green: 0x76/255, blue: 0x2A/255, alpha: 1)
    private static let greenColor = UIColor(red: 0x3B/255, green: 0x6B/255, blue: 0x33/255, alpha: 1)
    private static let indigoColor = UIColor(red: 0x3D/255, green: 0x4E/255, blue: 0x6E/255, alpha: 1)

    /// Stable key identifying a (record_kind, inner-axis) pair. Used
    /// both for clustering-color decisions and as the cache key for
    /// the rendered teardrop image.
    static func categoryKey(for location: FindHelpLocation) -> String {
        let kind = location.resolvedRecordKind.rawValue
        let inner = location.retailerCategory?.rawValue
            ?? location.primaryServiceType.rawValue
        return "\(kind):\(inner)"
    }

    static func color(for location: FindHelpLocation) -> UIColor {
        switch location.resolvedRecordKind {
        case .helpDirectory:
            switch location.primaryServiceType {
            case .snapApplicationHelp: return brickColor
            case .foodAssistance:      return tealColor
            case .both:                return graphite
            }
        case .ebtRetailer:
            switch location.retailerCategory ?? .supermarket {
            case .supermarket:   return tealDeepColor
            case .smallGrocer:   return amberColor
            case .farmersMarket: return greenColor
            case .coOp:          return indigoColor
            case .restaurantRMP: return brickColor
            }
        }
    }

    static func glyphSymbolName(for location: FindHelpLocation) -> String {
        switch location.resolvedRecordKind {
        case .helpDirectory:
            switch location.primaryServiceType {
            case .snapApplicationHelp: return "doc.text.fill"
            case .foodAssistance:      return "takeoutbag.and.cup.and.straw.fill"
            case .both:                return "square.stack.fill"
            }
        case .ebtRetailer:
            switch location.retailerCategory ?? .supermarket {
            case .supermarket:    return "cart.fill"
            case .smallGrocer:    return "basket.fill"
            case .farmersMarket:  return "leaf.fill"
            case .coOp:           return "building.2.fill"
            case .restaurantRMP:  return "fork.knife"
            }
        }
    }

    /// Cluster color picker: when every member shares one category the
    /// cluster takes that color; otherwise `mixedClusterColor` signals
    /// "multiple kinds nearby" without misleading hue.
    static func dominantColor(in annotations: [MKAnnotation]) -> UIColor {
        let locations = annotations.compactMap { ($0 as? FindHelpAnnotation)?.location }
        guard let first = locations.first else { return mixedClusterColor }
        let firstKey = categoryKey(for: first)
        let allSame = locations.allSatisfy { categoryKey(for: $0) == firstKey }
        return allSame ? color(for: first) : mixedClusterColor
    }

    /// Cached teardrop image for a location's pin category. First call
    /// per category rasterizes the bezier path; subsequent calls return
    /// the same UIImage instance.
    static func teardropImage(for location: FindHelpLocation) -> UIImage {
        let key = categoryKey(for: location)
        if let cached = imageCache[key] { return cached }
        let image = renderTeardrop(
            fillColor: color(for: location),
            glyphName: glyphSymbolName(for: location)
        )
        imageCache[key] = image
        return image
    }

    private static var imageCache: [String: UIImage] = [:]

    private static func renderTeardrop(fillColor: UIColor, glyphName: String) -> UIImage {
        let size = teardropSize
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in
            // Teardrop path — bulb top, point bottom. Bezier control
            // points map to the SVG curve commands in the canvas spec.
            let path = UIBezierPath()
            path.move(to: CGPoint(x: 14, y: 0))
            path.addCurve(
                to: CGPoint(x: 0, y: 14),
                controlPoint1: CGPoint(x: 6, y: 0),
                controlPoint2: CGPoint(x: 0, y: 6)
            )
            path.addCurve(
                to: CGPoint(x: 14, y: 35),
                controlPoint1: CGPoint(x: 0, y: 22),
                controlPoint2: CGPoint(x: 14, y: 35)
            )
            path.addCurve(
                to: CGPoint(x: 28, y: 14),
                controlPoint1: CGPoint(x: 14, y: 35),
                controlPoint2: CGPoint(x: 28, y: 22)
            )
            path.addCurve(
                to: CGPoint(x: 14, y: 0),
                controlPoint1: CGPoint(x: 28, y: 6),
                controlPoint2: CGPoint(x: 22, y: 0)
            )
            path.close()
            fillColor.setFill()
            path.fill()

            // Category glyph inside the bulb. 10pt semibold reads
            // legibly at the teardrop's small render size; centered
            // horizontally and vertically at y=15 to match where the
            // legacy paper-dot's visual center sat.
            let symbolConfig = UIImage.SymbolConfiguration(pointSize: 10, weight: .semibold)
            if let symbol = UIImage(systemName: glyphName, withConfiguration: symbolConfig)?
                .withTintColor(paperColor, renderingMode: .alwaysOriginal) {
                let symbolSize = symbol.size
                let symbolRect = CGRect(
                    x: (size.width - symbolSize.width) / 2,
                    y: 15 - symbolSize.height / 2,
                    width: symbolSize.width,
                    height: symbolSize.height
                )
                symbol.draw(in: symbolRect)
            } else {
                // Legacy fallback: plain paper dot. Reached only if
                // the SF Symbol lookup fails (which it shouldn't on
                // any iOS the Civica target deploys to).
                let dotSize: CGFloat = 9
                let dotRect = CGRect(
                    x: (size.width - dotSize) / 2,
                    y: 11,
                    width: dotSize,
                    height: dotSize
                )
                paperColor.setFill()
                UIBezierPath(ovalIn: dotRect).fill()
            }
        }
    }
}
