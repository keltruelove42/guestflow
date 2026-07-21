import { DesktopOnly } from "@/components/desktop-only";

export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopOnly
      title="Property management"
      description="Setting up listings, photos, and availability calendars works best with a bigger screen. Your properties still filter every view on mobile."
    >
      {children}
    </DesktopOnly>
  );
}
