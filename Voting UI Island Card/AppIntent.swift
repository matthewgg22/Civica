import AppIntents

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Configuration" }
    static var description = IntentDescription("Choose the emoji shown in the widget.")

    @Parameter(title: "Favorite Emoji", default: "😀")
    var favoriteEmoji: String
}
