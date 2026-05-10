import CivicaDesignSystem
import SwiftUI

// Root view for the Civica enrollment app. Mounts the SNAP entry as the
// first surface; future verticals (CalFresh, WIC, etc.) plug in here.

struct CivicaRootView: View {
    @StateObject private var snapViewModel = SNAPApplicationViewModel()

    var body: some View {
        NavigationStack {
            SNAPEntryView(viewModel: snapViewModel)
        }
        .tint(CivicaColors.brickPrimary)
    }
}

#if DEBUG
struct CivicaRootView_Previews: PreviewProvider {
    static var previews: some View {
        CivicaRootView()
    }
}
#endif
