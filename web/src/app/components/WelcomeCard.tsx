import { Button } from "../../components/ui/button";

interface WelcomeCardProps {
  onSignIn: () => void;
}

export function WelcomeCard({ onSignIn }: WelcomeCardProps) {
  const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string | undefined;
  const clientId = import.meta.env.VITE_AAD_CLIENT_ID as string | undefined;
  const adminConsentUrl =
    tenantId && clientId
      ? `https://login.microsoftonline.com/${encodeURIComponent(
          tenantId
        )}/v2.0/adminconsent?client_id=${encodeURIComponent(
          clientId
        )}&scope=${encodeURIComponent(
          "https://graph.microsoft.com/.default"
        )}&redirect_uri=${encodeURIComponent(window.location.origin)}`
      : undefined;
  return (
    <div className="py-16 flex items-center justify-center">
      <div className="w-full max-w-xl border bg-card text-card-foreground rounded-lg shadow-sm p-8 text-center">
        <div className="flex justify-center mb-4">
          <img
            src={`${import.meta.env.BASE_URL}entrarolereaper_logo.png`}
            alt="RoleReaper logo"
            className="h-20 w-20"
            loading="eager"
            decoding="async"
          />
          <span className="text-xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Entra RoleReaper
          </span>
        </div>
        <h1 className="text-2xl font-semibold mb-2">Welcome</h1>
        <p className="mb-6 text-muted-foreground">
          Sign in to start reviewing access for users and groups in your tenant.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Button onClick={onSignIn}>Sign in</Button>
          <Button
            variant="outline"
            onClick={() =>
              adminConsentUrl &&
              window.open(adminConsentUrl, "_blank", "noopener")
            }
            disabled={!adminConsentUrl}
            title={
              adminConsentUrl
                ? "Open Entra ID admin consent flow"
                : "Set VITE_AAD_TENANT_ID and VITE_AAD_CLIENT_ID to enable"
            }
          >
            Onboard tenant
          </Button>
        </div>
      </div>
    </div>
  );
}
