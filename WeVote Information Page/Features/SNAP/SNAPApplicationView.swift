import CivicaDesignSystem
import MapKit
import Network
import SwiftUI
import UIKit

// EXPERIMENTAL SILOED MODULE: iPhone-first SNAP guided flow.
// One short question group per screen to reduce navigation burden.
struct SNAPApplicationView: View {
    @ObservedObject var viewModel: SNAPApplicationViewModel
    @FocusState private var focusedField: FocusedField?
    @State private var showingChecklistShareSheet = false
    @State private var checklistShareItems: [Any] = []
    @State private var isWhereApplyingFromWhyExpanded = false
    @State private var isHouseholdBasicsWhyExpanded = false
    @State private var isApplicantAgeWhyExpanded = false
    @State private var isContactInformationWhyExpanded = false
    @State private var isIncomeWhyExpanded = false
    @State private var isStudentStatusWhyExpanded = false
    @State private var isExpensesWhyExpanded = false
    @State private var isDocumentsWhyExpanded = false
    @State private var isReviewWhyExpanded = false
    @State private var isNextStepsWhyExpanded = false
    @State private var residentialAddressSearchText: String = ""
    @StateObject private var residentialAddressAutocomplete = SNAPAddressAutocomplete()
    private enum FocusedField: Hashable {
        case residentialStreetAddress
        case residentialCity
        case residentialZIP
        case contactEmail
        case contactPhone
        case monthlyIncome
        case earnedGrossPay
        case earnedHoursPerWeek
        case gigGrossReceipts
        case gigBusinessExpenses
        case rent
        case utilities
        case childcare
        case medical
    }

    private struct SNAPStateOption: Identifiable {
        let code: String
        let name: String
        var id: String { code }
    }

    private let supportedStates: [SNAPStateOption] = [
        .init(code: "AL", name: "Alabama"),
        .init(code: "AK", name: "Alaska"),
        .init(code: "AZ", name: "Arizona"),
        .init(code: "AR", name: "Arkansas"),
        .init(code: "CA", name: "California"),
        .init(code: "CO", name: "Colorado"),
        .init(code: "CT", name: "Connecticut"),
        .init(code: "DE", name: "Delaware"),
        .init(code: "DC", name: "District of Columbia"),
        .init(code: "FL", name: "Florida"),
        .init(code: "GA", name: "Georgia"),
        .init(code: "HI", name: "Hawaii"),
        .init(code: "ID", name: "Idaho"),
        .init(code: "IL", name: "Illinois"),
        .init(code: "IN", name: "Indiana"),
        .init(code: "IA", name: "Iowa"),
        .init(code: "KS", name: "Kansas"),
        .init(code: "KY", name: "Kentucky"),
        .init(code: "LA", name: "Louisiana"),
        .init(code: "ME", name: "Maine"),
        .init(code: "MD", name: "Maryland"),
        .init(code: "MA", name: "Massachusetts"),
        .init(code: "MI", name: "Michigan"),
        .init(code: "MN", name: "Minnesota"),
        .init(code: "MS", name: "Mississippi"),
        .init(code: "MO", name: "Missouri"),
        .init(code: "MT", name: "Montana"),
        .init(code: "NE", name: "Nebraska"),
        .init(code: "NV", name: "Nevada"),
        .init(code: "NH", name: "New Hampshire"),
        .init(code: "NJ", name: "New Jersey"),
        .init(code: "NM", name: "New Mexico"),
        .init(code: "NY", name: "New York"),
        .init(code: "NC", name: "North Carolina"),
        .init(code: "ND", name: "North Dakota"),
        .init(code: "OH", name: "Ohio"),
        .init(code: "OK", name: "Oklahoma"),
        .init(code: "OR", name: "Oregon"),
        .init(code: "PA", name: "Pennsylvania"),
        .init(code: "RI", name: "Rhode Island"),
        .init(code: "SC", name: "South Carolina"),
        .init(code: "SD", name: "South Dakota"),
        .init(code: "TN", name: "Tennessee"),
        .init(code: "TX", name: "Texas"),
        .init(code: "UT", name: "Utah"),
        .init(code: "VT", name: "Vermont"),
        .init(code: "VA", name: "Virginia"),
        .init(code: "WA", name: "Washington"),
        .init(code: "WV", name: "West Virginia"),
        .init(code: "WI", name: "Wisconsin"),
        .init(code: "WY", name: "Wyoming")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            switch viewModel.draftStep {
            case .whereApplyingFrom:
                whereApplyingFromStep
            case .householdBasics:
                householdBasicsStep
            case .applicantAge:
                applicantAgeStep
            case .addressContact:
                addressContactStep
            case .income:
                incomeStep
            case .studentStatus:
                studentStatusStep
            case .expenses:
                expensesStep
            case .documentsChecklist:
                documentsChecklistStep
            case .reviewDraft:
                reviewDraftStep
            case .nextSteps:
                nextStepsStep
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    focusedField = nil
                }
            }
        }
        .sheet(isPresented: $showingChecklistShareSheet) {
            ShareSheet(items: checklistShareItems)
        }
    }

    private var whereApplyingFromStep: some View {
        VStack(spacing: CivicaSpacing.md) {
            SNAPSectionCard(
                title: "Where are you currently residing?",
                helper: nil,
                headerAccessory: {
                    SNAPCardInfoButton(
                        isExpanded: $isWhereApplyingFromWhyExpanded,
                        label: "Why we ask"
                    )
                }
            ) {
                SNAPStepGuidanceRows(
                    whatText: "",
                    whyText: "SNAP websites, timelines, and instructions vary by state. This helps us guide you to the right official path.",
                    doNotShareText: "Do not enter names, Social Security numbers, full addresses, immigration details, or other private identifying information.",
                    isWhyExpanded: $isWhereApplyingFromWhyExpanded
                ) {

                SNAPInputLabel(
                    "State",
                    badge: .required(isMissing: stateIsMissingAfterContinueAttempt)
                )
                Picker("State", selection: stateSelection) {
                    Text("Select state").tag("")
                    ForEach(supportedStates) { state in
                        Text(state.name).tag(state.code)
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, alignment: .leading)
                .snapCompactFieldSurface(highlightPrefilled: viewModel.isStateUsingPrefill)
                .modifier(
                    SNAPRequiredFieldShake(
                        isActive: stateIsMissingAfterContinueAttempt,
                        trigger: viewModel.draftContinueAttemptToken
                    )
                )

                if let prefillNoteText {
                    Text(prefillNoteText)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let selectedStateAgencyName {
                    Text("Your Application will be evaluated by the \(selectedStateAgencyName)")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                SNAPOptionalEnumPicker(
                    title: "Housing status",
                    badge: .required(isMissing: housingStatusIsMissingAfterContinueAttempt),
                    selection: housingStatusBinding,
                    compact: true,
                    condensed: true,
                    isMissingRequired: housingStatusIsMissingAfterContinueAttempt,
                    shakeToken: viewModel.draftContinueAttemptToken,
                    label: { $0.label }
                )

                housingStatusExamplesBlock

                if viewModel.application.housingStatus == .unhoused {
                    SNAPSectionCard(
                        title: "⚡ You may qualify for faster SNAP help",
                        helper: nil
                    ) {
                        Text("Because you selected that you do not have stable housing, you may qualify for expedited SNAP processing. You do not need a permanent address to continue. We'll help you prioritize the fastest path.")
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)

                        Button("Start expedited SNAP path") {
                            viewModel.startExpeditedPath()
                        }
                        .buttonStyle(CivicaPrimaryCTAButtonStyle())

                        Button("Continue regular application") {
                            viewModel.continueRegularApplicationPath()
                        }
                        .buttonStyle(.plain)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.ctaBlue)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if viewModel.application.isExpeditedPathActive {
                        SNAPSectionCard(
                            title: "Expedited SNAP path",
                            helper: "Minimum details to help prepare for faster review."
                        ) {
                            SNAPYesNoSegmentedQuestion(
                                title: "Do you have any form of ID?",
                                value: $viewModel.application.expeditedHasAnyID
                            )

                            SNAPInputLabel("What type of ID do you have?", badge: .optional)
                            TextField("Optional", text: $viewModel.application.expeditedIDType)
                                .textInputAutocapitalization(.words)
                                .snapCompactTextFieldStyle()

                            SNAPYesNoSegmentedQuestion(
                                title: "Do you currently have any income?",
                                value: $viewModel.application.expeditedHasCurrentIncome
                            )

                            SNAPInputLabel("About how much income did you receive this month?", badge: .optionalEstimate)
                            HStack(spacing: CivicaSpacing.sm) {
                                Text("$")
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(CivicaColors.textPrimary)

                                TextField("0", text: $viewModel.application.expeditedCurrentMonthIncomeAmount)
                                    .keyboardType(.decimalPad)

                                Spacer(minLength: 0)
                            }
                            .snapCompactFieldSurface()

                            SNAPInputLabel("About how much cash or bank money do you have right now?", badge: .optionalEstimate)
                            HStack(spacing: CivicaSpacing.sm) {
                                Text("$")
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(CivicaColors.textPrimary)

                                TextField("0", text: $viewModel.application.expeditedCashOrBankAmountNow)
                                    .keyboardType(.decimalPad)

                                Spacer(minLength: 0)
                            }
                            .snapCompactFieldSurface()

                            SNAPYesNoSegmentedQuestion(
                                title: "Is there someone who can confirm your situation if needed?",
                                value: $viewModel.application.expeditedHasCollateralContact
                            )

                            if viewModel.application.expeditedHasCollateralContact == true {
                                SNAPInputLabel("Collateral contact name", badge: .optional)
                                TextField("Optional", text: $viewModel.application.expeditedCollateralContactName)
                                    .textInputAutocapitalization(.words)
                                    .snapCompactTextFieldStyle()

                                SNAPInputLabel("Collateral contact role", badge: .optional)
                                TextField("Optional", text: $viewModel.application.expeditedCollateralContactRole)
                                    .textInputAutocapitalization(.words)
                                    .snapCompactTextFieldStyle()

                                SNAPInputLabel("Collateral contact phone or email", badge: .optional)
                                TextField("Optional", text: $viewModel.application.expeditedCollateralContactValue)
                                    .textInputAutocapitalization(.never)
                                    .keyboardType(.emailAddress)
                                    .snapCompactTextFieldStyle()
                            }

                            SNAPOptionalEnumPicker(
                                title: "Best way for the SNAP agency to contact you",
                                badge: .optional,
                                selection: $viewModel.application.expeditedBestAgencyContactMethod,
                                compact: true,
                                label: { $0.label }
                            )
                        }

                        SNAPSectionCard(
                            title: "Expedited SNAP checklist",
                            helper: nil
                        ) {
                            Text("You may qualify for expedited review.")
                                .font(CivicaTypography.footnoteStrong)
                                .foregroundStyle(CivicaColors.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)

                            Text("Identity is the most important item to verify first.")
                                .font(CivicaTypography.footnote)
                                .foregroundStyle(CivicaColors.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)

                            Text("Other documents may be requested later.")
                                .font(CivicaTypography.footnote)
                                .foregroundStyle(CivicaColors.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)

                            Text("A SNAP worker may still need to interview you.")
                                .font(CivicaTypography.footnote)
                                .foregroundStyle(CivicaColors.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)

                            Button("Continue to application summary") {
                                viewModel.jumpToDraftStep(.reviewDraft)
                            }
                            .buttonStyle(CivicaPrimaryCTAButtonStyle())
                        }
                    }
                }

                if shouldCollectResidentialAddress {
                    SNAPInputLabel(
                        "Residency address",
                        badge: .optional
                    )
                    TextField("Start typing address", text: residentialAddressSearchBinding)
                        .textInputAutocapitalization(.words)
                        .focused($focusedField, equals: .residentialStreetAddress)
                        .snapCompactTextFieldStyle()

                    if !residentialAddressAutocomplete.suggestions.isEmpty {
                        VStack(alignment: .leading, spacing: 0) {
                            ForEach(Array(residentialAddressAutocomplete.suggestions.enumerated()), id: \.element.id) { index, suggestion in
                                Button {
                                    applyResidentialAddressSuggestion(suggestion)
                                } label: {
                                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                                        Text(suggestion.title)
                                            .font(CivicaTypography.subheadStrong)
                                            .foregroundStyle(CivicaColors.textPrimary)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                        if !suggestion.subtitle.isEmpty {
                                            Text(suggestion.subtitle)
                                                .font(CivicaTypography.footnote)
                                                .foregroundStyle(CivicaColors.textSecondary)
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                        }
                                    }
                                    .padding(.vertical, CivicaSpacing.sm)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)

                                if index < residentialAddressAutocomplete.suggestions.count - 1 {
                                    Divider()
                                }
                            }
                        }
                        .snapCompactFieldSurface()
                    }

                    if let issue = residentialAddressAutocomplete.lookupIssue {
                        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                            HStack(spacing: CivicaSpacing.sm) {
                                Text(issue.message)
                                    .font(CivicaTypography.footnote)
                                    .foregroundStyle(CivicaColors.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)

                                Spacer(minLength: 0)

                                Button("Retry") {
                                    residentialAddressAutocomplete.retryLastQuery()
                                }
                                .font(CivicaTypography.footnoteStrong)
                                .foregroundStyle(CivicaColors.ctaBlue)
                                .buttonStyle(.plain)
                            }

                            if issue.showsOfflineHint {
                                Text("You may be offline. Check your connection and try again.")
                                    .font(CivicaTypography.footnote)
                                    .foregroundStyle(CivicaColors.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .padding(.horizontal, CivicaSpacing.sm)
                        .padding(.vertical, CivicaSpacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                                .fill(CivicaColors.surfaceSecondary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                        )
                    }

                    SNAPInputLabel(
                        "City",
                        badge: .required(isMissing: residentialCityIsMissingAfterContinueAttempt)
                    )
                    TextField("City", text: residentialCityBinding)
                        .textInputAutocapitalization(.words)
                        .focused($focusedField, equals: .residentialCity)
                        .snapCompactTextFieldStyle()
                        .modifier(
                            SNAPRequiredFieldShake(
                                isActive: residentialCityIsMissingAfterContinueAttempt,
                                trigger: viewModel.draftContinueAttemptToken
                            )
                        )

                    SNAPInputLabel(
                        "ZIP code",
                        badge: .required(isMissing: residentialZIPIsMissingAfterContinueAttempt)
                    )
                    TextField("ZIP code", text: residentialZIPBinding)
                        .keyboardType(.numberPad)
                        .focused($focusedField, equals: .residentialZIP)
                        .snapCondensedTextFieldStyle(highlightPrefilled: viewModel.isZIPUsingPrefill)
                        .modifier(
                            SNAPRequiredFieldShake(
                                isActive: residentialZIPIsMissingAfterContinueAttempt,
                                trigger: viewModel.draftContinueAttemptToken
                            )
                        )
                }

                if viewModel.application.housingStatus == .unhoused {
                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        Text("Unhoused support")
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.textPrimary)

                        Text("You can apply without a permanent address.")
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.ctaBlue)
                            .fixedSize(horizontal: false, vertical: true)

                        Text("Add a safe mailing address, shelter, phone, email, or trusted contact where the SNAP office can reach you.")
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)

                        Text("Residency checks can be flexible when standard proof is hard to provide.")
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)

                        Text("Homelessness alone does not guarantee emergency SNAP, so we will still check emergency criteria.")
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, CivicaSpacing.sm)
                    .padding(.vertical, CivicaSpacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                            .fill(CivicaColors.surfacePrimary)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                            .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                    )
                }
                }
            }
        }
        .onChange(of: viewModel.application.housingStatus) { _, newValue in
            if newValue == .unhoused {
                viewModel.application.residentialStreetAddress = ""
                viewModel.application.residentialCity = ""
                viewModel.application.residentialZIP = ""
                residentialAddressSearchText = ""
                residentialAddressAutocomplete.clear()
            }
        }
        .onChange(of: shouldCollectResidentialAddress) { _, shouldCollect in
            if !shouldCollect {
                residentialAddressSearchText = ""
                residentialAddressAutocomplete.clear()
            }
        }
    }

    private var householdBasicsStep: some View {
        VStack(spacing: CivicaSpacing.md) {
            SNAPSectionCard(
                title: "Your food household",
                helper: nil,
                headerAccessory: {
                    SNAPCardInfoButton(
                        isExpanded: $isHouseholdBasicsWhyExpanded,
                        label: "Why we ask"
                    )
                }
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Tell us who is in your food household.",
                    whyText: "For SNAP, your household means people who buy and prepare food together. Some people who live together usually must be counted together, like spouses and children under 22 living with a parent.",
                    doNotShareText: "Do not enter names, Social Security numbers, or private information about other household members.",
                    isWhyExpanded: $isHouseholdBasicsWhyExpanded
                ) {

                SNAPInputLabel(
                    "Household size",
                    badge: .required(isMissing: householdSizeIsMissingAfterContinueAttempt)
                )
                Picker("Household size", selection: householdSizeSelection) {
                    Text("Select household size").tag(0)
                    ForEach(1..<11) { count in
                        Text(count == 1 ? "1 (yourself)" : "\(count)").tag(count)
                    }
                    Text("11 or more").tag(11)
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, alignment: .leading)
                .snapFieldSurface()
                .modifier(
                    SNAPRequiredFieldShake(
                        isActive: householdSizeIsMissingAfterContinueAttempt,
                        trigger: viewModel.draftContinueAttemptToken
                    )
                )

                Text("DO COUNT: People you usually buy and prepare food with.\nDON'T COUNT: Roommates or others who buy and prepare food separately.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Divider()
                    .padding(.vertical, CivicaSpacing.xs)

                if shouldAskMultiPersonHouseholdFollowUps {
                    SNAPTernaryChoiceQuestion(
                        title: "Do you buy and prepare most food with anyone else?",
                        value: $viewModel.application.buysAndPreparesFoodWithOthers,
                        badge: nil
                    )

                    SNAPTernaryChoiceQuestion(
                        title: "Does a spouse live with you?",
                        value: spouseLivesChoiceBinding,
                        badge: nil
                    )

                    SNAPTernaryChoiceQuestion(
                        title: "Does any child under 22 live with a parent in the home?",
                        value: childUnder22ChoiceBinding,
                        badge: nil
                    )

                    SNAPTernaryChoiceQuestion(
                        title: "Any children in the household?",
                        value: childrenInHouseholdChoiceBinding,
                        badge: nil
                    )
                }

                SNAPTernaryChoiceQuestion(
                    title: "Anyone age 60 or older?",
                    value: anyoneAge60OrOlderChoiceBinding,
                    badge: nil
                )

                SNAPTernaryChoiceQuestion(
                    title: "Anyone with a disability?",
                    value: anyoneWithDisabilityChoiceBinding,
                    badge: nil,
                    infoText: "A SNAP disability is a long-term physical or mental condition that significantly limits daily activities or work, or receiving benefits like Supplemental Security Income or Social Security Disability Insurance."
                )

                SNAPTernaryChoiceQuestion(
                    title: "Anyone pregnant?",
                    value: anyonePregnantChoiceBinding,
                    badge: nil
                )

                SNAPTernaryChoiceQuestion(
                    title: "Anyone currently unhoused, in a shelter, couch-surfing, or without a fixed mailing address?",
                    value: unhousedOrNoFixedMailingChoiceBinding,
                    badge: nil
                )

                if viewModel.application.anyoneUnhousedOrNoFixedMailingAddress == .yes {
                    SNAPOptionalEnumPicker(
                        title: "Preferred safe mailing/contact option",
                        badge: nil,
                        selection: $viewModel.application.preferredSafeMailingContactOption,
                        compact: true,
                        label: { $0.label }
                    )

                    Text("Do not enter a full address here. Just choose the safest option for contact.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                }
            }

            Text("This draft does not need names, SSNs, or full addresses.")
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.textSecondary)
                .padding(.horizontal, CivicaSpacing.xs)
        }
    }

    private var applicantAgeStep: some View {
        VStack(spacing: CivicaSpacing.md) {
            SNAPSectionCard(
                title: "",
                helper: nil,
                headerAccessory: {
                    SNAPCardInfoButton(
                        isExpanded: $isApplicantAgeWhyExpanded,
                        label: "Why we ask"
                    )
                }
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Use the birth date of the person preparing this SNAP draft.",
                    whyText: "Official applications often ask for applicant age. This helps organize the interview prep details.",
                    doNotShareText: "Do not enter Social Security numbers or other sensitive identifiers.",
                    isWhyExpanded: $isApplicantAgeWhyExpanded
                ) {
                    SNAPInputLabel(
                        "Applicant age",
                        badge: .required(isMissing: applicantAgeIsMissingAfterContinueAttempt)
                    )
                    VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                        HStack(spacing: CivicaSpacing.sm) {
                            Text("Age: \(viewModel.application.applicantAge ?? ageInYears(from: applicantDateOfBirthBinding.wrappedValue))")
                                .font(CivicaTypography.footnoteStrong)
                                .foregroundStyle(CivicaColors.textSecondary)

                            Spacer(minLength: 0)

                            Button("Clear") {
                                viewModel.application.applicantDateOfBirth = nil
                                viewModel.application.applicantAge = nil
                            }
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.ctaBlue)
                            .buttonStyle(.plain)
                        }

                        DatePicker(
                            "Applicant date of birth",
                            selection: applicantDateOfBirthBinding,
                            in: ...Date(),
                            displayedComponents: .date
                        )
                        .datePickerStyle(.wheel)
                        .labelsHidden()
                        .frame(maxWidth: .infinity, minHeight: 128, maxHeight: 128, alignment: .leading)
                        .clipped()
                        .padding(.horizontal, CivicaSpacing.xs)
                    }
                    .snapCompactFieldSurface()
                }
            }
        }
    }

    private var addressContactStep: some View {
        VStack(spacing: CivicaSpacing.md) {
            SNAPSectionCard(
                title: "Contact information",
                helper: nil,
                headerAccessory: {
                    SNAPCardInfoButton(
                        isExpanded: $isContactInformationWhyExpanded,
                        label: "Why we ask"
                    )
                }
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Choose the easiest way for someone to reach you if you later ask for help with your application.",
                    whyText: "This helps prepare for follow-up support, but it does not contact you or submit anything by itself.",
                    doNotShareText: "Do not enter Social Security numbers, bank account numbers, immigration document numbers, or upload document images here.",
                    isWhyExpanded: $isContactInformationWhyExpanded
                ) {

                SNAPInputLabel("Email", badge: .optional)
                TextField("name@example.com", text: contactEmailBinding)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.emailAddress)
                    .focused($focusedField, equals: .contactEmail)
                    .snapCompactTextFieldStyle()

                SNAPInputLabel("Phone Number", badge: .optional)
                TextField("(555) 123-4567", text: contactPhoneBinding)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    .focused($focusedField, equals: .contactPhone)
                    .snapCompactTextFieldStyle()

                SNAPInputLabel("Preferred contact method", badge: .optional)

                LazyVGrid(
                    columns: [
                        GridItem(.flexible(), spacing: CivicaSpacing.sm),
                        GridItem(.flexible(), spacing: CivicaSpacing.sm)
                    ],
                    spacing: CivicaSpacing.sm
                ) {
                    ForEach(PreferredContactMethod.allCases) { method in
                        SNAPSelectableOptionButton(
                            title: method.label,
                            isSelected: viewModel.application.preferredContactMethod == method
                        ) {
                            if viewModel.application.preferredContactMethod == method {
                                viewModel.application.preferredContactMethod = nil
                            } else {
                                viewModel.application.preferredContactMethod = method
                            }
                        }
                    }
                }

                Text("This draft will not send messages automatically.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var incomeStep: some View {
        VStack(spacing: CivicaSpacing.md) {
            SNAPSectionCard(
                title: "Income details",
                helper: nil,
                headerAccessory: {
                    SNAPCardInfoButton(
                        isExpanded: $isIncomeWhyExpanded,
                        label: "Why we ask"
                    )
                }
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Enter your work status, monthly income estimate, and whether your income changes month to month. SNAP usually asks about income before taxes. Estimates are okay for prep.",
                    whyText: "Official SNAP applications often ask about income. Emergency review may consider gross income, liquid resources, and whether housing + utility costs are higher than income/resources. For gig or self-employed work, we look at earnings and allowable costs, not just paystubs.",
                    doNotShareText: "Do not enter Social Security numbers, employer EINs, bank account numbers, routing numbers, paystub images, or tax documents.",
                    isWhyExpanded: $isIncomeWhyExpanded
                ) {

                SNAPOptionalEnumPicker(
                    title: "Employment status",
                    badge: .required(),
                    selection: $viewModel.application.employmentStatus,
                    compact: true,
                    isMissingRequired: employmentStatusIsMissingAfterContinueAttempt,
                    shakeToken: viewModel.draftContinueAttemptToken,
                    label: { $0.label },
                    selectedHelperText: { $0.exampleText }
                )

                Text("Choose the option that best describes your current work situation.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                SNAPInputLabel("Estimated monthly income", badge: .required())
                HStack(spacing: CivicaSpacing.sm) {
                    Text("$")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(CivicaColors.textPrimary)

                    TextField("0", text: $viewModel.application.monthlyIncomeEstimate)
                        .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .monthlyIncome)

                    Spacer(minLength: 0)

                    Text("/month, pre-tax")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textSecondary)
                }
                .snapCompactFieldSurface()
                .modifier(
                    SNAPRequiredFieldShake(
                        isActive: monthlyIncomeIsMissingAfterContinueAttempt,
                        trigger: viewModel.draftContinueAttemptToken
                    )
                )

                Text(annualIncomeEstimateText)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Use your best estimate before taxes. Exact numbers may be needed later on the official application.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                SNAPYesNoSegmentedQuestion(
                    title: "Does your income change month to month?",
                    value: $viewModel.application.incomeChangesMonthToMonth,
                    isMissingRequired: incomeChangesIsMissingAfterContinueAttempt,
                    shakeToken: viewModel.draftContinueAttemptToken
                )

                Text("Answer yes if your income is not the same every month, such as changing hours, tips, seasonal work, gig work, or irregular pay.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Divider()
                    .padding(.vertical, CivicaSpacing.xs)

                if isEmploymentPrimarilyEmployerBased {
                    Toggle("Also have self-employed/gig income?", isOn: alsoHasSelfEmploymentIncomeBinding)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .toggleStyle(.switch)
                } else if isEmploymentPrimarilySelfEmployed {
                    Toggle("Also have employer income?", isOn: alsoHasEmployerIncomeBinding)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .toggleStyle(.switch)
                }

                if shouldShowEmployerIncomeSection {
                    Text("Earned income")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.textPrimary)
                    SNAPInputLabel("Employer or job type", badge: .optional)
                    TextField("Optional", text: $viewModel.application.employerOrJobType)
                        .textInputAutocapitalization(.words)
                        .snapCompactTextFieldStyle()

                    SNAPInputLabel("Gross pay amount", badge: .optionalEstimate)
                    HStack(spacing: CivicaSpacing.sm) {
                        Text("$")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(CivicaColors.textPrimary)

                        TextField("0", text: $viewModel.application.earnedGrossPayAmount)
                            .keyboardType(.decimalPad)
                            .focused($focusedField, equals: .earnedGrossPay)

                        Spacer(minLength: 0)

                        Text("/ month")
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.textSecondary)
                    }
                    .snapCompactFieldSurface()

                    SNAPOptionalEnumPicker(
                        title: "Pay frequency",
                        badge: .optional,
                        selection: $viewModel.application.earnedPayFrequency,
                        compact: true,
                        label: { $0.label }
                    )

                    SNAPInputLabel("Approximate hours per week", badge: .optional)
                    TextField("0", text: $viewModel.application.earnedHoursPerWeek)
                        .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .earnedHoursPerWeek)
                        .snapCompactTextFieldStyle()

                    SNAPTernaryChoiceQuestion(
                        title: "Recent job loss or stopped work?",
                        value: recentJobLossChoiceBinding
                    )

                    SNAPInputLabel("Last pay date", badge: .optional)
                    if viewModel.application.earnedLastPayDate != nil {
                        HStack(spacing: CivicaSpacing.sm) {
                            DatePicker(
                                "Last pay date",
                                selection: earnedLastPayDateBinding,
                                displayedComponents: .date
                            )
                            .labelsHidden()
                            .frame(maxWidth: .infinity, alignment: .leading)

                            Button("Clear") {
                                viewModel.application.earnedLastPayDate = nil
                            }
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.ctaBlue)
                            .buttonStyle(.plain)
                        }
                        .snapCompactFieldSurface()
                    } else {
                        Button("Add date (optional)") {
                            viewModel.application.earnedLastPayDate = Date()
                        }
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ctaBlue)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .snapCompactFieldSurface()
                        .buttonStyle(.plain)
                    }
                }

                Divider()
                    .padding(.vertical, CivicaSpacing.xs)

                if shouldShowSelfEmploymentIncomeSection {
                    Text("Self-employment or gig income")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.textPrimary)

                    SNAPInputLabel("Type of work or platform", badge: .optional)
                    TextField("Optional", text: $viewModel.application.gigWorkTypeOrPlatform)
                        .textInputAutocapitalization(.words)
                        .snapCompactTextFieldStyle()

                    SNAPInputLabel("Gross receipts this month", badge: .optionalEstimate)
                    HStack(spacing: CivicaSpacing.sm) {
                        Text("$")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(CivicaColors.textPrimary)

                        TextField("0", text: $viewModel.application.gigGrossReceiptsThisMonth)
                            .keyboardType(.decimalPad)
                            .focused($focusedField, equals: .gigGrossReceipts)

                        Spacer(minLength: 0)

                        Text("/ month")
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.textSecondary)
                    }
                    .snapCompactFieldSurface()

                    SNAPInputLabel("Business/work expenses this month", badge: .optionalEstimate)
                    HStack(spacing: CivicaSpacing.sm) {
                        Text("$")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(CivicaColors.textPrimary)

                        TextField("0", text: $viewModel.application.gigBusinessExpensesThisMonth)
                            .keyboardType(.decimalPad)
                            .focused($focusedField, equals: .gigBusinessExpenses)

                        Spacer(minLength: 0)

                        Text("/ month")
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.textSecondary)
                    }
                    .snapCompactFieldSurface()

                    SNAPTernaryChoiceQuestion(
                        title: "Income varies month to month?",
                        value: $viewModel.application.gigIncomeVariesMonthToMonth
                    )
                }

                if shouldShowStandaloneRecentJobLossQuestion {
                    SNAPTernaryChoiceQuestion(
                        title: "Recent job loss or stopped work?",
                        value: recentJobLossChoiceBinding
                    )
                }

                Divider()
                    .padding(.vertical, CivicaSpacing.xs)

                Text("Do you currently recieve unearned or other Income?")
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.textPrimary)

                LazyVGrid(
                    columns: [GridItem(.flexible()), GridItem(.flexible())],
                    alignment: .center,
                    spacing: CivicaSpacing.sm
                ) {
                    ForEach(SNAPOtherIncomeSource.allCases) { source in
                        SNAPSelectableOptionButton(
                            title: source.label,
                            isSelected: viewModel.application.otherIncomeSources.contains(source),
                            minHeight: 62,
                            multilineCentered: true,
                            lineLimit: 2
                        ) {
                            toggleOtherIncomeSource(source)
                        }
                    }
                }
                }
            }
        }
        .onChange(of: viewModel.application.employmentStatus) { _, newValue in
            guard let newValue else { return }
            switch newValue {
            case .selfEmployed:
                viewModel.application.selfEmployedOrGigWork = .yes
                viewModel.application.worksForEmployer = .no
            case .employedFullTime, .employedPartTime:
                viewModel.application.worksForEmployer = .yes
                viewModel.application.selfEmployedOrGigWork = .no
            case .unemployed, .unableToWork:
                viewModel.application.worksForEmployer = .no
                viewModel.application.selfEmployedOrGigWork = .no
            }
        }
    }

    private var studentStatusStep: some View {
        VStack(spacing: CivicaSpacing.md) {
            SNAPSectionCard(
                title: "Student questions",
                helper: nil,
                headerAccessory: {
                    SNAPCardInfoButton(
                        isExpanded: $isStudentStatusWhyExpanded,
                        label: "Why we ask"
                    )
                }
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Tell us whether you are enrolled in higher education",
                    whyText: "Student information can affect what documents or explanations the official application may request. This draft does not decide whether you qualify.",
                    doNotShareText: "Do not enter school ID numbers, transcripts, financial aid records, immigration information, or private details about your child or school.",
                    isWhyExpanded: $isStudentStatusWhyExpanded
                ) {

                SNAPYesNoSegmentedQuestion(
                    title: "Are you currently enrolled in higher education?",
                    value: currentlyEnrolledBinding,
                    isMissingRequired: studentEnrollmentIsMissingAfterContinueAttempt,
                    shakeToken: viewModel.draftContinueAttemptToken
                )

                Text("inlcude College / University (undergraduate), Graduate / Professional school, Vocational / Trade school, formal Technical or certificate programs, Technical or certificate programs, GED or adult basic education")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                if viewModel.application.isCurrentlyEnrolledInHigherEducation == true {
                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        Text("Students may still qualify for SNAP. These questions help organize what the official application asks next.")
                            .font(CivicaTypography.subhead)
                            .foregroundStyle(CivicaColors.textPrimary)
                    }
                    .padding(CivicaSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                            .fill(CivicaColors.infoSurfaceBlue.opacity(0.28))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                            .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                    )

                    SNAPYesNoSegmentedQuestion(
                        title: "Are you enrolled at least half-time?",
                        value: $viewModel.application.isEnrolledAtLeastHalfTime,
                        isMissingRequired: enrolledHalfTimeIsMissingAfterContinueAttempt,
                        shakeToken: viewModel.draftContinueAttemptToken
                    )
                    Text("Use your school's definition of half-time if you know it. If you are unsure, choose the closest answer and confirm later.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    SNAPYesNoSegmentedQuestion(
                        title: "Do you work at least 20 hours per week?",
                        value: $viewModel.application.worksAtLeastTwentyHoursPerWeek,
                        isMissingRequired: worksTwentyHoursIsMissingAfterContinueAttempt,
                        shakeToken: viewModel.draftContinueAttemptToken
                    )
                    Text("Use your usual weekly hours.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    SNAPYesNoSegmentedQuestion(
                        title: "Do you participate in work-study?",
                        value: $viewModel.application.participatesInWorkStudy,
                        isMissingRequired: workStudyIsMissingAfterContinueAttempt,
                        shakeToken: viewModel.draftContinueAttemptToken
                    )
                    Text("Ex: A school-arranged job funded partly by the government that lets students earn money while enrolled.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    SNAPYesNoSegmentedQuestion(
                        title: "Are you responsible for a dependent child?",
                        value: dependentChildResponsibilityBinding,
                        isMissingRequired: dependentChildIsMissingAfterContinueAttempt,
                        shakeToken: viewModel.draftContinueAttemptToken
                    )
                    Text("Answer based on your current responsibility.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                }
            }
        }
    }

    private var expensesStep: some View {
        VStack(spacing: CivicaSpacing.md) {
            SNAPSectionCard(
                title: "Expense estimates",
                helper: nil,
                headerAccessory: {
                    SNAPCardInfoButton(
                        isExpanded: $isExpensesWhyExpanded,
                        label: "Why we ask"
                    )
                }
            ) {
                SNAPStepGuidanceRows(
                    whatText: "",
                    whyText: "Rent and utilities may affect your SNAP amount. Utilities, including basic internet in some cases, can matter in official review. This draft helps you collect estimates before you continue.",
                    doNotShareText: "Do not enter medical diagnoses, medical history, account numbers, landlord private details, or document images.",
                    isWhyExpanded: $isExpensesWhyExpanded
                ) {

                SNAPInputLabel("Monthly rent or housing", badge: .required())
                HStack(spacing: CivicaSpacing.sm) {
                    Text("$")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(CivicaColors.textPrimary)

                    TextField("0", text: $viewModel.application.rentOrHousingCost)
                        .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .rent)

                    Spacer(minLength: 0)

                    Text("/ monthly")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textSecondary)
                }
                .snapCompactFieldSurface()
                .modifier(
                    SNAPRequiredFieldShake(
                        isActive: rentIsMissingAfterContinueAttempt,
                        trigger: viewModel.draftContinueAttemptToken
                    )
                )

                Text("Enter your usual monthly rent, mortgage, or housing payment estimate.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                SNAPInputLabel("Monthly utilities", badge: .required())
                HStack(spacing: CivicaSpacing.sm) {
                    Text("$")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(CivicaColors.textPrimary)

                    TextField("0", text: $viewModel.application.utilitiesCost)
                        .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .utilities)

                    Spacer(minLength: 0)

                    Text("/ monthly")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textSecondary)
                }
                .snapCompactFieldSurface()
                .modifier(
                    SNAPRequiredFieldShake(
                        isActive: utilitiesIsMissingAfterContinueAttempt,
                        trigger: viewModel.draftContinueAttemptToken
                    )
                )

                Text("Enter a broad monthly estimate for utilities such as electricity, gas, water, heat, or phone, if applicable.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                if shouldShowChildcareExpensesField {
                    SNAPInputLabel("Monthly childcare", badge: .optional)
                    HStack(spacing: CivicaSpacing.sm) {
                        Text("$")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(CivicaColors.textPrimary)

                        TextField("0", text: $viewModel.application.childcareCostEstimate)
                            .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .childcare)

                        Spacer(minLength: 0)

                        Text("/ monthly")
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.textSecondary)
                    }
                    .snapCompactFieldSurface()

                    Text("Enter a monthly estimate only if childcare costs apply to you.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                SNAPInputLabel("Monthly medical costs", badge: .optionalEstimate)
                HStack(spacing: CivicaSpacing.sm) {
                    Text("$")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(CivicaColors.textPrimary)

                    TextField("0", text: $viewModel.application.medicalExpensesEstimate)
                        .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .medical)

                    Spacer(minLength: 0)

                    Text("/ monthly")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textSecondary)
                }
                .snapCompactFieldSurface()

                Text("Enter only a dollar estimate. Do not include diagnoses, prescriptions, or medical history.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var documentsChecklistStep: some View {
        VStack(spacing: CivicaSpacing.md) {
            SNAPSectionCard(
                title: "Checklist items",
                helper: nil,
                headerAccessory: {
                    SNAPCardInfoButton(
                        isExpanded: $isDocumentsWhyExpanded,
                        label: "Why we ask"
                    )
                }
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Mark documents you already have or may want to gather before using the official application.",
                    whyText: "Having documents ready can make the official application process easier. This checklist does not upload, store, or submit documents.",
                    doNotShareText: "Do not upload document images, type document numbers, or enter immigration details in this draft.",
                    isWhyExpanded: $isDocumentsWhyExpanded
                ) {

                Text("Upload once. We'll use a document anywhere it helps.")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.ctaBlue)

                Text("You may not need every document right away. Upload what you have now; the agency may ask for more later.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                if viewModel.application.expeditedCandidate {
                    Text("Expedited path: focus on Identity first. Other documents can be added later.")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                ForEach(visibleChecklistDocuments) { document in
                    let hasDocument = viewModel.application.documentsAvailable.contains(document)
                    Button {
                        toggleDocument(document)
                    } label: {
                        HStack(spacing: CivicaSpacing.sm) {
                            Text(hasDocument ? "●" : "○")
                                .font(CivicaTypography.subheadStrong)
                                .foregroundStyle(hasDocument ? CivicaColors.ctaBlue : CivicaColors.textSecondary)

                            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                                HStack(spacing: CivicaSpacing.sm) {
                                    Text(document.label)
                                        .font(CivicaTypography.subhead)
                                        .foregroundStyle(CivicaColors.textPrimary)
                                        .multilineTextAlignment(.leading)

                                    Text("Helpful")
                                        .font(CivicaTypography.captionStrong)
                                        .foregroundStyle(CivicaColors.textSecondary)
                                        .padding(.horizontal, CivicaSpacing.sm)
                                        .padding(.vertical, CivicaSpacing.xs)
                                        .background(
                                            Capsule(style: .continuous)
                                                .fill(CivicaColors.surfaceSecondary)
                                        )
                                        .overlay(
                                            Capsule(style: .continuous)
                                                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                                        )
                                }

                                if let helperText = documentHelperText(for: document) {
                                    Text(helperText)
                                        .font(CivicaTypography.footnoteStrong)
                                        .foregroundStyle(CivicaColors.textSecondary)
                                        .multilineTextAlignment(.leading)
                                        .fixedSize(horizontal: false, vertical: true)
                                }

                                if let exampleText = documentExampleText(for: document) {
                                    Text(exampleText)
                                        .font(CivicaTypography.caption)
                                        .foregroundStyle(CivicaColors.textSecondary)
                                        .multilineTextAlignment(.leading)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }

                            Spacer(minLength: 0)

                            Text(hasDocument ? "Have this" : "Still need / Not sure")
                                .font(CivicaTypography.captionStrong)
                                .foregroundStyle(hasDocument ? CivicaColors.ctaBlue : CivicaColors.textSecondary)
                                .padding(.horizontal, CivicaSpacing.sm)
                                .padding(.vertical, CivicaSpacing.xs)
                                .background(
                                    Capsule(style: .continuous)
                                        .fill(hasDocument ? CivicaColors.statusInfoSurface : CivicaColors.surfaceSecondary)
                                )
                                .overlay(
                                    Capsule(style: .continuous)
                                        .stroke(hasDocument ? CivicaColors.ctaBlue.opacity(0.28) : CivicaColors.borderSubtle, lineWidth: 1)
                                )
                        }
                        .padding(.horizontal, CivicaSpacing.md)
                        .padding(.vertical, CivicaSpacing.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                                .fill(CivicaColors.surfacePrimary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }

                Text("This step does not store document images.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)

                Button("Save checklist to Images") {
                    // EXPERIMENTAL SILOED MODULE:
                    // Export a rendered checklist image through the iOS share sheet.
                    // This avoids backend storage and keeps SNAP data session-first.
                    checklistShareItems = [makeChecklistImage()]
                    showingChecklistShareSheet = true
                }
                .buttonStyle(SNAPSecondaryCTAButtonStyle())
                .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private var reviewDraftStep: some View {
        VStack(spacing: CivicaSpacing.md) {
            SNAPSectionCard(
                title: "Before continuing",
                helper: nil,
                headerAccessory: {
                    SNAPCardInfoButton(
                        isExpanded: $isReviewWhyExpanded,
                        label: "Why we ask"
                    )
                }
            ) {
                SNAPStepGuidanceRows(
                    whatText: "",
                    whyText: "Reviewing now can help you catch missing or incorrect information before you continue.",
                    doNotShareText: "Do not add extra sensitive information. Only correct the fields this assistant asks for.",
                    isWhyExpanded: $isReviewWhyExpanded
                ) {
                Text("Required Sections: \(requiredSectionsCompletedCount) of \(requiredSectionsTotalCount)")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.textPrimary)

                Text("Optional Sections: \(optionalSectionsCompletedCount) of \(optionalSectionsTotalCount)")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.textSecondary)

                Text("When this looks right, continue to the next step. This still does not submit your SNAP application.")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.warningAmber)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }

            SNAPSectionCard(
                title: "Review your application",
                helper: nil,
                titleAlignment: .center
            ) {
                ForEach(Array(reviewSectionSummaries.enumerated()), id: \.element.id) { index, section in
                    VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                        HStack(spacing: CivicaSpacing.sm) {
                            Text(section.title)
                                .font(CivicaTypography.sectionHeaderBold)
                                .foregroundStyle(CivicaColors.ctaBlue)

                            SNAPReviewStatusBadge(status: section.status)

                            Spacer(minLength: 0)

                            Button("Edit") {
                                viewModel.jumpToDraftStep(section.step)
                            }
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.ctaBlue)
                        }

                        ForEach(section.rows) { row in
                            let isMissingRequired = row.isRequired && row.value == "Not provided"
                            HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                                Text(row.label)
                                    .font(CivicaTypography.footnoteStrong)
                                    .foregroundStyle(isMissingRequired ? CivicaColors.ctaRed : CivicaColors.textSecondary)
                                Spacer(minLength: 8)
                                Text(row.value)
                                    .font(CivicaTypography.footnote)
                                    .foregroundStyle(isMissingRequired ? CivicaColors.ctaRed : CivicaColors.textSecondary)
                                    .multilineTextAlignment(.trailing)
                            }
                            .padding(.vertical, CivicaSpacing.xs)
                        }

                        if index < reviewSectionSummaries.count - 1 {
                            Divider()
                                .padding(.top, CivicaSpacing.xs)
                        }
                    }
                }
            }

            SNAPSectionCard(
                title: "Interview Prep Summary",
                helper: nil
            ) {
                Text("Use this to prepare for your SNAP interview. This is not an official eligibility decision.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Text("For prep only")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.ctaBlue)

                Text("DTA/the state SNAP agency makes the final decision.")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                SNAPInterviewSummarySection(
                    title: "Expedited screening",
                    rows: [
                        .init(label: "User estimate", value: viewModel.expeditedScreeningResult.label)
                    ]
                )

                SNAPInterviewSummarySection(
                    title: "Official application",
                    rows: officialApplicationSummaryRows
                )

                SNAPInterviewSummarySection(
                    title: "Household notes",
                    rows: householdSummaryRows
                )

                SNAPInterviewSummarySection(
                    title: "Income notes",
                    rows: incomeSummaryRows
                )

                SNAPInterviewSummarySection(
                    title: "Housing/utilities notes",
                    rows: housingUtilitySummaryRows
                )

                SNAPInterviewSummarySection(
                    title: "Documents",
                    rows: documentsSummaryRows
                )

                SNAPInterviewSummarySection(
                    title: "What to tell the SNAP office",
                    rows: [
                        .init(label: "User estimate", value: viewModel.interviewPrepSummaryText)
                    ]
                )

                if !followUpRisks.isEmpty {
                    SNAPInterviewSummarySection(
                        title: "Follow-up risks",
                        rows: followUpRisks.map { risk in
                            .init(label: "Warning", value: risk)
                        }
                    )
                }
            }
        }
    }

    private var nextStepsStep: some View {
        VStack(spacing: CivicaSpacing.md) {
            SNAPSectionCard(
                title: "Timeline at a glance",
                helper: nil
            ) {
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text("You may need expedited SNAP screening")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.textPrimary)

                    Text("You may qualify for emergency SNAP. If the SNAP office confirms eligibility, benefits can be available within 7 calendar days.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(SNAPCopy.globalDisclaimer)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.ctaBlue)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, CivicaSpacing.sm)
                .padding(.vertical, CivicaSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .fill(CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                )

                VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                    Text("Day tracker")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.textPrimary)

                    if let officialSubmissionDate = viewModel.application.officialSNAPApplicationSubmissionDate {
                        HStack(spacing: CivicaSpacing.sm) {
                            Text("Day \(daysSinceDate(officialSubmissionDate))")
                                .font(CivicaTypography.subheadBold)
                                .foregroundStyle(CivicaColors.ctaBlue)
                                .padding(.horizontal, CivicaSpacing.sm)
                                .padding(.vertical, CivicaSpacing.xs)
                                .background(
                                    Capsule(style: .continuous)
                                        .fill(CivicaColors.statusInfoSurface)
                                )

                            Text("since official application submission")
                                .font(CivicaTypography.footnote)
                                .foregroundStyle(CivicaColors.textSecondary)
                        }

                        Text("Official application date: \(compactDateText(from: officialSubmissionDate))")
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.textSecondary)
                    } else {
                        Text("SNAP clock has not started in this app")
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.textPrimary)

                        Text("The SNAP timeline starts after your official application is submitted to DTA/the state SNAP agency.")
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    if let submittedAt = viewModel.submittedAt {
                        Text("Prep checklist completed \(compactDateText(from: submittedAt))")
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.successGreen)
                    }
                }
                .padding(.bottom, CivicaSpacing.xs)

                if let stateTimeline = selectedStateTimeline {
                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        Text("\(stateTimeline.displayName) update")
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.textPrimary)

                        Text("Recent on-time rate: \(stateTimeline.onTimeRatePercentText)")
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)

                    }
                    .padding(.bottom, CivicaSpacing.xs)
                } else {
                    Text("State-specific timing details will appear after you select a state.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                }

                SNAPTimelineMilestoneRow(
                    dayRange: "Day 0",
                    title: "Submit official application",
                    detail: "Use your state portal to submit your official SNAP application."
                )

                SNAPTimelineMilestoneRow(
                    dayRange: "By Day 30",
                    title: "Regular SNAP timing",
                    detail: SNAPStateResources.federalTimelineSummary.regularSNAPDeadline
                )

                SNAPTimelineMilestoneRow(
                    dayRange: "By Day 7",
                    title: "Expedited SNAP timing",
                    detail: SNAPStateResources.federalTimelineSummary.expeditedSNAPDeadline
                )
            }

            SNAPSectionCard(
                title: "Next-step checklist",
                helper: nil,
                headerAccessory: {
                    SNAPCardInfoButton(
                        isExpanded: $isNextStepsWhyExpanded,
                        label: "Why this matters"
                    )
                }
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Use your draft and checklist to continue with your official state SNAP application.",
                    whyText: "This assistant helped you prepare. Your application is not submitted until you complete it through the official process.",
                    doNotShareText: "Only enter sensitive information, such as SSN or document details, on the official state application website or with a trusted benefits worker.",
                    whyLabel: "Why this matters",
                    isWhyExpanded: $isNextStepsWhyExpanded
                ) {
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text("Document follow-up")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.textPrimary)

                    Text("Identity is needed first. Send what you have now; missing non-identity items should not by itself delay emergency processing.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, CivicaSpacing.sm)
                .padding(.vertical, CivicaSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .fill(CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                )

                }
            }

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text("Your draft is ready.")
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.textPrimary)

                Text("Not submitted yet.")
                    .font(CivicaTypography.sectionHeaderBold)
                    .foregroundStyle(CivicaColors.warningAmber)

                Text("Next: continue through your official state SNAP application.")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                    .fill(CivicaColors.statusWarningSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                    .stroke(CivicaColors.warningAmber.opacity(0.45), lineWidth: 1)
            )
        }
    }

    private func documentExampleText(for document: SNAPDocumentType) -> String? {
        switch document {
        case .photoID:
            return "Ex: Driver's license, state ID, passport, school ID, shelter ID, or collateral contact."
        case .proofOfAddress:
            if viewModel.application.housingStatus == .unhoused {
                return "Ex: Official mail, shelter letter, landlord letter, or letter from someone you stay with. A permanent address is not required when you are unhoused."
            }
            return "Ex: Lease, utility bill, official mail, shelter letter, landlord letter, or letter from someone you stay with."
        case .proofOfIncome:
            return "Ex: Pay stubs, employer letter, unemployment statement, Social Security/SSI/SSDI award letter, VA benefit letter, child support record, or cash assistance notice."
        case .rentOrHousingCostProof:
            return "Ex: Lease, rent receipt, mortgage statement, landlord letter, or written note showing what you pay."
        case .utilityBill:
            return "Ex: Electric, gas, heating, water/sewer, phone, or internet bill."
        case .studentStatusDocuments:
            return "Ex: Class schedule, enrollment letter, school registration record, financial aid letter, or work-study award/approval."
        case .workStatusOrExemptions:
            return "Ex: Pay stubs, employer letter, work schedule, disability benefit letter, doctor note, caregiving statement, or school/work-study proof."
        case .childcareCostProof:
            return "Ex: Childcare invoices, provider receipts, or a written statement showing what you pay each month."
        case .immigrationDocumentsIfRelevant:
            return "Ex: Only if the official application asks. Bring what the state office requests for your household."
        }
    }

    private func documentHelperText(for document: SNAPDocumentType) -> String? {
        switch document {
        case .photoID:
            return "Proves you are who you say you are."
        case .proofOfAddress:
            return "Proves you live in the state where you are applying."
        case .proofOfIncome:
            return "Proves money coming into your household."
        case .rentOrHousingCostProof:
            return "May increase your SNAP amount by showing rent or housing costs."
        case .utilityBill:
            return "May increase your SNAP amount by showing utility expenses."
        case .studentStatusDocuments:
            return "Helps determine student SNAP eligibility."
        case .workStatusOrExemptions:
            return "Helps confirm employment or reasons work rules may not apply."
        case .childcareCostProof, .immigrationDocumentsIfRelevant:
            return nil
        }
    }

    private var householdSizeSelection: Binding<Int> {
        Binding<Int>(
            get: { viewModel.application.householdSize ?? 0 },
            set: { newValue in
                viewModel.application.householdSize = newValue == 0 ? nil : newValue
                if newValue == 1 {
                    // Hide and clear multi-person-only follow-ups for single-person households.
                    viewModel.application.buysAndPreparesFoodWithOthers = nil
                    viewModel.application.spouseLivesWithUser = nil
                    viewModel.application.childUnder22LivesWithParentInHome = nil
                    viewModel.application.childrenInHousehold = nil
                    viewModel.application.hasSpouseInHousehold = nil
                    viewModel.application.hasChildUnder22LivingWithParent = nil
                    viewModel.application.hasChildren = nil
                }
            }
        )
    }

    private var selectedStateTimeline: SNAPStateTimelineContext? {
        SNAPStateResources.timelineContext(for: viewModel.application.state)
    }

    private var reviewSectionSummaries: [SNAPReviewSectionSummary] {
        [
            SNAPReviewSectionSummary(
                id: "where_applying_from",
                title: "Where are you currently residing?",
                step: .whereApplyingFrom,
                status: locationReviewStatus,
                rows: [
                    SNAPReviewSectionRow(label: "State", value: normalized(viewModel.application.state).isEmpty ? "Not provided" : normalized(viewModel.application.state), isRequired: true),
                    SNAPReviewSectionRow(label: "City", value: normalized(viewModel.application.residentialCity).isEmpty ? "Not provided" : normalized(viewModel.application.residentialCity), isRequired: shouldCollectResidentialAddress),
                    SNAPReviewSectionRow(label: "ZIP code", value: normalized(viewModel.application.residentialZIP).isEmpty ? "Not provided" : normalized(viewModel.application.residentialZIP), isRequired: shouldCollectResidentialAddress),
                    SNAPReviewSectionRow(label: "Housing status", value: viewModel.application.housingStatus?.label ?? "Not provided", isRequired: true)
                ]
            ),
            SNAPReviewSectionSummary(
                id: "household_basics",
                title: "Your Food Household",
                step: .householdBasics,
                status: householdReviewStatus,
                rows: [
                    SNAPReviewSectionRow(label: "Food household size", value: displayOptionalInt(viewModel.application.householdSize), isRequired: true),
                    SNAPReviewSectionRow(label: "Buy/prepare food with others", value: ternaryChoiceText(viewModel.application.buysAndPreparesFoodWithOthers)),
                    SNAPReviewSectionRow(label: "Spouse lives with you", value: ternaryChoiceText(viewModel.application.spouseLivesWithUser)),
                    SNAPReviewSectionRow(label: "Child under 22 with parent in home", value: ternaryChoiceText(viewModel.application.childUnder22LivesWithParentInHome)),
                    SNAPReviewSectionRow(label: "Children in household", value: ternaryChoiceText(viewModel.application.childrenInHousehold)),
                    SNAPReviewSectionRow(label: "Anyone age 60 or older", value: ternaryChoiceText(viewModel.application.anyoneAge60OrOlder)),
                    SNAPReviewSectionRow(label: "Anyone with a disability", value: ternaryChoiceText(viewModel.application.anyoneWithDisability)),
                    SNAPReviewSectionRow(label: "Anyone pregnant", value: ternaryChoiceText(viewModel.application.anyonePregnant)),
                    SNAPReviewSectionRow(label: "Anyone unhoused / no fixed mailing address", value: ternaryChoiceText(viewModel.application.anyoneUnhousedOrNoFixedMailingAddress)),
                    SNAPReviewSectionRow(label: "Safe mailing/contact option", value: viewModel.application.preferredSafeMailingContactOption?.label ?? "Not provided")
                ]
            ),
            SNAPReviewSectionSummary(
                id: "applicant_age",
                title: "Applicant age",
                step: .applicantAge,
                status: applicantAgeReviewStatus,
                rows: [
                    SNAPReviewSectionRow(label: "Date of birth", value: viewModel.application.applicantDateOfBirth.map(readableDate) ?? "Not provided", isRequired: true),
                    SNAPReviewSectionRow(label: "Age", value: displayOptionalInt(viewModel.application.applicantAge))
                ]
            ),
            SNAPReviewSectionSummary(
                id: "contact_preference",
                title: "Contact information",
                step: .addressContact,
                status: contactReviewStatus,
                rows: [
                    SNAPReviewSectionRow(label: "Preferred contact method", value: viewModel.application.preferredContactMethod?.label ?? "Not provided"),
                    SNAPReviewSectionRow(label: "Email", value: normalized(viewModel.application.contactEmail).isEmpty ? "Not provided" : normalized(viewModel.application.contactEmail)),
                    SNAPReviewSectionRow(label: "Phone Number", value: normalized(viewModel.application.contactPhone).isEmpty ? "Not provided" : normalized(viewModel.application.contactPhone))
                ]
            ),
            SNAPReviewSectionSummary(
                id: "income",
                title: "Income",
                step: .income,
                status: incomeReviewStatus,
                rows: [
                    SNAPReviewSectionRow(label: "Employment status", value: viewModel.application.employmentStatus?.label ?? "Not provided", isRequired: true),
                    SNAPReviewSectionRow(label: "Estimated monthly income", value: displayCurrency(viewModel.application.monthlyIncomeEstimate), isRequired: true),
                    SNAPReviewSectionRow(label: "Income changes month to month", value: yesNoUnknown(viewModel.application.incomeChangesMonthToMonth), isRequired: true),
                    SNAPReviewSectionRow(label: "Works for employer", value: ternaryChoiceText(viewModel.application.worksForEmployer)),
                    SNAPReviewSectionRow(label: "Self-employed or gig work", value: ternaryChoiceText(viewModel.application.selfEmployedOrGigWork)),
                    SNAPReviewSectionRow(label: "Other income sources", value: viewModel.application.otherIncomeSources.isEmpty ? "None selected" : "\(viewModel.application.otherIncomeSources.count) selected")
                ]
            ),
            SNAPReviewSectionSummary(
                id: "student_status",
                title: "Student status",
                step: .studentStatus,
                status: studentReviewStatus,
                rows: studentReviewRows
            ),
            SNAPReviewSectionSummary(
                id: "expenses",
                title: "Expenses",
                step: .expenses,
                status: expensesReviewStatus,
                rows: expensesReviewRows
            ),
            SNAPReviewSectionSummary(
                id: "documents",
                title: "Documents",
                step: .documentsChecklist,
                status: documentsReviewStatus,
                rows: documentsReviewRows
            )
        ]
    }

    private var studentReviewRows: [SNAPReviewSectionRow] {
        var rows: [SNAPReviewSectionRow] = [
            SNAPReviewSectionRow(
                label: "Enrolled in higher education",
                value: yesNoUnknown(viewModel.application.isCurrentlyEnrolledInHigherEducation),
                isRequired: true
            )
        ]

        if viewModel.application.isCurrentlyEnrolledInHigherEducation == true {
            rows.append(SNAPReviewSectionRow(label: "Enrolled at least half-time", value: yesNoUnknown(viewModel.application.isEnrolledAtLeastHalfTime), isRequired: true))
            rows.append(SNAPReviewSectionRow(label: "Works at least 20 hours/week", value: yesNoUnknown(viewModel.application.worksAtLeastTwentyHoursPerWeek), isRequired: true))
            rows.append(SNAPReviewSectionRow(label: "Participates in work-study", value: yesNoUnknown(viewModel.application.participatesInWorkStudy), isRequired: true))
            rows.append(SNAPReviewSectionRow(label: "Responsible for dependent child", value: yesNoUnknown(viewModel.application.isResponsibleForDependentChild), isRequired: true))
        } else if viewModel.application.isCurrentlyEnrolledInHigherEducation == false {
            rows.append(SNAPReviewSectionRow(label: "Follow-up questions", value: "Not required"))
        }

        return rows
    }

    private var expensesReviewRows: [SNAPReviewSectionRow] {
        var rows: [SNAPReviewSectionRow] = [
            SNAPReviewSectionRow(label: "Monthly rent or housing", value: displayCurrency(viewModel.application.rentOrHousingCost), isRequired: true),
            SNAPReviewSectionRow(label: "Monthly utilities", value: displayCurrency(viewModel.application.utilitiesCost), isRequired: true)
        ]

        if shouldShowChildcareExpensesField {
            rows.append(
                SNAPReviewSectionRow(
                    label: "Monthly childcare",
                    value: displayCurrency(viewModel.application.childcareCostEstimate)
                )
            )
        } else {
            rows.append(SNAPReviewSectionRow(label: "Monthly childcare", value: "Not applicable"))
        }

        rows.append(
            SNAPReviewSectionRow(
                label: "Monthly medical costs",
                value: displayCurrency(viewModel.application.medicalExpensesEstimate)
            )
        )

        return rows
    }

    private var documentsReviewRows: [SNAPReviewSectionRow] {
        let selectedVisibleDocuments = visibleChecklistDocuments.filter { document in
            viewModel.application.documentsAvailable.contains(document)
        }

        guard !selectedVisibleDocuments.isEmpty else {
            return [SNAPReviewSectionRow(label: "Selected documents", value: "None selected yet")]
        }

        return [
            SNAPReviewSectionRow(
                label: "Selected documents",
                value: "\(selectedVisibleDocuments.count) selected"
            )
        ]
    }

    private var householdReviewStatus: SNAPReviewSectionStatus {
        let isMissingRequired = viewModel.application.householdSize == nil

        if isMissingRequired {
            return .missingRequiredInfo
        }

        let hasMissingOptional =
            (shouldAskMultiPersonHouseholdFollowUps && (
                viewModel.application.buysAndPreparesFoodWithOthers == nil
                    || viewModel.application.spouseLivesWithUser == nil
                    || viewModel.application.childUnder22LivesWithParentInHome == nil
                    || viewModel.application.childrenInHousehold == nil
            ))
            || viewModel.application.anyoneAge60OrOlder == nil
            || viewModel.application.anyoneWithDisability == nil
            || viewModel.application.anyonePregnant == nil
            || viewModel.application.anyoneUnhousedOrNoFixedMailingAddress == nil

        return hasMissingOptional ? .optionalNotProvided : .complete
    }

    private var applicantAgeReviewStatus: SNAPReviewSectionStatus {
        let hasAge = viewModel.application.applicantDateOfBirth != nil || viewModel.application.applicantAge != nil
        return hasAge ? .complete : .missingRequiredInfo
    }

    private var locationReviewStatus: SNAPReviewSectionStatus {
        let isMissingRequired = isBlank(viewModel.application.state)

        if isMissingRequired {
            return .missingRequiredInfo
        }

        if viewModel.application.housingStatus == nil {
            return .missingRequiredInfo
        }

        if shouldCollectResidentialAddress
            && (isBlank(viewModel.application.residentialCity)
                || isBlank(viewModel.application.residentialZIP)) {
            return .missingRequiredInfo
        }

        return .complete
    }

    private var incomeReviewStatus: SNAPReviewSectionStatus {
        let isMissingRequired = viewModel.application.employmentStatus == nil
            || isBlank(viewModel.application.monthlyIncomeEstimate)
            || viewModel.application.incomeChangesMonthToMonth == nil

        return isMissingRequired ? .missingRequiredInfo : .complete
    }

    private var contactReviewStatus: SNAPReviewSectionStatus {
        let hasMethod = viewModel.application.preferredContactMethod != nil
        let hasEmail = !isBlank(viewModel.application.contactEmail)
        let hasPhone = !isBlank(viewModel.application.contactPhone)

        return (hasMethod || hasEmail || hasPhone) ? .complete : .optionalNotProvided
    }

    private var studentReviewStatus: SNAPReviewSectionStatus {
        guard let isStudent = viewModel.application.isCurrentlyEnrolledInHigherEducation else {
            return .missingRequiredInfo
        }

        guard isStudent else {
            return .complete
        }

        let isMissingRequired = viewModel.application.isEnrolledAtLeastHalfTime == nil
            || viewModel.application.worksAtLeastTwentyHoursPerWeek == nil
            || viewModel.application.participatesInWorkStudy == nil
            || viewModel.application.isResponsibleForDependentChild == nil

        return isMissingRequired ? .missingRequiredInfo : .complete
    }

    private var expensesReviewStatus: SNAPReviewSectionStatus {
        let isMissingRequired = isBlank(viewModel.application.rentOrHousingCost)
            || isBlank(viewModel.application.utilitiesCost)

        if isMissingRequired {
            return .missingRequiredInfo
        }

        let hasMissingOptionalMedical = isBlank(viewModel.application.medicalExpensesEstimate)
        let hasMissingOptionalChildcare = shouldShowChildcareExpensesField
            && isBlank(viewModel.application.childcareCostEstimate)

        return (hasMissingOptionalMedical || hasMissingOptionalChildcare) ? .optionalNotProvided : .complete
    }

    private var documentsReviewStatus: SNAPReviewSectionStatus {
        viewModel.application.documentsAvailable.isEmpty ? .optionalNotProvided : .complete
    }

    private var requiredSectionsTotalCount: Int {
        reviewSectionSummaries.filter { !isOptionalReviewSection($0.step) }.count
    }

    private var optionalSectionsTotalCount: Int {
        reviewSectionSummaries.filter { isOptionalReviewSection($0.step) }.count
    }

    private var requiredSectionsCompletedCount: Int {
        reviewSectionSummaries.filter { !isOptionalReviewSection($0.step) && $0.status == .complete }.count
    }

    private var optionalSectionsCompletedCount: Int {
        reviewSectionSummaries.filter { isOptionalReviewSection($0.step) && $0.status == .complete }.count
    }

    private func isOptionalReviewSection(_ step: SNAPDraftStep) -> Bool {
        switch step {
        case .addressContact, .documentsChecklist:
            return true
        default:
            return false
        }
    }

    private var officialApplicationSummaryRows: [SNAPInterviewSummaryRow] {
        let submitted = viewModel.application.hasSubmittedOfficialSNAPApplication
        let submittedDate = viewModel.application.officialSNAPApplicationSubmissionDate

        switch submitted {
        case .some(true):
            if let submittedDate {
                return [.init(label: "Submitted date", value: readableDate(submittedDate))]
            }
            return [.init(label: "Submitted date", value: "Unknown")]
        case .some(false):
            return [.init(label: "Status", value: "Not submitted yet")]
        case .none:
            return [.init(label: "Status", value: "Unknown")]
        }
    }

    private var householdSummaryRows: [SNAPInterviewSummaryRow] {
        var rows: [SNAPInterviewSummaryRow] = []
        rows.append(.init(label: "Household size", value: displayOptionalInt(viewModel.application.householdSize)))
        rows.append(.init(label: "Buy/prepare food with others", value: ternaryChoiceText(viewModel.application.buysAndPreparesFoodWithOthers)))
        rows.append(.init(label: "Spouse in household", value: ternaryChoiceText(viewModel.application.spouseLivesWithUser)))
        rows.append(.init(label: "Child under 22 living with parent", value: ternaryChoiceText(viewModel.application.childUnder22LivesWithParentInHome)))
        rows.append(.init(label: "Children in household", value: ternaryChoiceText(viewModel.application.childrenInHousehold)))
        rows.append(.init(label: "Anyone age 60 or older", value: ternaryChoiceText(viewModel.application.anyoneAge60OrOlder)))
        rows.append(.init(label: "Anyone with disability", value: ternaryChoiceText(viewModel.application.anyoneWithDisability)))
        rows.append(.init(label: "Anyone pregnant", value: ternaryChoiceText(viewModel.application.anyonePregnant)))
        rows.append(.init(label: "Anyone unhoused / no fixed mailing address", value: ternaryChoiceText(viewModel.application.anyoneUnhousedOrNoFixedMailingAddress)))
        rows.append(.init(label: "Safe mailing/contact option", value: viewModel.application.preferredSafeMailingContactOption?.label ?? "Not provided"))

        return rows
    }

    private var incomeSummaryRows: [SNAPInterviewSummaryRow] {
        var rows: [SNAPInterviewSummaryRow] = [
            .init(
                label: "Income sources",
                value: incomeSourcesSummaryText
            ),
            .init(
                label: "Income varies month to month",
                value: yesNoUnknown(viewModel.application.incomeChangesMonthToMonth)
            ),
            .init(
                label: "Works for employer",
                value: ternaryChoiceText(viewModel.application.worksForEmployer)
            ),
            .init(
                label: "Self-employed or gig work",
                value: ternaryChoiceText(viewModel.application.selfEmployedOrGigWork)
            ),
            .init(
                label: "Pay frequency",
                value: viewModel.application.earnedPayFrequency?.label ?? "Not provided"
            )
        ]

        if viewModel.application.selfEmployedOrGigWork == .yes || viewModel.application.employmentStatus == .selfEmployed {
            rows.append(.init(label: "Self-employment / gig work", value: "Yes"))
            rows.append(.init(label: "Gross receipts this month", value: displayCurrency(viewModel.application.gigGrossReceiptsThisMonth)))
            rows.append(.init(label: "Business/work expenses this month", value: displayCurrency(viewModel.application.gigBusinessExpensesThisMonth)))
            rows.append(.init(label: "Gig income varies month to month", value: ternaryChoiceText(viewModel.application.gigIncomeVariesMonthToMonth)))
        }

        rows.append(.init(label: "Recent job loss or stopped work", value: ternaryChoiceText(viewModel.application.recentJobLossOrStoppedWorkChoice)))

        return rows
    }

    private var housingUtilitySummaryRows: [SNAPInterviewSummaryRow] {
        var rows: [SNAPInterviewSummaryRow] = [
            .init(label: "Rent/mortgage/shelter (User estimate)", value: displayCurrency(firstNonBlank(viewModel.application.expeditedHousingCostEstimate, viewModel.application.rentOrHousingCost))),
            .init(label: "Utilities (User estimate)", value: displayCurrency(firstNonBlank(viewModel.application.expeditedUtilityEstimate, viewModel.application.utilitiesCost)))
        ]

        rows.append(
            .init(
                label: "Pays utilities",
                value: yesNoUnknown(viewModel.application.expeditedPaysUtilities)
            )
        )

        if viewModel.application.housingStatus == .unhoused {
            rows.append(.init(label: "No fixed mailing address", value: "Yes"))
        }

        return rows
    }

    private var documentsSummaryRows: [SNAPInterviewSummaryRow] {
        let visible = visibleChecklistDocuments
        let ready = visible.filter { viewModel.application.documentsAvailable.contains($0) }
        let missingOrNotSureCount = max(0, visible.count - ready.count)
        return [
            .init(label: "Ready", value: "\(ready.count)"),
            .init(label: "Missing", value: "\(missingOrNotSureCount)"),
            .init(label: "Not sure", value: "\(missingOrNotSureCount)")
        ]
    }

    private var followUpRisks: [String] {
        var risks: [String] = []

        if viewModel.application.officialSNAPApplicationSubmissionDate == nil {
            risks.append("No official application date is recorded yet.")
        }
        if viewModel.application.preferredContactMethod == nil {
            let hasDirectContact =
                !normalized(viewModel.application.contactEmail).isEmpty
                || !normalized(viewModel.application.contactPhone).isEmpty
            if !hasDirectContact {
                risks.append("No safe contact method is selected.")
            }
        }
        if viewModel.application.interviewScheduledOrCompleted != true {
            risks.append("Interview is not marked as scheduled/completed.")
        }
        if viewModel.application.documentDueDate == nil {
            risks.append("Document due date is missing.")
        }
        if viewModel.expeditedScreeningResult == .unclear {
            risks.append("Expedited screening is unclear because income/resources/housing details are incomplete.")
        }

        return risks
    }

    private var incomeSourcesSummaryText: String {
        if !normalized(viewModel.application.incomeSourceNotes).isEmpty {
            return normalized(viewModel.application.incomeSourceNotes)
        }

        if !viewModel.application.otherIncomeSources.isEmpty {
            return viewModel.application.otherIncomeSources.map(\.label).joined(separator: ", ")
        }

        if !normalized(viewModel.application.gigWorkTypeOrPlatform).isEmpty {
            return normalized(viewModel.application.gigWorkTypeOrPlatform)
        }

        if !normalized(viewModel.application.employerOrJobType).isEmpty {
            return normalized(viewModel.application.employerOrJobType)
        }

        if let employmentStatus = viewModel.application.employmentStatus {
            return employmentStatus.label
        }

        return "Not provided"
    }

    private func displayOptionalInt(_ value: Int?) -> String {
        guard let value else { return "Not provided" }
        return "\(value)"
    }

    private func displayCurrency(_ value: String?) -> String {
        let normalizedValue = normalized(value)
        guard !normalizedValue.isEmpty else { return "Not provided" }
        if normalizedValue.hasPrefix("$") { return normalizedValue }
        return "$\(normalizedValue)"
    }

    private func yesNoUnknown(_ value: Bool?) -> String {
        guard let value else { return "Not provided" }
        return value ? "Yes" : "No"
    }

    private func ternaryChoiceText(_ value: SNAPTernaryChoice?) -> String {
        guard let value else { return "Not provided" }
        return value.label
    }

    private func boolValue(from choice: SNAPTernaryChoice?) -> Bool? {
        switch choice {
        case .some(.yes):
            return true
        case .some(.no):
            return false
        case .some(.notSure), .none:
            return nil
        }
    }

    private func normalized(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func isBlank(_ value: String?) -> Bool {
        normalized(value).isEmpty
    }

    private func firstNonBlank(_ values: String?...) -> String? {
        for value in values {
            let normalizedValue = normalized(value)
            if !normalizedValue.isEmpty {
                return normalizedValue
            }
        }
        return nil
    }

    private func readableDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    private var stateSelection: Binding<String> {
        Binding<String>(
            get: { viewModel.application.state ?? "" },
            set: { newValue in
                let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
                viewModel.application.state = trimmed.isEmpty ? nil : trimmed
            }
        )
    }

    private var housingStatusBinding: Binding<HousingStatus?> {
        Binding<HousingStatus?>(
            get: { viewModel.application.housingStatus },
            set: { newValue in
                viewModel.updateHousingStatus(newValue)
            }
        )
    }

    private var residentialCityBinding: Binding<String> {
        Binding<String>(
            get: { viewModel.application.residentialCity },
            set: { newValue in
                viewModel.application.residentialCity = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        )
    }

    private var residentialZIPBinding: Binding<String> {
        Binding<String>(
            get: { viewModel.application.residentialZIP },
            set: { newValue in
                let digitsOnly = newValue.filter(\.isNumber)
                viewModel.application.residentialZIP = String(digitsOnly.prefix(5))
            }
        )
    }

    private var residentialAddressSearchBinding: Binding<String> {
        Binding<String>(
            get: { residentialAddressSearchText },
            set: { newValue in
                residentialAddressSearchText = newValue
                residentialAddressAutocomplete.updateQuery(newValue)
            }
        )
    }

    private var contactEmailBinding: Binding<String> {
        Binding<String>(
            get: { viewModel.application.contactEmail },
            set: { newValue in
                viewModel.application.contactEmail = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        )
    }

    private var contactPhoneBinding: Binding<String> {
        Binding<String>(
            get: { viewModel.application.contactPhone },
            set: { newValue in
                let filtered = newValue.filter { character in
                    character.isNumber || character == " " || character == "-" || character == "(" || character == ")"
                }
                viewModel.application.contactPhone = filtered
            }
        )
    }

    private var householdSizeIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .householdBasics
            && viewModel.application.householdSize == nil
    }

    private var stateIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .whereApplyingFrom
            && (viewModel.application.state ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var housingStatusIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .whereApplyingFrom
            && viewModel.application.housingStatus == nil
    }

    private var residentialCityIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .whereApplyingFrom
            && shouldCollectResidentialAddress
            && normalized(viewModel.application.residentialCity).isEmpty
    }

    private var residentialZIPIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .whereApplyingFrom
            && shouldCollectResidentialAddress
            && normalized(viewModel.application.residentialZIP).isEmpty
    }

    private var employmentStatusIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .income
            && viewModel.application.employmentStatus == nil
    }

    private var monthlyIncomeIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .income
            && normalized(viewModel.application.monthlyIncomeEstimate).isEmpty
    }

    private var applicantAgeIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .applicantAge
            && viewModel.application.applicantDateOfBirth == nil
            && viewModel.application.applicantAge == nil
    }

    private var incomeChangesIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .income
            && viewModel.application.incomeChangesMonthToMonth == nil
    }

    private var studentEnrollmentIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .studentStatus
            && viewModel.application.isCurrentlyEnrolledInHigherEducation == nil
    }

    private var enrolledHalfTimeIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .studentStatus
            && viewModel.application.isCurrentlyEnrolledInHigherEducation == true
            && viewModel.application.isEnrolledAtLeastHalfTime == nil
    }

    private var worksTwentyHoursIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .studentStatus
            && viewModel.application.isCurrentlyEnrolledInHigherEducation == true
            && viewModel.application.worksAtLeastTwentyHoursPerWeek == nil
    }

    private var workStudyIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .studentStatus
            && viewModel.application.isCurrentlyEnrolledInHigherEducation == true
            && viewModel.application.participatesInWorkStudy == nil
    }

    private var dependentChildIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .studentStatus
            && viewModel.application.isCurrentlyEnrolledInHigherEducation == true
            && viewModel.application.isResponsibleForDependentChild == nil
    }

    private var rentIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .expenses
            && normalized(viewModel.application.rentOrHousingCost).isEmpty
    }

    private var utilitiesIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .expenses
            && normalized(viewModel.application.utilitiesCost).isEmpty
    }

    private var currentlyEnrolledBinding: Binding<Bool?> {
        Binding<Bool?>(
            get: { viewModel.application.isCurrentlyEnrolledInHigherEducation },
            set: { newValue in
                viewModel.application.isCurrentlyEnrolledInHigherEducation = newValue
                switch newValue {
                case .some(true):
                    viewModel.application.studentStatus = .currentlyStudent
                case .some(false):
                    viewModel.application.studentStatus = .notStudent
                    viewModel.application.isEnrolledAtLeastHalfTime = nil
                    viewModel.application.worksAtLeastTwentyHoursPerWeek = nil
                    viewModel.application.participatesInWorkStudy = nil
                    viewModel.application.isResponsibleForDependentChild = nil
                    viewModel.application.childcareCostEstimate = ""
                    viewModel.application.documentsAvailable.removeAll { $0 == .childcareCostProof }
                    viewModel.application.documentsAvailable.removeAll { $0 == .studentStatusDocuments }
                case .none:
                    viewModel.application.studentStatus = nil
                    viewModel.application.isEnrolledAtLeastHalfTime = nil
                    viewModel.application.worksAtLeastTwentyHoursPerWeek = nil
                    viewModel.application.participatesInWorkStudy = nil
                    viewModel.application.isResponsibleForDependentChild = nil
                    viewModel.application.childcareCostEstimate = ""
                    viewModel.application.documentsAvailable.removeAll { $0 == .childcareCostProof }
                    viewModel.application.documentsAvailable.removeAll { $0 == .studentStatusDocuments }
                }
            }
        )
    }

    private var dependentChildResponsibilityBinding: Binding<Bool?> {
        Binding<Bool?>(
            get: { viewModel.application.isResponsibleForDependentChild },
            set: { newValue in
                viewModel.application.isResponsibleForDependentChild = newValue
                guard newValue == true else {
                    viewModel.application.childcareCostEstimate = ""
                    viewModel.application.documentsAvailable.removeAll { $0 == .childcareCostProof }
                    return
                }
            }
        )
    }

    private var spouseLivesChoiceBinding: Binding<SNAPTernaryChoice?> {
        Binding<SNAPTernaryChoice?>(
            get: { viewModel.application.spouseLivesWithUser },
            set: { newValue in
                viewModel.application.spouseLivesWithUser = newValue
                viewModel.application.hasSpouseInHousehold = boolValue(from: newValue)
            }
        )
    }

    private var childUnder22ChoiceBinding: Binding<SNAPTernaryChoice?> {
        Binding<SNAPTernaryChoice?>(
            get: { viewModel.application.childUnder22LivesWithParentInHome },
            set: { newValue in
                viewModel.application.childUnder22LivesWithParentInHome = newValue
                viewModel.application.hasChildUnder22LivingWithParent = boolValue(from: newValue)
            }
        )
    }

    private var childrenInHouseholdChoiceBinding: Binding<SNAPTernaryChoice?> {
        Binding<SNAPTernaryChoice?>(
            get: { viewModel.application.childrenInHousehold },
            set: { newValue in
                viewModel.application.childrenInHousehold = newValue
                viewModel.application.hasChildren = boolValue(from: newValue)
            }
        )
    }

    private var anyoneAge60OrOlderChoiceBinding: Binding<SNAPTernaryChoice?> {
        Binding<SNAPTernaryChoice?>(
            get: { viewModel.application.anyoneAge60OrOlder },
            set: { newValue in
                viewModel.application.anyoneAge60OrOlder = newValue
                viewModel.application.isSeniorHousehold = boolValue(from: newValue)
            }
        )
    }

    private var anyoneWithDisabilityChoiceBinding: Binding<SNAPTernaryChoice?> {
        Binding<SNAPTernaryChoice?>(
            get: { viewModel.application.anyoneWithDisability },
            set: { newValue in
                viewModel.application.anyoneWithDisability = newValue
                viewModel.application.hasDisabilityInHousehold = boolValue(from: newValue)
            }
        )
    }

    private var anyonePregnantChoiceBinding: Binding<SNAPTernaryChoice?> {
        Binding<SNAPTernaryChoice?>(
            get: { viewModel.application.anyonePregnant },
            set: { newValue in
                viewModel.application.anyonePregnant = newValue
                viewModel.application.isPregnant = boolValue(from: newValue)
            }
        )
    }

    private var unhousedOrNoFixedMailingChoiceBinding: Binding<SNAPTernaryChoice?> {
        Binding<SNAPTernaryChoice?>(
            get: { viewModel.application.anyoneUnhousedOrNoFixedMailingAddress },
            set: { newValue in
                viewModel.application.anyoneUnhousedOrNoFixedMailingAddress = newValue

                if newValue == .yes {
                    viewModel.updateHousingStatus(.unhoused)
                } else if viewModel.application.housingStatus == .unhoused,
                          (newValue == .no || newValue == .notSure) {
                    viewModel.updateHousingStatus(nil)
                }

                if newValue != .yes {
                    viewModel.application.preferredSafeMailingContactOption = nil
                }
            }
        )
    }

    private var recentJobLossChoiceBinding: Binding<SNAPTernaryChoice?> {
        Binding<SNAPTernaryChoice?>(
            get: { viewModel.application.recentJobLossOrStoppedWorkChoice },
            set: { newValue in
                viewModel.application.recentJobLossOrStoppedWorkChoice = newValue
                switch newValue {
                case .some(.yes):
                    viewModel.application.recentJobLossOrStoppedWork = true
                case .some(.no):
                    viewModel.application.recentJobLossOrStoppedWork = false
                case .some(.notSure), .none:
                    viewModel.application.recentJobLossOrStoppedWork = nil
                }
            }
        )
    }

    private var earnedLastPayDateBinding: Binding<Date> {
        Binding<Date>(
            get: { viewModel.application.earnedLastPayDate ?? Date() },
            set: { newValue in
                viewModel.application.earnedLastPayDate = newValue
            }
        )
    }

    private var shouldShowChildcareExpensesField: Bool {
        viewModel.application.isResponsibleForDependentChild == true
    }

    private var shouldCollectResidentialAddress: Bool {
        switch viewModel.application.housingStatus {
        case .stableHome, .temporaryHousing, .stayingWithOthers:
            return true
        case .unhoused, .none:
            return false
        }
    }

    private var shouldAskMultiPersonHouseholdFollowUps: Bool {
        (viewModel.application.householdSize ?? 0) > 1
    }

    private var isEmploymentPrimarilyEmployerBased: Bool {
        switch viewModel.application.employmentStatus {
        case .employedFullTime, .employedPartTime:
            return true
        default:
            return false
        }
    }

    private var isEmploymentPrimarilySelfEmployed: Bool {
        viewModel.application.employmentStatus == .selfEmployed
    }

    private var isEmploymentNotWorking: Bool {
        switch viewModel.application.employmentStatus {
        case .unemployed, .unableToWork:
            return true
        default:
            return false
        }
    }

    private var shouldShowEmployerIncomeSection: Bool {
        isEmploymentPrimarilyEmployerBased || viewModel.application.worksForEmployer == .yes
    }

    private var shouldShowSelfEmploymentIncomeSection: Bool {
        isEmploymentPrimarilySelfEmployed || viewModel.application.selfEmployedOrGigWork == .yes
    }

    private var shouldShowStandaloneRecentJobLossQuestion: Bool {
        isEmploymentNotWorking
    }

    private var alsoHasSelfEmploymentIncomeBinding: Binding<Bool> {
        Binding<Bool>(
            get: { viewModel.application.selfEmployedOrGigWork == .yes },
            set: { isOn in
                viewModel.application.selfEmployedOrGigWork = isOn ? .yes : .no
                if !isOn {
                    viewModel.application.gigWorkTypeOrPlatform = ""
                    viewModel.application.gigGrossReceiptsThisMonth = ""
                    viewModel.application.gigBusinessExpensesThisMonth = ""
                    viewModel.application.gigIncomeVariesMonthToMonth = nil
                }
            }
        )
    }

    private var alsoHasEmployerIncomeBinding: Binding<Bool> {
        Binding<Bool>(
            get: { viewModel.application.worksForEmployer == .yes },
            set: { isOn in
                viewModel.application.worksForEmployer = isOn ? .yes : .no
                if !isOn {
                    viewModel.application.employerOrJobType = ""
                    viewModel.application.earnedGrossPayAmount = ""
                    viewModel.application.earnedPayFrequency = nil
                    viewModel.application.earnedHoursPerWeek = ""
                    viewModel.application.earnedLastPayDate = nil
                    if isEmploymentPrimarilySelfEmployed {
                        viewModel.application.recentJobLossOrStoppedWorkChoice = nil
                        viewModel.application.recentJobLossOrStoppedWork = nil
                    }
                }
            }
        )
    }

    private var visibleChecklistDocuments: [SNAPDocumentType] {
        let shouldShowStudentDocuments = viewModel.application.isCurrentlyEnrolledInHigherEducation == true
            || viewModel.application.studentStatus == .currentlyStudent
        let isWorkingOrUnableStatus: Bool = {
            switch viewModel.application.employmentStatus {
            case .employedFullTime, .employedPartTime, .selfEmployed, .unableToWork:
                return true
            default:
                return false
            }
        }()
        let shouldShowWorkStatusDocuments =
            isWorkingOrUnableStatus
            || viewModel.application.anyoneWithDisability == .yes
            || viewModel.application.hasDisabilityInHousehold == true
            || viewModel.application.isResponsibleForDependentChild == true
            || viewModel.application.isCurrentlyEnrolledInHigherEducation == true

        return SNAPDocumentType.allCases.filter { document in
            if document == .studentStatusDocuments {
                return shouldShowStudentDocuments
            }
            if document == .workStatusOrExemptions {
                return shouldShowWorkStatusDocuments
            }
            if document == .childcareCostProof || document == .immigrationDocumentsIfRelevant {
                return false
            }
            return true
        }
    }

    private var checklistShareText: String {
        let selected = visibleChecklistDocuments.filter { viewModel.application.documentsAvailable.contains($0) }
        let remaining = visibleChecklistDocuments.filter { !viewModel.application.documentsAvailable.contains($0) }

        let selectedLines = selected.isEmpty
            ? ["- None selected yet"]
            : selected.map { "- \($0.label)" }

        let remainingLines = remaining.isEmpty
            ? ["- Everything listed is marked"]
            : remaining.map { "- \($0.label)" }

        return """
        SNAP Application Assistant — Documents Checklist

        Selected:
        \(selectedLines.joined(separator: "\n"))

        Still to gather:
        \(remainingLines.joined(separator: "\n"))

        You may not need every document right away. Upload what you have now; the agency may ask for more later.
        This checklist is for preparation only and does not submit a SNAP application.
        """
    }

    private var checklistImageText: String {
        """
        SNAP Application Assistant
        Preparation Checklist

        \(checklistShareText)
        """
    }

    private func makeChecklistImage() -> UIImage {
        let canvasWidth: CGFloat = 1080
        let horizontalPadding: CGFloat = 64
        let verticalPadding: CGFloat = 64
        let titleBottomSpacing: CGFloat = 24
        let textWidth = canvasWidth - (horizontalPadding * 2)

        let titleAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.boldSystemFont(ofSize: 48),
            .foregroundColor: UIColor.label
        ]

        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = 6

        let bodyAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 30, weight: .regular),
            .foregroundColor: UIColor.label,
            .paragraphStyle: paragraphStyle
        ]

        let title = NSAttributedString(
            string: "SNAP Preparation Checklist",
            attributes: titleAttributes
        )
        let body = NSAttributedString(
            string: checklistImageText,
            attributes: bodyAttributes
        )

        let titleRect = title.boundingRect(
            with: CGSize(width: textWidth, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            context: nil
        ).integral

        let bodyRect = body.boundingRect(
            with: CGSize(width: textWidth, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            context: nil
        ).integral

        let canvasHeight = verticalPadding
            + titleRect.height
            + titleBottomSpacing
            + bodyRect.height
            + verticalPadding

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: canvasWidth, height: canvasHeight))
        return renderer.image { context in
            UIColor.systemBackground.setFill()
            context.fill(CGRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight))

            title.draw(
                with: CGRect(
                    x: horizontalPadding,
                    y: verticalPadding,
                    width: textWidth,
                    height: titleRect.height
                ),
                options: [.usesLineFragmentOrigin, .usesFontLeading],
                context: nil
            )

            body.draw(
                with: CGRect(
                    x: horizontalPadding,
                    y: verticalPadding + titleRect.height + titleBottomSpacing,
                    width: textWidth,
                    height: bodyRect.height
                ),
                options: [.usesLineFragmentOrigin, .usesFontLeading],
                context: nil
            )
        }
    }

    private var applicantDateOfBirthBinding: Binding<Date> {
        Binding<Date>(
            get: {
                viewModel.application.applicantDateOfBirth
                    ?? (Calendar.current.date(byAdding: .year, value: -18, to: Date()) ?? Date())
            },
            set: { newValue in
                viewModel.application.applicantDateOfBirth = newValue
                viewModel.application.applicantAge = ageInYears(from: newValue)
            }
        )
    }

    private func ageInYears(from birthDate: Date) -> Int {
        let calendar = Calendar.current
        let now = Date()
        let components = calendar.dateComponents([.year], from: birthDate, to: now)
        return max(0, components.year ?? 0)
    }

    private func toggleDocument(_ document: SNAPDocumentType) {
        if viewModel.application.documentsAvailable.contains(document) {
            viewModel.application.documentsAvailable.removeAll { $0 == document }
        } else {
            viewModel.application.documentsAvailable.append(document)
        }
    }

    private func toggleOtherIncomeSource(_ source: SNAPOtherIncomeSource) {
        if viewModel.application.otherIncomeSources.contains(source) {
            viewModel.application.otherIncomeSources.removeAll { $0 == source }
        } else {
            viewModel.application.otherIncomeSources.append(source)
        }
    }

    private var annualIncomeEstimateText: String {
        guard let monthly = parsedPositiveAmount(from: viewModel.application.monthlyIncomeEstimate) else {
            return "Estimate ~$0 annual income"
        }

        let annual = monthly * 12
        return "Estimate ~\(formatCurrency(annual)) annual income"
    }

    private var prefillNoteText: String? {
        switch (viewModel.isStateUsingPrefill, viewModel.isZIPUsingPrefill) {
        case (true, true):
            return "State and ZIP were pre-filled from the address listed in the app. You can change them here."
        case (true, false):
            return "State was pre-filled from the address listed in the app. You can change it here."
        case (false, true):
            return "ZIP was pre-filled from the address listed in the app. You can change it here."
        case (false, false):
            return nil
        }
    }

    private var selectedStateAgencyName: String? {
        SNAPStateResources.administeringAgencyName(for: viewModel.application.state)
    }

    @ViewBuilder
    private var housingStatusExamplesBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            if let selectedStatus = viewModel.application.housingStatus {
                housingStatusExampleRow(for: selectedStatus)
            } else {
                ForEach(HousingStatus.allCases) { status in
                    housingStatusExampleRow(for: status)
                }
            }
        }
        .padding(.horizontal, CivicaSpacing.sm)
        .padding(.vertical, CivicaSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func housingStatusExampleRow(for status: HousingStatus) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(housingStatusHeading(for: status))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.textPrimary)

            Text(housingStatusExampleText(for: status))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if status == .stayingWithOthers {
                Text("Follow-up in this flow: Do you buy and prepare your own food separately?")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func housingStatusHeading(for status: HousingStatus) -> String {
        switch status {
        case .stableHome:
            return "🏠 Stable housing"
        case .temporaryHousing:
            return "🔄 Temporary housing"
        case .stayingWithOthers:
            return "🛋️ Staying with others"
        case .unhoused:
            return "🚫 Unhoused"
        }
    }

    private func housingStatusExampleText(for status: HousingStatus) -> String {
        switch status {
        case .stableHome:
            return "(Ex:) Renting an apartment, owning a home, living in public housing, or staying in a long-term room rental"
        case .temporaryHousing:
            return "(Ex:) Hotel or motel, short-term sublet, Airbnb, or a transitional housing program"
        case .stayingWithOthers:
            return "(Ex:) Couch-surfing, staying with friends or family, or living with someone without a lease"
        case .unhoused:
            return "(Ex:) Staying in a shelter, living in a car, or sleeping outside or in a public place"
        }
    }

    private func parsedPositiveAmount(from text: String) -> Double? {
        let cleaned = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .filter { $0.isNumber || $0 == "." }
        guard let value = Double(cleaned), value > 0 else { return nil }
        return value
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$0"
    }

    private func daysSinceDate(_ date: Date) -> Int {
        let calendar = Calendar.current
        let fromDate = calendar.startOfDay(for: date)
        let toDate = calendar.startOfDay(for: Date())
        let dayDelta = calendar.dateComponents([.day], from: fromDate, to: toDate).day ?? 0
        return max(0, dayDelta)
    }

    private func compactDateText(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    private func applyResidentialAddressSuggestion(_ suggestion: SNAPAddressSuggestion) {
        viewModel.application.residentialStreetAddress = suggestion.title
        if let parsedCity = parseCity(from: suggestion.subtitle) {
            viewModel.application.residentialCity = parsedCity
        }
        if let parsedZIP = parseZIP(from: suggestion.subtitle) {
            viewModel.application.residentialZIP = parsedZIP
        }
        if let parsedStateCode = parseStateCode(from: suggestion.subtitle) {
            viewModel.application.state = parsedStateCode
        }

        residentialAddressSearchText = suggestion.fullText
        residentialAddressAutocomplete.clear()
        focusedField = nil
    }

    private func parseCity(from subtitle: String) -> String? {
        let firstPart = subtitle.split(separator: ",").first.map(String.init)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return firstPart.isEmpty ? nil : firstPart
    }

    private func parseZIP(from subtitle: String) -> String? {
        let digits = subtitle.filter(\.isNumber)
        guard digits.count >= 5 else { return nil }
        return String(digits.prefix(5))
    }

    private func parseStateCode(from subtitle: String) -> String? {
        let upper = subtitle.uppercased()
        for state in supportedStates {
            if upper.contains(state.name.uppercased()) {
                return state.code
            }
        }

        let tokens = upper
            .components(separatedBy: CharacterSet.letters.inverted)
            .filter { $0.count == 2 }

        let supportedCodes = Set(supportedStates.map(\.code))
        for token in tokens {
            if supportedCodes.contains(token) {
                return token
            }
        }
        return nil
    }
}

private struct SNAPAddressSuggestion: Identifiable {
    let id: String
    let title: String
    let subtitle: String

    var fullText: String {
        if subtitle.isEmpty { return title }
        return "\(title), \(subtitle)"
    }
}

private final class SNAPAddressAutocomplete: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {
    struct LookupIssue: Equatable {
        let message: String
        let showsOfflineHint: Bool
    }

    @Published private(set) var suggestions: [SNAPAddressSuggestion] = []
    @Published private(set) var lookupIssue: LookupIssue?

    private let completer: MKLocalSearchCompleter = {
        let completer = MKLocalSearchCompleter()
        completer.resultTypes = .address
        return completer
    }()
    private let pathMonitor = NWPathMonitor()
    private let pathMonitorQueue = DispatchQueue(label: "SNAPAddressAutocomplete.Network")
    private var isCurrentlyOffline = false
    private var lastQuery: String = ""

    override init() {
        super.init()
        completer.delegate = self
        pathMonitor.pathUpdateHandler = { [weak self] path in
            let offline = path.status != .satisfied
            DispatchQueue.main.async {
                self?.isCurrentlyOffline = offline
            }
        }
        pathMonitor.start(queue: pathMonitorQueue)
    }

    deinit {
        pathMonitor.cancel()
    }

    func updateQuery(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        lastQuery = trimmed
        guard trimmed.count >= 3 else {
            suggestions = []
            lookupIssue = nil
            completer.queryFragment = ""
            return
        }
        lookupIssue = nil
        completer.queryFragment = trimmed
    }

    func clear() {
        suggestions = []
        lookupIssue = nil
        lastQuery = ""
        completer.queryFragment = ""
    }

    func retryLastQuery() {
        guard lastQuery.count >= 3 else { return }
        lookupIssue = nil
        // Force a fresh request on the same fragment.
        completer.queryFragment = ""
        completer.queryFragment = lastQuery
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        lookupIssue = nil
        suggestions = completer.results.prefix(6).map { result in
            SNAPAddressSuggestion(
                id: "\(result.title)|\(result.subtitle)",
                title: result.title,
                subtitle: result.subtitle
            )
        }
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        suggestions = []
        lookupIssue = buildLookupIssue(from: error)
    }

    private func buildLookupIssue(from error: Error) -> LookupIssue {
        let nsError = error as NSError
        let loweredDescription = nsError.localizedDescription.lowercased()
        let isTimedOut =
            nsError.domain == NSURLErrorDomain
            && nsError.code == NSURLErrorTimedOut
            || loweredDescription.contains("timed out")
        let isOfflineError =
            (nsError.domain == NSURLErrorDomain && (
                nsError.code == NSURLErrorNotConnectedToInternet
                    || nsError.code == NSURLErrorNetworkConnectionLost
            ))
            || isCurrentlyOffline

        if isTimedOut {
            return LookupIssue(
                message: "Address search timed out.",
                showsOfflineHint: true
            )
        }

        if isOfflineError {
            return LookupIssue(
                message: "Address search needs an internet connection.",
                showsOfflineHint: true
            )
        }

        return LookupIssue(
            message: "Address search is unavailable right now.",
            showsOfflineHint: false
        )
    }
}

private struct SNAPStepGuidanceRows<Content: View>: View {
    let whatText: String
    let whyText: String
    let doNotShareText: String
    var whyLabel: String = "Why we ask"
    @Binding var isWhyExpanded: Bool
    @ViewBuilder let content: Content

    init(
        whatText: String,
        whyText: String,
        doNotShareText: String,
        whyLabel: String = "Why we ask",
        isWhyExpanded: Binding<Bool>,
        @ViewBuilder content: () -> Content
    ) {
        self.whatText = whatText
        self.whyText = whyText
        self.doNotShareText = doNotShareText
        self.whyLabel = whyLabel
        _isWhyExpanded = isWhyExpanded
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            if isWhyExpanded {
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(whyLabel)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textPrimary)
                    Text(whyText)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, CivicaSpacing.md)
                .padding(.vertical, CivicaSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .fill(CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                )
            }

            if !whatText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(whatText)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            content
        }
    }
}

private struct SNAPCardInfoButton: View {
    @Binding var isExpanded: Bool
    let label: String

    var body: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.18)) {
                isExpanded.toggle()
            }
        } label: {
            Image(systemName: "info.circle")
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.ctaBlue)
                .frame(width: 22, height: 22)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityHint("Shows or hides why this information is asked.")
    }
}

private struct SNAPInlineDisclosureRow: View {
    let iconName: String
    let title: String
    let detailText: String
    @Binding var isExpanded: Bool

    var bodyView: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: CivicaSpacing.sm) {
                    Image(systemName: iconName)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.ctaBlue)
                        .frame(width: 16)

                    Text(title)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textPrimary)

                    Spacer(minLength: 0)

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.textSecondary)
                }
            }
            .buttonStyle(.plain)

            if isExpanded {
                Text(detailText)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, CivicaSpacing.md)
        .padding(.vertical, CivicaSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
        )
    }

    var body: some View {
        bodyView
    }
}

private enum SNAPReviewSectionStatus {
    case complete
    case missingRequiredInfo
    case optionalNotProvided
}

private struct SNAPReviewSectionSummary: Identifiable {
    let id: String
    let title: String
    let step: SNAPDraftStep
    let status: SNAPReviewSectionStatus
    let rows: [SNAPReviewSectionRow]
}

private struct SNAPInterviewSummaryRow: Identifiable {
    let id = UUID()
    let label: String
    let value: String
}

private struct SNAPInterviewSummarySection: View {
    let title: String
    let rows: [SNAPInterviewSummaryRow]

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(title)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.textPrimary)

            ForEach(rows) { row in
                HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                    Text(row.label)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textSecondary)
                    Spacer(minLength: 10)
                    Text(row.value)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .multilineTextAlignment(.trailing)
                }
            }
        }
        .padding(.horizontal, CivicaSpacing.sm)
        .padding(.vertical, CivicaSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
        )
    }
}

private struct SNAPReviewSectionRow: Identifiable {
    let id = UUID()
    let label: String
    let value: String
    let isRequired: Bool

    init(label: String, value: String, isRequired: Bool = false) {
        self.label = label
        self.value = value
        self.isRequired = isRequired
    }
}

private struct SNAPReviewStatusBadge: View {
    let status: SNAPReviewSectionStatus

    var body: some View {
        Text(title)
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, CivicaSpacing.xs)
            .background(
                Capsule(style: .continuous)
                    .fill(backgroundColor)
            )
            .overlay(
                Capsule(style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
    }

    private var title: String {
        switch status {
        case .complete:
            return "Complete"
        case .missingRequiredInfo:
            return "Missing required info"
        case .optionalNotProvided:
            return "Optional not provided"
        }
    }

    private var foregroundColor: Color {
        switch status {
        case .complete:
            return CivicaColors.successGreen
        case .missingRequiredInfo:
            return CivicaColors.warningAmber
        case .optionalNotProvided:
            return CivicaColors.textSecondary
        }
    }

    private var backgroundColor: Color {
        switch status {
        case .complete:
            return CivicaColors.statusSuccessSurface
        case .missingRequiredInfo:
            return CivicaColors.statusWarningSurface
        case .optionalNotProvided:
            return CivicaColors.surfaceSecondary
        }
    }

    private var borderColor: Color {
        switch status {
        case .complete:
            return CivicaColors.successGreen.opacity(0.3)
        case .missingRequiredInfo:
            return CivicaColors.warningAmber.opacity(0.4)
        case .optionalNotProvided:
            return CivicaColors.borderSubtle
        }
    }
}

private struct SNAPNextStepRow: View {
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .font(.subheadline)
                .foregroundStyle(CivicaColors.ctaBlue)
                .padding(.top, CivicaSpacing.xs)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                Text(detail)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
    }
}

private struct SNAPTimelineMilestoneRow: View {
    let dayRange: String
    let title: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                Text(dayRange)
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.ctaBlue)
                    .padding(.horizontal, CivicaSpacing.sm)
                    .padding(.vertical, CivicaSpacing.xs)
                    .background(
                        Capsule(style: .continuous)
                            .fill(CivicaColors.statusInfoSurface)
                    )

                Text(title)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.textPrimary)
            }

            Text(detail)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, CivicaSpacing.sm)
        .padding(.vertical, CivicaSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
        )
    }
}

private struct SNAPSectionCard<Content: View>: View {
    let title: String
    let helper: String?
    let titleAlignment: Alignment
    let hasHeaderAccessory: Bool
    let headerAccessory: AnyView
    @ViewBuilder let content: Content

    init(
        title: String,
        helper: String?,
        titleAlignment: Alignment = .leading,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.helper = helper
        self.titleAlignment = titleAlignment
        self.hasHeaderAccessory = false
        self.headerAccessory = AnyView(EmptyView())
        self.content = content()
    }

    init<HeaderAccessory: View>(
        title: String,
        helper: String?,
        titleAlignment: Alignment = .leading,
        @ViewBuilder headerAccessory: () -> HeaderAccessory,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.helper = helper
        self.titleAlignment = titleAlignment
        self.hasHeaderAccessory = true
        self.headerAccessory = AnyView(headerAccessory())
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            if !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || hasHeaderAccessory {
                HStack(alignment: .center, spacing: CivicaSpacing.sm) {
                    if !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(title)
                            .font(CivicaTypography.sectionHeader)
                            .foregroundStyle(CivicaColors.textPrimary)
                            .frame(maxWidth: .infinity, alignment: titleAlignment)
                    } else {
                        Spacer(minLength: 0)
                    }

                    if hasHeaderAccessory {
                        headerAccessory
                    }
                }
            }

            if let helper, !helper.isEmpty {
                Text(helper)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
            }

            content
        }
        .padding(CivicaSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
        )
    }
}

private struct SNAPInputLabel: View {
    let text: String
    let badge: SNAPFieldBadge?

    init(_ text: String, badge: SNAPFieldBadge? = nil) {
        self.text = text
        self.badge = badge
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
            Text(text)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 8)

            if let badge, shouldRenderBadge(badge) {
                SNAPFieldBadgeChip(badge: badge)
            }
        }
    }

    private func shouldRenderBadge(_ badge: SNAPFieldBadge) -> Bool {
        switch badge.style {
        case .required, .requiredAttention:
            return true
        case .optional, .optionalEstimate:
            return false
        }
    }
}

private struct SNAPFieldBadge {
    enum Style {
        case required
        case requiredAttention
        case optional
        case optionalEstimate
    }

    let text: String
    let style: Style

    static func required(isMissing: Bool = false) -> SNAPFieldBadge {
        SNAPFieldBadge(
            text: "Required",
            style: isMissing ? .requiredAttention : .required
        )
    }

    static let optional = SNAPFieldBadge(text: "Optional", style: .optional)
    static let optionalEstimate = SNAPFieldBadge(text: "Optional estimate", style: .optionalEstimate)
}

private struct SNAPFieldBadgeChip: View {
    let badge: SNAPFieldBadge

    var body: some View {
        Text(badge.text)
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, CivicaSpacing.xs)
            .background(
                Capsule(style: .continuous)
                    .fill(backgroundColor)
            )
            .overlay(
                Capsule(style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
            .fixedSize(horizontal: true, vertical: true)
    }

    private var foregroundColor: Color {
        switch badge.style {
        case .required:
            return CivicaColors.ctaBlue
        case .requiredAttention:
            return CivicaColors.warningAmber
        case .optional, .optionalEstimate:
            return CivicaColors.textSecondary
        }
    }

    private var backgroundColor: Color {
        switch badge.style {
        case .required:
            return CivicaColors.statusInfoSurface
        case .requiredAttention:
            return CivicaColors.statusWarningSurface
        case .optional:
            return CivicaColors.surfaceSecondary
        case .optionalEstimate:
            return CivicaColors.infoSurfaceBlue.opacity(0.52)
        }
    }

    private var borderColor: Color {
        switch badge.style {
        case .required:
            return CivicaColors.ctaBlue.opacity(0.32)
        case .requiredAttention:
            return CivicaColors.warningAmber.opacity(0.42)
        case .optional:
            return CivicaColors.borderSubtle
        case .optionalEstimate:
            return CivicaColors.ctaBlue.opacity(0.2)
        }
    }
}

private extension View {
    func snapFieldSurface() -> some View {
        self
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                    .fill(CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                    .stroke(CivicaColors.borderSubtle, lineWidth: 1)
            )
    }

    func snapTextFieldStyle() -> some View {
        self
            .font(.body)
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                    .fill(CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                    .stroke(CivicaColors.borderSubtle, lineWidth: 1)
            )
    }

    func snapCompactTextFieldStyle(highlightPrefilled: Bool = false) -> some View {
        self
            .font(.body)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .fill(highlightPrefilled ? CivicaColors.warningAmber.opacity(0.12) : CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .stroke(highlightPrefilled ? CivicaColors.warningAmber.opacity(0.3) : CivicaColors.borderSubtle, lineWidth: 1)
            )
    }

    func snapCompactFieldSurface(highlightPrefilled: Bool = false) -> some View {
        self
            .font(.body)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .fill(highlightPrefilled ? CivicaColors.warningAmber.opacity(0.12) : CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .stroke(highlightPrefilled ? CivicaColors.warningAmber.opacity(0.3) : CivicaColors.borderSubtle, lineWidth: 1)
            )
    }

    func snapCondensedTextFieldStyle(highlightPrefilled: Bool = false) -> some View {
        self
            .font(.body)
            .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, CivicaSpacing.xs)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous)
                    .fill(highlightPrefilled ? CivicaColors.warningAmber.opacity(0.12) : CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous)
                    .stroke(highlightPrefilled ? CivicaColors.warningAmber.opacity(0.3) : CivicaColors.borderSubtle, lineWidth: 1)
            )
    }

    func snapCondensedFieldSurface(highlightPrefilled: Bool = false) -> some View {
        self
            .font(.body)
            .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, CivicaSpacing.xs)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous)
                    .fill(highlightPrefilled ? CivicaColors.warningAmber.opacity(0.12) : CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous)
                    .stroke(highlightPrefilled ? CivicaColors.warningAmber.opacity(0.3) : CivicaColors.borderSubtle, lineWidth: 1)
            )
    }
}

private struct SNAPRequiredFieldShake: ViewModifier {
    let isActive: Bool
    let trigger: Int
    @State private var shakeAttempts: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .modifier(SNAPShakeEffect(animatableData: shakeAttempts))
            .onChange(of: trigger) { _, _ in
                guard isActive else { return }
                withAnimation(.linear(duration: 0.32)) {
                    shakeAttempts += 1
                }
            }
    }
}

private struct SNAPShakeEffect: GeometryEffect {
    var amount: CGFloat = 8
    var shakesPerUnit: CGFloat = 3
    var animatableData: CGFloat

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(
            CGAffineTransform(
                translationX: amount * sin(animatableData * .pi * shakesPerUnit),
                y: 0
            )
        )
    }
}

private struct SNAPTernaryChoiceQuestion: View {
    let title: String
    @Binding var value: SNAPTernaryChoice?
    var badge: SNAPFieldBadge? = .optional
    var infoText: String?
    @State private var isInfoExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(alignment: .center, spacing: CivicaSpacing.xs) {
                SNAPInputLabel(title, badge: badge)

                if let infoText, !infoText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            isInfoExpanded.toggle()
                        }
                    } label: {
                        Image(systemName: "info.circle")
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.ctaBlue)
                            .frame(width: 20, height: 20)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("More information")
                }
            }

            HStack(spacing: CivicaSpacing.sm) {
                choiceButton(.yes)
                choiceButton(.no)
                choiceButton(.notSure)
            }
            .frame(maxWidth: .infinity, minHeight: 44)

            if isInfoExpanded,
               let infoText,
               !infoText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(infoText)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func choiceButton(_ choice: SNAPTernaryChoice) -> some View {
        Button {
            if value == choice {
                value = nil
            } else {
                value = choice
            }
        } label: {
            Text(choice.label)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(value == choice ? CivicaColors.ctaBlue : CivicaColors.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .fill(value == choice ? CivicaColors.statusInfoSurface : CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .stroke(
                            value == choice ? CivicaColors.ctaBlue.opacity(0.45) : CivicaColors.borderSubtle,
                            lineWidth: 1
                        )
                )
        }
        .buttonStyle(.plain)
    }
}

private struct SNAPYesNoSegmentedQuestion: View {
    let title: String
    @Binding var value: Bool?
    var isMissingRequired: Bool = false
    var shakeToken: Int = 0

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(title)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: CivicaSpacing.sm) {
                yesNoButton(title: "Yes", isSelected: value == true) {
                    value = true
                }

                yesNoButton(title: "No", isSelected: value == false) {
                    value = false
                }
            }
            .frame(maxWidth: .infinity, minHeight: 44)
        }
        .modifier(
            SNAPRequiredFieldShake(
                isActive: isMissingRequired,
                trigger: shakeToken
            )
        )
    }

    private func yesNoButton(
        title: String,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(isSelected ? CivicaColors.ctaBlue : CivicaColors.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .fill(isSelected ? CivicaColors.statusInfoSurface : CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .stroke(
                            isSelected ? CivicaColors.ctaBlue.opacity(0.45) : CivicaColors.borderSubtle,
                            lineWidth: 1
                        )
                )
        }
        .buttonStyle(.plain)
    }
}

private struct SNAPSelectableOptionButton: View {
    let title: String
    let isSelected: Bool
    let minHeight: CGFloat
    let multilineCentered: Bool
    let lineLimit: Int?
    let action: () -> Void

    init(
        title: String,
        isSelected: Bool,
        minHeight: CGFloat = 44,
        multilineCentered: Bool = false,
        lineLimit: Int? = nil,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.isSelected = isSelected
        self.minHeight = minHeight
        self.multilineCentered = multilineCentered
        self.lineLimit = lineLimit
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(isSelected ? CivicaColors.ctaBlue : CivicaColors.textPrimary)
                .multilineTextAlignment(multilineCentered ? .center : .leading)
                .lineLimit(lineLimit)
                .minimumScaleFactor(multilineCentered ? 0.85 : 1.0)
                .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .center)
                .padding(.horizontal, CivicaSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .fill(isSelected ? CivicaColors.statusInfoSurface : CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .stroke(
                            isSelected ? CivicaColors.ctaBlue.opacity(0.45) : CivicaColors.borderSubtle,
                            lineWidth: 1
                        )
                )
        }
        .buttonStyle(.plain)
    }
}

private struct SNAPOptionalEnumPicker<Option: CaseIterable & Hashable & RawRepresentable>: View
where Option.RawValue == String, Option.AllCases: RandomAccessCollection, Option.AllCases.Element == Option {
    let title: String
    let badge: SNAPFieldBadge?
    @Binding var selection: Option?
    let compact: Bool
    let condensed: Bool
    let isMissingRequired: Bool
    let shakeToken: Int
    let label: (Option) -> String
    let selectedHelperText: ((Option) -> String?)?

    init(
        title: String,
        badge: SNAPFieldBadge? = nil,
        selection: Binding<Option?>,
        compact: Bool = false,
        condensed: Bool = false,
        isMissingRequired: Bool = false,
        shakeToken: Int = 0,
        label: @escaping (Option) -> String,
        selectedHelperText: ((Option) -> String?)? = nil
    ) {
        self.title = title
        self.badge = badge
        self._selection = selection
        self.compact = compact
        self.condensed = condensed
        self.isMissingRequired = isMissingRequired
        self.shakeToken = shakeToken
        self.label = label
        self.selectedHelperText = selectedHelperText
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            SNAPInputLabel(title, badge: badge)

            Menu {
                Button("Select one") {
                    selection = nil
                }

                ForEach(Array(Option.allCases), id: \.rawValue) { option in
                    Button(label(option)) {
                        selection = option
                    }
                }
            } label: {
                HStack(spacing: CivicaSpacing.sm) {
                    Text(selectedLabel)
                        .foregroundStyle(selection == nil ? CivicaColors.textSecondary : CivicaColors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Image(systemName: "chevron.down")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(accessibilitySelectionLabel)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .buttonStyle(.plain)
            .modifier(SNAPEnumPickerSurfaceModifier(compact: compact, condensed: condensed))
            .modifier(
                SNAPRequiredFieldShake(
                    isActive: isMissingRequired,
                    trigger: shakeToken
                )
            )

            if let selectedHelperText, let selection {
                let helper = selectedHelperText(selection)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if !helper.isEmpty {
                    Text(helper)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var selectedLabel: String {
        guard let selection else { return "Select one" }
        return label(selection)
    }

    private var accessibilitySelectionLabel: String {
        guard let selection else {
            return "\(title), Select one"
        }

        if let selectedHelperText {
            let helper = selectedHelperText(selection)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !helper.isEmpty {
                return "\(title), \(label(selection)). \(helper)"
            }
        }

        return "\(title), \(label(selection))"
    }
}

private struct SNAPEnumPickerSurfaceModifier: ViewModifier {
    let compact: Bool
    let condensed: Bool

    func body(content: Content) -> some View {
        if condensed {
            content.snapCondensedFieldSurface()
        } else if compact {
            content.snapCompactFieldSurface()
        } else {
            content.snapFieldSurface()
        }
    }
}
