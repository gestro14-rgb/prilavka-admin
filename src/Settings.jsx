import { useEffect, useState } from 'react';
import { api } from './api';

const SETTING_META = {
  min_order_total:          { label: 'Минимальная сумма заказа',               unit: '₽',    type: 'number' },
  points_percent:           { label: 'Процент баллов за заказ',                unit: '%',    type: 'number' },
  referral_points_reward:   { label: 'Баллы за приглашённого друга',           unit: 'балл', type: 'number' },
  referral_discount:        { label: 'Скидка по реферальному коду',            unit: '₽',    type: 'number' },
  max_points_spend_percent: { label: 'Макс. % суммы заказа для оплаты баллами', unit: '%',   type: 'number' },
  default_slot:             { label: 'Стандартное время доставки',             unit: '',     type: 'text'   },
};

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSettings()
      .then((rows) => {
        const map = Object.fromEntries(rows.map((r) => [r.key, r]));
        setSettings(map);
        setDrafts(Object.fromEntries(rows.map((r) => [r.key, r.value])));
      })
      .catch((e) => setError(e.message));
  }, []);

  const handleSave = async (key) => {
    setSaving((s) => ({ ...s, [key]: true }));
    setError('');
    try {
      const updated = await api.updateSetting(key, drafts[key]);
      setSettings((prev) => ({ ...prev, [key]: updated }));
      setSaved((s) => ({ ...s, [key]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  const orderedKeys = [
    'min_order_total',
    'points_percent',
    'max_points_spend_percent',
    'referral_discount',
    'referral_points_reward',
    'default_slot',
  ];

  return (
    <div>
      <div className="page-header">
        <h2>Настройки</h2>
      </div>

      {error && <div className="alert error">{error}</div>}

      {settings === null ? (
        <div className="loading">Загрузка…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orderedKeys.map((key) => {
            const row = settings[key];
            if (!row) return null;
            const meta = SETTING_META[key] || { label: key, unit: '', type: 'text' };
            const isDirty = drafts[key] !== row.value;
            return (
              <div className="card" style={{ padding: '18px 20px' }} key={key}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{meta.label}</div>
                  {row.description && (
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>{row.description}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={meta.type}
                      value={drafts[key] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSave(key)}
                      style={{
                        width: '100%',
                        padding: meta.unit ? '10px 36px 10px 12px' : '10px 12px',
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        outline: 'none',
                        background: isDirty ? '#FFFBF5' : '#fff',
                      }}
                    />
                    {meta.unit && (
                      <span style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 13, color: 'var(--ink-soft)', pointerEvents: 'none',
                      }}>
                        {meta.unit}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSave(key)}
                    disabled={!isDirty || saving[key]}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: saved[key] ? '#2a6e38' : isDirty ? 'var(--accent)' : 'var(--line)',
                      color: isDirty || saved[key] ? '#fff' : 'var(--ink-soft)',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: isDirty && !saving[key] ? 'pointer' : 'default',
                      transition: 'background 0.2s',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {saving[key] ? '…' : saved[key] ? '✓ Сохранено' : 'Сохранить'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
