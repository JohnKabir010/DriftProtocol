import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DISTRICTS = [
  {
    key: "docklands",
    name: "The Docklands",
    description: "Rain-slicked industrial waterfront. Long straights, hard chicanes.",
    trackIds: ["docklands-sprint", "docklands-circuit"],
  },
  {
    key: "neon-row",
    name: "Neon Row",
    description: "The strip. Every surface covered in ads. Three lanes of chaos.",
    trackIds: ["neon-row-circuit"],
  },
  {
    key: "the-stacks",
    name: "The Stacks",
    description: "Vertical city. Rooftop-to-rooftop hairpins, no guardrails.",
    trackIds: ["stacks-drift-bowl", "stacks-circuit"],
  },
  {
    key: "skyline-loop",
    name: "Skyline Loop",
    description: "Elevated expressway ring. 300km/h on the banking, legend only.",
    trackIds: ["skyline-loop"],
  },
];

async function main() {
  console.log("🌱 Seeding districts…");

  for (const d of DISTRICTS) {
    const district = await prisma.district.upsert({
      where: { key: d.key },
      update: { name: d.name },
      create: { key: d.key, name: d.name },
    });

    // Create the current open epoch if none exists.
    const existing = await prisma.districtEpoch.findFirst({
      where: { districtId: district.id },
      orderBy: { epochNumber: "desc" },
    });
    if (!existing) {
      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await prisma.districtEpoch.create({
        data: {
          districtId: district.id,
          epochNumber: 1,
          influence: {},
          startsAt: now,
          endsAt: weekEnd,
        },
      });
    }
  }

  console.log("✅ Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
