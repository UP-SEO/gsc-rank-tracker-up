import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getPages } from "@/lib/gsc";
import { withCache } from "@/lib/cache";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteUrl = searchParams.get("site");
  const days = parseInt(searchParams.get("days") || "28");
  const startDate = searchParams.get("startDate") || null;
  const endDate = searchParams.get("endDate") || null;
  const page = parseInt(searchParams.get("page") || "0");
  const search = searchParams.get("search") || "";
  const country = searchParams.get("country") || "all";

  if (!siteUrl) return Response.json({ error: "Missing site param" }, { status: 400 });

  const tk = session.accessToken.slice(-10);
  const rangeKey = startDate && endDate ? `${startDate}:${endDate}` : `d${days}`;

  try {
    const cacheKey = `pages:${tk}:${siteUrl}:${rangeKey}:${country}:${page}`;
    const data = await withCache(
      cacheKey,
      () => getPages(session.accessToken, siteUrl, { days, startDate, endDate, page, country }),
      180
    );

    const rows = search
      ? data.rows.filter(r => r.url.toLowerCase().includes(search.toLowerCase()))
      : data.rows;

    return Response.json({ rows, hasMore: data.hasMore });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
