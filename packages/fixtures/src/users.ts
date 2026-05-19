import type { User, Navigator } from "./schemas";

export const FIXTURE_APPLICANT: User = {
  id: "00000000-0000-0000-0000-000000000010",
  email: "applicant@civica-test.local",
  role: "applicant",
  state: "CA",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

export const FIXTURE_NAVIGATOR_USER: User = {
  id: "00000000-0000-0000-0000-000000000011",
  email: "navigator@civica-test.local",
  role: "navigator",
  state: "CA",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

export const FIXTURE_NAVIGATOR: Navigator = {
  id: "00000000-0000-0000-0000-000000000012",
  user_id: FIXTURE_NAVIGATOR_USER.id,
  organization: "Bay Area Benefits Coalition",
  states: ["CA"],
  created_at: "2026-01-01T00:00:00.000Z",
};
