import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getPageAnalytics, getPageQueries, getPageRankTracker, getUrlInspection, getPageCountries } from "@/lib/gsc";
import { withCache } from "@/lib/cache";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteUrl = searchParams.get("site");
  const pageUrl = searchParams.get("url");
  const days = parseInt(searchParams.get("days") || "28");
  const startDate = searchParams.get("startDate") || null;
  const endDate = searchParams.get("endDate") || null;
  const type = searchParams.get("type") || "analytics";
  const country = searchParams.get("country") || "all";
  const page = parseInt(searchParams.get("page") || "0");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");
  const minImpressions = parseInt(searchParams.get("minImpressions") || "0");

  if (!siteUrl || !pageUrl) return Response.json({ error: "Missing params" }, { status: 400 });

  const tk = session.accessToken.slice(-10);
  const rangeKey = startDate && endDate ? `${startDate}:${endDate}` : `d${days}`;

  try {
    let data;

    if (type === "analytics") {
      data = await withCache(
        `analytics:${tk}:${siteUrl}:${pageUrl}:${rangeKey}:${country}`,
        () => getPageAnalytics(session.accessToken, siteUrl, pageUrl, { days, startDate, endDate, country }),
        180
      );
    } else if (type === "queries") {
      data = await withCache(
        `queries:${tk}:${siteUrl}:${pageUrl}:${rangeKey}:${country}`,
        () => getPageQueries(session.accessToken, siteUrl, pageUrl, { days, startDate, endDate, country }),
        180
      );
    } else if (type === "rank") {
      data = await withCache(
        `rank:${tk}:${siteUrl}:${pageUrl}:${rangeKey}:${country}:${page}:${pageSize}`,
        () => getPageRankTracker(session.accessToken, siteUrl, pageUrl, { days, startDate, endDate, country, page, pageSize }),
        180
      );
      if (minImpressions > 0 && data.queries) {
        data.queries = data.queries.filter((q) => (data.totals[q]?.impressions || 0) >= minImpressions);
      }
    } else if (type === "countries") {
      data = await withCache(
        `countries:${tk}:${siteUrl}:${pageUrl}:${rangeKey}`,
        () => getPageCountries(session.accessToken, siteUrl, pageUrl, { days, startDate, endDate }),
        300
      );
    } else if (type === "inspection") {
      data = await withCache(
        `inspection:${tk}:${siteUrl}:${pageUrl}`,
        () => getUrlInspection(session.accessToken, siteUrl, pageUrl),
        3600
      );
    } else {
      return Response.json({ error: "Unknown type" }, { status: 400 });
    }

    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
