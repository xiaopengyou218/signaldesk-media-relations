import { getAppState } from "@/db";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialState = await getAppState();
  return <DashboardClient initialState={initialState} />;
}
