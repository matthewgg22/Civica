import SwiftUI

// NavigationStack wrapper for the Recertification Companion module.
//
// This is the surface CivicaRootView mounts when the user's status is
// .recertDue and RecertCompanionFeatureFlag.isEnabled is true. Inside
// CivicaEntryView (first-launch tile), the tile pushes
// RecertCompanionRoot directly into the existing NavigationStack.
//
// Keeping this thin wrapper lets us own our own stack when we're the
// root surface (recertDue routing) without affecting how we render
// when pushed onto someone else's stack (entry-tile routing).

struct RecertCompanionFlowView: View {
    var body: some View {
        NavigationStack {
            RecertCompanionRoot()
        }
    }
}

#if DEBUG
struct RecertCompanionFlowView_Previews: PreviewProvider {
    static var previews: some View {
        RecertCompanionFlowView()
    }
}
#endif
