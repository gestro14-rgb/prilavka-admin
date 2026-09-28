import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';

const RUB = (n) => Number(n || 0).toLocaleString('ru-RU') + ' ₽';

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// Та же нормализация, что на сервере (normalizeSlug в partners.js). Здесь она
// нужна, чтобы подсказка в форме совпадала с тем, что реально сохранится, —
// иначе админ вводит «Анна Петрова», видит одно, а получает другое.
function normalizeSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 32);
}

export default function Partners() {
  const navigate = useNavigate();
  const [partners, setPartners] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [telegramUserId, setTelegramUserId] = useState('');
  // slugTouched отличает «админ вписал ссылку руками» от «ссылка
  // подставилась сама»: подсказку продолжаем обновлять только пока её не
  // правили, иначе набранное вручную затирал бы каждый символ в имени.
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState('active');

  const load = () => {
    api
      .getPartners({ status: statusFilter, q: search })
      .then(setPartners)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search]);

  const suggestedSlug = normalizeSlug(username || name);
  const effectiveSlug = slugTouched ? normalizeSlug(slug) : suggestedSlug;

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const created = await api.createPartner({
        name,
        telegramUsername: username,
        telegramUserId,
        referralSlug: effectiveSlug,
        status,
      });
      setSuccess(`Партнёр «${created.name}» создан. Ссылка: ${created.referralLink}`);
      setName(''); setUsername(''); setTelegramUserId('');
      setSlug(''); setSlugTouched(false); setStatus('active');
      setShowForm(false);
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Ссылка скопирована');
    } catch {
      setError('Не удалось скопировать — скопируйте вручную');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Партнёры</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Отмена' : '+ Добавить партнёра'}
        </button>
      </div>

      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
      {success && <div className="success" style={{ marginTop: 12 }}>{success}</div>}

      {showForm && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="pName">Имя</label>
              <input id="pName" type="text" value={name} required
                     onChange={(e) => setName(e.target.value)} placeholder="например, Анна" />
            </div>
            <div className="field">
              <label htmlFor="pUsername">Telegram username</label>
              <input id="pUsername" type="text" value={username}
                     onChange={(e) => setUsername(e.target.value)} placeholder="@anna_pilates" />
            </div>
            <div className="field">
              <label htmlFor="pTgId">Telegram user ID</label>
              <input id="pTgId" type="text" inputMode="numeric" value={telegramUserId}
                     onChange={(e) => setTelegramUserId(e.target.value)} placeholder="123456789" />
              {/* Без id ссылка всё равно работает и клиенты закрепляются —
                  недоступен только личный кабинет партнёра, который
                  сопоставляется именно по нему. */}
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Можно заполнить позже. Без него ссылка работает, но кабинет партнёру не откроется.
              </div>
            </div>
            <div className="field">
              <label htmlFor="pSlug">Ссылка (slug)</label>
              <input id="pSlug" type="text" value={slugTouched ? slug : suggestedSlug}
                     onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                     placeholder="anna" />
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Латиница, цифры, _ и -. Получится: <code>t.me/…?start=p_{effectiveSlug || '…'}</code>
              </div>
            </div>
            <div className="field">
              <label htmlFor="pStatus">Статус</label>
              <select id="pStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Активен</option>
                <option value="inactive">Неактивен</option>
              </select>
            </div>
            <button className="btn-primary" type="submit" disabled={saving || !name || !effectiveSlug}>
              {saving ? 'Создание…' : 'Создать партнёра'}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {[['', 'Все'], ['active', 'Активные'], ['inactive', 'Неактивные']].map(([v, label]) => (
          <button key={v}
                  className={statusFilter === v ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: 13, padding: '5px 12px' }}
                  onClick={() => setStatusFilter(v)}>
            {label}
          </button>
        ))}
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
               placeholder="Поиск: имя, username, ссылка"
               style={{ flex: 1, minWidth: 200 }} />
      </div>

      {partners === null ? (
        <div className="loading">Загрузка…</div>
      ) : partners.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="empty-hint">
            {search || statusFilter ? 'Ничего не найдено.' : 'Партнёров пока нет.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {partners.map((p) => (
            <div className="card" key={p.id} style={{ padding: 16, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/partners/${p.id}`)}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {p.telegramUsername ? '@' + p.telegramUsername : 'без username'}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>{p.customers} {plural(p.customers, 'клиент', 'клиента', 'клиентов')}</span>
                    <span>{p.orders} {plural(p.orders, 'заказ', 'заказа', 'заказов')}</span>
                    <span>{RUB(p.earned)}</span>
                    <span style={{ color: 'var(--ink-soft)' }}>к выплате {RUB(p.available)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                  {p.status === 'active'
                    ? <span style={{ fontSize: 12, background: '#D4EDDA', color: '#155724', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>Активен</span>
                    : <span style={{ fontSize: 12, background: '#FFF3CD', color: '#856404', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>Неактивен</span>}
                  <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => copy(p.referralLink)}>
                    Скопировать ссылку
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-soft)', wordBreak: 'break-all' }}>
                {p.referralLink}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
