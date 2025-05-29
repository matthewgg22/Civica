//
//  MailInBallotView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/20/25.
//

import SwiftUI

struct MailInBallotView: View {
    var body: some View {
        AbsenteeView()
            .navigationTitle("Request Mail-in Ballot")
            .navigationBarTitleDisplayMode(.inline)
    }
}

struct MailInBallotView_Previews: PreviewProvider {
    static var previews: some View {
        MailInBallotView()
    }
}
