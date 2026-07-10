import { useEffect, useState } from 'react';
import { api } from './api';

function fmt(n) {
  return Number(n).toLocaleString('ru-RU');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Человекочитаемые подписи для screen_name — как в воронке, так и в
// "Топ экранов" / "Путь сессии" (там встречаются и не-воронковые экраны:
// profile, order_tracking).
const SCREEN_LABELS = {
  home: 'Главная',
  catalog: 'Каталог',
  product: 'Товар',
  cart: 'Корзина',
  checkout: 'Оформление',
  order_placed: 'Заказ',
  profile: 'Профиль',
  order_tracking: 'Трекинг',
  other: 'Другое',
};

function screenLabel(name) {
  return SCREEN_LABELS[name] || name;
}

function FunnelBlock({ funnel, loading }) {
  if (loading) return <div className="loading">Загрузка…</div>;
  if (!funnel || funnel.steps.every((s) => s.count === 0)) {
    return <div className="empty-hint">Нет данных за выбранный период</div>;
  }
  const maxCount = Math.max(...funnel.steps.map((s) => s.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {funnel.steps.map((s) => {
        const pct = Math.round((s.count / maxCount) * 100);
        return (
          <div key={s.step}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{s.label}</span>
              <span style={{ fontSize: 13, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <b style={{ fontSize: 17 }}>{fmt(s.count)}</b>
                <span style={{ color: 'var(--ink-soft)' }}>сессий</span>
                {s.dropOffPct != null && (
                  <span style={{ color: s.dropOffPct > 0 ? '#C0392B' : 'var(--ink-soft)', fontWeight: 800 }}>
                    {s.dropOffPct > 0 ? `отвал −${s.dropOffPct}%` : '0% отвала'}
                  </span>
                )}
              </span>
            </div>
            <div style={{ width: '100%', height: 10, background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: 'var(--accent)', borderRadius: 6 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const [from, setFrom] = useState(() => daysAgoISO(7));
  const [to, setTo] = useState(() => todayISO());
  const [userIdFilter, setUserIdFilter] = useState('');

  const [funnel, setFunnel] = useState(null);
  const [topScreens, setTopScreens] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const [sessionDetailError, setSessionDetailError] = useState('');

  // Сама загрузка — без синхронных setState перед запросом (initial state
  // уже верный для первого рендера); сброс loading/error/selectedSession
  // делает вызывающая сторона — эффект на монтирование этого не требует,
  // а обработчик кнопки "Применить" делает это явно в handleApply.
  const fetchData = () =>
    Promise.all([
      api.getAnalyticsFunnel({ from, to }),
      api.getAnalyticsTopScreens({ from, to }),
      api.getAnalyticsSessions({ from, to, userId: userIdFilter.trim() || undefined }),
    ])
      .then(([f, t, s]) => {
        setFunnel(f);
        setTopScreens(t);
        setSessions(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => {
    setLoading(true);
    setError('');
    setSelectedSession(null);
    fetchData();
  };

  const applyPreset = (days) => {
    setFrom(daysAgoISO(days));
    setTo(todayISO());
  };

  const openSession = (sessionId) => {
    setSessionDetailLoading(true);
    setSessionDetailError('');
    api
      .getAnalyticsSession(sessionId)
      .then(setSelectedSession)
      .catch((e) => setSessionDetailError(e.message))
      .finally(() => setSessionDetailLoading(false));
  };

  return (
    <div>
      <div className="page-header">
        <h2>Аналитика</h2>
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* Фильтр по датам */}
      <div className="card" style={{ padding: 20, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="anFrom">С даты</label>
          <input id="anFrom" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="anTo">По дату</label>
          <input id="anTo" type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="anUserId">User ID (опционально)</label>
          <input
            id="anUserId"
            type="text"
            placeholder="telegram id"
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            style={{ width: 140 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={() => applyPreset(7)}>7 дней</button>
          <button type="button" className="btn-secondary" onClick={() => applyPreset(30)}>30 дней</button>
          <button type="button" className="btn-primary" onClick={handleApply} disabled={loading}>
            {loading ? 'Загрузка…' : 'Применить'}
          </button>
        </div>
      </div>

      {/* Воронка */}
      <div className="section-label" style={{ marginTop: 0 }}>Воронка</div>
      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <FunnelBlock funnel={funnel} loading={loading && !funnel} />
      </div>

      {/* Топ экранов */}
      <div className="section-label">Топ экранов</div>
      <div className="card" style={{ marginBottom: 32 }}>
        <table className="product-table">
          <thead>
            <tr>
              <th>Экран</th>
              <th style={{ textAlign: 'right' }}>Просмотров</th>
            </tr>
          </thead>
          <tbody>
            {!topScreens || topScreens.length === 0 ? (
              <tr>
                <td colSpan={2} className="empty-hint">{loading ? 'Загрузка…' : 'Нет данных за период'}</td>
              </tr>
            ) : (
              topScreens.map((s) => (
                <tr key={s.screenName}>
                  <td style={{ fontWeight: 700 }}>{screenLabel(s.screenName)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 15 }}>{fmt(s.views)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Сессии пользователей */}
      <div className="section-label">Сессии пользователей</div>
      <div className="card" style={{ marginBottom: selectedSession || sessionDetailLoading ? 16 : 32 }}>
        <table className="product-table">
          <thead>
            <tr>
              <th>Начало</th>
              <th>User ID</th>
              <th style={{ textAlign: 'right' }}>Событий</th>
              <th>Дошёл до</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!sessions || sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-hint">{loading ? 'Загрузка…' : 'Нет сессий за период'}</td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr
                  key={s.sessionId}
                  onClick={() => openSession(s.sessionId)}
                  style={{
                    cursor: 'pointer',
                    background: selectedSession?.sessionId === s.sessionId ? 'var(--surface)' : undefined,
                  }}
                >
                  <td>{new Date(s.startedAt).toLocaleString('ru-RU')}</td>
                  <td>{s.userId ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{s.eventCount}</td>
                  <td style={{ fontWeight: 700 }}>{screenLabel(s.finalStep)}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>Путь →</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Путь выбранной сессии */}
      {(sessionDetailLoading || selectedSession) && (
        <div className="card" style={{ padding: 24, marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="section-label" style={{ margin: 0 }}>
              Путь сессии {selectedSession ? selectedSession.sessionId.slice(0, 8) : ''}
              {selectedSession?.userId ? ` · user ${selectedSession.userId}` : ''}
            </div>
            <button type="button" className="btn-secondary" onClick={() => setSelectedSession(null)}>Закрыть</button>
          </div>
          {sessionDetailLoading ? (
            <div className="loading">Загрузка…</div>
          ) : sessionDetailError ? (
            <div className="alert error">{sessionDetailError}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {selectedSession.events.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 0',
                    borderBottom: i < selectedSession.events.length - 1 ? '1px dashed var(--line)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', width: 150, flexShrink: 0 }}>
                    {new Date(e.createdAt).toLocaleString('ru-RU')}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{e.eventType}</span>
                  {e.screenName && (
                    <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>— {screenLabel(e.screenName)}</span>
                  )}
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{JSON.stringify(e.metadata)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
