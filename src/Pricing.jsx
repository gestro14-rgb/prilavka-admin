import { useEffect, useState } from 'react';
import { api } from './api';

// Единая форма, не по-полю, как Settings.jsx — эти 5 чисел составляют один
// взаимосвязанный расчёт (см. pricingCalc.js), сохранять их по отдельности
// смысла нет.
const FIELDS = [
  {
    key: 'fixedCostsMonthly',
    label: 'Постоянные расходы в месяц',
    unit: '₽',
    hint: 'Аренда + зарплата + прочие постоянные траты одной суммой — просуммируйте сами перед вводом.',
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
    key: 'defaultMarginPercent',
    label: 'Желаемая маржа по умолчанию',
    unit: '%',
    hint: 'Насколько сверх полной себестоимости (закупка + упаковка + доля постоянных расходов) вы хотите зарабатывать. 25 значит цена на 25% выше себестоимости.',
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
      )}
    </div>
  );
}
