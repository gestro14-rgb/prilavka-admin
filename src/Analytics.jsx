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

// Человекочитаемые подписи. Здесь сразу два словаря значений: screen_name
// для "Топа экранов" и ключи шагов воронки для колонки "Дошёл до" — они не
// пересекаются, поэтому лежат в одной таблице.
const SCREEN_LABELS = {
  home: 'Главная',
  catalog: 'Каталог',
  product: 'Товар',
  cart: 'Корзина',
  landing: 'Лендинг',
  checkout: 'Оформление',
  order_placed: 'Заказ',
  profile: 'Профиль',
  order_tracking: 'Трекинг',
  other: 'Другое',
  // Ключи шагов воронки (колонка "Дошёл до" в таблице сессий)
  app_opened: 'Открыл приложение',
  catalog_opened: 'Каталог',
  product_opened: 'Карточка',
  add_to_cart: 'В корзину',
  cart_opened: 'Корзина',
  checkout_started: 'Оформление',
  order_created: 'Заказ',
};

function screenLabel(name) {
  return SCREEN_LABELS[name] || name;
}

// Оттенки ступеней — от насыщенного к светлому по мере сужения воронки.
// Захардкожены, а не color-mix(): стадий ровно семь и они не меняются.
const FUNNEL_SHADES = ['#1C8F1C', '#26972A', '#309F35', '#3AA740', '#44AF4B', '#4EB756', '#61C164'];

function pluralSessions(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'сессия';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'сессии';
  return 'сессий';
}

// Лендинг живёт на другом домене и в своей сессии — связать его просмотры с
// открытиями мини-аппа по session_id нельзя в принципе. Поэтому не ступень
// воронки, а отдельный блок с честно названным грубым отношением: числа
// сопоставимы по объёму, но это не «те же самые люди».
function PreFunnelBlock({ preFunnel }) {
  if (!preFunnel || (!preFunnel.landingViews && !preFunnel.appOpens)) return null;
  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>Просмотры лендинга</div>
          <b style={{ fontSize: 22 }}>{fmt(preFunnel.landingViews)}</b>
        </div>
        <span style={{ color: 'var(--line)', fontSize: 18 }}>→</span>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>Открыли приложение</div>
          <b style={{ fontSize: 22 }}>{fmt(preFunnel.appOpens)}</b>
        </div>
        {preFunnel.ratioPct != null && (
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <b style={{ fontSize: 22, color: 'var(--accent)' }}>{preFunnel.ratioPct}%</b>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 10, lineHeight: 1.45 }}>
        Лендинг и мини-апп — разные сайты с разными сессиями, поэтому это отношение объёмов,
        а не отвал по конкретным людям: часть посетителей приходит в бота мимо лендинга.
      </div>
    </div>
  );
}

// Воронка ступенями: ширина блока — доля от ПЕРВОГО шага (а не от максимума,
// как было раньше), поэтому сужение читается как реальный путь клиента.
// Между ступенями — перемычка с отвалом в процентах и в людях.
//
// Ветки (наборы) рисуются рядом со ступенью, а не отдельной ступенью: сессия,
// ушедшая в наборы, не даёт product_opened, и в линейной цепочке такой шаг
// показывал бы фиктивный «отвал 100%».
function FunnelBlock({ funnel, loading }) {
  if (loading) return <div className="loading">Загрузка…</div>;
  if (!funnel || !funnel.stages || funnel.stages.every((s) => s.count === 0)) {
    return <div className="empty-hint">Нет данных за выбранный период</div>;
  }

  const steps = funnel.stages;
  // Обычно база — «Главная». Но если на неё почему-то нет событий (сессия
  // может начаться сразу с каталога по диплинку), берём максимум, иначе
  // всё поделилось бы на ноль и воронка схлопнулась бы в нули.
  const base = steps[0]?.count || Math.max(...steps.map((s) => s.count), 1);
  const last = steps[steps.length - 1];
  const totalConversion = base ? Math.round((last.count / base) * 1000) / 10 : 0;

  return (
    <div>
      {steps.map((s, i) => {
        // Клампим сверху: шаг может превысить базу (сессия с диплинка
        // начинается сразу с каталога, минуя главную) — без ограничения
        // блок вылез бы за карточку.
        const widthPct = Math.min(Math.max((s.count / base) * 100, 22), 100);
        const fromStart = base ? Math.round((s.count / base) * 1000) / 10 : 0;
        const lost = i > 0 ? steps[i - 1].count - s.count : 0;

        return (
          <div key={s.step}>
            {i > 0 && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '7px 0', fontSize: 12, fontWeight: 700,
                  color: lost > 0 ? 'var(--danger)' : 'var(--ink-soft)',
                }}
              >
                <span style={{ color: 'var(--line)' }}>▼</span>
                {lost > 0
                  ? <span>−{s.dropOffPct}% · потеряли {fmt(lost)} {pluralSessions(lost)}</span>
                  : <span>без отвала</span>}
              </div>
            )}

            <div
              style={{
                width: `${widthPct}%`, margin: '0 auto', borderRadius: 10,
                background: FUNNEL_SHADES[i] || FUNNEL_SHADES[FUNNEL_SHADES.length - 1],
                color: '#FFFFFF', padding: '12px 16px',
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                gap: 12, minWidth: 240, boxSizing: 'border-box',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 14 }}>{s.label}</span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap' }}>
                <b style={{ fontSize: 20 }}>{fmt(s.count)}</b>
                <span style={{ fontSize: 12, opacity: 0.85 }}>{fromStart}%</span>
              </span>
            </div>

            {/* Ветка «наборы» — рядом со ступенью, в её же ширине, но
                визуально подчинённая: это параллельный путь, а не
                следующий шаг, и в расчёт отвала он не входит. */}
            {s.branches?.length > 0 && s.branches.some((b) => b.count > 0) && (
              <div style={{ width: `${widthPct}%`, margin: '4px auto 0', minWidth: 240, boxSizing: 'border-box' }}>
                {s.branches.map((b) => (
                  <div
                    key={b.step}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
                      padding: '7px 16px', borderRadius: 8,
                      border: '1px dashed var(--line)', marginTop: 4,
                      fontSize: 13, color: 'var(--ink-soft)',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>↳ {b.label}</span>
                    <b style={{ fontSize: 15, color: 'var(--ink)' }}>{fmt(b.count)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div
        style={{
          marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)',
          display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 700 }}>
          {steps[0].label} → {last.label}
        </span>
        <b style={{ fontSize: 24, color: 'var(--accent)' }}>{totalConversion}%</b>
        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          ({fmt(last.count)} из {fmt(base)})
        </span>
      </div>
    </div>
  );
}

// Под-воронка внутри оформления. Отдельным блоком, а не ступенями основной:
// адрес и оплата происходят ВНУТРИ промежутка checkout_started → order_created,
// и вставленные в общую цепочку они ломали бы её арифметику.
//
// Плоский список, без сужающихся блоков: шаги здесь не строго
// последовательны (адрес часто сохранён ещё до корзины, с Главной), поэтому
// «отвал» между ними — подсказка, а не точная величина.
function CheckoutStepsBlock({ steps, loading }) {
  if (loading) return <div className="loading">Загрузка…</div>;
  if (!steps || steps.every((s) => s.count === 0)) {
    return <div className="empty-hint">Нет данных за выбранный период</div>;
  }
  const base = steps[0]?.count || 0;
  return (
    <div>
      {steps.map((s, i) => {
        const pct = base ? Math.round((s.count / base) * 1000) / 10 : 0;
        return (
          <div
            key={s.step}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
              borderBottom: i < steps.length - 1 ? '1px solid var(--line)' : 'none',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>{s.label}</span>
            {/* Полоса — доля от первого шага под-воронки */}
            <span style={{ width: 120, height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${Math.min(pct, 100)}%`, height: '100%', background: 'var(--accent)' }} />
            </span>
            <b style={{ fontSize: 16, width: 60, textAlign: 'right' }}>{fmt(s.count)}</b>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', width: 52, textAlign: 'right' }}>{pct}%</span>
          </div>
        );
      })}
      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 12, lineHeight: 1.45 }}>
        Оформление — единая скроллящаяся секция корзины, а не отдельные экраны.
        «Открыли адрес» и «Дошли до оплаты» считаются по взаимодействию: открытию шторки адреса
        и появлению блока оплаты на экране. Адрес часто сохранён заранее, с Главной, — тогда шаг
        не наступает внутри этого прохода.
      </div>
    </div>
  );
}

export default function Analytics() {
  const [from, setFrom] = useState(() => daysAgoISO(7));
  const [to, setTo] = useState(() => todayISO());
  const [userIdFilter, setUserIdFilter] = useState('');
  // Источник хранится одной строкой "source|campaign" — так селект остаётся
  // одним контролом, а пары источник+кампания не могут разъехаться между
  // собой (кампания всегда принадлежит своему источнику).
  const [sourceFilter, setSourceFilter] = useState('');

  const [funnel, setFunnel] = useState(null);
  const [topScreens, setTopScreens] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const [sessionDetailError, setSessionDetailError] = useState('');

  // Сама загрузка — без синхронных setState перед запросом (initial state
  // уже верный для первого рендера); сброс loading/error/selectedSession
  // делает вызывающая сторона — эффект на монтирование этого не требует,
  // а обработчик кнопки "Применить" делает это явно в handleApply.
  const [utmSource, utmCampaign] = sourceFilter ? sourceFilter.split('|') : [undefined, undefined];

  const fetchData = () =>
    Promise.all([
      api.getAnalyticsFunnel({ from, to, utmSource, utmCampaign: utmCampaign || undefined }),
      api.getAnalyticsTopScreens({ from, to }),
      api.getAnalyticsSessions({
        from, to,
        userId: userIdFilter.trim() || undefined,
        utmSource,
        utmCampaign: utmCampaign || undefined,
      }),
      // Список источников не зависит от выбранного источника — иначе,
      // отфильтровав по одному, из селекта пропали бы все остальные.
      api.getAnalyticsSources({ from, to }),
    ])
      .then(([f, t, s, src]) => {
        setFunnel(f);
        setTopScreens(t);
        setSessions(s);
        setSources(src);
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
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="anSource">Источник трафика</label>
          <select
            id="anSource"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{ minWidth: 190 }}
          >
            <option value="">Все источники</option>
            {sources.map((s) => {
              const value = `${s.utmSource}|${s.utmCampaign || ''}`;
              return (
                <option key={value} value={value}>
                  {s.utmSource}{s.utmCampaign ? ` · ${s.utmCampaign}` : ''} ({s.sessions})
                </option>
              );
            })}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={() => applyPreset(7)}>7 дней</button>
          <button type="button" className="btn-secondary" onClick={() => applyPreset(30)}>30 дней</button>
          <button type="button" className="btn-primary" onClick={handleApply} disabled={loading}>
            {loading ? 'Загрузка…' : 'Применить'}
          </button>
        </div>
      </div>

      {/* До приложения: лендинг → открытие мини-аппа */}
      <div className="section-label" style={{ marginTop: 0 }}>До приложения</div>
      <PreFunnelBlock preFunnel={funnel?.preFunnel} />

      {/* Воронка */}
      <div className="section-label">Воронка</div>
      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <FunnelBlock funnel={funnel} loading={loading && !funnel} />
      </div>

      {/* Оформление по шагам */}
      <div className="section-label">Внутри оформления</div>
      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <CheckoutStepsBlock steps={funnel?.checkoutSteps} loading={loading && !funnel} />
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
              <th>Пользователь</th>
              <th>Источник</th>
              <th style={{ textAlign: 'right' }}>Событий</th>
              <th>Дошёл до</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!sessions || sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-hint">{loading ? 'Загрузка…' : 'Нет сессий за период'}</td>
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
                  {/* Имени нет у входа по телефону и у сессий вне Telegram —
                      там в analytics_events не пишется user_id вообще.
                      Показываем сам id как запасной вариант, чтобы сессия
                      всё равно оставалась опознаваемой. */}
                  <td>{s.userName || (s.userId != null ? `id ${s.userId}` : '—')}</td>
                  {/* Прочерк — не «данных нет», а «пришёл без размеченной
                      ссылки»: прямой заход в бота тоже полноценный источник. */}
                  <td>
                    {s.utmSource
                      ? <span style={{ fontWeight: 700 }}>{s.utmSource}{s.utmCampaign ? ` · ${s.utmCampaign}` : ''}</span>
                      : <span style={{ color: 'var(--ink-soft)' }}>прямой</span>}
                  </td>
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
              {selectedSession?.userName
                ? ` · ${selectedSession.userName}`
                : selectedSession?.userId ? ` · id ${selectedSession.userId}` : ''}
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
