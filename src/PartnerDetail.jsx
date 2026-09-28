import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from './api';

const RUB = (n) => Number(n || 0).toLocaleString('ru-RU') + ' ₽';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const TX_TYPE = {
  referral_first_order: 'Первый заказ',
  repeat_order: 'Повторный заказ',
  manual_adjustment: 'Ручная корректировка',
  payout: 'Выплата',
  correction: 'Корректировка',
};

const TX_STATUS = {
  pending: 'Ожидает',
  available: 'Доступно',
  paid: 'Выплачено',
  cancelled: 'Отменено',
};

function Stat({ label, value }) {
  return (
    <div style={{ flex: '1 1 120px', minWidth: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function PartnerDetail() {
  const { id } = useParams();
  const [partner, setPartner] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('overview');

  // Редактирование — теми же полями, что и создание, но отдельным состоянием:
  // форма заполняется из загруженного партнёра, а не правит его напрямую.
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  // Условия вознаграждения правятся отдельной формой и отдельной кнопкой:
  // смена имени или slug и включение денег — разные по цене действия, и
  // сохраняться одним нажатием они не должны.
  const [rules, setRules] = useState(null);
  const [savingRules, setSavingRules] = useState(false);

  const load = () => {
    api.getPartner(id).then((p) => {
      setPartner(p);
      setEdit({
        name: p.name,
        telegramUsername: p.telegramUsername || '',
        telegramUserId: p.telegramUserId || '',
        referralSlug: p.referralSlug,
        status: p.status,
      });
      setRules({
        firstOrderRewardAmount: p.firstOrderRewardAmount ?? 0,
        repeatRewardType: p.repeatRewardType || 'percentage',
        repeatRewardValue: p.repeatRewardValue ?? 0,
        attributionDurationMonths: p.attributionDurationMonths ?? null,
        rewardEnabled: Boolean(p.rewardEnabled),
      });
    }).catch((e) => setError(e.message));
    api.getPartnerReferrals(id).then(setReferrals).catch((e) => setError(e.message));
    api.getPartnerTransactions(id).then(setTransactions).catch((e) => setError(e.message));
  };

  useEffect(load, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSaving(true);
    try {
      await api.updatePartner(id, edit);
      setSuccess('Сохранено');
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRules = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSavingRules(true);
    try {
      await api.updatePartner(id, {
        firstOrderRewardAmount: Number(rules.firstOrderRewardAmount) || 0,
        repeatRewardType: rules.repeatRewardType,
        repeatRewardValue: Number(rules.repeatRewardValue) || 0,
        attributionDurationMonths: rules.attributionDurationMonths,
        rewardEnabled: rules.rewardEnabled,
      });
      setSuccess('Условия сохранены');
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSavingRules(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(partner.referralLink);
      setSuccess('Ссылка скопирована');
    } catch {
      setError('Не удалось скопировать — скопируйте вручную');
    }
  };

  if (error && !partner) return <div className="error">{error}</div>;
  if (!partner) return <div className="loading">Загрузка…</div>;

  const s = partner.stats || {};

  return (
    <div>
      <Link to="/partners" style={{ fontSize: 13 }}>← Партнёры</Link>
      <h1 style={{ marginTop: 8 }}>{partner.name}</h1>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="card" style={{ padding: 20, marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Stat label="приведено клиентов" value={s.customers ?? 0} />
          <Stat label="клиентов с заказом" value={s.customersWithOrder ?? 0} />
          <Stat label="всего заказов" value={s.orders ?? 0} />
          <Stat label="заработано" value={RUB(s.earned)} />
          <Stat label="к выплате" value={RUB(s.available)} />
        </div>
        <div style={{ marginTop: 14, fontSize: 13, wordBreak: 'break-all' }}>
          {partner.referralLink}{' '}
          <button className="btn-secondary" style={{ fontSize: 12, padding: '3px 10px', marginLeft: 6 }} onClick={copy}>
            Скопировать
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-soft)' }}>
          Telegram ID: {partner.telegramUserId || '—'} · создан {formatDate(partner.createdAt)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {[['overview', 'Обзор'], ['referrals', 'Клиенты'], ['transactions', 'Начисления']].map(([v, label]) => (
          <button key={v}
                  className={tab === v ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: 13, padding: '5px 12px' }}
                  onClick={() => setTab(v)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && edit && (
        <div className="card" style={{ padding: 20, marginTop: 12 }}>
          <form onSubmit={handleSave}>
            <div className="field">
              <label htmlFor="eName">Имя</label>
              <input id="eName" type="text" value={edit.name} required
                     onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="eUsername">Telegram username</label>
              <input id="eUsername" type="text" value={edit.telegramUsername}
                     onChange={(e) => setEdit({ ...edit, telegramUsername: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="eTgId">Telegram user ID</label>
              <input id="eTgId" type="text" inputMode="numeric" value={edit.telegramUserId}
                     onChange={(e) => setEdit({ ...edit, telegramUserId: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="eSlug">Ссылка (slug)</label>
              <input id="eSlug" type="text" value={edit.referralSlug}
                     onChange={(e) => setEdit({ ...edit, referralSlug: e.target.value })} />
              {/* Менять slug у работающего партнёра — значит сломать все уже
                  разосланные им ссылки. Уже закреплённые клиенты не
                  потеряются: связь хранится по partner_id, а не по slug. */}
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Смена ссылки сломает уже разосланные. Закреплённые клиенты сохранятся.
              </div>
            </div>
            <div className="field">
              <label htmlFor="eStatus">Статус</label>
              <select id="eStatus" value={edit.status}
                      onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                <option value="active">Активен</option>
                <option value="inactive">Неактивен</option>
              </select>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Неактивный партнёр не закрепляет новых клиентов. Уже закреплённые остаются за ним.
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </form>
        </div>
      )}

      {tab === 'overview' && rules && (
        <div className="card" style={{ padding: 20, marginTop: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Условия партнёрской программы</h2>

          <form onSubmit={handleSaveRules}>
            <div className="field">
              <label htmlFor="rFirst">Вознаграждение за первый заказ, ₽</label>
              <input id="rFirst" type="number" min="0" step="1" value={rules.firstOrderRewardAmount}
                     onChange={(e) => setRules({ ...rules, firstOrderRewardAmount: e.target.value })} />
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Партнёр получает эту сумму за первый завершённый заказ приведённого клиента.
              </div>
            </div>

            <div className="field">
              <label htmlFor="rType">Повторные заказы</label>
              <select id="rType" value={rules.repeatRewardType}
                      onChange={(e) => setRules({ ...rules, repeatRewardType: e.target.value })}>
                <option value="percentage">% от суммы заказа</option>
                <option value="fixed">Фиксированная сумма</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="rValue">
                {rules.repeatRewardType === 'percentage' ? 'Процент, %' : 'Сумма, ₽'}
              </label>
              <input id="rValue" type="number" min="0"
                     max={rules.repeatRewardType === 'percentage' ? 100 : undefined}
                     step={rules.repeatRewardType === 'percentage' ? '0.1' : '1'}
                     value={rules.repeatRewardValue}
                     onChange={(e) => setRules({ ...rules, repeatRewardValue: e.target.value })} />
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Начисляется за каждый следующий завершённый заказ в течение срока привязки.
                {rules.repeatRewardType === 'percentage'
                  ? ' Процент считается от суммы заказа после скидок.'
                  : ''}
              </div>
            </div>

            <div className="field">
              <label htmlFor="rMonths">Срок действия привязки</label>
              <select id="rMonths" value={rules.attributionDurationMonths ?? ''}
                      onChange={(e) => setRules({
                        ...rules,
                        attributionDurationMonths: e.target.value === '' ? null : Number(e.target.value),
                      })}>
                <option value="">Без ограничения</option>
                {[1, 3, 6, 12, 24].map((m) => (
                  <option key={m} value={m}>{m} {m === 1 ? 'месяц' : m < 5 ? 'месяца' : 'месяцев'}</option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                После окончания срока новые заказы клиента больше не приносят партнёру вознаграждение.
                Сам клиент остаётся закреплённым за партнёром и к другому не переходит.
              </div>
            </div>

            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={rules.rewardEnabled}
                       onChange={(e) => setRules({ ...rules, rewardEnabled: e.target.checked })} />
                Включить начисления
              </label>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Пока выключено, начисления не создаются вовсе. Уже созданные не пересчитываются
                при изменении условий — новые правила действуют только на будущие заказы.
              </div>
            </div>

            <button className="btn-primary" type="submit" disabled={savingRules}>
              {savingRules ? 'Сохранение…' : 'Сохранить условия'}
            </button>
          </form>
        </div>
      )}

      {tab === 'referrals' && (
        <div className="card" style={{ padding: 20, marginTop: 12 }}>
          {referrals === null ? (
            <div className="loading">Загрузка…</div>
          ) : referrals.length === 0 ? (
            <div className="empty-hint">Клиентов пока нет.</div>
          ) : (
            <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
              {referrals.map((r) => (
                <div key={r.id} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ flex: 1, minWidth: 160 }}>
                    {r.name || (r.customerId ? `Клиент №${r.customerId}` : 'Ещё не открывал приложение')}
                    {r.username && <span style={{ color: 'var(--ink-soft)' }}> @{r.username}</span>}
                  </span>
                  <span style={{ color: 'var(--ink-soft)' }}>{r.phone || '—'}</span>
                  <span>{r.orders} зак.</span>
                  <span>{RUB(r.ordersTotal)}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>{formatDate(r.referredAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'transactions' && (
        <div className="card" style={{ padding: 20, marginTop: 12 }}>
          {transactions === null ? (
            <div className="loading">Загрузка…</div>
          ) : transactions.length === 0 ? (
            /* Начислений нет не потому, что что-то сломалось: финансовая
               формула ещё не включена (см. migrations/061). */
            <div className="empty-hint">Начислений пока нет.</div>
          ) : (
            <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
              {transactions.map((t) => (
                <div key={t.id} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ flex: 1, minWidth: 140 }}>{TX_TYPE[t.type] || t.type}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>{t.orderId ? `заказ #${t.orderId}` : '—'}</span>
                  <span style={{ fontWeight: 700 }}>{t.amount > 0 ? '+' : ''}{RUB(t.amount)}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>{TX_STATUS[t.status] || t.status}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>{formatDate(t.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
