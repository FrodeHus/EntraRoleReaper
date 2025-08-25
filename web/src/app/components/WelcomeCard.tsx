import { Button } from "../../components/ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useNavigate } from "react-router-dom";

interface WelcomeCardProps {
  onSignIn: () => void;
}

export function WelcomeCard({ onSignIn }: WelcomeCardProps) {
  const navigate = useNavigate();

  return (
    <div className="py-16 flex items-center justify-center">
      <Card className="w-full max-w-xl text-center relative overflow-hidden">
        {/* Beta ribbon (top-right corner) */}
        <span
          className="pointer-events-none select-none absolute -right-8 top-3 rotate-45 bg-gradient-to-r from-rose-600 to-pink-500 text-white text-[10px] font-semibold uppercase tracking-widest shadow-md ring-1 ring-rose-400/50 px-10 py-1"
          aria-hidden="true"
        >
          beta
        </span>
        <CardHeader className="items-center">
          <div className="flex items-center gap-2 mb-1">
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
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>
            <p>
              Sign in to start reviewing access for users and groups in your
              tenant.
            </p>
            <p>
              Using this application requires that you log in with an Entra ID
              account that has been granted the necessary permissions to read
              directory data such as Security Reader.
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <Button onClick={onSignIn}>Sign in</Button>
            <Button variant="outline" onClick={() => navigate("/onboard")}>
              Onboard tenant
            </Button>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <div className="w-full flex justify-center">
            <div className="text-xs text-muted-foreground rounded-md border bg-muted/30 px-3 py-2">
              <p className="flex items-center gap-2 justify-center">
                <span>Source code available here:</span>
                <a
                  href="https://github.com/FrodeHus/EntraRoleReaper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
                >
                  <GitHubLogoIcon className="h-4 w-4" aria-hidden="true" />
                  <span>GitHub</span>
                </a>
              </p>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
