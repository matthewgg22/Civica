//
//  MapvShareCardView.swift
//  VoteNow
//
//  Created by Matthew Greer-Gentis on 2/20/26.
//

import SwiftUI
import CoreImage.CIFilterBuiltins

struct MapvShareCardView: View {
    let title: String
    let electionName: String
    let voteDateText: String
    let voteTimeText: String
    let locationLine1: String
    let locationLine2: String?
    let shareURLString: String

    var body: some View {
        ZStack {
            // Solid background for iMessage rendering
            LinearGradient(
                colors: [Color(.systemBackground), Color(.secondarySystemBackground)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 20) {
                header
                details
                Spacer(minLength: 0)
                footer
            }
            .padding(48)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Civica")
                .font(.system(size: 20, weight: .semibold))
                .opacity(0.8)

            Text(title) // e.g., “My Plan to Vote”
                .font(.system(size: 44, weight: .bold))
                .lineLimit(2)
                .minimumScaleFactor(0.85)

            Text(electionName)
                .font(.system(size: 22, weight: .medium))
                .opacity(0.9)
                .lineLimit(2)
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 14) {
            infoRow(label: "When", value: "\(voteDateText) • \(voteTimeText)")
            infoRow(label: "Where", value: locationLine1)
            if let l2 = locationLine2, !l2.isEmpty {
                infoRow(label: "", value: l2)
            }

            // Optional hint line (you can swap for real data)
            Text("Tip: Bring any required ID and give yourself extra time for lines.")
                .font(.system(size: 16, weight: .regular))
                .opacity(0.8)
                .padding(.top, 6)
        }
        .padding(22)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color(.systemBackground).opacity(0.85))
                .shadow(radius: 10)
        )
    }

    private var footer: some View {
        HStack(alignment: .center, spacing: 18) {
            QRCodeView(text: shareURLString)
                .frame(width: 140, height: 140)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text("Open this plan")
                    .font(.system(size: 18, weight: .semibold))
                Text(shareURLString)
                    .font(.system(size: 14, weight: .regular))
                    .opacity(0.75)
                    .lineLimit(2)
            }

            Spacer()
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(Color(.secondarySystemBackground).opacity(0.9))
        )
    }

    private func infoRow(label: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            if !label.isEmpty {
                Text(label)
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 70, alignment: .leading)
                    .opacity(0.85)
            } else {
                Color.clear.frame(width: 70)
            }

            Text(value)
                .font(.system(size: 18, weight: .medium))
                .opacity(0.95)
                .lineLimit(2)
                .minimumScaleFactor(0.9)

            Spacer()
        }
    }
}

struct QRCodeView: View {
    let text: String
    private let context = CIContext()
    private let filter = CIFilter.qrCodeGenerator()

    var body: some View {
        if let uiImage = generateQRCode(from: text) {
            Image(uiImage: uiImage)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
        } else {
            RoundedRectangle(cornerRadius: CivicaRadius.lg)
                .fill(Color(.systemGray5))
        }
    }

    private func generateQRCode(from string: String) -> UIImage? {
        filter.setValue(Data(string.utf8), forKey: "inputMessage")
        filter.correctionLevel = "M"

        guard let outputImage = filter.outputImage else { return nil }
        // Scale it up crisply
        let transform = CGAffineTransform(scaleX: 12, y: 12)
        let scaled = outputImage.transformed(by: transform)

        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
