import { DesktopOnly } from "@/components/desktop-only";

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopOnly
      title="The campaign builder"
      description="Creating and editing ad campaigns needs room for audiences, budgets, and lead forms. New leads from your campaigns still show up right here on your phone."
    >
      {children}
    </DesktopOnly>
  );
}
