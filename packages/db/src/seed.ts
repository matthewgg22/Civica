import { prisma } from "./client.js";

async function main() {
  await prisma.user.upsert({
    where: { email: "navigator@civica-dev.local" },
    create: {
      email: "navigator@civica-dev.local",
      role: "navigator",
      state: "CA",
      navigator: {
        create: { organization: "Bay Area Benefits Coalition", states: ["CA"] },
      },
    },
    update: {},
  });

  const navigator = await prisma.navigator.findFirst({
    where: { user: { email: "navigator@civica-dev.local" } },
  });

  const applicant = await prisma.user.upsert({
    where: { email: "applicant@civica-dev.local" },
    create: { email: "applicant@civica-dev.local", role: "applicant", state: "CA" },
    update: {},
  });

  await prisma.packet.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      user_id: applicant.id,
      state: "CA",
      status: "in_progress",
      navigator_id: navigator?.id ?? null,
    },
    update: {},
  });

  console.warn("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
