import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSiteAnalytics, getSiteCountries } from "@/lib/gsc";
import { withCache } from "@/lib/cache";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteUrl = searchParams.get("site");
  const days = parseInt(searchParams.get("days") || "28");
  const startDate = searchParams.get("startDate") || null;
  const endDate = searchParams.get("endDate") || null;
  const country = searchParams.get("country") || "all";
  const type = searchParams.get("type") || "analytics";

  if (!siteUrl) return Response.json({ error: "Missing site param" }, { status: 400 });

  const tk = session.accessToken.slice(-10);
  const rangeKey = startDate && endDate ? `${startDate}:${endDate}` : `d${days}`;

  try {
    if (type === "countries") {
      const data = await withCache(
        `site-countries:${tk}:${siteUrl}:${rangeKey}`,
        () => getSiteCountries(session.accessToken, siteUrl, { days, startDate, endDate }),
        300
      );
      return Response.json(data);
    }

    const data = await withCache(
      `site-analytics:${tk}:${siteUrl}:${rangeKey}:${country}`,
      () => getSiteAnalytics(session.accessToken, siteUrl, { days, startDate, endDate, country }),
      300
    );
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
