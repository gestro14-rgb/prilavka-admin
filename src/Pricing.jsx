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
    hint: 'Сколько заказов/продаж вы рассчитываете делать в месяц — на это число делятся постоянные расходы, чтобы получить долю на заказ.',
  },
  {
    key: 'avgItemsPerOrder',
    label: 'Среднее число товаров в заказе',
    unit: 'шт',
    hint: 'Сколько в среднем разных товаров покупают в одном заказе. Используется, чтобы правильно разделить постоянные расходы между товарами внутри заказа, а не относить их целиком к каждому товару.',
    nullable: true,
    min: 1,
    step: 1,
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

// null (не заполнено, см. migrations/035 — avgItemsPerOrder) → пустая
// строка в поле, а не "0", чтобы не выглядело как осознанно введённый ноль.
const toDisplayValue = (v) => (v == null ? '' : String(v));

export default function Pricing() {
  const [values, setValues] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPricingSettings()
      .then((data) => {
        setValues(Object.fromEntries(FIELDS.map((f) => [f.key, toDisplayValue(data[f.key])])));
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
      const payload = Object.fromEntries(FIELDS.map((f) => {
        if (f.nullable) {
          return [f.key, values[f.key] === '' ? null : Number(values[f.key]) || null];
        }
        return [f.key, Number(values[f.key]) || 0];
      }));
      const updated = await api.updatePricingSettings(payload);
      setValues(Object.fromEntries(FIELDS.map((f) => [f.key, toDisplayValue(updated[f.key])])));
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
  const avgItemsPerOrder = Number(values.avgItemsPerOrder) || 0;
  const fixedCostPerItem = fixedCostPerOrder != null && avgItemsPerOrder > 0
    ? fixedCostPerOrder / avgItemsPerOrder
    : null;

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
                      min={f.min ?? 0}
                      step={f.step ?? 'any'}
                      value={values[f.key]}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                      placeholder={f.nullable ? 'не настроено' : undefined}
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
              <div>
                Постоянных расходов на товар (при среднем чеке из {avgItemsPerOrder > 0 ? avgItemsPerOrder : '—'} позиций):{' '}
                <b>{fixedCostPerItem != null ? `${fixedCostPerItem.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽` : '—'}</b>
              </div>
              <div>Средний % списаний: <b>{(Number(values.wastePercent) || 0).toLocaleString('ru-RU')}%</b></div>
            </div>
            {plannedSales <= 0 && (
              <div className="hint" style={{ marginTop: 10 }}>
                Укажите планируемое число продаж в месяц — без него доля постоянных расходов не считается.
              </div>
            )}
            {plannedSales > 0 && avgItemsPerOrder <= 0 && (
              <div className="hint" style={{ marginTop: 10 }}>
                Укажите среднее число товаров в заказе — без него расходы на товар не считаются
                (и рекомендуемая цена на карточках товаров тоже не появится).
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
