import { PrismaClient } from "./generated/prisma/index";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Singleton to avoid exhausting connections in dev with hot reloads
export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__prisma = prisma;
}
