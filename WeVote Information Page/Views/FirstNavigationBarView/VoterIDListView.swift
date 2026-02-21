import SwiftUI

struct VoterIDListView: View {
    var body: some View {
        List(VoterIDLinks.all) { item in
            Link(item.name, destination: item.url)
        }
        .navigationTitle("Voter ID by State")
    }
}

struct VoterIDListView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            VoterIDListView()
        }
    }
}
