//
//  SharedUI.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//

import SwiftUI

struct PageHeader: View {
    let title: String
    var body: some View {
        Text(title)
            .font(.largeTitle)
            .fontWeight(.bold)
            .padding(.top)
            .padding(.horizontal)
    }
}
