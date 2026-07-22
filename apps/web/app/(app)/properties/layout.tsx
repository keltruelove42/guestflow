import { DesktopOnly } from "@/components/desktop-only";

export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopOnly
      useContextNoun
      title="Property management"
      description="Setting up listings works best with a bigger screen."
    >
      {children}
    </DesktopOnly>
  );
}
