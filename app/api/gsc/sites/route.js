import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSites } from "@/lib/gsc";
import { withCache } from "@/lib/cache";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sites = await withCache(
      `sites:${session.accessToken.slice(-10)}`,
      () => getSites(session.accessToken),
      300 // 5 хвилин
    );
    return Response.json({ sites });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
