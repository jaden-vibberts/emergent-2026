import Link from "next/link";
import { loadDashboard } from "@/lib/dashboard";
import Dashboard from "./Dashboard";
export const dynamic = "force-dynamic";
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; demo?: string }> }) {
  const params = await searchParams;
  const range = ["7", "14", "28", "all"].includes(params.range ?? "") ? params.range! : "28";
  try {
    const data = await loadDashboard(range, params.demo === "1");
    return <main className="page-shell pb-12"><header className="site-header"><Link className="wordmark" href="/">Laundry room<span className="wordmark-dot" /></Link><Link className="nav-link" href="/">← Live machines</Link></header><Dashboard data={data} /></main>;
  } catch (error) {
    return <main className="page-shell py-12"><Link href="/">← Live machines</Link><h1 className="mt-8 text-3xl font-semibold">Usage dashboard</h1><p role="alert" className="notice">{error instanceof Error ? error.message : "Could not load the dashboard."}</p></main>;
  }
}
