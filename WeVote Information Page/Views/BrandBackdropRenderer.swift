import MapKit

final class BrandBackdropRenderer: MKOverlayRenderer {
    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        let drawRect = rect(for: mapRect)
        context.setFillColor(USStateOverlayStyle.oceanNavy.cgColor)
        context.fill(drawRect)
    }
}
