import CivicaDesignSystem
import MapKit
import SwiftUI
import UIKit

/// Glyph + cached teardrop image dispatcher for every pin category on
/// the FindHelp map. Lifted out of `FindHelpAnnotationView` so the
/// table has a single home; the annotation view becomes a thin consumer.
///
/// Pin colors source from `CivicaColors.pinX` design tokens (audit
/// DS-7, 2026-05-29). The inline hex literals previously declared
/// here have been deleted — see DESIGN.md §13 (Map Pin tokens) for
/// the cartography palette + rationale.
///
/// Dispatch table by (record_kind, service_type / retailer_category):
///   • Help directory + SNAP application help → `pinFood`         (brick)
///   • Help directory + Food assistance       → `pinHelp`         (teal)
///   • Help directory + Both                  → `pinHelpBoth`     (graphite)
///   • EBT retailer  + Supermarket            → `pinSupermarket`  (teal-deep)
///   • EBT retailer  + Small grocer           → `pinSmallGrocer`  (amber)
///   • EBT retailer  + Farmers market         → `pinFarmersMarket`(green)
///   • EBT retailer  + Co-op                  → `pinCoop`         (indigo)
///   • EBT retailer  + Restaurant RMP         → `pinRestaurant`   (brick)
///
/// Glyphs are SF Symbols rendered in paper inside the bulb.
///
/// Teardrop renders are cached in a static `[String: UIImage]` keyed
/// by `categoryKey`. There are 8 unique combinations, so the cache
/// stops growing after the first time each appears on screen — at
/// 24k-row scale (CA) this avoids re-rasterizing the same path
/// hundreds of times per pan/zoom as annotation views are recycled.
enum FindHelpPinPalette {
    static let teardropSize = CGSize(width: 28, height: 35)

    /// Bulb glyph fill — canonical paper from the design token.
    /// Resolved through `CivicaColors.paper` (#F7F5EF, v2 warm-neutral)
    /// rather than the legacy inline hex (#F5F2EC, pre-v2 paper).
    static let paperColor = UIColor(CivicaColors.paper)

    /// Help-directory "both" pin color — same as `pinHelpBoth` in the
    /// dispatch table. Exposed for callers (e.g. cluster pin code)
    /// that still expect a top-level `graphite` symbol on the palette.
    static let graphite = UIColor(CivicaColors.pinHelpBoth)

    /// Lighter graphite used only for MIXED-category cluster pins on
    /// the map. The single-pin graphite above is too dark to read
    /// against dark-mode map tiles when applied to MKMarkerAnnotation
    /// View's rounded-rect marker; this lifts the cluster off the tile
    /// without changing the teardrop fill semantics for individual
    /// help-directory "both" pins. Not in the §13 pin token set —
    /// cluster-only adaptation; revisit when dark variants land in T7.
    static let mixedClusterColor = UIColor(red: 0x6E/255, green: 0x66/255, blue: 0x5E/255, alpha: 1)

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
            case .snapApplicationHelp: return UIColor(CivicaColors.pinFood)
            case .foodAssistance:      return UIColor(CivicaColors.pinHelp)
            case .both:                return UIColor(CivicaColors.pinHelpBoth)
            }
        case .ebtRetailer:
            switch location.retailerCategory ?? .supermarket {
            case .supermarket:   return UIColor(CivicaColors.pinSupermarket)
            case .smallGrocer:   return UIColor(CivicaColors.pinSmallGrocer)
            case .farmersMarket: return UIColor(CivicaColors.pinFarmersMarket)
            case .coOp:          return UIColor(CivicaColors.pinCoop)
            case .restaurantRMP: return UIColor(CivicaColors.pinRestaurant)
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
