import { DesktopOnly } from "@/components/desktop-only";

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopOnly
      title="Integrations setup"
      description="Connecting Meta, Hostfully, Twilio and friends involves OAuth flows and API keys, much easier on desktop. Connected integrations keep working everywhere."
    >
      {children}
    </DesktopOnly>
  );
}
