import { useEffect, useState } from 'react';
import { api } from './api';

/**
 * Библиотека бейджей товаров (migrations/057).
 *
 * Бейдж — это визуальная плашка на карточке и ничего больше. Он не
 * участвует ни в подборе «Хитов недели» (за это отвечает старое поле
 * badge_type у товара), ни в отборе в витрину «Сегодня на прилавке» (за
 * это отвечает тег). Поэтому раздел живёт отдельно и ничего не знает ни о
 * витринах, ни о тегах.
 *
 * Назначение бейджа товару делается не здесь, а в карточке товара: там
 * человек видит сам товар и решает, что про него написать.
 */

// Ровно то, что принимает бэкенд. Прозрачности нет намеренно: плашка
// лежит поверх фотографии, и полупрозрачный фон сделал бы текст
// нечитаемым на половине снимков.
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const EMPTY_BADGE = {
  label: '',
  icon: '',
  bgColor: '#FFF1E8',
  textColor: '#EA682C',
  sortOrder: 0,
  isActive: true,
};

/**
 * Предпросмотр — те же значения, что у CustomBadge.jsx в мини-аппе:
 * кегль 9.5, вес 800, интерлиньяж 1.4, паддинги 3/7, радиус 7, эмодзи 10.
 * Числа продублированы сознательно: админка и мини-апп — разные сборки,
 * общего файла стилей у них нет, а видеть администратор должен ровно то,
 * что получит покупатель. Если поменяется вид бейджа на витрине, поменять
 * нужно и здесь — об этом же написано в CustomBadge.jsx.
 *
 * scale — во сколько раз увеличить: на витрине бейдж мелкий, а в форме по
 * нему нужно принимать решение о читаемости цветов.
 */
export function BadgePreview({ badge, scale = 1 }) {
  const px = (v) => `${v * scale}px`;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: px(3),
        background: HEX_RE.test(badge.bgColor) ? badge.bgColor : '#EEE',
        color: HEX_RE.test(badge.textColor) ? badge.textColor : '#999',
        fontFamily: 'inherit',
        fontSize: px(9.5),
        fontWeight: 800,
        lineHeight: 1.4,
        padding: `${px(3)} ${px(7)}`,
        borderRadius: px(7),
        whiteSpace: 'nowrap',
      }}
    >
      {badge.icon ? <span style={{ fontSize: px(10), lineHeight: 1 }}>{badge.icon}</span> : null}
      {badge.label || 'Текст бейджа'}
    </span>
  );
}

// Поле цвета: нативный color-picker плюс HEX руками. Пикер не умеет
// трёхзначную запись, поэтому в него отдаём только валидный шестизначный
// цвет, а в текстовом поле оставляем ровно то, что набрал человек.
function ColorField({ label, value, onChange }) {
  const valid = HEX_RE.test(value);
  const expand = (v) => (v.length === 4 ? '#' + v.slice(1).split('').map((c) => c + c).join('') : v);
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="color"
          value={valid ? expand(value) : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 44, height: 38, padding: 2, cursor: 'pointer' }}
          aria-label={label + ': выбрать цвет'}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#FFF1E8"
          style={{ flex: 1, minWidth: 0 }}
          aria-label={label + ': HEX'}
        />
      </div>
      {!valid && <div className="hint" style={{ color: 'var(--danger)' }}>Формат #RGB или #RRGGBB</div>}
    </div>
  );
}

function BadgeForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isNew = !initial.id;

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const valid = form.label.trim() !== '' && HEX_RE.test(form.bgColor) && HEX_RE.test(form.textColor);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        label: form.label.trim(),
        icon: form.icon.trim(),
        bgColor: form.bgColor.trim(),
        textColor: form.textColor.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive !== false,
      };
      if (isNew) await api.createBadge(payload);
      else await api.updateBadge(form.id, payload);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>
        {isNew ? 'Новый бейдж' : 'Редактирование бейджа'}
      </h3>

      {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="badge-label">Текст</label>
          <input
            id="badge-label"
            type="text"
            value={form.label}
            onChange={(e) => set('label', e.target.value)}
            placeholder="например, Сочные"
            maxLength={40}
          />
          <div className="hint">Коротко: на карточке помещается два-три слова.</div>
        </div>

        <div className="field">
          <label htmlFor="badge-icon">Эмодзи (необязательно)</label>
          <input
            id="badge-icon"
            type="text"
            value={form.icon}
            onChange={(e) => set('icon', e.target.value)}
            placeholder="🍓"
            maxLength={8}
          />
          <div className="hint">Оставьте пустым — бейдж будет только с текстом.</div>
        </div>

        <ColorField label="Цвет фона" value={form.bgColor} onChange={(v) => set('bgColor', v)} />
        <ColorField label="Цвет текста" value={form.textColor} onChange={(v) => set('textColor', v)} />

        <div className="field">
          <label htmlFor="badge-order">Порядок</label>
          <input
            id="badge-order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
            style={{ width: 120 }}
          />
          <div className="hint">Меньше — выше в списке бейджей.</div>
        </div>

        <div className="field">
          <label>Показывать в приложении</label>
          <button
            type="button"
            className={`switch${form.isActive !== false ? ' is-on' : ''}`}
            role="switch"
            aria-checked={form.isActive !== false}
            onClick={() => set('isActive', form.isActive === false)}
          >
            <span className="switch-knob" />
            <span className="switch-text">{form.isActive !== false ? 'ON' : 'OFF'}</span>
          </button>
          <div className="hint">
            Выключенный бейдж остаётся назначенным товарам, но не показывается покупателю.
          </div>
        </div>
      </div>

      {/* Предпросмотр крупно — чтобы оценить читаемость цветов — и в
          реальный размер, каким его увидит покупатель на карточке. */}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <div className="hint" style={{ marginBottom: 8 }}>Предпросмотр</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <BadgePreview badge={form} scale={2} />
          <span className="hint">в реальном размере на карточке:</span>
          <BadgePreview badge={form} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button className="btn-primary" onClick={save} disabled={!valid || saving}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <button className="btn-secondary" onClick={onCancel} disabled={saving}>Отмена</button>
      </div>
    </div>
  );
}

export default function Badges() {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    api.getBadges().then(setItems).catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const toggleActive = async (b) => {
    setBusyId(b.id);
    setError('');
    try {
      await api.updateBadge(b.id, { isActive: !b.isActive });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  // Число товаров показываем ДО подтверждения: удаление снимает бейдж со
  // всех карточек разом, и человек должен понимать масштаб.
  const remove = async (b) => {
    const used = b.productCount > 0
      ? `Бейдж «${b.label}» используется у ${b.productCount} товаров.\n\nУдалить бейдж? Привязки будут удалены, товары останутся.`
      : `Бейдж «${b.label}» не используется ни одним товаром.\n\nУдалить?`;
    if (!window.confirm(used)) return;
    setBusyId(b.id);
    setError('');
    try {
      await api.deleteBadge(b.id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (items === null && error) return <div className="alert error">{error}</div>;
  if (items === null) return <div className="loading">Загрузка…</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Бейджи товаров</h2>
        {!editing && (
          <button className="btn-primary" onClick={() => setEditing({ ...EMPTY_BADGE })}>+ Создать бейдж</button>
        )}
      </div>

      <div className="section-hint">
        Плашки, которые видно на карточке товара поверх фотографии. Создайте бейдж здесь, а назначить его
        товару можно в карточке товара — раздел «Товары», блок «Бейджи».
        <br />
        Это только оформление: на подборки Главной, «Хиты недели» и фильтры бейджи не влияют.
      </div>

      {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}

      {editing && (
        <BadgeForm
          key={editing.id || 'new'}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {items.length === 0 ? (
        <div className="empty-hint">
          Бейджей пока нет.
          <br />
          Нажмите «Создать бейдж» — например, «Сочные» с эмодзи 🍓.
        </div>
      ) : (
        <table className="product-table">
          <thead>
            <tr>
              <th style={{ width: 200 }}>Бейдж</th>
              <th>Цвета</th>
              <th style={{ width: 90 }}>Порядок</th>
              <th style={{ width: 150 }}>Показывать</th>
              <th>Используется</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} style={{ opacity: b.isActive ? 1 : 0.55 }}>
                <td><BadgePreview badge={b} scale={1.6} /></td>
                <td className="hint" style={{ whiteSpace: 'nowrap' }}>
                  фон {b.bgColor}<br />текст {b.textColor}
                </td>
                <td>{b.sortOrder}</td>
                <td>
                  <button
                    type="button"
                    className={`switch${b.isActive ? ' is-on' : ''}`}
                    role="switch"
                    aria-checked={b.isActive}
                    aria-label={`Показывать бейдж «${b.label}»`}
                    onClick={() => toggleActive(b)}
                    disabled={busyId === b.id}
                  >
                    <span className="switch-knob" />
                    <span className="switch-text">{b.isActive ? 'ON' : 'OFF'}</span>
                  </button>
                </td>
                <td className="hint">
                  {b.productCount > 0 ? `${b.productCount} товаров` : 'нигде'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={() => setEditing({ ...EMPTY_BADGE, ...b, icon: b.icon || '' })}>
                      Изменить
                    </button>
                    <button className="btn-danger" onClick={() => remove(b)} disabled={busyId === b.id}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
