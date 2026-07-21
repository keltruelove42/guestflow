import { DesktopOnly } from "@/components/desktop-only";

export default function SequencesLayout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopOnly
      title="The sequence editor"
      description="Designing multi-step follow-up flows is desktop work. Use the Follow-ups tab to keep on top of replies and due messages from your phone."
    >
      {children}
    </DesktopOnly>
  );
}
