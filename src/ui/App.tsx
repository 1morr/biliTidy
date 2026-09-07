import { useEffect, useState } from 'react';
import { IconBrand, IconRefresh } from './components/icons';
import { useHeaderRuleError, useSession } from './hooks/useSession';
import { useMessages } from './hooks/useI18n';
import { FoldersPage } from './pages/FoldersPage';
import { FollowsPage } from './pages/FollowsPage';
import { RunPage } from './pages/RunPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { useAppStore } from './store';

type Page = 'run' | 'folders' | 'follows' | 'settings';

/**
 * 外殼只有兩件事：頂列與目前的分頁。四個分頁平行並排：整理收藏、收藏夾、關注、設定。
 * 版面是滿版高度的，每個分頁自己決定「左軌／中央／右欄」怎麼分，以及底部作業列放什麼——
 * 那條列在每個分頁都是同一個意思：你正要執行的批次，以及執行它的按鈕。
 * 分頁切換不會打斷任務：兩個 jobStore 都是模組層級的單例，切走再切回來畫面接得上。
 */
export function App() {
  const [page, setPage] = useState<Page>('run');
  const { state, refresh } = useSession();
  const headerRuleError = useHeaderRuleError();
  const hydrated = useAppStore((s) => s.hydrated);
  const hydrate = useAppStore((s) => s.hydrate);
  const loadFolders = useAppStore((s) => s.loadFolders);
  const m = useMessages();
  const pages: { id: Page; label: string }[] = [
    { id: 'run', label: m.app.nav.run },
    { id: 'folders', label: m.app.nav.folders },
    { id: 'follows', label: m.app.nav.follows },
    { id: 'settings', label: m.app.nav.settings },
  ];

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const nav = state.status === 'ready' && state.nav.isLogin ? state.nav : null;
  const mid = nav?.mid ?? null;
  useEffect(() => {
    if (mid === null || !hydrated) return;
    void loadFolders(mid);
  }, [mid, hydrated, loadFolders]);

  const loggedOut = state.status === 'ready' && !state.nav.isLogin;
  const ready = nav !== null && mid !== null && hydrated;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <IconBrand />
          <span className="brand-name">biliTidy</span>
        </span>
        <nav className="tabs">
          {pages.map((p) => (
            <button key={p.id} type="button" className={page === p.id ? 'tab active' : 'tab'} onClick={() => setPage(p.id)}>
              {p.label}
            </button>
          ))}
        </nav>
        <SessionBadge state={state} onRefresh={refresh} />
      </header>

      <div className="app-body">
        {headerRuleError && (
          <div className="banner error">
            <span className="dot" style={{ background: 'var(--bad)' }} />
            <span>{headerRuleError}</span>
          </div>
        )}

        {page === 'settings' && hydrated ? (
          <SettingsPage onOpenFollows={() => setPage('follows')} />
        ) : page === 'run' && ready ? (
          <RunPage mid={mid} onOpenFolders={() => setPage('folders')} onOpenSettings={() => setPage('settings')} />
        ) : page === 'folders' && ready ? (
          <FoldersPage mid={mid} />
        ) : page === 'follows' && ready ? (
          <FollowsPage nav={nav} />
        ) : (
          <div className="page no-bar">
            <div className="empty-page">
              {loggedOut ? (
                <div className="banner warn" style={{ maxWidth: 520, marginBottom: 0 }}>
                  <span className="dot" style={{ background: 'var(--warn)' }} />
                  <span>
                    {m.app.signedOutBefore}{' '}
                    <a href="https://www.bilibili.com/" target="_blank" rel="noreferrer">
                      bilibili.com
                    </a>
                    {m.app.signedOutAfter}
                  </span>
                </div>
              ) : state.status === 'error' ? (
                <div className="banner error" style={{ maxWidth: 520, marginBottom: 0 }}>
                  <span className="dot" style={{ background: 'var(--bad)' }} />
                  <span>{state.message}</span>
                  <button type="button" className="link spacer" onClick={refresh}>
                    {m.common.retry}
                  </button>
                </div>
              ) : (
                <span className="dim">{m.app.loading}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionBadge({ state, onRefresh }: { state: ReturnType<typeof useSession>['state']; onRefresh: () => void }) {
  const m = useMessages();
  if (state.status === 'loading') return <span className="session">{m.app.sessionChecking}</span>;
  if (state.status === 'error') {
    return (
      <span className="session error">
        {state.message}
        <button type="button" className="link" onClick={onRefresh}>
          {m.common.retry}
        </button>
      </span>
    );
  }
  const { nav } = state;
  return (
    <span className="session">
      {nav.isLogin ? (
        <>
          {nav.face && <img className="avatar" src={nav.face} alt="" referrerPolicy="no-referrer" />}
          <span className="uname">{nav.uname}</span>
          <span className="mono dim">mid {nav.mid}</span>
        </>
      ) : (
        m.app.sessionNotSignedIn
      )}
      <button type="button" className="link recheck" aria-label={m.app.sessionRecheck} onClick={onRefresh}>
        <IconRefresh className="recheck-icon" />
        <span className="recheck-text">{m.app.sessionRecheck}</span>
      </button>
    </span>
  );
}
