import { loadMachines } from "@/lib/machines";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const device = new URL(request.url).searchParams.get("device") ?? undefined;
  if (device && !/^[a-zA-Z0-9_-]{1,80}$/.test(device)) return Response.json({ error: "Invalid machine ID." }, { status: 400 });
  try {
    const machines = await loadMachines(device);
    return Response.json({ machines, server_time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load machines. Retrying automatically." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
