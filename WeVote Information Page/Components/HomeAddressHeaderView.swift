//
//  HomeAddressHeaderView.swift
//  WeVote Information Page 10044
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import SwiftUI

struct HomeAddressHeaderView: View {
    @Binding var address: String
    var onSubmit: (() -> Void)?

    var body: some View {
        HStack {
            Image(systemName: "house.fill")
                .foregroundColor(.white)
                .padding(.leading, 8)
            TextField("Enter your home address", text: $address, onCommit: {
                onSubmit?()
            })
            .textFieldStyle(RoundedBorderTextFieldStyle())
            .padding(.vertical, 8)
            .padding(.horizontal, 4)
        }
        .padding(.horizontal)
        .background(CivicaColors.ctaBlue)
    }
}
