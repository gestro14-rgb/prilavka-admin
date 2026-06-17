import { useEffect, useState } from 'react';
import { api } from './api';

const STATUS_LABELS = {
  new: 'Новые',
  in_progress: 'В работе',
  delivered: 'Доставлены',
  cancelled: 'Отменены',
};

function fmt(n) {
  return Number(n).toLocaleString('ru-RU');
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      className="card"
      style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent || 'var(--ink)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>{sub}</div>
      )}
    </div>
  );
}

function RevenueChart({ days }) {
  if (!days || days.length === 0) {
    return <div className="empty-hint">Нет данных за последние 7 дней</div>;
  }

  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 4px' }}>
      {days.map((d) => {
        const pct = Math.round((d.revenue / maxRevenue) * 100);
        const label = new Date(d.day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        return (
          <div
            key={d.day}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--ink-soft)',
                whiteSpace: 'nowrap',
              }}
            >
              {fmt(d.revenue)} ₽
            </div>
            <div
              style={{
                width: '100%',
                height: `${Math.max(pct, 4)}%`,
                background: 'var(--accent)',
                borderRadius: 6,
                minHeight: 4,
              }}
            />
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!stats) return <div className="loading">Загрузка…</div>;

  const totalOrders = Object.values(stats.ordersByStatus).reduce((s, n) => s + n, 0);

  return (
    <div>
      <div className="page-header">
        <h2>📊 Статистика</h2>
      </div>

      {/* Основные метрики */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          label="Выручка (доставлено)"
          value={`${fmt(stats.totalRevenue)} ₽`}
          accent="var(--accent)"
        />
        <StatCard
          label="Всего заказов"
          value={fmt(totalOrders)}
        />
        <StatCard
          label="Пользователей"
          value={fmt(stats.usersCount)}
        />
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <StatCard
            key={key}
            label={label}
            value={fmt(stats.ordersByStatus[key] || 0)}
          />
        ))}
      </div>

      {/* Топ-5 товаров */}
      <div className="section-label">Топ-5 товаров по продажам</div>
      <div className="card" style={{ marginBottom: 32 }}>
        <table className="product-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Товар</th>
              <th style={{ textAlign: 'right' }}>Продано (шт.)</th>
            </tr>
          </thead>
          <tbody>
            {stats.topProducts.length === 0 ? (
              <tr>
                <td colSpan={3} className="empty-hint">Нет данных</td>
              </tr>
            ) : (
              stats.topProducts.map((p, i) => (
                <tr key={p.title}>
                  <td style={{ color: 'var(--ink-soft)', fontWeight: 700, width: 40 }}>{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{p.title}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 16 }}>{fmt(p.totalQty)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Выручка за 7 дней */}
      <div className="section-label">Выручка за последние 7 дней</div>
      <div className="card" style={{ padding: 24 }}>
        <RevenueChart days={stats.revenueByDay} />
      </div>
    </div>
  );
}
