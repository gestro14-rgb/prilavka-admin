import { useEffect, useState } from 'react';
import { api } from './api';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function Users() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [adjusting, setAdjusting] = useState(null); // { telegramId, firstName, points }
  const [deltaInput, setDeltaInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.getUsers().then(setUsers).catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const openAdjust = (u) => {
    setAdjusting(u);
    setDeltaInput('');
    setError('');
  };

  const handleAdjust = async () => {
    const delta = parseInt(deltaInput, 10);
    if (isNaN(delta)) return;
    setSaving(true);
    setError('');
    try {
      const result = await api.adjustUserPoints(adjusting.telegramId, delta);
      setUsers((prev) =>
        prev.map((u) => (u.telegramId === adjusting.telegramId ? { ...u, points: result.points } : u))
      );
      setAdjusting(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Пользователи</h2>
      </div>

      {error && <div className="alert error">{error}</div>}

      {users === null ? (
        <div className="loading">Загрузка…</div>
      ) : users.length === 0 ? (
        <div className="card">
          <div className="empty-hint">Пока нет пользователей.</div>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="product-table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Реф. код</th>
                <th>Баллы</th>
                <th>Рефералов</th>
                <th>Заказов</th>
                <th>Зарегистрирован</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.telegramId}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{u.firstName || '—'}</div>
                    {u.username && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>@{u.username}</div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }}>
                      {u.referralCode}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{u.points}</td>
                  <td>{u.referralsCount}</td>
                  <td>{u.ordersCount}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => openAdjust(u)}>
                      Баллы ±
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно корректировки баллов */}
      {adjusting && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setAdjusting(null); }}
        >
          <div className="card" style={{ width: 320, padding: 24 }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>
              Изменить баллы
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
              {adjusting.firstName || `ID ${adjusting.telegramId}`} · сейчас {adjusting.points} баллов
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="deltaInput">Изменение (+ начислить, − списать)</label>
              <input
                id="deltaInput"
                type="number"
                value={deltaInput}
                onChange={(e) => setDeltaInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdjust()}
                placeholder="например +100 или -50"
                autoFocus
              />
            </div>

            {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-primary"
                onClick={handleAdjust}
                disabled={saving || !deltaInput}
              >
                {saving ? 'Сохраняем…' : 'Применить'}
              </button>
              <button className="btn-secondary" onClick={() => setAdjusting(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
