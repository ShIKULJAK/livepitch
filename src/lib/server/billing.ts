import { prisma } from "@/lib/db/prisma";

export async function getBillingSnapshot(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, name: true },
  });

  const [teams, competitions, storageApprox] = await Promise.all([
    prisma.team.count({ where: { organizationId } }),
    prisma.competition.count({ where: { organizationId } }),
    prisma.message.count(),
  ]);

  return {
    name: organization?.plan ? `${organization.plan} Plan` : "Free Plan",
    priceMonthly: organization?.plan === "Pro" ? 29 : 0,
    status: "active",
    features: [
      "Unlimited tournaments",
      "Unlimited teams",
      "Advanced statistics",
      "Priority support",
      "Custom branding",
      "API access",
    ],
    usage: {
      tournaments: `${competitions} / Unlimited`,
      teams: `${teams} / Unlimited`,
      storage: `${(storageApprox / 1000).toFixed(1)} GB / 10 GB`,
    },
  };
}

