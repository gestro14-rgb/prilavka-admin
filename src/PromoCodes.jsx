import { useEffect, useState } from 'react';
import { api } from './api';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return iso;
  }
}

// В базе условие лежит парой границ номера заказа (миграция 044) — здесь
// собираем из неё человеческую подпись для таблицы. Пары, которые не
// выражаются вариантами селекта (например "только 3-й заказ"), валидны и
// проверяются сервером, поэтому показываем их общей формулировкой, а не "—".
function formatOrderCondition(p) {
  const { minOrderNumber: min, maxOrderNumber: max } = p;
  if (min == null && max == null) return 'Любой заказ';
  if (min == null && max === 1) return 'Только первый';
  if (min === 2 && max == null) return 'Только повторный';
  if (min == null) return `Первые ${max}`;
  if (max == null) return `С ${min}-го и далее`;
  if (min === max) return `Только ${min}-й`;
  return `С ${min}-го по ${max}-й`;
}

export default function PromoCodes() {
  const [promos, setPromos] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderTotal, setMinOrderTotal] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [orderCondition, setOrderCondition] = useState('any');
  const [orderConditionN, setOrderConditionN] = useState('');

  const load = () => {
    api
      .getPromoCodes()
      .then(setPromos)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!code.trim() || !discountValue) {
      setError('Укажите код и размер скидки');
      return;
    }
    if (orderCondition === 'first_n_orders' && !(Number(orderConditionN) >= 1)) {
      setError('Укажите, на сколько первых заказов действует промокод');
      return;
    }
    setSaving(true);
    try {
      await api.createPromoCode({
        code: code.trim(),
        discountType,
        discountValue: Number(discountValue),
        minOrderTotal: minOrderTotal ? Number(minOrderTotal) : 0,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        orderCondition,
        orderConditionN: orderCondition === 'first_n_orders' ? Number(orderConditionN) : null,
      });
      setSuccess('Промокод создан');
      setCode('');
      setDiscountValue('');
      setMinOrderTotal('');
      setExpiresAt('');
      setOrderCondition('any');
      setOrderConditionN('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот промокод?')) return;
    setError('');
    try {
      await api.deletePromoCode(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Промокоды</h2>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="promoCode">Код</label>
              <input
                id="promoCode"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="например, WELCOME200"
              />
            </div>
            <div className="field">
              <label htmlFor="promoType">Тип скидки</label>
              <select id="promoType" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="fixed">Фиксированная сумма (₽)</option>
                <option value="percent">Процент (%)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="promoValue">{discountType === 'percent' ? 'Скидка, %' : 'Скидка, ₽'}</label>
              <input
                id="promoValue"
                type="number"
                min="1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? 'например, 10' : 'например, 200'}
              />
            </div>
            <div className="field">
              <label htmlFor="promoMin">Мин. сумма заказа, ₽ (необязательно)</label>
              <input
                id="promoMin"
                type="number"
                min="0"
                value={minOrderTotal}
                onChange={(e) => setMinOrderTotal(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="field">
              <label htmlFor="promoExpires">Действует до (необязательно)</label>
              <input
                id="promoExpires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="promoOrderCondition">На какой по счёту заказ</label>
              <select
                id="promoOrderCondition"
                value={orderCondition}
                onChange={(e) => setOrderCondition(e.target.value)}
              >
                <option value="any">Любой заказ</option>
                <option value="first_order">Только первый заказ</option>
                <option value="repeat_order">Только повторный (от 2-го)</option>
                <option value="first_n_orders">Первые N заказов</option>
              </select>
            </div>
            {orderCondition === 'first_n_orders' && (
              <div className="field">
                <label htmlFor="promoOrderConditionN">Сколько первых заказов (N)</label>
                <input
                  id="promoOrderConditionN"
                  type="number"
                  min="1"
                  value={orderConditionN}
                  onChange={(e) => setOrderConditionN(e.target.value)}
                  placeholder="например, 3"
                />
              </div>
            )}
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Создание…' : 'Создать промокод'}
            </button>
          </div>
        </form>
      </div>

      {promos === null ? (
        <div className="loading">Загрузка…</div>
      ) : promos.length === 0 ? (
        <div className="card">
          <div className="empty-hint">Пока нет промокодов.</div>
        </div>
      ) : (
        <table className="product-table">
          <thead>
            <tr>
              <th>Код</th>
              <th>Скидка</th>
              <th>Мин. сумма</th>
              <th>По счёту</th>
              <th>Статус</th>
              <th>Действует до</th>
              <th>Создан</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id}>
                <td><b>{p.code}</b></td>
                <td>{p.discountType === 'percent' ? `${p.discountValue}%` : `${p.discountValue.toLocaleString('ru-RU')} ₽`}</td>
                <td>{p.minOrderTotal ? `${p.minOrderTotal.toLocaleString('ru-RU')} ₽` : '—'}</td>
                <td>{formatOrderCondition(p)}</td>
                <td>{p.isUsed ? `Использован ${formatDate(p.usedAt)}` : 'Активен'}</td>
                <td>{p.expiresAt ? formatDate(p.expiresAt) : '—'}</td>
                <td>{formatDate(p.createdAt)}</td>
                <td>
                  <button className="btn-danger" onClick={() => handleDelete(p.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
