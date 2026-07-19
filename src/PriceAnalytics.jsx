import { useEffect, useState } from 'react';
import { api } from './api';
import { calcPricing, calcCurrentPriceMargin, effectivePurchaseCost, pricingStatus } from './pricingCalc';

// Аналитика цен по каталогу — считается на лету при открытии страницы из
// уже существующих данных (товары + подкатегории + настройки ценообразования),
// ничего не пишет в БД и не имеет кнопки массового пересчёта (сознательно).
// Учитываются все товары с заполненной закупочной ценой, включая скрытые
// (is_active = false) — закупка у них есть, значит экономика тоже.

const STATUS_COLOR = { green: '#1C8F1C', yellow: '#D07812', red: 'var(--danger)' };

function summarize(products, subcategories, settings) {
  // Приоритет маржи (migrations/038): индивидуальная маржа товара → маржа
  // подкатегории → глобальная из настроек; товар без подкатегории пропускает
  // средний уровень (в карте его просто нет → null).
  const marginBySubcategory = Object.fromEntries(
    subcategories.map((sc) => [sc.id, sc.targetMarginPercent])
  );

  const s = {
    withPurchase: 0,   // всего товаров с заполненной закупкой
    missingWeight: 0,  // закупка за кг, но вес для расчёта не заполнен — посчитать нельзя
    loss: 0,           // текущая цена < безубытка
    thin: 0,           // между безубытком и рекомендуемой
    good: 0,           // ≥ рекомендуемой
    avgMargin: null,   // средняя маржа по текущим ценам (та же база, что в форме товара)
    settingsError: null,
  };

  for (const p of products) {
    if (p.purchasePrice == null) continue;
    s.withPurchase += 1;

    const cost = effectivePurchaseCost({
      purchasePrice: p.purchasePrice,
      pricingUnit: p.pricingUnit,
      weightKg: p.weightKg,
    });
    if (cost == null) {
      s.missingWeight += 1;
      continue;
    }

    const result = calcPricing({
      purchasePrice: cost,
      settings,
      productMarginPercent: p.individualMarginPercent ?? null,
      subcategoryMarginPercent: p.subcategoryId != null ? (marginBySubcategory[p.subcategoryId] ?? null) : null,
    });
    if (result.error) {
      // Настройки неполные — ошибка одна и та же для всех товаров, дальше
      // считать нечего.
      s.settingsError = result.error;
      return s;
    }

    const status = pricingStatus(p.price, result);
    if (status === 'red') s.loss += 1;
    else if (status === 'yellow') s.thin += 1;
    else s.good += 1;

    const { marginPercent } = calcCurrentPriceMargin(p.price, result);
    s.avgMargin = s.avgMargin == null
      ? { sum: marginPercent, count: 1 }
      : { sum: s.avgMargin.sum + marginPercent, count: s.avgMargin.count + 1 };
  }

  if (s.avgMargin != null) s.avgMargin = s.avgMargin.sum / s.avgMargin.count;
  return s;
}

function StatCard({ label, value, color, hint }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)', fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: color || 'var(--ink)', marginTop: 4 }}>
        {value}
      </div>
      {hint && <div className="hint" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default function PriceAnalytics() {
  const [data, setData] = useState(null); // { products, subcategories, settings }
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getProducts(), api.getSubcategories(), api.getPricingSettings()])
      .then(([products, subcategories, settings]) => setData({ products, subcategories, settings }))
      .catch((e) => setError(e.message));
  }, []);

  const summary = data ? summarize(data.products, data.subcategories, data.settings) : null;
  const computable = summary ? summary.loss + summary.thin + summary.good : 0;

  return (
    <div>
      <div className="page-header">
        <h2>Аналитика цен</h2>
      </div>

      {error && <div className="alert error">{error}</div>}

      {!data && !error ? (
        <div className="loading">Загрузка…</div>
      ) : summary && (
        <>
          {summary.settingsError && (
            <div className="alert error">{summary.settingsError}</div>
          )}

          {!summary.settingsError && (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16, marginBottom: 16,
              }}>
                <StatCard
                  label="С заполненной закупкой"
                  value={summary.withPurchase}
                  hint={`из ${data.products.length} товаров в каталоге`}
                />
                <StatCard
                  label="В убытке"
                  value={summary.loss}
                  color={STATUS_COLOR.red}
                  hint="текущая цена ниже безубыточности"
                />
                <StatCard
                  label="Низкая маржа"
                  value={summary.thin}
                  color={STATUS_COLOR.yellow}
                  hint="в плюсе, но ниже рекомендуемой цены"
                />
                <StatCard
                  label="Хорошая маржа"
                  value={summary.good}
                  color={STATUS_COLOR.green}
                  hint="цена не ниже рекомендуемой"
                />
                <StatCard
                  label="Средняя маржа"
                  value={summary.avgMargin != null ? `${summary.avgMargin.toFixed(1)}%` : '—'}
                  hint={computable > 0 ? `по ${computable} товарам с расчётом` : 'нет товаров с расчётом'}
                />
              </div>

              {summary.missingWeight > 0 && (
                <div className="hint" style={{ color: '#D07812', fontWeight: 700, marginBottom: 8 }}>
                  ⚠ У {summary.missingWeight} товар(ов) закупка указана за килограмм, но не заполнен
                  «Вес для расчёта, кг» — они не участвуют в расчёте. Заполните вес в карточке товара.
                </div>
              )}

              <div className="hint">
                Считается при открытии страницы по текущим ценам, закупкам и настройкам
                ценообразования (маржа: товар → подкатегория → общая). Ничего не сохраняется в базу.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
