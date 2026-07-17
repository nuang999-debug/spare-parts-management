import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PACKING_RULES: Array<{ itemNo: string; multipleOf: number }> = [
  { itemNo: "140 7015 040", multipleOf: 10 },
  { itemNo: "140 8618 000", multipleOf: 10 },
  { itemNo: "81620000", multipleOf: 5 },
  { itemNo: "82309600", multipleOf: 25 },
  { itemNo: "82365500", multipleOf: 25 },
  { itemNo: "82295600", multipleOf: 25 },
];

function normalizeItemNo(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
      displayName: "Admin",
      role: "ADMIN",
      mustChangePassword: true,
    },
  });

  console.log(`Admin user ready: ${admin.username} (id=${admin.id})`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`Default admin password: ${adminPassword} (change on first login)`);
  }

  for (const rule of PACKING_RULES) {
    await prisma.packingUnitRule.upsert({
      where: { itemNoNormalized: normalizeItemNo(rule.itemNo) },
      update: { multipleOf: rule.multipleOf, active: true },
      create: {
        itemNoNormalized: normalizeItemNo(rule.itemNo),
        multipleOf: rule.multipleOf,
        active: true,
        createdById: admin.id,
      },
    });
  }
  console.log(`Seeded ${PACKING_RULES.length} packing unit rules.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
