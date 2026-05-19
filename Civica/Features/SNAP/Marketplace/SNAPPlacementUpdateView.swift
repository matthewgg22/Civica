import SwiftUI

/// Screen 05 — Post-placement update (quiet competence).
///
/// Notification destination after Argyle confirms the first paycheck.
/// Shows the benefit recalculation, the county-worker notification,
/// and the OBBBA work-hour progress bar.
/// No confetti. No animations except the optional bar fill on first appear.
struct SNAPPlacementUpdateView: View {
    @ObservedObject var vm: SNAPMarketplaceViewModel
    var onSeeBreakdown: () -> Void
    var onReportProblem: () -> Void

    @State private var barProgress: Double = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                heroBlock
                MHairline()
                beforeAfterBlock
                MHairline()
                obbbaLog
                actionsSection
                Spacer(minLength: 32)
            }
        }
        .background(Color.civicaPaper.ignoresSafeArea())
        .navigationTitle("Update")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // 300ms ease-out fill — only on first appearance
            withAnimation(.easeOut(duration: 0.3)) {
                barProgress = vm.obbbaProgress
            }
        }
    }

    // MARK: Hero

    private var heroBlock: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(vm.placementConfirmedDateFormatted)
                .font(MFont.capsLabel)
                .foregroundStyle(Color.civicaGraphite)
                .kerning(1.5)
                .padding(.horizontal, 24)
                .padding(.bottom, 10)

            // "Dining Services · $612 (first paycheck)"
            Group {
                Text("Dining Services · $\(vm.placement.firstPaycheckAmount) ")
                    .font(.custom("HankenGrotesk-SemiBold", size: 20))
                    .foregroundStyle(Color.civicaInk)
                + Text("(first paycheck)")
                    .font(.custom("HankenGrotesk-Medium", size: 20))
                    .foregroundStyle(Color.civicaGraphite)
            }
            .monospacedDigit()
            .padding(.horizontal, 24)
            .accessibilityLabel("Dining Services, $\(vm.placement.firstPaycheckAmount), first paycheck")

            Text("Confirmed via \(vm.placement.confirmationSource) from your direct deposit.")
                .font(MFont.bodySmall)
                .foregroundStyle(Color.civicaGraphite)
                .lineSpacing(15 * 0.45)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 24)
                .padding(.top, 8)
        }
        .padding(.top, 14)
        .padding(.bottom, 18)
    }

    // MARK: Before / after benefit

    private var beforeAfterBlock: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("YOUR BENEFIT ESTIMATE")
                .font(MFont.capsLabel)
                .foregroundStyle(Color.civicaGraphite)
                .kerning(1.5)
                .padding(.bottom, 14)

            HStack(alignment: .bottom, spacing: 18) {
                // Was
                VStack(alignment: .leading, spacing: 2) {
                    Text("WAS")
                        .font(MFont.capsLabel)
                        .foregroundStyle(Color.civicaGraphite)
                        .kerning(1.2)
                    Text("$\(vm.placement.oldBenefit)")
                        .font(MFont.listTitle)
                        .foregroundStyle(Color.civicaGraphite)
                        .strikethrough(true, color: Color.civicaGraphite.opacity(0.6))
                        .monospacedDigit()
                }
                .accessibilityLabel("Was: $\(vm.placement.oldBenefit)")

                // Arrow →
                ArrowRightIcon()
                    .padding(.bottom, 6)
                    .accessibilityHidden(true)

                // Now
                VStack(alignment: .leading, spacing: 2) {
                    Text("NOW")
                        .font(MFont.capsLabel)
                        .foregroundStyle(Color.civicaGraphite)
                        .kerning(1.2)
                    Text("$\(vm.placement.newBenefit)")
                        .font(.custom("HankenGrotesk-SemiBold", size: 24))
                        .foregroundStyle(Color.civicaInk)
                        .monospacedDigit()
                }
                .accessibilityLabel("Now: $\(vm.placement.newBenefit)")
            }

            // Key copy — the "killer copy" per spec
            Text("Your county worker has been notified. No action needed.")
                .font(MFont.metaMedium)
                .foregroundStyle(Color.civicaTeal)
                .lineSpacing(13 * 0.45)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 16)
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
        .padding(.bottom, 8)
    }

    // MARK: OBBBA work-hour log

    private var obbbaLog: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("OBBBA WORK-HOUR LOG")
                .font(MFont.capsLabel)
                .foregroundStyle(Color.civicaGraphite)
                .kerning(1.5)
                .padding(.bottom, 12)

            HStack(alignment: .lastTextBaseline) {
                Text(vm.placement.obbbaMonth)
                    .font(MFont.bodySmallMedium)
                    .foregroundStyle(Color.civicaInk)
                Spacer()
                Group {
                    Text("\(vm.placement.obbbaHoursLogged)")
                        .font(.custom("HankenGrotesk-SemiBold", size: 15))
                    + Text(" of \(vm.placement.obbbaHoursRequired) hours")
                        .font(MFont.bodySmallMedium)
                        .foregroundStyle(Color.civicaGraphite)
                }
                .foregroundStyle(Color.civicaInk)
                .monospacedDigit()
                .accessibilityLabel("\(vm.placement.obbbaHoursLogged) of \(vm.placement.obbbaHoursRequired) hours")
            }
            .padding(.bottom, 10)

            // Progress bar — 12pt tall, radius 999, teal fill
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 999)
                    .fill(Color.civicaGraphite.opacity(0.15))
                    .frame(height: 12)
                GeometryReader { geo in
                    RoundedRectangle(cornerRadius: 999)
                        .fill(Color.civicaTeal)
                        .frame(width: geo.size.width * barProgress, height: 12)
                }
                .frame(height: 12)
            }
            .accessibilityLabel("OBBBA progress: \(vm.placement.obbbaHoursLogged) of \(vm.placement.obbbaHoursRequired) hours")
            .accessibilityValue("\(Int(vm.obbbaProgress * 100)) percent")

            Text("Civica auto-counts hours from your verified employer. No timesheet to submit.")
                .font(MFont.meta)
                .foregroundStyle(Color.civicaGraphite)
                .lineSpacing(13 * 0.45)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
        .padding(.bottom, 8)
    }

    // MARK: Actions

    private var actionsSection: some View {
        VStack(spacing: 0) {
            MBrickOutlineButton(label: "See full benefit breakdown") {
                onSeeBreakdown()
            }
            .accessibilityLabel("See full benefit breakdown")

            MTealTextLink(label: "Report a problem") {
                onReportProblem()
            }
            .padding(.top, 14)
        }
        .padding(.top, 24)
        .padding(.bottom, 16)
    }
}

// MARK: - Arrow right icon (22×14pt)

private struct ArrowRightIcon: View {
    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height
            var p = Path()
            // Horizontal shaft
            p.move(to: CGPoint(x: w * 1/22, y: h * 7/14))
            p.addLine(to: CGPoint(x: w * 20/22, y: h * 7/14))
            // Arrowhead up
            p.move(to: CGPoint(x: w * 20/22, y: h * 7/14))
            p.addLine(to: CGPoint(x: w * 14/22, y: h * 1.5/14))
            // Arrowhead down
            p.move(to: CGPoint(x: w * 20/22, y: h * 7/14))
            p.addLine(to: CGPoint(x: w * 14/22, y: h * 12.5/14))
            ctx.stroke(p, with: .color(Color.civicaGraphite),
                       style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round))
        }
        .frame(width: 22, height: 14)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        SNAPPlacementUpdateView(
            vm: SNAPMarketplaceViewModel(),
            onSeeBreakdown: {},
            onReportProblem: {}
        )
    }
}
#endif
