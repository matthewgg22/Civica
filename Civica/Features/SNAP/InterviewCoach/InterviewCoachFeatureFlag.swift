import Foundation

// EXPERIMENTAL SILOED MODULE:
// Interview Coach is a SNAP sub-feature.
//
// Originally gated on the SNAP_DEV compilation condition so it only
// shipped to internal Debug builds. As of the broad-rollout decision,
// the gate is lifted -- the feature is now visible in every build
// (Debug, Release, TestFlight, App Store).
//
// The type is kept (rather than removing the `if isEnabled` checks
// at the call sites) so future re-gating is one line: swap the
// constant for a remote-config lookup, a percentage rollout check,
// a build-condition gate, or whatever the next iteration needs.
// Call sites in CivicaEntryView and SNAPInterviewCoachView don't
// have to change.
//
// IMPORTANT: lifting this flag does NOT make the feature functional
// on its own. The practice session calls Supabase Edge Functions
// (interview-coach-turn, interview-coach-score) that must be
// deployed to the Civica Supabase project, and SUPABASE_URL +
// SUPABASE_ANON_KEY must be set in Civica/Info.plist. Until both
// land, every practice session fails -- the retry button and the
// disclaimer make this less jarring, but users will see errors.
// Hold the App Store submission until both prerequisites ship.
enum InterviewCoachFeatureFlag {
    static let isEnabled = true
}
