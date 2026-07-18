import { useEffect, useState } from 'react';
import { api } from './api';

// Единая форма, не по-полю, как Settings.jsx — эти числа составляют один
// взаимосвязанный расчёт (см. pricingCalc.js), сохранять их по отдельности
// смысла нет.
const FIELDS = [
  {
    key: 'rentMonthly',
    label: 'Аренда в месяц',
    unit: '₽',
    hint: 'Ежемесячная аренда помещения.',
  },
  {
    key: 'salaryMonthly',
    label: 'Зарплаты в месяц',
    unit: '₽',
    hint: 'Фонд оплаты труда за месяц — все постоянные сотрудники.',
  },
  {
    key: 'otherCostsMonthly',
    label: 'Прочие постоянные расходы',
    unit: '₽',
    hint: 'Всё остальное, что не аренда и не зарплаты (связь, бухгалтерия, реклама и т.п.) — одной суммой.',
  },
  {
    key: 'plannedSalesMonthly',
    label: 'Планируемое число продаж в месяц',
    unit: 'шт',
    hint: 'Сколько заказов/продаж вы рассчитываете делать в месяц — на это число делятся постоянные расходы, чтобы получить долю на единицу товара.',
  },
  {
    key: 'packagingCostPerUnit',
    label: 'Упаковка на единицу товара',
    unit: '₽',
    hint: 'Средняя стоимость упаковки одного товара — пакет, коробка, стикер и т.п.',
  },
  {
    key: 'acquiringPercent',
    label: 'Комиссия эквайринга',
    unit: '%',
    hint: 'Процент, который банк или платёжный провайдер удерживает с каждой продажи — уточните у своего эквайера или в договоре на приём платежей.',
  },
  {
    key: 'wastePercent',
    label: 'Процент списаний',
    unit: '%',
    hint: 'Какая доля товара в среднем портится и не продаётся. Для свежих продуктов обычно 3-10%. Эта потеря закладывается в цену проданного товара.',
  },
  {
    key: 'defaultMarginPercent',
    label: 'Желаемая маржа по умолчанию',
    unit: '%',
    hint: 'Насколько сверх полной себестоимости (закупка + упаковка + доля постоянных расходов, с поправкой на списания) вы хотите зарабатывать. 25 значит цена на 25% выше себестоимости.',
  },
];

const EMPTY = Object.fromEntries(FIELDS.map((f) => [f.key, '']));

export default function Pricing() {
  const [values, setValues] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPricingSettings()
      .then((data) => {
        setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(data[f.key] ?? 0)])));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key]) || 0]));
      const updated = await api.updatePricingSettings(payload);
      setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(updated[f.key] ?? 0)])));
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Сводка-проверка — считается прямо из полей формы (ещё до сохранения),
  // чтобы админ сразу увидел, если ввёл цифру с лишним нулём.
  const rent = Number(values.rentMonthly) || 0;
  const salary = Number(values.salaryMonthly) || 0;
  const other = Number(values.otherCostsMonthly) || 0;
  const totalFixedCosts = rent + salary + other;
  const plannedSales = Number(values.plannedSalesMonthly) || 0;
  const fixedCostPerOrder = plannedSales > 0 ? totalFixedCosts / plannedSales : null;

  return (
    <div>
      <div className="page-header">
        <h2>Ценообразование</h2>
      </div>

      {error && <div className="alert error">{error}</div>}
      {saved && <div className="alert success">Настройки сохранены</div>}

      {loading ? (
        <div className="loading">Загрузка…</div>
      ) : (
        <>
          <form className="card" style={{ padding: '20px 24px' }} onSubmit={handleSubmit}>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 18, lineHeight: 1.5 }}>
              Эти цифры используются для расчёта рекомендуемой цены и цены безубыточности
              на карточке товара — там, где заполнена закупочная цена.
            </div>

            <div className="form-grid">
              {FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={values[f.key]}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                      style={{ paddingRight: 40 }}
                    />
                    <span style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 13, color: 'var(--ink-soft)', pointerEvents: 'none',
                    }}>
                      {f.unit}
                    </span>
                  </div>
                  <div className="hint">{f.hint}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </form>

          <div className="card" style={{ padding: '20px 24px', marginTop: 16 }}>
            <div className="section-label" style={{ marginTop: 0 }}>Сводка</div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '10px 24px', fontSize: 14,
            }}>
              <div>Общие постоянные расходы: <b>{totalFixedCosts.toLocaleString('ru-RU')} ₽</b></div>
              <div>Заказов в месяц: <b>{plannedSales.toLocaleString('ru-RU')}</b></div>
              <div>
                Постоянных расходов на заказ:{' '}
                <b>{fixedCostPerOrder != null ? `${fixedCostPerOrder.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽` : '—'}</b>
              </div>
              <div>Средний % списаний: <b>{(Number(values.wastePercent) || 0).toLocaleString('ru-RU')}%</b></div>
            </div>
            {plannedSales <= 0 && (
              <div className="hint" style={{ marginTop: 10 }}>
                Укажите планируемое число продаж в месяц — без него доля постоянных расходов не считается.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
