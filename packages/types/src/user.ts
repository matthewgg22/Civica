import { z } from "zod";
import { SupportedStateSchema } from "./packet.js";

export const UserRoleSchema = z.enum(["applicant", "navigator", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
  state: SupportedStateSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const NavigatorSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  organization: z.string(),
  states: z.array(SupportedStateSchema).min(1),
  created_at: z.string().datetime(),
});
export type Navigator = z.infer<typeof NavigatorSchema>;
