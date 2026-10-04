import { KernDashboard } from "@/components/KernDashboard";
import { Login } from "@/components/Login";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const authenticated = await isAuthenticated();
  return authenticated ? <KernDashboard /> : <Login />;
}
