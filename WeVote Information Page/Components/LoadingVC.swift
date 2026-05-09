//
//  LoadingVC.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/9/25.
//

import SwiftUI

struct LoadingVC: View {
    var body: some View {
        ZStack {
            // Semi-transparent black background covers the whole screen.
            CivicaColors.primaryText.opacity(0.5)
                .ignoresSafeArea()
            
            // Vertical stack for the progress indicator and text.
            VStack(spacing: 20) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    .scaleEffect(1.5)
                
                Text("Loading...")
                    .foregroundColor(.white)
                    .font(.headline)
            }
        }
    }
}

struct LoadingVC_Previews: PreviewProvider {
    static var previews: some View {
        LoadingVC()
    }
}
