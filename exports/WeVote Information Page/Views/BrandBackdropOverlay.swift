import MapKit

final class BrandBackdropOverlay: NSObject, MKOverlay {
    let coordinate = CLLocationCoordinate2D(latitude: 0, longitude: 0)
    let boundingMapRect = MKMapRect.world

    static func worldBounds() -> BrandBackdropOverlay {
        BrandBackdropOverlay()
    }
}
