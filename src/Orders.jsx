import { useEffect, useState } from 'react';
import { api } from './api';

const STATUS_LABELS = {
  new: 'Новый',
  in_progress: 'В работе',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

const PAYMENT_LABELS = {
  cash: 'При получении',
  online: 'Онлайн',
};

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return iso;
  }
}

function formatAddressDetails(details) {
  if (!details) return '';
  const parts = [
    details.entrance && `подъезд ${details.entrance}`,
    details.floor && `этаж ${details.floor}`,
    details.apartment && `кв. ${details.apartment}`,
    details.intercom && `домофон ${details.intercom}`,
  ].filter(Boolean);
  return parts.join(', ');
}

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const load = () => {
    api
      .getOrders()
      .then(setOrders)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (id, status) => {
    setUpdatingId(id);
    setError('');
    try {
      await api.updateOrder(id, { status });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Заказы</h2>
      </div>

      {error && <div className="alert error">{error}</div>}

      {orders === null ? (
        <div className="loading">Загрузка…</div>
      ) : orders.length === 0 ? (
        <div className="card">
          <div className="empty-hint">Пока нет заказов.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {orders.map((o) => (
            <div className="card" style={{ padding: 20 }} key={o.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>Заказ #{o.id}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{formatDate(o.createdAt)}</div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{Number(o.total).toLocaleString('ru-RU')} ₽</div>
              </div>

              <div className="section-label" style={{ marginTop: 0 }}>Состав</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 12 }}>
                {o.items.map((item, i) => (
                  <div key={i}>{item.title} × {item.qty} — {Number(item.sum).toLocaleString('ru-RU')} ₽</div>
                ))}
                {o.promoCode && o.discountAmount > 0 && (
                  <div>🎁 Промокод {o.promoCode} (−{Number(o.discountAmount).toLocaleString('ru-RU')} ₽)</div>
                )}
              </div>

              <div className="section-label">Доставка</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 12 }}>
                <div>
                  {o.deliveryDate ? `${o.deliveryDate.day || ''} ${o.deliveryDate.date || ''}`.trim() : '—'}
                  {o.deliverySlot ? `, ${o.deliverySlot}` : ''}
                </div>
                <div>{o.addressStreet || 'Адрес не указан'}</div>
                {o.addressDetails && <div>{formatAddressDetails(o.addressDetails)}</div>}
                {o.addressDetails?.comment && <div>💬 {o.addressDetails.comment}</div>}
                {o.comment && <div>💬 Комментарий к заказу: {o.comment}</div>}
              </div>

              <div className="section-label">Покупатель и оплата</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 16 }}>
                <div>
                  {[o.telegramFirstName, o.telegramUsername ? `@${o.telegramUsername}` : null].filter(Boolean).join(' ') || '—'}
                </div>
                <div>{PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Статус
                </span>
                <select
                  value={o.status}
                  onChange={(e) => handleStatusChange(o.id, e.target.value)}
                  disabled={updatingId === o.id}
                  style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 13, fontWeight: 700 }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
