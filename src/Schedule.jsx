import { useEffect, useState } from 'react';
import { api } from './api';

const DEFAULT_SLOT = '18:00–21:00';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function ScheduleRow({ entry, onSaved }) {
  const isOverride = entry.id !== null;
  const [isAvailable, setIsAvailable] = useState(entry.isAvailable);
  const [slot, setSlot] = useState(entry.slot === DEFAULT_SLOT ? '' : (entry.slot || ''));
  const [note, setNote] = useState(entry.note || '');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');

  const isDirty =
    isAvailable !== entry.isAvailable ||
    (slot || DEFAULT_SLOT) !== entry.slot ||
    (note || null) !== entry.note;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.upsertDeliverySchedule({
        date: entry.date,
        isAvailable,
        slot: slot.trim() || null,
        note: note.trim() || null,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!entry.id) return;
    setResetting(true);
    setError('');
    try {
      await api.deleteDeliverySchedule(entry.id);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <tr style={{ background: !isAvailable ? '#FFF5F5' : undefined }}>
      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
        {formatDate(entry.date)}
        {isOverride && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 10,
              fontWeight: 800,
              background: '#E8F5E9',
              color: '#2F6F3E',
              padding: '2px 7px',
              borderRadius: 100,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            изменено
          </span>
        )}
      </td>
      <td>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: isAvailable ? 'var(--accent)' : 'var(--danger)' }}>
            {isAvailable ? 'Доступна' : 'Недоступна'}
          </span>
        </label>
      </td>
      <td>
        <input
          type="text"
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          placeholder={DEFAULT_SLOT}
          disabled={!isAvailable}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 13,
            width: 130,
            background: isAvailable ? 'var(--bg)' : 'var(--surface)',
            color: 'var(--ink)',
            fontFamily: 'inherit',
          }}
        />
      </td>
      <td>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Например: праздник"
          style={{
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 13,
            width: 180,
            background: 'var(--bg)',
            color: 'var(--ink)',
            fontFamily: 'inherit',
          }}
        />
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn-primary"
            style={{ padding: '7px 16px', fontSize: 12 }}
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
          {isOverride && (
            <button
              className="btn-secondary"
              style={{ padding: '7px 14px', fontSize: 12 }}
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? '…' : 'Сброс'}
            </button>
          )}
        </div>
        {error && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--danger)' }}>{error}</div>}
      </td>
    </tr>
  );
}

export default function Schedule() {
  const [schedule, setSchedule] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    api.getDeliverySchedule().then(setSchedule).catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!schedule) return <div className="loading">Загрузка…</div>;

  const hasUnavailable = schedule.some((e) => !e.isAvailable);

  return (
    <div>
      <div className="page-header">
        <h2>📅 Расписание доставки</h2>
      </div>

      {hasUnavailable && (
        <div className="alert error" style={{ marginBottom: 20 }}>
          Есть недоступные дни — убедитесь, что покупатели об этом знают.
        </div>
      )}

      <div className="card">
        <table className="product-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Доставка</th>
              <th>Слот</th>
              <th>Заметка</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((entry) => (
              <ScheduleRow key={entry.date} entry={entry} onSaved={load} />
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 16,
          fontSize: 12,
          color: 'var(--ink-soft)',
          fontWeight: 500,
        }}
      >
        Слот по умолчанию: <strong>{DEFAULT_SLOT}</strong>. Кнопка «Сброс» удаляет переопределение — день возвращается к дефолту.
      </div>
    </div>
  );
}
