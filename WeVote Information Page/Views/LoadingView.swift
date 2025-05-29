//
//  LoadingView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import SwiftUI

struct LoadingView: View {
    // List of voting quotes.
    let quotes: [String] = [
        "To vote is to recognize that your voice matters in shaping the world.\n— Unknown",
        "If we don't vote, we are ignoring history and giving away the future.\n— Pat Mitchell",
        "I believe that voting is the first act of building a community as well as building a country.\n— John Ensign",
        "Your vote is your seat at the table. Don't give it up.\n— Inspired by Shirley Chisholm",
        "Not voting is not a protest. It is a surrender.\n— Keith Ellison",
        "We do not have government by the majority. We have government by the majority who participate.\n— Attributed to Thomas Jefferson",
        "Voting is the expression of our commitment to ourselves, one another, this country, and this world.\n— Sharon Salzberg",
        "Every election is determined by the people who show up.\n— Larry J. Sabato",
        "Talk is cheap, voting is free; take it to the polls.\n— Nanette L. Avery",
        "Democracy is not a spectator sport.\n— Marian Wright Edelman",
        "A man without a vote is a man without protection.\n— Lyndon B. Johnson",
        "Our lives begin to end the day we become silent about things that matter.\n— Commonly attributed to Martin Luther King Jr.",
        "Voting is not only our right—it is our power.\n— Loung Ung",
        "Bad officials are elected by good citizens who do not vote.\n— George Jean Nathan",
        "The vote is the most powerful nonviolent tool we have.\n— John Lewis",
        "Someone struggled for your right to vote. Use it.\n— Susan B. Anthony",
        "Change doesn't roll in on the wheels of inevitability... it comes through continuous struggle. Vote.\n— Inspired by Martin Luther King Jr."
    ]
    
    @State private var currentQuote: String = ""
    @State private var textOpacity: Double = 1.0
    @State private var reveals: [CGFloat] = Array(repeating: 0, count: 6)
    
    let imageNames = [
        "logo load 1",
        "logo load 2",
        "logo load 3",
        "logo load 4",
        "logo load 5",
        "logo load 6"
    ]
    
    // Adjusted reveal duration to ≈1.61s per image, staggered.
    let revealDuration: Double = 1.2375 * 1.60 * 1.50 * 1.30 * 0.8 * 0.65 * 0.8
    let cycleInterval: Double = 10

    var body: some View {
        ZStack {
            Color.black.opacity(0.5)
                .edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 30) {
                VStack(spacing: -200) {
                    ForEach(0..<imageNames.count, id: \.self) { i in
                        Image(imageNames[i])
                            .resizable()
                            .scaledToFit()
                            .frame(width: 200)
                            .clipped()
                            .mask(
                                GeometryReader { geo in
                                    Rectangle()
                                        .frame(width: reveals[i], height: geo.size.height)
                                        .alignmentGuide(.leading) { _ in 0 }
                                }
                            )
                    }
                }
                
                Text(currentQuote)
                    .foregroundColor(.white)
                    .font(.headline)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 30)
                    .opacity(textOpacity)
            }
        }
        .onAppear {
            startAnimationCycle()
            Timer.scheduledTimer(withTimeInterval: cycleInterval, repeats: true) { _ in
                startAnimationCycle()
            }
        }
    }
    
    func startAnimationCycle() {
        // Fade out text
        withAnimation(.easeOut(duration: 0.2)) { textOpacity = 0 }
        // After fade, switch quote and fade back in
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            currentQuote = quotes.randomElement() ?? "Loading..."
            withAnimation(.easeIn(duration: 0.2)) { textOpacity = 1 }
        }
        // Reset reveals
        reveals = Array(repeating: 0, count: imageNames.count)
        // Animate each image
        for i in 0..<imageNames.count {
            let delay = revealDuration * Double(i)
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                withAnimation(.easeOut(duration: revealDuration)) {
                    reveals[i] = 200
                }
            }
        }
    }
}

struct LoadingView_Previews: PreviewProvider {
    static var previews: some View {
        LoadingView()
    }
}

