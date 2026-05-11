import CivicaDesignSystem
import SwiftUI

// Civica — SNAP (and CalFresh, eventually) enrollment app.
//
// Separate iOS target from VoteNow (the democracy / civic-engagement app).
// Shares the CivicaDesignSystem package; nothing else. The SNAP/Find Help
// surfaces live under `Civica/Features/SNAP/` and `Civica/Features/SNAP/FindHelp/`.

@main
struct CivicaApp: App {
    init() {
        // Ensure Hanken Grotesk + Atkinson Hyperlegible are registered before
        // any view tries to render text. Same pattern as the existing app.
        CivicaFonts.register()
    }

    var body: some Scene {
        WindowGroup {
            CivicaRootView()
        }
    }
}
