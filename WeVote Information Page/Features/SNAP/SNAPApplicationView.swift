import SwiftUI
import UIKit

// EXPERIMENTAL SILOED MODULE: iPhone-first SNAP guided flow.
// One short question group per screen to reduce navigation burden.
struct SNAPApplicationView: View {
    @ObservedObject var viewModel: SNAPApplicationViewModel
    @FocusState private var focusedField: FocusedField?
    @State private var showingChecklistShareSheet = false
    @State private var checklistShareItems: [Any] = []
    private enum FocusedField: Hashable {
        case zipCode
        case monthlyIncome
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
        VStack(alignment: .leading, spacing: 14) {
            switch viewModel.draftStep {
            case .householdBasics:
                householdBasicsStep
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

    private var householdBasicsStep: some View {
        VStack(spacing: 12) {
            SNAPSectionCard(
                title: "Your food household",
                helper: nil
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Tell us who is in your food household, your age, your state, ZIP code, and your general housing situation.",
                    whyText: "These details help organize the information you may need when you continue to your official state SNAP application.",
                    doNotShareText: "Do not enter names, Social Security numbers, full addresses, immigration details, or private information about other household members."
                ) {

                SNAPInputLabel(
                    "Household size",
                    badge: .required(isMissing: householdSizeIsMissingAfterContinueAttempt)
                )
                Picker("Household size", selection: householdSizeSelection) {
                    Text("Select household size").tag(0)
                    ForEach(1..<11) { count in
                        Text("\(count)").tag(count)
                    }
                    Text("11 or more").tag(11)
                }
                .pickerStyle(.menu)
                .snapFieldSurface()

                Text("Count the people who usually buy food and prepare meals with you. Do not include roommates or others who keep food separate.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                SNAPInputLabel("Applicant age", badge: .optional)
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Age: \(viewModel.application.applicantAge ?? 18)")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(VoteNowColors.textPrimary)
                        Spacer(minLength: 0)
                        Text("0-120")
                            .font(.caption)
                            .foregroundStyle(VoteNowColors.textSecondary)
                    }

                    Slider(value: applicantAgeSliderValue, in: 0...120, step: 1)
                        .tint(VoteNowColors.primaryCTA)
                        .padding(.horizontal, 4)
                }

                Text(applicantBirthdayRangeText)
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }

            SNAPSectionCard(
                title: "Where you are applying from",
                helper: nil
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
                .snapCompactFieldSurface()
                .disabled(viewModel.isStateGeofenced)

                if viewModel.isStateGeofenced {
                    Text("State is locked to your saved address for location-based SNAP guidance.")
                        .font(.footnote)
                        .foregroundStyle(VoteNowColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                SNAPInputLabel(
                    "ZIP code",
                    badge: .required(isMissing: zipCodeIsMissingAfterContinueAttempt)
                )
                TextField("ZIP code", text: zipCodeBinding)
                    .keyboardType(.numberPad)
                    .focused($focusedField, equals: .zipCode)
                    .snapCompactTextFieldStyle()

                Text("We use this only to point you toward the right official state process. SNAP websites and instructions vary by state.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                SNAPOptionalEnumPicker(
                    title: "Housing status",
                    badge: .optional,
                    selection: $viewModel.application.housingStatus,
                    label: { $0.label }
                )

                Text("Choose the option that best describes where you are staying right now. This is optional in this draft.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text("This draft does not need names, SSNs, or full addresses.")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(VoteNowColors.textSecondary)
                .padding(.horizontal, 4)
        }
    }

    private var addressContactStep: some View {
        VStack(spacing: 12) {
            SNAPSectionCard(
                title: "Contact preference",
                helper: nil
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Choose the easiest way for someone to reach you if you later ask for help with your application.",
                    whyText: "This helps prepare for follow-up support, but it does not contact you or submit anything by itself.",
                    doNotShareText: "Do not enter your phone number, email, mailing address, or other contact details unless a specific field asks for it."
                ) {

                SNAPInputLabel("Preferred contact method", badge: .optional)

                LazyVGrid(
                    columns: [
                        GridItem(.flexible(), spacing: 10),
                        GridItem(.flexible(), spacing: 10)
                    ],
                    spacing: 10
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

                Text("Pick the method you would prefer if you later choose to get help. This draft will not send messages automatically.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var incomeStep: some View {
        VStack(spacing: 12) {
            SNAPSectionCard(
                title: "Income details",
                helper: nil
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Enter your work status, a monthly income estimate, and whether your income changes from month to month.",
                    whyText: "Official SNAP applications often ask about income. This draft helps you prepare those answers, but it does not calculate benefits or approval.",
                    doNotShareText: "Do not enter Social Security numbers, employer EINs, bank account numbers, routing numbers, paystub images, or tax documents."
                ) {

                SNAPOptionalEnumPicker(
                    title: "Employment status",
                    badge: .required(),
                    selection: $viewModel.application.employmentStatus,
                    label: { $0.label }
                )

                Text("Choose the option that best describes your current work situation.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                SNAPInputLabel("Estimated monthly income", badge: .required())
                HStack(spacing: 8) {
                    Text("$")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textPrimary)

                    TextField("0", text: $viewModel.application.monthlyIncomeEstimate)
                        .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .monthlyIncome)

                    Spacer(minLength: 0)

                    Text("/ month")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textSecondary)
                }
                .font(.body)
                .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(VoteNowColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
                )

                Text(annualIncomeEstimateText)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Use your best estimate before taxes. Exact numbers may be needed later on the official application.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                SNAPYesNoSegmentedQuestion(
                    title: "Does your income change month to month?",
                    value: $viewModel.application.incomeChangesMonthToMonth
                )

                Text("Answer yes if your income is not the same every month, such as changing hours, tips, seasonal work, gig work, or irregular pay.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var studentStatusStep: some View {
        VStack(spacing: 12) {
            SNAPSectionCard(
                title: "Student questions",
                helper: nil
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Tell us whether you are enrolled in higher education and answer a few follow-up questions only if that applies to you.",
                    whyText: "Student information can affect what documents or explanations the official application may request. This draft does not decide whether you qualify.",
                    doNotShareText: "Do not enter school ID numbers, transcripts, financial aid records, immigration information, or private details about your child or school."
                ) {

                SNAPYesNoSegmentedQuestion(
                    title: "Are you currently enrolled in higher education?",
                    value: currentlyEnrolledBinding
                )

                Text("Include college, community college, trade school, university, or similar programs.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                if viewModel.application.isCurrentlyEnrolledInHigherEducation == true {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Students are still eligibly for SNAP. These questions questions help organize what the official application asks next")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(VoteNowColors.textPrimary)
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(VoteNowColors.infoSurfaceBlue.opacity(0.28))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
                    )

                    SNAPYesNoSegmentedQuestion(
                        title: "Are you enrolled at least half-time?",
                        value: $viewModel.application.isEnrolledAtLeastHalfTime
                    )
                    Text("Use your school's definition of half-time if you know it. If you are unsure, choose the closest answer and confirm later.")
                        .font(.footnote)
                        .foregroundStyle(VoteNowColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    SNAPYesNoSegmentedQuestion(
                        title: "Do you work at least 20 hours per week?",
                        value: $viewModel.application.worksAtLeastTwentyHoursPerWeek
                    )
                    Text("Use your usual weekly hours. Do not include employer IDs or paystub details.")
                        .font(.footnote)
                        .foregroundStyle(VoteNowColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    SNAPYesNoSegmentedQuestion(
                        title: "Do you participate in work-study?",
                        value: $viewModel.application.participatesInWorkStudy
                    )
                    Text("Answer yes only if you are officially part of a work-study program.")
                        .font(.footnote)
                        .foregroundStyle(VoteNowColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    SNAPYesNoSegmentedQuestion(
                        title: "Are you responsible for a dependent child?",
                        value: dependentChildResponsibilityBinding
                    )
                    Text("Answer based on your current responsibility.")
                        .font(.footnote)
                        .foregroundStyle(VoteNowColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                }
            }
        }
    }

    private var expensesStep: some View {
        VStack(spacing: 12) {
            SNAPSectionCard(
                title: "Expense estimates",
                helper: nil
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Enter broad monthly estimates for housing, utilities, childcare if applicable, and out-of-pocket medical costs if you want to include them.",
                    whyText: "Some official applications ask about certain costs. This draft helps you collect estimates before you continue.",
                    doNotShareText: "Do not enter medical diagnoses, medical history, account numbers, landlord private details, or document images."
                ) {

                SNAPInputLabel("Monthly rent or housing", badge: .required())
                HStack(spacing: 8) {
                    Text("$")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textPrimary)

                    TextField("0", text: $viewModel.application.rentOrHousingCost)
                        .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .rent)

                    Spacer(minLength: 0)

                    Text("/ monthly")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textSecondary)
                }
                .snapCompactFieldSurface()

                Text("Enter your usual monthly rent, mortgage, or housing payment estimate.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                SNAPInputLabel("Monthly utilities", badge: .required())
                HStack(spacing: 8) {
                    Text("$")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textPrimary)

                    TextField("0", text: $viewModel.application.utilitiesCost)
                        .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .utilities)

                    Spacer(minLength: 0)

                    Text("/ monthly")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textSecondary)
                }
                .snapCompactFieldSurface()

                Text("Enter a broad monthly estimate for utilities such as electricity, gas, water, heat, or phone, if applicable.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                if shouldShowChildcareExpensesField {
                    SNAPInputLabel("Monthly childcare", badge: .optional)
                    HStack(spacing: 8) {
                        Text("$")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(VoteNowColors.textPrimary)

                        TextField("0", text: $viewModel.application.childcareCostEstimate)
                            .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .childcare)

                        Spacer(minLength: 0)

                        Text("/ monthly")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(VoteNowColors.textSecondary)
                    }
                    .snapCompactFieldSurface()

                    Text("Enter a monthly estimate only if childcare costs apply to you.")
                        .font(.footnote)
                        .foregroundStyle(VoteNowColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                SNAPInputLabel("Monthly medical costs", badge: .optionalEstimate)
                HStack(spacing: 8) {
                    Text("$")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textPrimary)

                    TextField("0", text: $viewModel.application.medicalExpensesEstimate)
                        .keyboardType(.decimalPad)
                        .focused($focusedField, equals: .medical)

                    Spacer(minLength: 0)

                    Text("/ monthly")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textSecondary)
                }
                .snapCompactFieldSurface()

                Text("Optional. Enter only a dollar estimate. Do not include diagnoses, prescriptions, or medical history.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var documentsChecklistStep: some View {
        VStack(spacing: 12) {
            SNAPSectionCard(
                title: "Checklist items",
                helper: nil
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Mark documents you already have or may want to gather before using the official application.",
                    whyText: "Having documents ready can make the official application process easier. This checklist does not upload, store, or submit documents.",
                    doNotShareText: "Do not upload document images, type document numbers, or enter immigration details in this draft."
                ) {

                Text("You may not need every item. Requirements vary by state and household.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)

                ForEach(visibleChecklistDocuments) { document in
                    let hasDocument = viewModel.application.documentsAvailable.contains(document)
                    Button {
                        toggleDocument(document)
                    } label: {
                        HStack(spacing: 10) {
                            Text(hasDocument ? "●" : "○")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(hasDocument ? VoteNowColors.primaryCTA : VoteNowColors.textSecondary)

                            Text(document.label)
                                .font(.subheadline)
                                .foregroundStyle(VoteNowColors.textPrimary)
                                .multilineTextAlignment(.leading)

                            Spacer(minLength: 0)

                            Text(hasDocument ? "Have this" : "Still need / Not sure")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(hasDocument ? VoteNowColors.primaryCTA : VoteNowColors.textSecondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(
                                    Capsule(style: .continuous)
                                        .fill(hasDocument ? VoteNowColors.statusInfoSurface : VoteNowColors.surfaceSecondary)
                                )
                                .overlay(
                                    Capsule(style: .continuous)
                                        .stroke(hasDocument ? VoteNowColors.primaryCTA.opacity(0.28) : VoteNowColors.borderSubtle, lineWidth: 1)
                                )
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(VoteNowColors.surfacePrimary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }

                Text("This step does not store document images.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)

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
        VStack(spacing: 12) {
            SNAPSectionCard(
                title: "Before continuing",
                helper: nil
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Check your answers before using them on the official state application.",
                    whyText: "Reviewing now can help you catch missing or incorrect information before you continue.",
                    doNotShareText: "Do not add extra sensitive information. Only correct the fields this assistant asks for."
                ) {

                Text("When this looks right, continue to the next step. This still does not submit your SNAP application.")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(VoteNowColors.warningAmber)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }

            SNAPSectionCard(
                title: "Review your application",
                helper: nil,
                titleAlignment: .center
            ) {
                ForEach(Array(reviewSectionSummaries.enumerated()), id: \.element.id) { index, section in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 10) {
                            Text(section.title)
                                .font(.headline.weight(.bold))
                                .foregroundStyle(VoteNowColors.primaryCTA)

                            SNAPReviewStatusBadge(status: section.status)

                            Spacer(minLength: 0)

                            Button("Edit") {
                                viewModel.jumpToDraftStep(section.step)
                            }
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(VoteNowColors.primaryCTA)
                        }

                        ForEach(section.rows) { row in
                            HStack(alignment: .top, spacing: 10) {
                                Text(row.label)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(VoteNowColors.textSecondary)
                                Spacer(minLength: 8)
                                Text(row.value)
                                    .font(.footnote)
                                    .foregroundStyle(VoteNowColors.textSecondary)
                                    .multilineTextAlignment(.trailing)
                            }
                            .padding(.vertical, 1)
                        }

                        if index < reviewSectionSummaries.count - 1 {
                            Divider()
                                .padding(.top, 2)
                        }
                    }
                }
            }
        }
    }

    private var nextStepsStep: some View {
        VStack(spacing: 12) {
            SNAPSectionCard(
                title: "Next-step checklist",
                helper: nil
            ) {
                SNAPStepGuidanceRows(
                    whatText: "Use your draft and checklist to continue with your official state SNAP application.",
                    whyText: "This assistant helped you prepare. Your application is not submitted until you complete it through the official process.",
                    doNotShareText: "Only enter sensitive information, such as SSN or document details, on the official state application website or with a trusted benefits worker.",
                    whyLabel: "Why this matters"
                ) {

                VStack(spacing: 10) {
                    SNAPNextStepRow(
                        title: "Open your official state SNAP application site.",
                        detail: "Use the state listed in your draft."
                    )
                    SNAPNextStepRow(
                        title: "Keep this draft nearby.",
                        detail: "Copy only the answers that the official application asks for."
                    )
                    SNAPNextStepRow(
                        title: "Gather documents if requested.",
                        detail: "You may not need every item in your checklist."
                    )
                    SNAPNextStepRow(
                        title: "Ask for help if anything is unclear.",
                        detail: "A benefits navigator or official agency worker can help you confirm details."
                    )
                }
                }
            }

            SNAPSectionCard(
                title: "What happens next",
                helper: nil
            ) {
                if let stateTimeline = selectedStateTimeline {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("\(stateTimeline.displayName) timeline snapshot")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(VoteNowColors.textPrimary)

                        HStack(spacing: 8) {
                            Text("Recent on-time rate:")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(VoteNowColors.textSecondary)
                            Text(stateTimeline.onTimeRatePercentText)
                                .font(.footnote.weight(.bold))
                                .foregroundStyle(VoteNowColors.textPrimary)
                        }

                        Text(stateTimeline.laymanBandLabel)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(VoteNowColors.primaryCTA)

                        Text("This is recent statewide performance, not a guarantee for your case.")
                            .font(.footnote)
                            .foregroundStyle(VoteNowColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.bottom, 4)
                } else {
                    Text("State-specific timing details will appear after you select a state.")
                        .font(.footnote)
                        .foregroundStyle(VoteNowColors.textSecondary)
                }

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

                Text("Simple timeline")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(VoteNowColors.textPrimary)
                    .padding(.top, 2)

                ForEach(SNAPStateResources.processTimelineSteps) { step in
                    SNAPTimelineMilestoneRow(
                        dayRange: step.typicalDayRange,
                        title: step.appStatusLabel,
                        detail: step.appFriendlyCopy
                    )
                }

                if let stateTimeline = selectedStateTimeline {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Suggested follow-up")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(VoteNowColors.textPrimary)
                        Text(stateTimeline.suggestedFollowUpInApp)
                            .font(.footnote)
                            .foregroundStyle(VoteNowColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.top, 4)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Your draft is ready.")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(VoteNowColors.textPrimary)

                Text("Not submitted yet.")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(VoteNowColors.warningAmber)

                Text("Next: continue through your official state SNAP application.")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(VoteNowColors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(VoteNowColors.statusWarningSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(VoteNowColors.warningAmber.opacity(0.45), lineWidth: 1)
            )
        }
    }

    private var householdSizeSelection: Binding<Int> {
        Binding<Int>(
            get: { viewModel.application.householdSize ?? 0 },
            set: { newValue in
                viewModel.application.householdSize = newValue == 0 ? nil : newValue
            }
        )
    }

    private var selectedStateTimeline: SNAPStateTimelineContext? {
        SNAPStateResources.timelineContext(for: viewModel.application.state)
    }

    private var reviewSectionSummaries: [SNAPReviewSectionSummary] {
        [
            SNAPReviewSectionSummary(
                id: "household_basics",
                title: "Household basics",
                step: .householdBasics,
                status: householdReviewStatus,
                rows: [
                    SNAPReviewSectionRow(label: "Food household size", value: displayOptionalInt(viewModel.application.householdSize)),
                    SNAPReviewSectionRow(label: "Applicant age", value: displayOptionalInt(viewModel.application.applicantAge)),
                    SNAPReviewSectionRow(label: "State and ZIP", value: displayStateZIP()),
                    SNAPReviewSectionRow(label: "Housing status", value: viewModel.application.housingStatus?.label ?? "Not provided")
                ]
            ),
            SNAPReviewSectionSummary(
                id: "income",
                title: "Income",
                step: .income,
                status: incomeReviewStatus,
                rows: [
                    SNAPReviewSectionRow(label: "Employment status", value: viewModel.application.employmentStatus?.label ?? "Not provided"),
                    SNAPReviewSectionRow(label: "Estimated monthly income", value: displayCurrency(viewModel.application.monthlyIncomeEstimate)),
                    SNAPReviewSectionRow(label: "Income changes month to month", value: yesNoUnknown(viewModel.application.incomeChangesMonthToMonth))
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
                value: yesNoUnknown(viewModel.application.isCurrentlyEnrolledInHigherEducation)
            )
        ]

        if viewModel.application.isCurrentlyEnrolledInHigherEducation == true {
            rows.append(SNAPReviewSectionRow(label: "Enrolled at least half-time", value: yesNoUnknown(viewModel.application.isEnrolledAtLeastHalfTime)))
            rows.append(SNAPReviewSectionRow(label: "Works at least 20 hours/week", value: yesNoUnknown(viewModel.application.worksAtLeastTwentyHoursPerWeek)))
            rows.append(SNAPReviewSectionRow(label: "Participates in work-study", value: yesNoUnknown(viewModel.application.participatesInWorkStudy)))
            rows.append(SNAPReviewSectionRow(label: "Responsible for dependent child", value: yesNoUnknown(viewModel.application.isResponsibleForDependentChild)))
        } else if viewModel.application.isCurrentlyEnrolledInHigherEducation == false {
            rows.append(SNAPReviewSectionRow(label: "Follow-up questions", value: "Not required"))
        }

        return rows
    }

    private var expensesReviewRows: [SNAPReviewSectionRow] {
        var rows: [SNAPReviewSectionRow] = [
            SNAPReviewSectionRow(label: "Monthly rent or housing", value: displayCurrency(viewModel.application.rentOrHousingCost)),
            SNAPReviewSectionRow(label: "Monthly utilities", value: displayCurrency(viewModel.application.utilitiesCost))
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
            || isBlank(viewModel.application.state)
            || isBlank(viewModel.application.zipCode)

        if isMissingRequired {
            return .missingRequiredInfo
        }

        let hasMissingOptional = viewModel.application.applicantAge == nil
            || viewModel.application.housingStatus == nil

        return hasMissingOptional ? .optionalNotProvided : .complete
    }

    private var incomeReviewStatus: SNAPReviewSectionStatus {
        let isMissingRequired = viewModel.application.employmentStatus == nil
            || isBlank(viewModel.application.monthlyIncomeEstimate)
            || viewModel.application.incomeChangesMonthToMonth == nil

        return isMissingRequired ? .missingRequiredInfo : .complete
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

    private func displayOptionalInt(_ value: Int?) -> String {
        guard let value else { return "Not provided" }
        return "\(value)"
    }

    private func displayStateZIP() -> String {
        let state = normalized(viewModel.application.state)
        let zip = normalized(viewModel.application.zipCode)

        if state.isEmpty && zip.isEmpty {
            return "Not provided"
        }
        if state.isEmpty {
            return zip
        }
        if zip.isEmpty {
            return state
        }
        return "\(state), \(zip)"
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

    private func normalized(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func isBlank(_ value: String?) -> Bool {
        normalized(value).isEmpty
    }

    private var stateSelection: Binding<String> {
        Binding<String>(
            get: { viewModel.application.state ?? "" },
            set: { newValue in
                if viewModel.isStateGeofenced {
                    return
                }
                let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
                viewModel.application.state = trimmed.isEmpty ? nil : trimmed
            }
        )
    }

    private var zipCodeBinding: Binding<String> {
        Binding<String>(
            get: { viewModel.application.zipCode ?? "" },
            set: { newValue in
                let digitsOnly = newValue.filter(\.isNumber)
                let trimmed = String(digitsOnly.prefix(5))
                viewModel.application.zipCode = trimmed.isEmpty ? nil : trimmed
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
            && viewModel.draftStep == .householdBasics
            && (viewModel.application.state ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var zipCodeIsMissingAfterContinueAttempt: Bool {
        viewModel.hasAttemptedDraftContinue
            && viewModel.draftStep == .householdBasics
            && (viewModel.application.zipCode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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

    private var shouldShowChildcareExpensesField: Bool {
        viewModel.application.isResponsibleForDependentChild == true
    }

    private var visibleChecklistDocuments: [SNAPDocumentType] {
        let shouldShowStudentDocuments = viewModel.application.isCurrentlyEnrolledInHigherEducation == true
            || viewModel.application.studentStatus == .currentlyStudent
        let shouldShowChildcareDocuments = viewModel.application.isResponsibleForDependentChild == true
        // No dedicated immigration relevance question exists yet in this prototype,
        // so keep this hidden until that gate is explicitly implemented.
        let shouldShowImmigrationDocuments = false

        return SNAPDocumentType.allCases.filter { document in
            if document == .studentStatusDocuments {
                return shouldShowStudentDocuments
            }
            if document == .childcareCostProof {
                return shouldShowChildcareDocuments
            }
            if document == .immigrationDocumentsIfRelevant {
                return shouldShowImmigrationDocuments
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

        You may not need every item. Requirements vary by state and household.
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

    private var applicantBirthdayRangeText: String {
        let selectedAge = viewModel.application.applicantAge ?? 18
        return "Estimated birthday range: \(birthMonthRangeText(for: selectedAge))"
    }

    private func birthMonthRangeText(for age: Int) -> String {
        let now = Date()
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = "LLLL yyyy"

        guard
            let earliest = calendar.date(byAdding: .year, value: -(age + 1), to: now),
            let latest = calendar.date(byAdding: .year, value: -age, to: now)
        else {
            return "Unavailable"
        }

        return "\(formatter.string(from: earliest)) - \(formatter.string(from: latest))"
    }

    private var applicantAgeSliderValue: Binding<Double> {
        Binding<Double>(
            get: { Double(viewModel.application.applicantAge ?? 18) },
            set: { newValue in
                viewModel.application.applicantAge = Int(newValue.rounded())
            }
        )
    }

    private func toggleDocument(_ document: SNAPDocumentType) {
        if viewModel.application.documentsAvailable.contains(document) {
            viewModel.application.documentsAvailable.removeAll { $0 == document }
        } else {
            viewModel.application.documentsAvailable.append(document)
        }
    }

    private var annualIncomeEstimateText: String {
        guard let monthly = parsedPositiveAmount(from: viewModel.application.monthlyIncomeEstimate) else {
            return "Estimate ~$0 annual income"
        }

        let annual = monthly * 12
        return "Estimate ~\(formatCurrency(annual)) annual income"
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
}

private struct SNAPStepGuidanceRows<Content: View>: View {
    let whatText: String
    let whyText: String
    let doNotShareText: String
    var whyLabel: String = "Why we ask"
    @ViewBuilder let content: Content

    @State private var isWhyExpanded = false
    @State private var isPrivacyExpanded = false

    init(
        whatText: String,
        whyText: String,
        doNotShareText: String,
        whyLabel: String = "Why we ask",
        @ViewBuilder content: () -> Content
    ) {
        self.whatText = whatText
        self.whyText = whyText
        self.doNotShareText = doNotShareText
        self.whyLabel = whyLabel
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(whatText)
                .font(.footnote)
                .foregroundStyle(VoteNowColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            SNAPInlineDisclosureRow(
                iconName: "info.circle",
                title: whyLabel,
                detailText: whyText,
                isExpanded: $isWhyExpanded
            )

            content

            SNAPInlineDisclosureRow(
                iconName: "lock.shield",
                title: "Do not share",
                detailText: doNotShareText,
                isExpanded: $isPrivacyExpanded
            )
        }
    }
}

private struct SNAPInlineDisclosureRow: View {
    let iconName: String
    let title: String
    let detailText: String
    @Binding var isExpanded: Bool

    var bodyView: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: iconName)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(VoteNowColors.primaryCTA)
                        .frame(width: 16)

                    Text(title)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textPrimary)

                    Spacer(minLength: 0)

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textSecondary)
                }
            }
            .buttonStyle(.plain)

            if isExpanded {
                Text(detailText)
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(VoteNowColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
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

private struct SNAPReviewSectionRow: Identifiable {
    let id = UUID()
    let label: String
    let value: String
}

private struct SNAPReviewStatusBadge: View {
    let status: SNAPReviewSectionStatus

    var body: some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
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
            return VoteNowColors.successGreen
        case .missingRequiredInfo:
            return VoteNowColors.warningAmber
        case .optionalNotProvided:
            return VoteNowColors.textSecondary
        }
    }

    private var backgroundColor: Color {
        switch status {
        case .complete:
            return VoteNowColors.statusSuccessSurface
        case .missingRequiredInfo:
            return VoteNowColors.statusWarningSurface
        case .optionalNotProvided:
            return VoteNowColors.surfaceSecondary
        }
    }

    private var borderColor: Color {
        switch status {
        case .complete:
            return VoteNowColors.successGreen.opacity(0.3)
        case .missingRequiredInfo:
            return VoteNowColors.warningAmber.opacity(0.4)
        case .optionalNotProvided:
            return VoteNowColors.borderSubtle
        }
    }
}

private struct SNAPNextStepRow: View {
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .font(.subheadline)
                .foregroundStyle(VoteNowColors.primaryCTA)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(VoteNowColors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
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
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(dayRange)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(VoteNowColors.primaryCTA)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(
                        Capsule(style: .continuous)
                            .fill(VoteNowColors.statusInfoSurface)
                    )

                Text(title)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(VoteNowColors.textPrimary)
            }

            Text(detail)
                .font(.footnote)
                .foregroundStyle(VoteNowColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(VoteNowColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
        )
    }
}

private struct SNAPSectionCard<Content: View>: View {
    let title: String
    let helper: String?
    let titleAlignment: Alignment
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
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(VoteNowColors.textPrimary)
                    .frame(maxWidth: .infinity, alignment: titleAlignment)
            }

            if let helper, !helper.isEmpty {
                Text(helper)
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.textSecondary)
            }

            content
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
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
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(text)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(VoteNowColors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 8)

            if let badge {
                SNAPFieldBadgeChip(badge: badge)
            }
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
            .font(.caption2.weight(.semibold))
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
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
            return VoteNowColors.primaryCTA
        case .requiredAttention:
            return VoteNowColors.warningAmber
        case .optional, .optionalEstimate:
            return VoteNowColors.textSecondary
        }
    }

    private var backgroundColor: Color {
        switch badge.style {
        case .required:
            return VoteNowColors.statusInfoSurface
        case .requiredAttention:
            return VoteNowColors.statusWarningSurface
        case .optional:
            return VoteNowColors.surfaceSecondary
        case .optionalEstimate:
            return VoteNowColors.infoSurfaceBlue.opacity(0.52)
        }
    }

    private var borderColor: Color {
        switch badge.style {
        case .required:
            return VoteNowColors.primaryCTA.opacity(0.32)
        case .requiredAttention:
            return VoteNowColors.warningAmber.opacity(0.42)
        case .optional:
            return VoteNowColors.borderSubtle
        case .optionalEstimate:
            return VoteNowColors.primaryCTA.opacity(0.2)
        }
    }
}

private extension View {
    func snapFieldSurface() -> some View {
        self
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(VoteNowColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
            )
    }

    func snapTextFieldStyle() -> some View {
        self
            .font(.body)
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(VoteNowColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
            )
    }

    func snapCompactTextFieldStyle() -> some View {
        self
            .font(.body)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(VoteNowColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
            )
    }

    func snapCompactFieldSurface() -> some View {
        self
            .font(.body)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(VoteNowColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
            )
    }
}

private struct SNAPYesNoSegmentedQuestion: View {
    let title: String
    @Binding var value: Bool?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(VoteNowColors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 10) {
                yesNoButton(title: "Yes", isSelected: value == true) {
                    value = true
                }

                yesNoButton(title: "No", isSelected: value == false) {
                    value = false
                }
            }
            .frame(maxWidth: .infinity, minHeight: 44)
        }
    }

    private func yesNoButton(
        title: String,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? VoteNowColors.primaryCTA : VoteNowColors.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(isSelected ? VoteNowColors.statusInfoSurface : VoteNowColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(
                            isSelected ? VoteNowColors.primaryCTA.opacity(0.45) : VoteNowColors.borderSubtle,
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
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? VoteNowColors.primaryCTA : VoteNowColors.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(isSelected ? VoteNowColors.statusInfoSurface : VoteNowColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(
                            isSelected ? VoteNowColors.primaryCTA.opacity(0.45) : VoteNowColors.borderSubtle,
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
    let label: (Option) -> String

    init(
        title: String,
        badge: SNAPFieldBadge? = nil,
        selection: Binding<Option?>,
        label: @escaping (Option) -> String
    ) {
        self.title = title
        self.badge = badge
        self._selection = selection
        self.label = label
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SNAPInputLabel(title, badge: badge)

            Picker(title, selection: selectionBinding) {
                Text("Select one").tag("")
                ForEach(Array(Option.allCases), id: \.rawValue) { option in
                    Text(label(option)).tag(option.rawValue)
                }
            }
            .pickerStyle(.menu)
            .snapFieldSurface()
        }
    }

    private var selectionBinding: Binding<String> {
        Binding<String>(
            get: { selection?.rawValue ?? "" },
            set: { newValue in
                selection = newValue.isEmpty ? nil : Option(rawValue: newValue)
            }
        )
    }
}
