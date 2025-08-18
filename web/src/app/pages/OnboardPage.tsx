import { useState } from "react";
import { Button } from "../../components/ui/button";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function OnboardPage() {
  const [step, setStep] = useState(1);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<null | {
    tenantId: string;
    name?: string;
    domain?: string;
  }>(null);
  const navigate = useNavigate();
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

  const verify = async () => {
    setVerifying(true);
    setVerifyError(null);
    setVerifySuccess(null);
    try {
      const res = await fetch(
        new URL("/api/onboarding/verify", import.meta.env.VITE_API_URL),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) {
        let detail = "";
        try {
          const prob = await res.json();
          detail = prob?.detail || prob?.title || "";
        } catch {}
        throw new Error(detail || `Verification failed (HTTP ${res.status}).`);
      }
      const json = await res.json();
      // Redirect to home with a one-time success banner
      navigate("/", { replace: true, state: { verifiedTenant: json } });
    } catch (e: any) {
      setVerifyError(e?.message || "Verification failed. Please retry.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Onboard new tenant</h1>
      <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
        <div className="border-b px-4 py-3 text-sm">Step {step} of 3</div>
        <div className="p-4 space-y-4 text-sm leading-relaxed">
          {step === 1 && (
            <>
              <h2 className="text-lg font-medium">Welcome</h2>
              <p>
                By onboarding your tenant, this application will request
                delegated permissions to read the data it needs for reviews.
              </p>
              <p>
                The only data stored persistently is your tenant ID and any
                custom role definitions you create. All other data retrieved
                during reviews is temporary and discarded when the review is
                completed.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-lg font-medium">Grant admin consent</h2>
              <p>
                To onboard the tenant, sign in with a user that has Global
                Administrator permissions and grant the required application
                permissions.
              </p>
              {!adminConsentUrl && (
                <p className="text-xs text-muted-foreground">
                  Admin consent link is not available. Set VITE_AAD_TENANT_ID
                  and VITE_AAD_CLIENT_ID in your web environment to enable the
                  direct consent link, or visit Entra Portal to grant consent.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    adminConsentUrl &&
                    window.open(adminConsentUrl, "_blank", "noopener")
                  }
                  disabled={!adminConsentUrl}
                >
                  Open admin consent
                </Button>
                <Button onClick={() => setStep(3)}>Already completed</Button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="text-lg font-medium">Verify connection</h2>
              <p>We will verify connectivity and retrieve tenant metadata.</p>
              {verifySuccess && (
                <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200 p-3 text-sm">
                  <CheckCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <div className="font-medium">Verification successful</div>
                    <div className="text-xs mt-0.5">
                      Tenant:{" "}
                      <span className="font-medium">
                        {verifySuccess.name || "(unknown)"}
                      </span>{" "}
                      ({verifySuccess.domain || "-"})
                    </div>
                  </div>
                </div>
              )}
              {verifyError && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>
                    <div className="font-medium">Verification failed</div>
                    <div className="text-xs mt-0.5">{verifyError}</div>
                    <ul className="list-disc ml-5 mt-2 text-xs space-y-1">
                      <li>Ensure admin consent was granted successfully.</li>
                      <li>Use a Global Administrator account for consent.</li>
                      <li>
                        Sign out and back in if your session changed roles.
                      </li>
                      <li>
                        Wait 1–2 minutes for consent to propagate, then retry.
                      </li>
                      <li>
                        Check API URL configuration and network connectivity.
                      </li>
                    </ul>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={verify}
                        disabled={verifying}
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-2">
                <Button
                  onClick={verify}
                  disabled={verifying}
                  aria-busy={verifying}
                >
                  {verifying ? "Verifying…" : "Verify"}
                </Button>
              </div>
            </>
          )}
        </div>
        <div className="border-t px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            Back
          </Button>
          <Button
            onClick={() => setStep((s) => (s < 3 ? s + 1 : s))}
            disabled={step === 3}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
