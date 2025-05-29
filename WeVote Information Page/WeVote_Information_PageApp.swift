//
//
//
//  WeVote_Information_PageApp.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 3/30/25.
//  Updated by ChatGPT on 05/27/25 (force light mode)
//

import SwiftUI

@main
struct WeVote_Information_PageApp: App {
    // hook up our AppDelegate so FirebaseApp.configure() runs
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate

    // shared view models
    @StateObject private var planVM = PlanViewModel()
    @StateObject private var repsVM = MyRepsViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()              // ← your single root view
                .environmentObject(planVM)
                .environmentObject(repsVM)
                .preferredColorScheme(.light)   // forces light mode across the app
        }
    }
}

