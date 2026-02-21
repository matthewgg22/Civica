//
//  ViewSnapshotter.swift
//  VoteNow
//
//  Created by Matthew Greer-Gentis on 2/20/26.
//
import SwiftUI
import UIKit

enum ViewSnapshotter {
    @MainActor
    static func snapshot<Content: View>(_ view: Content, size: CGSize) -> UIImage? {
        let renderer = ImageRenderer(
            content: view
                .frame(width: size.width, height: size.height)
        )
        renderer.scale = UIScreen.main.scale
        renderer.proposedSize = ProposedViewSize(size)
        return renderer.uiImage
    }
}
