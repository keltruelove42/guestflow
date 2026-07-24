// LOCAL SANDBOX ONLY — seeds one demo org per vertical for design review.
import { seedDemoOrg, type SeedVertical } from "./seed";
import { prisma } from "./client";

const VERTICALS: SeedVertical[] = [
  "RENTALS",
  "TRADES",
  "BEAUTY",
  "DEALERSHIPS",
  "SAAS",
  "ECOMMERCE",
  "REALESTATE",
  "HOTELS",
];

const ORG_NAMES: Record<SeedVertical, string> = {
  RENTALS: "Blue Ridge Stays",
  TRADES: "Summit Plumbing & Air",
  BEAUTY: "Luxe & Co Salon",
  DEALERSHIPS: "Crestview Auto Group",
  SAAS: "Northbeam Software",
  ECOMMERCE: "Harbor Goods Co",
  REALESTATE: "Maple Grove Realty",
  HOTELS: "The Carriage House Inn",
};

async function main() {
  for (const v of VERTICALS) {
    const r = await seedDemoOrg({
      vertical: v,
      userId: `demo-user-${v.toLowerCase()}`,
      email: `demo-${v.toLowerCase()}@leadcoda.demo`,
      orgName: ORG_NAMES[v],
      userName: "Taylor",
    });
    console.log(`${v}: org=${r.org.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
