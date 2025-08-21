import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
      <Card className="w-full max-w-xl text-center">
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
            Sign in to start reviewing access for users and groups in your
            tenant.
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
      </Card>
    </div>
  );
}
