import CivicaDesignSystem
import SwiftUI

struct EmojiParticle: Identifiable, Equatable {
    let id = UUID()
    let emoji: String
    let startX: CGFloat // 0...1
    let horizontalDrift: CGFloat
    let startTime: Date
    let duration: TimeInterval
    let size: CGFloat
    let rotation: Double
    let delay: TimeInterval
    let wobblePhase: Double
}

@MainActor
final class EmojiWaterfallController: ObservableObject {
    @Published private(set) var particles: [EmojiParticle] = []
    @Published private(set) var isActive = false

    private var cleanupTask: Task<Void, Never>?
    private var runID = UUID()

    func trigger(reduceMotion: Bool) {
        cleanupTask?.cancel()
        runID = UUID()
        let currentRun = runID

        let now = Date()
        let burstCount = reduceMotion ? 5 : Int.random(in: 9...14)
        var delayCursor: TimeInterval = 0
        var generated: [EmojiParticle] = []

        for _ in 0..<burstCount {
            let burstDelay = Double.random(in: 0.13...0.22)
            delayCursor += burstDelay
            let perBurst = reduceMotion ? Int.random(in: 8...12) : Int.random(in: 14...24)

            for _ in 0..<perBurst {
                let roll = Double.random(in: 0...1)
                let emoji: String
                if roll < 0.60 {
                    emoji = "🦅"
                } else if roll < 0.85 {
                    emoji = "🇺🇸"
                } else {
                    emoji = "🗽"
                }
                let particle = EmojiParticle(
                    emoji: emoji,
                    startX: CGFloat.random(in: 0.02...0.98),
                    horizontalDrift: reduceMotion ? 0 : CGFloat.random(in: -32...32),
                    startTime: now,
                    duration: reduceMotion ? Double.random(in: 1.4...1.8) : Double.random(in: 2.4...3.4),
                    size: reduceMotion ? CGFloat.random(in: 18...22) : CGFloat.random(in: 18...28),
                    rotation: reduceMotion ? 0 : Double.random(in: -26...26),
                    delay: delayCursor,
                    wobblePhase: Double.random(in: 0...(Double.pi * 2))
                )
                generated.append(particle)
            }
        }

        particles = generated
        isActive = true

        let maxDuration = generated.map { $0.delay + $0.duration }.max() ?? 0
        let lifetime = maxDuration + 0.35

        cleanupTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(lifetime * 1_000_000_000))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard self.runID == currentRun else { return }
                self.isActive = false
                self.particles = []
            }
        }
    }

    func stop() {
        cleanupTask?.cancel()
        cleanupTask = nil
        isActive = false
        particles = []
    }
}

struct EmojiWaterfallView: View {
    @ObservedObject var controller: EmojiWaterfallController
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            TimelineView(.animation(minimumInterval: 1.0 / 40.0)) { context in
                let now = context.date

                ZStack(alignment: .topLeading) {
                    ForEach(controller.particles) { particle in
                        if let style = style(for: particle, now: now, size: geo.size) {
                            Text(particle.emoji)
                                .font(.system(size: style.fontSize))
                                .rotationEffect(.degrees(style.rotation))
                                .opacity(style.opacity)
                                .position(x: style.x, y: style.y)
                        }
                    }
                }
            }
        }
        .opacity(controller.isActive ? 1 : 0)
        .animation(reduceMotion ? nil : CivicaAnimation.snap, value: controller.isActive)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func style(for particle: EmojiParticle, now: Date, size: CGSize) -> ParticleStyle? {
        let elapsed = now.timeIntervalSince(particle.startTime) - particle.delay
        guard elapsed >= 0 else { return nil }

        let progress = min(max(elapsed / max(0.01, particle.duration), 0), 1)
        guard progress < 1 else { return nil }

        let cardWidth = max(1, size.width)
        let cardHeight = max(1, size.height)

        var x = particle.startX * cardWidth
        if !reduceMotion {
            x += particle.horizontalDrift * CGFloat(progress)
            let wobble = sin((CGFloat(progress) * 11) + CGFloat(particle.wobblePhase))
            x += wobble * (6 * (1 - CGFloat(progress)))
        }

        let y = -20 + pow(progress, 1.03) * (cardHeight + 60)

        let fadeIn = min(1, progress / 0.08)
        let fadeOut = progress > 0.84 ? (1 - progress) / 0.16 : 1
        let opacity = max(0, min(1, fadeIn * fadeOut))

        let rotation = reduceMotion ? 0 : particle.rotation * progress

        return ParticleStyle(
            x: min(max(0, x), cardWidth),
            y: y,
            opacity: opacity,
            rotation: rotation,
            fontSize: particle.size
        )
    }
}

private struct ParticleStyle {
    let x: CGFloat
    let y: CGFloat
    let opacity: Double
    let rotation: Double
    let fontSize: CGFloat
}
