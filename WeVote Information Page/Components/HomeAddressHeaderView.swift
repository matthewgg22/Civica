//
//  HomeAddressHeaderView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import CivicaDesignSystem
import SwiftUI

struct HomeAddressHeaderView: View {
    @Binding var address: String
    var onSubmit: (() -> Void)?

    var body: some View {
        HStack {
            Image(systemName: "house.fill")
                .foregroundColor(.white)
                .padding(.leading, CivicaSpacing.sm)
            TextField("Enter your home address", text: $address, onCommit: {
                onSubmit?()
            })
            .textFieldStyle(RoundedBorderTextFieldStyle())
            .padding(.vertical, CivicaSpacing.sm)
            .padding(.horizontal, CivicaSpacing.xs)
        }
        .padding(.horizontal)
        .background(CivicaColors.ctaBlue)
    }
}
