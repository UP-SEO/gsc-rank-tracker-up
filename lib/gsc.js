const GSC_BASE = "https://www.googleapis.com/webmasters/v3";
const INSPECTION_BASE = "https://searchconsole.googleapis.com/v1";

async function gscFetch(url, accessToken, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GSC API error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function getSites(accessToken) {
  const data = await gscFetch(`${GSC_BASE}/sites`, accessToken);
  return (data.siteEntry || []).map((s) => ({
    url: s.siteUrl,
    permissionLevel: s.permissionLevel,
  }));
}

export async function getPages(accessToken, siteUrl, { days = 28, startDate, endDate, page = 0, rowsPerPage = 50, country = "all" } = {}) {
  const range = startDate && endDate ? { startDate, endDate } : getDateRange(days);
  const countryFilter = country && country !== "all"
    ? [{ filters: [{ dimension: "country", operator: "equals", expression: country }] }]
    : [];
  const body = {
    startDate: range.startDate, endDate: range.endDate,
    dimensions: ["page"],
    rowLimit: rowsPerPage,
    startRow: page * rowsPerPage,
    dimensionFilterGroups: countryFilter,
  };
  const data = await gscFetch(
    `${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    accessToken,
    { method: "POST", body: JSON.stringify(body) }
  );
  return {
    rows: (data.rows || []).map((r) => ({
      url: r.keys[0], clicks: r.clicks, impressions: r.impressions,
      ctr: r.ctr, position: r.position,
    })),
    hasMore: (data.rows || []).length === rowsPerPage,
  };
}

/** Загальний дашборд сайту з фільтром по країні */
export async function getSiteAnalytics(accessToken, siteUrl, { days = 28, startDate, endDate, country = "all" } = {}) {
  const range = startDate && endDate ? { startDate, endDate } : getDateRange(days);
  const prevRange = startDate && endDate
    ? getPreviousPeriodForRange(startDate, endDate)
    : getPreviousPeriod(days);

  const countryFilter = country && country !== "all"
    ? [{ filters: [{ dimension: "country", operator: "equals", expression: country }] }]
    : [];

  const [current, previous, byCountry] = await Promise.all([
    fetchAnalytics(accessToken, siteUrl, range.startDate, range.endDate, ["date"], countryFilter),
    fetchAnalytics(accessToken, siteUrl, prevRange.startDate, prevRange.endDate, ["date"], countryFilter),
    fetchAnalytics(accessToken, siteUrl, range.startDate, range.endDate, ["country"], [], 250),
  ]);

  return {
    current: {
      totals: sumRows(current.rows),
      byDate: current.rows.map((r) => ({
        date: r.keys[0],
        clicks: r.clicks, impressions: r.impressions,
        ctr: parseFloat((r.ctr * 100).toFixed(2)),
        position: parseFloat(r.position.toFixed(1)),
      })),
    },
    previous: {
      totals: sumRows(previous.rows),
      byDate: previous.rows.map((r) => ({
        date: r.keys[0],
        clicks: r.clicks, impressions: r.impressions,
        ctr: parseFloat((r.ctr * 100).toFixed(2)),
        position: parseFloat(r.position.toFixed(1)),
      })),
    },
    byCountry: (byCountry.rows || []).map((r) => ({
      country: r.keys[0], clicks: r.clicks, impressions: r.impressions,
      ctr: parseFloat((r.ctr * 100).toFixed(2)),
      position: parseFloat(r.position.toFixed(1)),
    })),
  };
}

/** Метрики сторінки з фільтром по країні */
export async function getPageAnalytics(accessToken, siteUrl, pageUrl, { days = 28, startDate, endDate, country = "all" } = {}) {
  const range = startDate && endDate ? { startDate, endDate } : getDateRange(days);
  const prevRange = startDate && endDate
    ? getPreviousPeriodForRange(startDate, endDate)
    : getPreviousPeriod(days);

  const filters = [{ dimension: "page", operator: "equals", expression: pageUrl }];
  if (country && country !== "all") filters.push({ dimension: "country", operator: "equals", expression: country });
  const fg = [{ filters }];

  const [current, previous] = await Promise.all([
    fetchAnalytics(accessToken, siteUrl, range.startDate, range.endDate, ["date"], fg),
    fetchAnalytics(accessToken, siteUrl, prevRange.startDate, prevRange.endDate, ["date"], fg),
  ]);

  return {
    current: {
      totals: sumRows(current.rows),
      byDate: current.rows.map((r) => ({
        date: r.keys[0], clicks: r.clicks, impressions: r.impressions,
        ctr: parseFloat((r.ctr * 100).toFixed(2)),
        position: parseFloat(r.position.toFixed(1)),
      })),
    },
    previous: {
      totals: sumRows(previous.rows),
      byDate: previous.rows.map((r) => ({
        date: r.keys[0], clicks: r.clicks, impressions: r.impressions,
        ctr: parseFloat((r.ctr * 100).toFixed(2)),
        position: parseFloat(r.position.toFixed(1)),
      })),
    },
  };
}

export async function getPageQueries(accessToken, siteUrl, pageUrl, { days = 28, startDate, endDate, country = "all" } = {}) {
  const range = startDate && endDate ? { startDate, endDate } : getDateRange(days);
  const filters = [{ dimension: "page", operator: "equals", expression: pageUrl }];
  if (country && country !== "all") filters.push({ dimension: "country", operator: "equals", expression: country });
  const data = await fetchAnalytics(accessToken, siteUrl, range.startDate, range.endDate, ["query"], [{ filters }], 50);
  return (data.rows || []).map((r) => ({
    query: r.keys[0], clicks: r.clicks, impressions: r.impressions,
    ctr: parseFloat((r.ctr * 100).toFixed(2)),
    position: parseFloat(r.position.toFixed(1)),
  }));
}

/**
 * Rank tracker — позиції по query+date, impressions агрегуються за весь період
 */
export async function getPageRankTracker(accessToken, siteUrl, pageUrl, { days = 28, startDate, endDate, country = "all", page = 0, pageSize = 50 } = {}) {
  const range = startDate && endDate ? { startDate, endDate } : getDateRange(days);

  const filters = [{ dimension: "page", operator: "equals", expression: pageUrl }];
  if (country && country !== "all") filters.push({ dimension: "country", operator: "equals", expression: country });
  const fg = [{ filters }];

  // Запит 1: позиції по query+date
  // Запит 2: сумарні impressions/clicks по query за весь період
  const [byDate, byQuery] = await Promise.all([
    fetchAnalytics(accessToken, siteUrl, range.startDate, range.endDate, ["query", "date"], fg, 25000),
    fetchAnalytics(accessToken, siteUrl, range.startDate, range.endDate, ["query"], fg, 25000),
  ]);

  // Impressions та clicks за весь період по query
  const queryTotals = {};
  for (const r of byQuery.rows || []) {
    queryTotals[r.keys[0]] = {
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: parseFloat((r.ctr * 100).toFixed(2)),
    };
  }

  // Позиції { query -> { date -> position } }
  const posMap = {};
  for (const r of byDate.rows || []) {
    const [query, date] = r.keys;
    if (!posMap[query]) posMap[query] = {};
    posMap[query][date] = parseFloat(r.position.toFixed(1));
  }

  // Сортування за середньою позицією + пагінація
  const allQueries = Object.keys(posMap)
    .map((q) => {
      const vals = Object.values(posMap[q]);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { query: q, avg };
    })
    .sort((a, b) => a.avg - b.avg);

  const total = allQueries.length;
  const queries = allQueries.slice(page * pageSize, (page + 1) * pageSize).map((x) => x.query);

  return {
    queries,
    total,
    hasMore: (page + 1) * pageSize < total,
    positions: Object.fromEntries(queries.map((q) => [q, posMap[q]])),
    totals: Object.fromEntries(queries.map((q) => [q, queryTotals[q] || { impressions: 0, clicks: 0, ctr: 0 }])),
  };
}

/** Всі країни для сторінки */
export async function getPageCountries(accessToken, siteUrl, pageUrl, { days = 28, startDate, endDate } = {}) {
  const range = startDate && endDate ? { startDate, endDate } : getDateRange(days);
  const filter = pageFilter(pageUrl);
  const data = await fetchAnalytics(accessToken, siteUrl, range.startDate, range.endDate, ["country"], filter, 250);
  return (data.rows || []).map((r) => ({
    country: r.keys[0], clicks: r.clicks, impressions: r.impressions,
  }));
}

/** Всі країни для сайту */
export async function getSiteCountries(accessToken, siteUrl, { days = 28, startDate, endDate } = {}) {
  const range = startDate && endDate ? { startDate, endDate } : getDateRange(days);
  const data = await fetchAnalytics(accessToken, siteUrl, range.startDate, range.endDate, ["country"], [], 250);
  return (data.rows || []).map((r) => ({
    country: r.keys[0], clicks: r.clicks, impressions: r.impressions,
  }));
}

export async function getUrlInspection(accessToken, siteUrl, pageUrl) {
  const data = await gscFetch(
    `${INSPECTION_BASE}/urlInspection/index:inspect`,
    accessToken,
    { method: "POST", body: JSON.stringify({ inspectionUrl: pageUrl, siteUrl }) }
  );
  const r = data.inspectionResult?.indexStatusResult || {};
  return {
    verdict: r.verdict || "UNKNOWN",
    coverageState: r.coverageState || "—",
    robotsTxtState: r.robotsTxtState || "—",
    indexingState: r.indexingState || "—",
    lastCrawlTime: r.lastCrawlTime || null,
    pageFetchState: r.pageFetchState || "—",
    crawledAs: r.crawledAs || "—",
    googleCanonical: r.googleCanonical || "—",
    userCanonical: r.userCanonical || "—",
  };
}

// ─── Helpers ─────────────────────────────────────────────────

function getDateRange(days) {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

function getPreviousPeriod(days) {
  const end = new Date();
  end.setDate(end.getDate() - 3 - days);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

function getPreviousPeriodForRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end - start;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd - diff);
  return {
    startDate: prevStart.toISOString().split("T")[0],
    endDate: prevEnd.toISOString().split("T")[0],
  };
}

function pageFilter(pageUrl) {
  return [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] }];
}

async function fetchAnalytics(accessToken, siteUrl, startDate, endDate, dimensions, filters, rowLimit = 1000) {
  const body = { startDate, endDate, dimensions, rowLimit, dimensionFilterGroups: filters || [] };
  return gscFetch(
    `${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    accessToken,
    { method: "POST", body: JSON.stringify(body) }
  );
}

function sumRows(rows = []) {
  const totals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  if (!rows.length) return totals;
  for (const r of rows) {
    totals.clicks += r.clicks;
    totals.impressions += r.impressions;
    totals.ctr += r.ctr;
    totals.position += r.position;
  }
  totals.ctr = parseFloat(((totals.ctr / rows.length) * 100).toFixed(2));
  totals.position = parseFloat((totals.position / rows.length).toFixed(1));
  return totals;
}
