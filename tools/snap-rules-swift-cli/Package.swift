// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SnapRulesSwiftCli",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "SnapRulesSwiftCli",
            path: "Sources/SnapRulesSwiftCli"
        )
    ]
)
