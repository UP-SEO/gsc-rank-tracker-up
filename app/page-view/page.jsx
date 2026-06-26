"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DateRangePicker from "../components/DateRangePicker";
import CountrySelect, { countryName } from "../components/CountrySelect";
import styles from "./page.module.css";

function fmt(n) { return typeof n === "number" ? n.toLocaleString("uk-UA") : "—"; }
function fmtPct(n) { return typeof n === "number" ? n.toFixed(1) + "%" : "—"; }
function fmtPos(n) { return typeof n === "number" ? n.toFixed(1) : "—"; }
function delta(curr, prev) {
  if (!prev || prev === 0) return null;
  const d = ((curr - prev) / prev) * 100;
  return { value: Math.abs(d).toFixed(1), up: d >= 0 };
}
function pillCls(pos, s) {
  if (pos <= 3) return s.pillGreen;
  if (pos <= 10) return s.pillBlue;
  if (pos <= 20) return s.pillOrange;
  return s.pillGray;
}

function MetricCard({ label, value, prev, compare, format = fmt }) {
  const d = compare && prev != null ? delta(value, prev) : null;
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricVal}>{format(value)}</div>
      {d && <div className={`${styles.metricDelta} ${d.up?styles.up:styles.down}`}>{d.up?"↑":"↓"} {d.value}%</div>}
    </div>
  );
}

function buildParams(base, extra = {}) {
  return `${base}&${new URLSearchParams(extra)}`;
}

function PageDashboardContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const siteUrl = searchParams.get("site") || "";
  const pageUrl = searchParams.get("url") || "";

  const [dateRange, setDateRange] = useState({ days: 28, startDate: null, endDate: null });
  const [compare, setCompare] = useState(false);
  const [activeTab, setActiveTab] = useState("gsc");
  const [country, setCountry] = useState("all");
  const [pageCountries, setPageCountries] = useState([]);

  const [analytics, setAnalytics] = useState(null);
  const [queries, setQueries] = useState([]);
  const [rankData, setRankData] = useState(null);
  const [inspection, setInspection] = useState(null);

  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingQueries, setLoadingQueries] = useState(false);
  const [loadingRank, setLoadingRank] = useState(false);
  const [loadingInspection, setLoadingInspection] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [sortQueries, setSortQueries] = useState("clicks");
  const [rankGroup, setRankGroup] = useState("week");
  const [rankFilter, setRankFilter] = useState("");
  const [rankPage, setRankPage] = useState(0);
  const [rankTotal, setRankTotal] = useState(0);
  const [rankHasMore, setRankHasMore] = useState(false);
  const [minImpressions, setMinImpressions] = useState(0);
  const [minImpInput, setMinImpInput] = useState("0");

  const PAGE_SIZE = 50;

  const apiBase = `/api/gsc/page?site=${encodeURIComponent(siteUrl)}&url=${encodeURIComponent(pageUrl)}`;

  function rangeParams() {
    return dateRange.startDate && dateRange.endDate
      ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
      : { days: dateRange.days };
  }

  useEffect(() => { if (status === "unauthenticated") router.push("/"); }, [status]);

  // Load page countries once per pageUrl
  useEffect(() => {
    if (!session) return;
    fetch(`${apiBase}&type=countries&days=28`)
      .then(r => r.json())
      .then(d => Array.isArray(d) && setPageCountries(d));
  }, [session, pageUrl]);

  // Analytics
  useEffect(() => {
    if (!session) return;
    setLoadingAnalytics(true);
    const p = { ...rangeParams(), country };
    fetch(buildParams(`${apiBase}&type=analytics`, p))
      .then(r => r.json()).then(setAnalytics)
      .finally(() => setLoadingAnalytics(false));
  }, [session, dateRange, country, pageUrl]);

  // Queries (GSC tab)
  useEffect(() => {
    if (!session || activeTab !== "gsc") return;
    setLoadingQueries(true);
    const p = { ...rangeParams(), country };
    fetch(buildParams(`${apiBase}&type=queries`, p))
      .then(r => r.json()).then(d => Array.isArray(d) && setQueries(d))
      .finally(() => setLoadingQueries(false));
  }, [session, activeTab, dateRange, country, pageUrl]);

  // Inspection (once)
  useEffect(() => {
    if (!session || activeTab !== "gsc" || inspection) return;
    setLoadingInspection(true);
    fetch(`${apiBase}&type=inspection`)
      .then(r => r.json()).then(setInspection)
      .finally(() => setLoadingInspection(false));
  }, [session, activeTab, pageUrl]);

  const loadRank = (pg = 0, append = false) => {
    if (!session) return;
    pg === 0 ? setLoadingRank(true) : setLoadingMore(true);
    const p = { ...rangeParams(), country, page: pg, pageSize: PAGE_SIZE, minImpressions };
    fetch(buildParams(`${apiBase}&type=rank`, p))
      .then(r => r.json())
      .then(d => {
        if (d.error) return;
        if (append) {
          setRankData(prev => ({
            queries: [...(prev?.queries||[]), ...d.queries],
            positions: { ...(prev?.positions||{}), ...d.positions },
            totals: { ...(prev?.totals||{}), ...d.totals },
          }));
        } else {
          setRankData(d);
        }
        setRankTotal(d.total || 0);
        setRankHasMore(d.hasMore || false);
        setRankPage(pg);
      })
      .finally(() => { setLoadingRank(false); setLoadingMore(false); });
  };

  useEffect(() => {
    if (!session || activeTab !== "rank") return;
    loadRank(0, false);
  }, [session, activeTab, dateRange, country, minImpressions, pageUrl]);

  const c = analytics?.current;
  const p = analytics?.previous;
  const sortedQueries = [...queries].sort((a, b) => b[sortQueries] - a[sortQueries]);
  const chartData = (c?.byDate || []).map((row, i) => ({
    date: row.date.slice(5),
    clicks: row.clicks, impressions: row.impressions,
    clicks_prev: p?.byDate?.[i]?.clicks,
  }));
  const displayPath = pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <button className={styles.backBtn} onClick={() => router.push(`/site?url=${encodeURIComponent(siteUrl)}`)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Сторінки
            </button>
            <span className={styles.divider}>/</span>
            <span className={styles.pagePathTitle} title={pageUrl}>{displayPath}</span>
          </div>
          <div className={styles.headerControls}>
            <CountrySelect countries={pageCountries} value={country} onChange={setCountry} className={styles.select} />
            <label className={styles.compareLabel}>
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
              Порівняти
            </label>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.dateRow}>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* Metrics */}
        <div className={styles.metricsGrid}>
          <MetricCard label="Кліки" value={c?.totals?.clicks} prev={p?.totals?.clicks} compare={compare} />
          <MetricCard label="Покази" value={c?.totals?.impressions} prev={p?.totals?.impressions} compare={compare} />
          <MetricCard label="CTR" value={c?.totals?.ctr} prev={p?.totals?.ctr} compare={compare} format={fmtPct} />
          <MetricCard label="Середня позиція" value={c?.totals?.position} prev={p?.totals?.position} compare={compare} format={fmtPos} />
        </div>

        {/* Chart */}
        <div className={styles.chartCard}>
          {loadingAnalytics && <div className={styles.chartLoader}><div className={styles.spinner}/></div>}
          {!loadingAnalytics && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{top:4,right:16,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                <XAxis dataKey="date" tick={{fontSize:11,fill:"var(--text3)"}} tickLine={false}/>
                <YAxis yAxisId="left" tick={{fontSize:11,fill:"#378ADD"}} tickLine={false} axisLine={false} width={40}/>
                <YAxis yAxisId="right" orientation="right" tick={{fontSize:11,fill:"#1D9E75"}} tickLine={false} axisLine={false} width={50}/>
                <Tooltip contentStyle={{fontSize:12,borderColor:"var(--border)"}}/>
                <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#378ADD" strokeWidth={2} dot={false} name="Кліки"/>
                <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#1D9E75" strokeWidth={2} dot={false} name="Покази"/>
                {compare && <Line yAxisId="left" type="monotone" dataKey="clicks_prev" stroke="#B4B2A9" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Кліки (попер.)"/>}
              </LineChart>
            </ResponsiveContainer>
          )}
          {!loadingAnalytics && !chartData.length && <div className={styles.noData}>Немає даних</div>}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab==="gsc"?styles.tabActive:""}`} onClick={() => setActiveTab("gsc")}>GSC</button>
          <button className={`${styles.tab} ${activeTab==="rank"?styles.tabActive:""}`} onClick={() => setActiveTab("rank")}>Rank tracker</button>
        </div>

        {/* GSC Tab */}
        {activeTab === "gsc" && (
          <div>
            {loadingInspection && <div className={styles.loadingRow}><div className={styles.spinner}/><span>Перевірка індексації...</span></div>}
            {inspection && !inspection.error && (
              <div className={styles.inspectionGrid}>
                <InspCard label="Статус індексації" value={<VerdictBadge verdict={inspection.verdict}/>}/>
                <InspCard label="Дата сканування" value={inspection.lastCrawlTime ? new Date(inspection.lastCrawlTime).toLocaleString("uk-UA") : "—"}/>
                <InspCard label="Crawled as" value={inspection.crawledAs}/>
                <InspCard label="Google canonical" value={inspection.googleCanonical} mono/>
                <InspCard label="User canonical" value={inspection.userCanonical} mono/>
                <InspCard label="Стан покриття" value={inspection.coverageState}/>
              </div>
            )}
            {inspection?.error && <div className={styles.inspError}>URL Inspection: {inspection.error}</div>}

            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Запити</span>
              <div className={styles.sortBtns}>
                {["clicks","impressions","ctr","position"].map(k => (
                  <button key={k} className={`${styles.sortBtn} ${sortQueries===k?styles.sortBtnActive:""}`} onClick={() => setSortQueries(k)}>
                    {{clicks:"Кліки",impressions:"Покази",ctr:"CTR",position:"Позиція"}[k]}
                  </button>
                ))}
              </div>
            </div>

            {loadingQueries && <div className={styles.loadingRow}><div className={styles.spinner}/><span>Завантаження...</span></div>}
            {!loadingQueries && sortedQueries.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr>
                    <th className={styles.qCol}>Запит</th>
                    <th className={styles.nCol}>Кліки</th>
                    <th className={styles.nCol}>Покази</th>
                    <th className={styles.nCol}>CTR</th>
                    <th className={styles.posCol}>Позиція</th>
                  </tr></thead>
                  <tbody>
                    {sortedQueries.map(row => (
                      <tr key={row.query}>
                        <td className={styles.qCell}>{row.query}</td>
                        <td className={styles.nCell}>{fmt(row.clicks)}</td>
                        <td className={styles.nCell}>{fmt(row.impressions)}</td>
                        <td className={styles.nCell}>{fmtPct(row.ctr)}</td>
                        <td className={styles.posCell}>
                          <div className={styles.posRow}>
                            <span>{fmtPos(row.position)}</span>
                            <div className={styles.posTrack}><div className={styles.posFill} style={{width:`${Math.max(0,(1-row.position/20)*100)}%`}}/></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Rank Tracker Tab */}
        {activeTab === "rank" && (
          <div>
            <div className={styles.rankControls}>
              <select className={styles.select} value={rankGroup} onChange={e => setRankGroup(e.target.value)}>
                <option value="day">По днях</option>
                <option value="week">По тижнях</option>
              </select>
              <div className={styles.impFilter}>
                <span className={styles.impLabel}>Мін. покази:</span>
                <input
                  type="number" min="0" className={styles.impInput}
                  value={minImpInput}
                  onChange={e => setMinImpInput(e.target.value)}
                  onBlur={() => setMinImpressions(Number(minImpInput)||0)}
                  onKeyDown={e => e.key==="Enter" && setMinImpressions(Number(minImpInput)||0)}
                />
              </div>
              <input
                type="text" className={styles.filterInput}
                placeholder="Фільтр за запитом..."
                value={rankFilter}
                onChange={e => setRankFilter(e.target.value)}
              />
            </div>

            {rankTotal > 0 && (
              <div className={styles.rankMeta}>
                Показано {(rankData?.queries||[]).length} з {rankTotal} запитів
                {country !== "all" && ` · ${countryName(country)}`}
              </div>
            )}

            {loadingRank && <div className={styles.loadingRow}><div className={styles.spinner}/><span>Завантаження позицій...</span></div>}

            {!loadingRank && rankData && (
              <RankTable data={rankData} group={rankGroup} filter={rankFilter} />
            )}

            {!loadingRank && rankHasMore && (
              <div className={styles.loadMoreRow}>
                <button
                  className={styles.loadMoreBtn}
                  onClick={() => loadRank(rankPage+1, true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Завантаження..." : `Завантажити ще (${rankTotal-(rankData?.queries||[]).length} залишилось)`}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function InspCard({ label, value, mono }) {
  return (
    <div className={styles.inspCard}>
      <div className={styles.inspLabel}>{label}</div>
      <div className={`${styles.inspVal} ${mono?styles.inspMono:""}`}>{value||"—"}</div>
    </div>
  );
}

function VerdictBadge({ verdict }) {
  const map = {
    PASS:{label:"Проіндексовано",cls:styles.badgeGreen},
    NEUTRAL:{label:"Не проіндексовано",cls:styles.badgeOrange},
    FAIL:{label:"Заблоковано",cls:styles.badgeRed},
    UNKNOWN:{label:"Невідомо",cls:styles.badgeGray},
  };
  const {label,cls} = map[verdict]||map.UNKNOWN;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

function RankTable({ data, group, filter }) {
  const { queries=[], positions={}, totals={} } = data;
  const [sortCol, setSortCol] = useState('avg'); // 'impressions' | 'avg' | 'change' | colIndex
  const [sortDir, setSortDir] = useState(1); // 1=asc, -1=desc (для позицій 1=від меншої до більшої)

  const allDates = [...new Set(
    Object.values(positions).flatMap(d => Object.keys(d))
  )].sort();

  let cols;
  if (group === "week") {
    const weeks = [];
    for (let i=0; i<allDates.length; i+=7) {
      const chunk = allDates.slice(i, i+7);
      weeks.push({ label: `${chunk[0].slice(5)}–${chunk[chunk.length-1].slice(5)}`, dates: chunk });
    }
    cols = weeks;
  } else {
    cols = allDates.map(d => ({ label: d.slice(5), dates: [d] }));
  }

  const filtered = filter ? queries.filter(q => q.toLowerCase().includes(filter.toLowerCase())) : queries;

  function getAvgPos(q, dates) {
    const vals = dates.map(d => positions[q]?.[d]).filter(v => v != null);
    if (!vals.length) return null;
    return parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1));
  }

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d * -1);
    } else {
      setSortCol(col);
      // Покази сортуємо за замовчуванням desc (більше зверху)
      // Позиції сортуємо за замовчуванням asc (менша позиція = вище)
      setSortDir(col === 'impressions' ? -1 : 1);
    }
  }

  function SortTh({ col, children, className }) {
    const active = sortCol === col;
    return (
      <th className={`${className||""} ${styles.sortable} ${active?styles.sortActive:""}`} onClick={() => handleSort(col)}>
        {children} <span className={styles.sortIcon}>{active ? (sortDir===1?"↑":"↓") : "↕"}</span>
      </th>
    );
  }

  // Обчислюємо дані для сортування
  const rowData = filtered.map(q => {
    const t = totals[q]||{};
    const colVals = cols.map(c => getAvgPos(q, c.dates));
    const nonNull = colVals.filter(v=>v!=null);
    const avg = nonNull.length ? nonNull.reduce((a,b)=>a+b,0)/nonNull.length : null;
    const first = colVals.find(v=>v!=null);
    const last = [...colVals].reverse().find(v=>v!=null);
    const change = first!=null && last!=null ? parseFloat((first-last).toFixed(1)) : null;
    return { q, t, colVals, avg, change };
  });

  const sorted = [...rowData].sort((a, b) => {
    if (!sortCol) return 0;
    let av, bv;
    if (sortCol === 'impressions') { av = a.t.impressions||0; bv = b.t.impressions||0; }
    else if (sortCol === 'avg') { av = a.avg??999; bv = b.avg??999; }
    else if (sortCol === 'change') { av = a.change??0; bv = b.change??0; }
    else if (typeof sortCol === 'number') { av = a.colVals[sortCol]??999; bv = b.colVals[sortCol]??999; }
    else return 0;
    return (av - bv) * sortDir;
  });

  const exportCSV = () => {
    const header = ["Запит","Покази",...cols.map(c=>c.label),"Середнє","Зміна"];
    const rows = sorted.map(({q,t,colVals,avg,change}) => [
      q, t.impressions||0,
      ...colVals.map(v=>v??''),
      avg!=null?avg.toFixed(1):'',
      change!=null?change:'',
    ]);
    const csv = [header,...rows].map(r=>r.join(",")).join("\n");
    const blob = new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="rank-tracker.csv"; a.click();
  };

  return (
    <>
      <div className={styles.rankTableHeader}>
        <div className={styles.rankLegend}>
          <span>Позиції:</span>
          <span><span className={`${styles.pill} ${styles.pillGreen}`}>1</span> 1–3</span>
          <span><span className={`${styles.pill} ${styles.pillBlue}`}>7</span> 4–10</span>
          <span><span className={`${styles.pill} ${styles.pillOrange}`}>14</span> 11–20</span>
          <span><span className={`${styles.pill} ${styles.pillGray}`}>25</span> 21+</span>
        </div>
        <button className={styles.exportBtn} onClick={exportCSV}>↓ CSV</button>
      </div>

      <div className={styles.tableWrap} style={{overflowX:"auto"}}>
        <table className={styles.table} style={{minWidth:cols.length*70+340}}>
          <thead><tr>
            <th className={styles.qCol} style={{minWidth:200}}>Запит</th>
            <SortTh col="impressions" className={styles.nCol}>Покази</SortTh>
            {cols.map((c,i) => (
              <SortTh key={c.label} col={i} className={styles.rankDateCol}>{c.label}</SortTh>
            ))}
            <SortTh col="avg" className={styles.rankDateCol}>Серед.</SortTh>
            <SortTh col="change" className={styles.rankDateCol}>Зміна</SortTh>
          </tr></thead>
          <tbody>
            {sorted.map(({q, t, colVals, avg, change}) => (
              <tr key={q}>
                <td className={styles.qCell}>{q}</td>
                <td className={styles.nCell}>{fmt(t.impressions)}</td>
                {colVals.map((v,i) => (
                  <td key={i} className={styles.rankPosCell}>
                    {v!=null
                      ? <span className={`${styles.pill} ${pillCls(v,styles)}`}>{v.toFixed(1)}</span>
                      : <span className={styles.noPos}>—</span>}
                  </td>
                ))}
                <td className={styles.rankPosCell} style={{fontWeight:500}}>
                  {avg!=null ? avg.toFixed(1) : "—"}
                </td>
                <td className={styles.rankPosCell}>
                  {change!=null && Math.abs(change)>=0.1
                    ? <span className={change>0?styles.deltaUp:styles.deltaDown}>{change>0?"↑":"↓"} {Math.abs(change)}</span>
                    : <span className={styles.deltaFlat}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PageDashboard() {
  return <Suspense><PageDashboardContent /></Suspense>;
}
