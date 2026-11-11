
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OnboardingForm from "./onboarding-form";

export default async function OnboardingPage() {
  // Check whether the user is logged in
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Check whether onboarding has already been completed
  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      username: true,
    },
  });

  // Already completed? Return to dashboard.
  if (user?.username) {
    redirect("/");
  }

  return <OnboardingForm />;
}
