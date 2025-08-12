import { Button } from "../../components/ui/button";
import { RolesBrowser } from "../RolesBrowser";
import { useNavigate } from "react-router-dom";

interface RolesPageProps {
	accessToken: string | null;
}

export function RolesPage({ accessToken }: RolesPageProps) {
	const navigate = useNavigate();
	return (
		<section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden p-4 sm:p-6">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-sm font-medium tracking-wide">Role definitions</h2>
				<Button variant="outline" size="sm" onClick={() => navigate("/")}>Back to review</Button>
			</div>
			<RolesBrowser accessToken={accessToken} />
		</section>
	);
}
