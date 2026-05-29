#!/usr/bin/env ruby
# encoding: utf-8
# frozen_string_literal: true

# Adds pointfreeco/swift-snapshot-testing as a SwiftPM dependency to the
# CivicaTests target only. Idempotent: re-running is a no-op once installed.
#
# Why this exists: hand-editing project.pbxproj is risky. The xcodeproj gem
# (Apple-blessed Ruby library, used by CocoaPods + many Apple sample projects)
# generates the same UUIDs + structure that Xcode itself would.
#
# Reference: PR-0 of docs/audits/civica-ios-product-audit-2026-05-29.md
# Source: https://github.com/pointfreeco/swift-snapshot-testing

# Ruby 2.6 (system Ruby on macOS) defaults to US-ASCII for file reads, which
# trips on UTF-8 em-dashes inside project.pbxproj. Force UTF-8 globally.
Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

require 'xcodeproj'

PROJECT_PATH = 'Civica.xcodeproj'
PACKAGE_URL = 'https://github.com/pointfreeco/swift-snapshot-testing'
PACKAGE_REQUIREMENT = { kind: 'upToNextMajorVersion', minimumVersion: '1.17.0' }
PRODUCT_NAME = 'SnapshotTesting'
TEST_TARGET_NAME = 'CivicaTests'

project = Xcodeproj::Project.open(PROJECT_PATH)

# Already installed? Skip cleanly.
existing_ref = project.root_object.package_references.find do |ref|
  ref.respond_to?(:repositoryURL) && ref.repositoryURL == PACKAGE_URL
end

if existing_ref
  puts "swift-snapshot-testing already declared in #{PROJECT_PATH} — nothing to do."
  exit 0
end

# Find the test target.
test_target = project.targets.find { |t| t.name == TEST_TARGET_NAME }
abort "ERROR: target #{TEST_TARGET_NAME} not found in #{PROJECT_PATH}" unless test_target

# Add the remote package reference at the project level.
pkg_ref = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
pkg_ref.repositoryURL = PACKAGE_URL
pkg_ref.requirement = PACKAGE_REQUIREMENT
project.root_object.package_references << pkg_ref

# Add the product dependency on the test target only.
product_dep = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
product_dep.package = pkg_ref
product_dep.product_name = PRODUCT_NAME
test_target.package_product_dependencies << product_dep

# Link the product in the test target's Frameworks build phase.
frameworks_phase = test_target.frameworks_build_phase
build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
build_file.product_ref = product_dep
frameworks_phase.files << build_file

project.save

puts "Added swift-snapshot-testing (#{PACKAGE_REQUIREMENT[:minimumVersion]}+) as #{PRODUCT_NAME} dependency on #{TEST_TARGET_NAME}."
puts "Run: xcodebuild -project #{PROJECT_PATH} -resolvePackageDependencies"
