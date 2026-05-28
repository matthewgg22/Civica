import { describe, it, expect } from "vitest";
import {
  STAFF_ROLES,
  ROLE_HOMES,
  isStaff,
  homeForRole,
  isPathAllowedForRole,
  isPubliclyAccessible,
} from "../roleRouting";

describe("roleRouting", () => {
  describe("isStaff", () => {
    it("accepts each known staff role", () => {
      for (const role of STAFF_ROLES) {
        expect(isStaff(role)).toBe(true);
      }
    });

    it("rejects unknown roles", () => {
      expect(isStaff("applicant")).toBe(false);
      expect(isStaff("anonymous")).toBe(false);
      expect(isStaff("")).toBe(false);
    });

    it("rejects non-string values (defensive against JWT claim shapes)", () => {
      expect(isStaff(null)).toBe(false);
      expect(isStaff(undefined)).toBe(false);
      expect(isStaff(42)).toBe(false);
      expect(isStaff({ name: "navigator" })).toBe(false);
    });
  });

  describe("homeForRole", () => {
    it("returns the configured home for each role", () => {
      // Navigators land on the queue-driven daily-driver, not the
      // browse-everything view. Supervisors/admin stay on /packets.
      expect(homeForRole("navigator")).toBe("/outreach");
      expect(homeForRole("supervisor")).toBe("/packets");
      expect(homeForRole("admin")).toBe("/packets");
      expect(homeForRole("state_deputy")).toBe("/cdss");
      expect(homeForRole("county_director")).toBe("/county");
      expect(homeForRole("cbo_preview")).toBe("/cbo-preview");
    });

    it("falls back to /packets for unknown roles", () => {
      // Defensive: a staff role that passes isStaff() but isn't in ROLE_HOMES
      // should still land somewhere safe rather than nowhere.
      expect(homeForRole("custom_role_not_in_map")).toBe("/packets");
    });
  });

  describe("isPathAllowedForRole — operational roles", () => {
    it("navigator has full access to all routes", () => {
      expect(isPathAllowedForRole("/packets", "navigator")).toBe(true);
      expect(isPathAllowedForRole("/dashboard", "navigator")).toBe(true);
      expect(isPathAllowedForRole("/enrollments", "navigator")).toBe(true);
      expect(isPathAllowedForRole("/cdss", "navigator")).toBe(true);
      expect(isPathAllowedForRole("/county", "navigator")).toBe(true);
      expect(isPathAllowedForRole("/cbo-preview", "navigator")).toBe(true);
    });

    it("admin has full access to all routes", () => {
      expect(isPathAllowedForRole("/cdss", "admin")).toBe(true);
      expect(isPathAllowedForRole("/county", "admin")).toBe(true);
      expect(isPathAllowedForRole("/cbo-preview", "admin")).toBe(true);
      expect(isPathAllowedForRole("/packets", "admin")).toBe(true);
    });
  });

  describe("isPathAllowedForRole — audience roles (restricted)", () => {
    it("state_deputy can only access /cdss", () => {
      expect(isPathAllowedForRole("/cdss", "state_deputy")).toBe(true);
      expect(isPathAllowedForRole("/cdss/breakdown", "state_deputy")).toBe(true);
      expect(isPathAllowedForRole("/county", "state_deputy")).toBe(false);
      expect(isPathAllowedForRole("/cbo-preview", "state_deputy")).toBe(false);
      expect(isPathAllowedForRole("/packets", "state_deputy")).toBe(false);
      expect(isPathAllowedForRole("/dashboard", "state_deputy")).toBe(false);
    });

    it("county_director can only access /county", () => {
      expect(isPathAllowedForRole("/county", "county_director")).toBe(true);
      expect(isPathAllowedForRole("/county/details", "county_director")).toBe(true);
      expect(isPathAllowedForRole("/cdss", "county_director")).toBe(false);
      expect(isPathAllowedForRole("/cbo-preview", "county_director")).toBe(false);
      expect(isPathAllowedForRole("/packets", "county_director")).toBe(false);
    });

    it("cbo_preview can only access /cbo-preview", () => {
      expect(isPathAllowedForRole("/cbo-preview", "cbo_preview")).toBe(true);
      expect(isPathAllowedForRole("/cbo-preview/demo", "cbo_preview")).toBe(true);
      expect(isPathAllowedForRole("/cdss", "cbo_preview")).toBe(false);
      expect(isPathAllowedForRole("/county", "cbo_preview")).toBe(false);
      expect(isPathAllowedForRole("/packets", "cbo_preview")).toBe(false);
    });
  });

  describe("isPathAllowedForRole — public prefixes", () => {
    it("auth routes are accessible to every role", () => {
      expect(isPathAllowedForRole("/login", "state_deputy")).toBe(true);
      expect(isPathAllowedForRole("/auth/signout", "county_director")).toBe(true);
      expect(isPathAllowedForRole("/auth/signout", "cbo_preview")).toBe(true);
    });

    it("api routes are accessible to every role", () => {
      // Without this, restricted roles can't call any internal API endpoint
      // their page makes XHR/fetch calls to.
      expect(isPathAllowedForRole("/api/uat-feedback", "state_deputy")).toBe(true);
      expect(isPathAllowedForRole("/api/anything", "county_director")).toBe(true);
    });

    it("demo packet detail pages are publicly accessible", () => {
      // /packets/demo-pkt-* opens the navigator review surface for prospective
      // CBOs via the public /cbo-preview queue. Real packet IDs are UUIDs and
      // do NOT match this prefix, so production data stays gated.
      expect(isPubliclyAccessible("/packets/demo-pkt-001-maria")).toBe(true);
      expect(isPubliclyAccessible("/packets/demo-pkt-002-carlos")).toBe(true);
      expect(isPubliclyAccessible("/packets/demo-pkt-003-jasmine")).toBe(true);
      // Real packet IDs (UUID-shaped) must NOT match the demo prefix.
      expect(isPubliclyAccessible("/packets/a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(false);
      expect(isPubliclyAccessible("/packets")).toBe(false);
    });
  });

  describe("ROLE_HOMES coverage", () => {
    it("every staff role has a home defined", () => {
      // Prevents drift: if someone adds a role to STAFF_ROLES but forgets
      // ROLE_HOMES, this catches it. homeForRole() falls back to /packets
      // but explicit > implicit for role routing.
      for (const role of STAFF_ROLES) {
        expect(ROLE_HOMES[role], `role ${role} missing from ROLE_HOMES`).toBeDefined();
      }
    });
  });
});
