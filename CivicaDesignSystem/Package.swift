// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CivicaDesignSystem",
    platforms: [.iOS(.v17)],
    products: [
        .library(
            name: "CivicaDesignSystem",
            targets: ["CivicaDesignSystem"]
        ),
    ],
    targets: [
        .target(
            name: "CivicaDesignSystem"
        ),
    ]
)
