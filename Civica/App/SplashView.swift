// SplashView.swift
// Civica · SNAP — Splash with Riso wordmark treatment
// Locked motion: 1100ms total · 400ms entry + variable hold + 400ms exit
// Locked palette: paper #F5F2EC bg · bright #E54B3C front · deep #9C3A24 back

import SwiftUI

// MARK: - Splash overlay

struct SplashView: View {
    /// Flip to true once session hydration AND the minimum 200ms hold are done.
    let ready: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var opacity: Double { ready ? 0 : 1 }
    private var scale: CGFloat   { ready ? 1.06 : 1.00 }

    var body: some View {
        ZStack {
            Color.civicaPaper
                .ignoresSafeArea()

            RisoWordmark(
                frontColor: .civicaBrickPop,
                backColor: .civicaBrick,
                size: CGSize(width: 233, height: 93),
                offset: CGSize(width: 4, height: 4)   // 4.5% of fontSize at 93pt
            )
            .opacity(opacity)
            .scaleEffect(scale)
            .animation(animation, value: ready)
        }
        .opacity(opacity)
        .animation(animation, value: ready)
        .allowsHitTesting(!ready)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Civica is loading"))
    }

    private var animation: Animation {
        if reduceMotion {
            return .easeInOut(duration: 0.2)
        }
        return ready
            ? .easeIn(duration: 0.4)
            : .easeOut(duration: 0.4)
    }
}

// MARK: - Riso wordmark
//
// Same single-color template asset rendered twice:
//   • back layer — deep brick, offset down-right
//   • front layer — bright brick, in place
// Both layers animate as a unit so the offset stays locked during scale.

struct RisoWordmark: View {
    let frontColor: Color
    let backColor: Color
    let size: CGSize
    let offset: CGSize

    var body: some View {
        ZStack {
            wordmark(color: backColor)
                .offset(x: offset.width, y: offset.height)
            wordmark(color: frontColor)
        }
        .frame(width: size.width + offset.width,
               height: size.height + offset.height,
               alignment: .topLeading)
    }

    @ViewBuilder
    private func wordmark(color: Color) -> some View {
        Image("civica-wordmark")
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .frame(width: size.width, height: size.height)
            .foregroundStyle(color)
    }
}

// MARK: - Preview

#Preview("Splash · Riso") {
    SplashPreview()
}

private struct SplashPreview: View {
    @State private var ready = false

    var body: some View {
        ZStack {
            Color.civicaPaper
                .overlay(alignment: .top) {
                    Color.civicaTeal
                        .frame(height: 64)
                        .padding(.top, 60)
                }
                .opacity(ready ? 1 : 0)
                .animation(.easeIn(duration: 0.4), value: ready)

            SplashView(ready: ready)
        }
        .task {
            try? await Task.sleep(for: .milliseconds(700))
            ready = true
        }
    }
}
