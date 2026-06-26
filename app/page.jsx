"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function HomePage() {
  const { data: session, status } = useSession();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (session) {
      setLoading(true);
      fetch("/api/gsc/sites")
        .then((r) => r.json())
        .then((d) => {
          if (d.error) setError(d.error);
          else setSites(d.sites || []);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [session]);

  if (status === "loading") {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.center}>
        <div className={styles.loginCard}>
          <div className={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#378ADD" />
              <path d="M8 22L14 10L20 18L23 14L26 22H8Z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          <h1 className={styles.loginTitle}>GSC Tool</h1>
          <p className={styles.loginSub}>
            Аналітика Google Search Console для кожної сторінки вашого сайту
          </p>
          <button className={styles.googleBtn} onClick={() => signIn("google")}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            Увійти через Google
          </button>
          <p className={styles.loginNote}>
            Потрібен доступ до Google Search Console API
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLogo}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#378ADD" />
              <path d="M8 22L14 10L20 18L23 14L26 22H8Z" fill="white" fillOpacity="0.9" />
            </svg>
            <span className={styles.headerTitle}>GSC Tool</span>
          </div>
          <div className={styles.headerUser}>
            {session.user?.image && (
              <img src={session.user.image} alt="" className={styles.avatar} />
            )}
            <span className={styles.userName}>{session.user?.name}</span>
            <button className={styles.signOutBtn} onClick={() => signOut()}>
              Вийти
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <h2 className={styles.pageTitle}>Оберіть сайт</h2>

        {loading && (
          <div className={styles.loadingRow}>
            <div className={styles.spinner} />
            <span>Завантаження списку сайтів...</span>
          </div>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        {!loading && !error && sites.length === 0 && (
          <div className={styles.emptyBox}>
            Сайтів не знайдено. Переконайтесь що у вашому GSC акаунті є верифіковані сайти.
          </div>
        )}

        <div className={styles.siteGrid}>
          {sites.map((site) => (
            <button
              key={site.url}
              className={styles.siteCard}
              onClick={() => router.push(`/site?url=${encodeURIComponent(site.url)}`)}
            >
              <div className={styles.siteIcon}>
                {site.url.replace(/^(sc-domain:|https?:\/\/)/, "").charAt(0).toUpperCase()}
              </div>
              <div className={styles.siteInfo}>
                <div className={styles.siteUrl}>
                  {site.url.replace(/^sc-domain:/, "🔗 ").replace(/^https?:\/\//, "")}
                </div>
                <div className={styles.sitePerm}>{formatPermission(site.permissionLevel)}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.siteArrow}>
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function formatPermission(level) {
  const map = {
    siteOwner: "Власник",
    siteFullUser: "Повний доступ",
    siteRestrictedUser: "Обмежений доступ",
    siteUnverifiedUser: "Не верифікований",
  };
  return map[level] || level;
}
