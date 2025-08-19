import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAccessToken } from "../hooks/useAccessToken";
import { useMsal } from "@azure/msal-react";
import { defineStepper } from "../../components/stepper";

export function OnboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStepRaw = Number(searchParams.get("step") || "1");
  const initialStep = isNaN(initialStepRaw)
    ? 1
    : Math.max(1, Math.min(3, initialStepRaw));
  const [step, setStep] = useState(initialStep);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<null | {
    tenantId: string;
    name?: string;
    domain?: string;
  }>(null);
  const navigate = useNavigate();
  const { accessToken } = useAccessToken();
  const { instance } = useMsal();
  const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string | undefined;
  const clientId = import.meta.env.VITE_AAD_CLIENT_ID as string | undefined;
  const apiScope = import.meta.env.VITE_API_SCOPE as string;
  // Build a redirect back to the onboard page, landing on step=3
  const onboardRedirect = (() => {
    try {
      const url = new URL("/onboard", window.location.origin);
      url.searchParams.set("step", "3");
      return url.toString();
    } catch {
      return undefined;
    }
  })();
  const adminConsentUrl =
    tenantId && clientId
      ? `https://login.microsoftonline.com/common/adminconsent?client_id=${encodeURIComponent(
          clientId
        )}&scope=${encodeURIComponent(
          "https://graph.microsoft.com/.default"
        )}&redirect_uri=${encodeURIComponent(
          onboardRedirect || window.location.origin
        )}`
      : undefined;

  const doVerify = async (token: string) => {
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
            Authorization: `Bearer ${token}`,
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
      navigate("/", { replace: true, state: { verifiedTenant: json } });
    } catch (e: any) {
      setVerifyError(e?.message || "Verification failed. Please retry.");
    } finally {
      setVerifying(false);
    }
  };

  const verify = async () => {
    setVerifyError(null);
    setVerifySuccess(null);
    try {
      if (!accessToken) {
        const url = new URL("/onboard", window.location.origin);
        url.searchParams.set("step", "3");
        url.searchParams.set("action", "verify");
        await instance.loginRedirect({
          scopes: [apiScope],
          redirectStartPage: url.toString(),
        });
        return; // Redirecting to sign-in; after return we'll auto-verify
      }
      await doVerify(accessToken);
    } catch (e: any) {
      setVerifyError(e?.message || "Verification failed. Please retry.");
    }
  };

  // After returning from sign-in, if action=verify and we have a token, run verification automatically
  useEffect(() => {
    const intent = searchParams.get("action");
    if (
      intent === "verify" &&
      step === 3 &&
      accessToken &&
      !verifying &&
      !verifySuccess &&
      !verifyError
    ) {
      void doVerify(accessToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, step, accessToken]);

  // Stepper definition
  const { Stepper, steps } = useMemo(
    () =>
      defineStepper(
        { id: "welcome" as const },
        { id: "consent" as const },
        { id: "verify" as const }
      ),
    []
  );

  // Map numeric initial step to step id
  const initialStepId = steps[Math.min(steps.length, Math.max(1, step)) - 1].id;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <img
          src={`${import.meta.env.BASE_URL}entrarolereaper_logo.png`}
          alt="RoleReaper"
          className="h-12 w-12 translate-y-1.5 drop-shadow-sm"
        />
        <h1 className="text-2xl font-semibold">Onboard new tenant</h1>
      </div>
      <div className="border rounded-lg bg-card text-card-foreground shadow-sm p-4">
        <Stepper.Provider
          initialStep={initialStepId}
          variant="horizontal"
          labelOrientation="horizontal"
        >
          {({ methods }) => (
            <>
              <Stepper.Navigation className="mb-4">
                <Stepper.Step of="welcome">
                  <Stepper.Title>Welcome</Stepper.Title>
                  <Stepper.Description>Overview</Stepper.Description>
                </Stepper.Step>
                <Stepper.Step of="consent">
                  <Stepper.Title>Admin consent</Stepper.Title>
                  <Stepper.Description>Grant permissions</Stepper.Description>
                </Stepper.Step>
                <Stepper.Step of="verify">
                  <Stepper.Title>Verify</Stepper.Title>
                  <Stepper.Description>Connectivity</Stepper.Description>
                </Stepper.Step>
              </Stepper.Navigation>
              {methods.switch({
                welcome: (step) => (
                  <Stepper.Panel>
                    <p>
                      By onboarding your tenant, this application will request
                      delegated permissions to read the data it needs for
                      reviews.
                    </p>
                    <p>
                      The only data stored persistently is your tenant ID and
                      any custom role definitions you create. All other data
                      retrieved during reviews is temporary and discarded when
                      the review is completed.
                    </p>
                  </Stepper.Panel>
                ),
                consent: (step) => (
                  <Stepper.Panel className="space-y-3 text-sm leading-relaxed">
                    <h2 className="text-lg font-medium">Grant admin consent</h2>
                    <p>
                      To onboard the tenant, sign in with a user that has Global
                      Administrator permissions and grant the required
                      application permissions.
                    </p>
                    <p>
                      If you are not signed in as a Global Administrator, you
                      will be redirected to sign in with the correct account.
                    </p>
                    <p>
                      All permissions requested are delegated permissions that
                      allow the application to read data on your behalf.
                    </p>
                    {!adminConsentUrl && (
                      <p className="text-xs text-muted-foreground">
                        Admin consent link is not available. Set
                        VITE_AAD_TENANT_ID and VITE_AAD_CLIENT_ID in your web
                        environment to enable the direct consent link, or visit
                        Entra Portal to grant consent.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (adminConsentUrl) {
                            window.location.assign(adminConsentUrl);
                          }
                        }}
                        disabled={!adminConsentUrl}
                      >
                        Grant admin consent
                      </Button>
                    </div>
                  </Stepper.Panel>
                ),
                verify: (step) => (
                  <Stepper.Panel className="space-y-3 text-sm leading-relaxed">
                    <h2 className="text-lg font-medium">Verify connection</h2>
                    <p>
                      We will verify connectivity and retrieve tenant metadata.
                    </p>
                    {verifySuccess && (
                      <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200 p-3 text-sm">
                        <CheckCircle className="h-4 w-4 mt-0.5" />
                        <div>
                          <div className="font-medium">
                            Verification successful
                          </div>
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
                            <li>
                              Ensure admin consent was granted successfully.
                            </li>
                            <li>
                              Use a Global Administrator account for consent.
                            </li>
                            <li>
                              Sign out and back in if your session changed
                              roles.
                            </li>
                            <li>
                              Wait 1–2 minutes for consent to propagate, then
                              retry.
                            </li>
                            <li>
                              Check API URL configuration and network
                              connectivity.
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
                  </Stepper.Panel>
                ),
              })}

              <Stepper.Controls className="border-t pt-3 mt-4">
                <div className="flex items-center justify-between w-full">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const idx = steps.findIndex(
                        (s) => s.id === methods.current.id
                      );
                      if (idx > 0) {
                        methods.prev();
                        setStep(idx); // new human step is idx
                        setSearchParams((p) => {
                          p.set("step", String(idx));
                          return p;
                        });
                      }
                    }}
                    disabled={methods.current.id === steps[0].id}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      const idx = steps.findIndex(
                        (s) => s.id === methods.current.id
                      );
                      if (idx < steps.length - 1) {
                        methods.next();
                        setStep(idx + 2); // next human step number
                        setSearchParams((p) => {
                          p.set("step", String(idx + 2));
                          return p;
                        });
                      }
                    }}
                    disabled={methods.current.id === steps[steps.length - 1].id}
                  >
                    Next
                  </Button>
                </div>
              </Stepper.Controls>
            </>
          )}
        </Stepper.Provider>
      </div>
    </div>
  );
}
