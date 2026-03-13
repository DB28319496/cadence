import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { SidebarProvider } from "@/components/dashboard/sidebar-context";
import { DemoTour } from "@/components/demo-tour";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let member;
  try {
    member = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    console.error("[layout] DB error:", err);
    throw err;
  }

  if (!member) redirect("/signup");

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar workspaceName={member.workspace.name} />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Header
            workspaceName={member.workspace.name}
            userName={session.user.name ?? ""}
            userEmail={session.user.email ?? ""}
            userImage={session.user.image ?? undefined}
          />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        <Suspense>
          <DemoTour />
        </Suspense>
      </div>
    </SidebarProvider>
  );
}
