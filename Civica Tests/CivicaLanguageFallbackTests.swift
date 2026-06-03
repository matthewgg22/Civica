import Foundation
import Testing
@testable import Civica

// Coverage for the 2026-05-31 multilingual expansion: Mandarin /
// Vietnamese / Tagalog are selectable, but every string that lacks a
// translation must fall back to English — never render empty, never
// crash. English + Spanish stay at full parity.

struct CivicaLanguageFallbackTests {

    @Test func allFiveLanguagesAreSelectable() {
        let codes = Set(CivicaLanguage.allCases.map(\.rawValue))
        #expect(codes == ["en", "es", "zh", "vi", "tl"])
    }

    @Test func everyLanguageHasANonEmptyDisplayName() {
        for lang in CivicaLanguage.allCases {
            #expect(!lang.displayName.isEmpty, "\(lang) display name is empty")
        }
    }

    @Test func onlyEnglishAndSpanishAreFullyTranslated() {
        #expect(CivicaLanguage.english.isFullyTranslated)
        #expect(CivicaLanguage.spanish.isFullyTranslated)
        #expect(!CivicaLanguage.mandarin.isFullyTranslated)
        #expect(!CivicaLanguage.vietnamese.isFullyTranslated)
        #expect(!CivicaLanguage.tagalog.isFullyTranslated)
    }

    @Test func untranslatedNewLanguagesFallBackToEnglish() {
        let text = CivicaText("Apply for SNAP", es: "Solicitar SNAP")
        #expect(text.value(in: .mandarin) == "Apply for SNAP")
        #expect(text.value(in: .vietnamese) == "Apply for SNAP")
        #expect(text.value(in: .tagalog) == "Apply for SNAP")
        // English + Spanish unchanged.
        #expect(text.value(in: .english) == "Apply for SNAP")
        #expect(text.value(in: .spanish) == "Solicitar SNAP")
    }

    @Test func suppliedTranslationsAreUsedOverFallback() {
        let text = CivicaText(
            "Continue", es: "Continuar",
            zh: "继续", vi: "Tiếp tục", tl: "Magpatuloy"
        )
        #expect(text.value(in: .mandarin) == "继续")
        #expect(text.value(in: .vietnamese) == "Tiếp tục")
        #expect(text.value(in: .tagalog) == "Magpatuloy")
    }

    @Test func partialTranslationFallsBackPerLanguage() {
        // zh supplied, vi/tl nil → vi/tl fall back to English, zh used.
        let text = CivicaText("Help", es: "Ayuda", zh: "帮助")
        #expect(text.value(in: .mandarin) == "帮助")
        #expect(text.value(in: .vietnamese) == "Help")
        #expect(text.value(in: .tagalog) == "Help")
    }

    @Test func noLanguageEverRendersEmptyForNonEmptyEnglish() {
        let text = CivicaText("Non-empty", es: "No vacío")
        for lang in CivicaLanguage.allCases {
            #expect(!text.value(in: lang).isEmpty, "\(lang) rendered empty")
        }
    }
}
