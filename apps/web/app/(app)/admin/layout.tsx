import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session.email)) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-0.5 text-sm text-muted">
          Platform operator tools — all workspaces
        </p>
      </div>
      {children}
    </div>
  );
}
