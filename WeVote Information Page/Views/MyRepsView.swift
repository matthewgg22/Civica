//
//
//
//  MyRepsView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//  Updated by ChatGPT on 05/25/25 (keyboard toolbar constraint fix)
//

import SwiftUI

struct MyRepsView: View {
    @EnvironmentObject var planVM: PlanViewModel
    @EnvironmentObject var repsVM: MyRepsViewModel

    @FocusState private var zipFieldIsFocused: Bool

    private var sections: [(title: String, officials: [Official])] {
        [
            ("Federal", repsVM.federalReps),
            ("State",   repsVM.stateReps),
            ("City",    repsVM.cityReps)
        ].filter { !$0.officials.isEmpty }
    }

    var body: some View {
        ZStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("My Representatives")
                        .font(.largeTitle).bold()

                    // ZIP code input
                    TextField("Enter ZIP Code", text: $planVM.zip)
                        .keyboardType(.numberPad)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .padding(.vertical, 8)
                        .focused($zipFieldIsFocused)
                        .onChange(of: planVM.zip) { newZip in
                            guard !newZip.isEmpty else { return }
                            repsVM.fetchReps(for: newZip)
                        }
                        // fix toolbar constraints by giving it a real width
                        .toolbar {
                            ToolbarItem(placement: .keyboard) {
                                HStack {
                                    Spacer()
                                    Button("Done") {
                                        zipFieldIsFocused = false
                                    }
                                    .fixedSize()               // ensures the button has intrinsic width
                                }
                                .frame(maxWidth: .infinity)   // stretch the HStack across the toolbar
                            }
                        }

                    // … loading / error / results …
                    if repsVM.isLoading {
                        ProgressView("Looking up your reps…")
                            .frame(maxWidth: .infinity)
                    } else if let error = repsVM.errorMessage {
                        VStack(spacing: 8) {
                            Text(error).foregroundColor(.red)
                            Button("Retry") {
                                repsVM.fetchReps(for: planVM.zip)
                            }
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        ForEach(sections, id: \.title) { section in
                            RepresentativeSection(
                                title:     section.title,
                                officials: section.officials
                            )
                        }
                    }
                }
                .padding()
            }
            .scrollDismissesKeyboard(.interactively)

            if repsVM.isLoading {
                Color.black.opacity(0.3).ignoresSafeArea()
                ProgressView().scaleEffect(1.5)
            }
        }
        .onAppear {
            if !planVM.zip.isEmpty {
                repsVM.fetchReps(for: planVM.zip)
            }
        }
        .onTapGesture {
            zipFieldIsFocused = false
        }
    }
}

struct MyRepsView_Previews: PreviewProvider {
    static var previews: some View {
        MyRepsView()
            .environmentObject(PlanViewModel())
            .environmentObject(MyRepsViewModel())
    }
}
