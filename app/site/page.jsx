"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DateRangePicker from "../components/DateRangePicker";
import CountrySelect, { countryName } from "../components/CountrySelect";
import styles from "./site.module.css";

function fmt(n) { return typeof n === "number" ? n.toLocaleString("uk-UA") : "—"; }
function fmtPct(n) { return typeof n === "number" ? n.toFixed(1) + "%" : "—"; }
function fmtPos(n) { return typeof n === "number" ? n.toFixed(1) : "—"; }
function delta(curr, prev) {
  if (!prev || prev === 0) return null;
  const d = ((curr - prev) / prev) * 100;
  return { value: Math.abs(d).toFixed(1), up: d >= 0 };
}

function MetricCard({ label, value, prev, compare, format = fmt }) {
  const d = compare && prev != null ? delta(value, prev) : null;
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricVal}>{format(value)}</div>
      {d && <div className={`${styles.metricDelta} ${d.up ? styles.up : styles.down}`}>{d.up?"↑":"↓"} {d.value}%</div>}
    </div>
  );
}

function buildUrl(base, params) {
  return `${base}?${new URLSearchParams(params)}`;
}

function SitePageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const siteUrl = searchParams.get("url") || "";

  const [dateRange, setDateRange] = useState({ days: 28, startDate: null, endDate: null });
  const [country, setCountry] = useState("all");
  const [compare, setCompare] = useState(false);

  const [siteCountries, setSiteCountries] = useState([]);
  const [dashData, setDashData] = useState(null);
  const [loadingDash, setLoadingDash] = useState(false);

  // Pages state
  const [allRows, setAllRows] = useState([]); // всі завантажені рядки
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Сортування таблиці сторінок
  const [sortCol, setSortCol] = useState("clicks");
  const [sortDir, setSortDir] = useState(-1); // -1=desc, 1=asc

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  // Завантажити список країн один раз
  useEffect(() => {
    if (!session || !siteUrl) return;
    fetch(buildUrl("/api/gsc/site-analytics", { site: siteUrl, type: "countries", days: 28 }))
      .then(r => r.json())
      .then(d => Array.isArray(d) && setSiteCountries(d));
  }, [session, siteUrl]);

  function rangeParams() {
    return dateRange.startDate && dateRange.endDate
      ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
      : { days: dateRange.days };
  }

  // Дашборд
  useEffect(() => {
    if (!session || !siteUrl) return;
    setLoadingDash(true);
    fetch(buildUrl("/api/gsc/site-analytics", { site: siteUrl, country, ...rangeParams() }))
      .then(r => r.json())
      .then(setDashData)
      .finally(() => setLoadingDash(false));
  }, [session, siteUrl, dateRange, country]);

  // Сторінки
  const loadPages = useCallback(async (reset = false) => {
    if (!siteUrl || !session) return;
    setLoading(true); setError("");
    const pg = reset ? 0 : page;
    try {
      const params = { site: siteUrl, page: pg, search, country, ...rangeParams() };
      const res = await fetch(buildUrl("/api/gsc/pages", params));
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (reset) { setAllRows(data.rows); setPage(0); }
      else setAllRows(prev => [...prev, ...data.rows]);
      setHasMore(data.hasMore);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [siteUrl, session, page, dateRange, country, search]);

  useEffect(() => { loadPages(true); }, [siteUrl, dateRange, country, search]);

  // Сортування таблиці на фронті
  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d * -1);
    } else {
      setSortCol(col);
      // позиція — від меншої до більшої за замовчуванням
      setSortDir(col === "position" ? 1 : -1);
    }
  }

  const sortedRows = [...allRows].sort((a, b) => {
    const av = a[sortCol] ?? 0;
    const bv = b[sortCol] ?? 0;
    return (av - bv) * sortDir;
  });

  const c = dashData?.current;
  const p = dashData?.previous;
  const chartData = (c?.byDate || []).map((row, i) => ({
    date: row.date.slice(5),
    clicks: row.clicks, impressions: row.impressions,
    clicks_prev: p?.byDate?.[i]?.clicks,
  }));
  const displayUrl = siteUrl.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  function SortTh({ col, children, className }) {
    const active = sortCol === col;
    return (
      <th
        className={`${className||""} ${styles.sortable} ${active ? styles.sortActive : ""}`}
        onClick={() => handleSort(col)}
      >
        {children}
        <span className={styles.sortIcon}>{active ? (sortDir === -1 ? "↓" : "↑") : "↕"}</span>
      </th>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <button className={styles.backBtn} onClick={() => router.push("/")}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Сайти
            </button>
            <span className={styles.divider}>/</span>
            <span className={styles.siteTitle}>{displayUrl}</span>
          </div>
          <div className={styles.headerControls}>
            <CountrySelect countries={siteCountries} value={country} onChange={setCountry} className={styles.select} />
            <label className={styles.compareLabel}>
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
              Порівняти
            </label>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.filterBar}>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* Dashboard */}
        <div className={styles.dashSection}>
          <div className={styles.dashTitle}>
            Загальна статистика
            {country !== "all" && <span className={styles.filterBadge}>· {countryName(country)}</span>}
          </div>

          {loadingDash && <div className={styles.loadingRow} style={{marginTop:16}}><div className={styles.spinner}/><span>Завантаження...</span></div>}

          {!loadingDash && dashData && (
            <>
              <div className={styles.metricsGrid}>
                <MetricCard label="Кліки" value={c?.totals?.clicks} prev={p?.totals?.clicks} compare={compare} />
                <MetricCard label="Покази" value={c?.totals?.impressions} prev={p?.totals?.impressions} compare={compare} />
                <MetricCard label="CTR" value={c?.totals?.ctr} prev={p?.totals?.ctr} compare={compare} format={fmtPct} />
                <MetricCard label="Середня позиція" value={c?.totals?.position} prev={p?.totals?.position} compare={compare} format={fmtPos} />
              </div>

              <div className={styles.chartCard}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{top:4,right:16,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0dfd8"/>
                    <XAxis dataKey="date" tick={{fontSize:11,fill:"#888"}} tickLine={false}/>
                    <YAxis yAxisId="left" tick={{fontSize:11,fill:"#378ADD"}} tickLine={false} axisLine={false} width={40}/>
                    <YAxis yAxisId="right" orientation="right" tick={{fontSize:11,fill:"#1D9E75"}} tickLine={false} axisLine={false} width={50}/>
                    <Tooltip contentStyle={{fontSize:12}}/>
                    <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#378ADD" strokeWidth={2} dot={false} name="Кліки"/>
                    <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#1D9E75" strokeWidth={2} dot={false} name="Покази"/>
                    {compare && <Line yAxisId="left" type="monotone" dataKey="clicks_prev" stroke="#B4B2A9" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Кліки (попер.)"/>}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {dashData.byCountry?.length > 0 && country === "all" && (
                <div className={styles.countriesWrap}>
                  <div className={styles.countriesTitle}>Топ країн</div>
                  <div className={styles.countriesGrid}>
                    {dashData.byCountry.slice(0, 8).map(ct => (
                      <div key={ct.country} className={styles.countryCard} onClick={() => setCountry(ct.country)} style={{cursor:"pointer"}} title="Фільтрувати по цій країні">
                        <div className={styles.countryName}>{countryName(ct.country)}</div>
                        <div className={styles.countryStats}>
                          <span>{fmt(ct.clicks)} кл.</span>
                          <span className={styles.sep}>·</span>
                          <span>{fmt(ct.impressions)} пок.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pages */}
        <div className={styles.pagesSection}>
          <div className={styles.toolbar}>
            <div className={styles.dashTitle}>
              Сторінки
              {country !== "all" && <span className={styles.filterBadge}>· {countryName(country)}</span>}
            </div>
            <div className={styles.toolbarRight}>
              <div className={styles.searchRow}>
                <input
                  type="text" className={styles.searchInput}
                  placeholder="Пошук по URL..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && setSearch(searchInput)}
                />
                <button className={styles.searchBtn} onClick={() => setSearch(searchInput)}>Знайти</button>
              </div>
              {allRows.length > 0 && <span className={styles.countLabel}>{allRows.length} сторінок</span>}
            </div>
          </div>

          {error && <div className={styles.errorBox}>{error}</div>}
          {!loading && allRows.length === 0 && !error && (
            <div className={styles.emptyBox}>Сторінки не знайдені.</div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.urlCol}>URL</th>
                  <SortTh col="clicks" className={styles.numCol}>Кліки</SortTh>
                  <SortTh col="impressions" className={styles.numCol}>Покази</SortTh>
                  <SortTh col="ctr" className={styles.numCol}>CTR</SortTh>
                  <SortTh col="position" className={styles.numCol}>Позиція</SortTh>
                  <th className={styles.actCol}></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => (
                  <tr key={row.url}>
                    <td className={styles.urlCell}>
                      <span className={styles.urlText} title={row.url}>
                        {row.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                      </span>
                    </td>
                    <td className={styles.numCell}>{fmt(row.clicks)}</td>
                    <td className={styles.numCell}>{fmt(row.impressions)}</td>
                    <td className={styles.numCell}>{(row.ctr * 100).toFixed(1)}%</td>
                    <td className={styles.numCell}>{row.position.toFixed(1)}</td>
                    <td className={styles.actCell}>
                      <button className={styles.detailBtn} onClick={() => router.push(`/page-view?site=${encodeURIComponent(siteUrl)}&url=${encodeURIComponent(row.url)}`)}>
                        Деталі
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading && <div className={styles.loadingRow}><div className={styles.spinner}/><span>Завантаження...</span></div>}
          {hasMore && !loading && (
            <div className={styles.loadMoreRow}>
              <button className={styles.loadMoreBtn} onClick={() => { setPage(pg => pg+1); loadPages(false); }}>Завантажити ще</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function SitePage() {
  return <Suspense><SitePageContent /></Suspense>;
}
