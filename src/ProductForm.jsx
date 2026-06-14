import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from './api';

const EMPTY_PRODUCT = {
  id: '',
  title: '',
  price: 0,
  weight: '',
  emoji: '🥕',
  bg: 'linear-gradient(135deg, #F4F7F2, #fff)',
  category: 'vegetables',
  badge: null,
  composition: [],
  suppliers: [],
  pricing: [],
  isActive: true,
  sortOrder: 0,
};

const BADGE_TYPES = [
  { value: '', label: 'Без метки' },
  { value: 'popular', label: 'Чаще берут' },
  { value: 'deal', label: 'Выгодно' },
  { value: 'hit', label: 'Хит' },
];

const CATEGORIES = [
  { value: 'bundles', label: 'Наборы' },
  { value: 'vegetables', label: 'Овощи' },
  { value: 'fruits', label: 'Фрукты' },
  { value: 'greens', label: 'Зелень' },
];

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    api
      .getProduct(id)
      .then((p) =>
        setForm({
          ...p,
          badge: p.badge || null,
        })
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateBadgeField = (field, value) => {
    setForm((prev) => {
      const badge = prev.badge || { type: '', label: '' };
      return { ...prev, badge: { ...badge, [field]: value } };
    });
  };

  // ===== Composition (состав набора) =====
  const updateCompositionItem = (index, field, value) => {
    setForm((prev) => {
      const composition = [...prev.composition];
      const row = [...(composition[index] || ['', ''])];
      row[field] = value;
      composition[index] = row;
      return { ...prev, composition };
    });
  };
  const addCompositionItem = () => {
    setForm((prev) => ({ ...prev, composition: [...prev.composition, ['', '']] }));
  };
  const removeCompositionItem = (index) => {
    setForm((prev) => ({
      ...prev,
      composition: prev.composition.filter((_, i) => i !== index),
    }));
  };

  // ===== Suppliers (поставщики) =====
  const updateSupplier = (index, field, value) => {
    setForm((prev) => {
      const suppliers = [...prev.suppliers];
      suppliers[index] = { ...suppliers[index], [field]: value };
      return { ...prev, suppliers };
    });
  };
  const addSupplier = () => {
    setForm((prev) => ({
      ...prev,
      suppliers: [...prev.suppliers, { emoji: '🧑‍🌾', name: '', region: '', note: '' }],
    }));
  };
  const removeSupplier = (index) => {
    setForm((prev) => ({
      ...prev,
      suppliers: prev.suppliers.filter((_, i) => i !== index),
    }));
  };

  // ===== Pricing (структура цены) =====
  const updatePricingItem = (index, field, value) => {
    setForm((prev) => {
      const pricing = [...prev.pricing];
      const item = { ...pricing[index], [field]: value };
      pricing[index] = item;
      return { ...prev, pricing };
    });
  };
  const addPricingItem = () => {
    setForm((prev) => ({
      ...prev,
      pricing: [
        ...prev.pricing,
        { label: '', sub: '', pct: 0, amount: 0, color: '#5C8A52' },
      ],
    }));
  };
  const removePricingItem = (index) => {
    setForm((prev) => ({
      ...prev,
      pricing: prev.pricing.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.id.trim() || !form.title.trim() || !form.category) {
      setError('Заполните обязательные поля: ID, название, категория');
      return;
    }

    const payload = {
      ...form,
      price: Number(form.price) || 0,
      sortOrder: Number(form.sortOrder) || 0,
      badge: form.badge && form.badge.type ? form.badge : null,
      composition: form.composition.filter((row) => row[0] || row[1]),
      suppliers: form.suppliers.filter((s) => s.name),
      pricing: form.pricing.map((p) => ({
        ...p,
        pct: Number(p.pct) || 0,
        amount: Number(p.amount) || 0,
      })),
    };

    setSaving(true);
    try {
      if (isNew) {
        await api.createProduct(payload);
      } else {
        await api.updateProduct(id, payload);
      }
      navigate('/products');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Загрузка…</div>;

  return (
    <div>
      <div className="page-header">
        <h2>{isNew ? 'Новый товар' : `Редактирование: ${form.title}`}</h2>
      </div>

      {error && <div className="alert error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: 24 }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="id">ID товара</label>
              <input
                id="id"
                type="text"
                value={form.id}
                onChange={(e) => updateField('id', e.target.value)}
                disabled={!isNew}
                placeholder="например, tomato"
                required
              />
              <div className="hint">
                {isNew
                  ? 'Латиницей, без пробелов. Используется во ссылках, изменить позже нельзя.'
                  : 'ID товара изменить нельзя после создания.'}
              </div>
            </div>

            <div className="field">
              <label htmlFor="title">Название</label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="например, Томаты семейные"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="price">Цена, ₽</label>
              <input
                id="price"
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => updateField('price', e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="weight">Вес / описание объёма</label>
              <input
                id="weight"
                type="text"
                value={form.weight}
                onChange={(e) => updateField('weight', e.target.value)}
                placeholder="например, 1 кг, сорт Сливка"
              />
            </div>

            <div className="field">
              <label htmlFor="category">Категория</label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="emoji">Эмодзи (картинка товара)</label>
              <input
                id="emoji"
                type="text"
                value={form.emoji}
                onChange={(e) => updateField('emoji', e.target.value)}
                placeholder="🥕"
              />
            </div>

            <div className="field">
              <label htmlFor="bg">Фон карточки (CSS)</label>
              <input
                id="bg"
                type="text"
                value={form.bg}
                onChange={(e) => updateField('bg', e.target.value)}
                placeholder="linear-gradient(135deg, #FCE9E6, #fff)"
              />
              <div className="hint">Градиент или цвет фона за эмодзи на карточке товара.</div>
            </div>

            <div className="field">
              <label htmlFor="sortOrder">Порядок сортировки</label>
              <input
                id="sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={(e) => updateField('sortOrder', e.target.value)}
              />
              <div className="hint">Меньше число — выше в каталоге.</div>
            </div>

            <div className="field checkbox-field full">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => updateField('isActive', e.target.checked)}
              />
              <label htmlFor="isActive">Показывать товар в приложении</label>
            </div>
          </div>

          <div className="section-label">Метка на карточке (опционально)</div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="badgeType">Тип метки</label>
              <select
                id="badgeType"
                value={form.badge?.type || ''}
                onChange={(e) => updateBadgeField('type', e.target.value)}
              >
                {BADGE_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="badgeLabel">Текст метки</label>
              <input
                id="badgeLabel"
                type="text"
                value={form.badge?.label || ''}
                onChange={(e) => updateBadgeField('label', e.target.value)}
                placeholder="например, Хит"
                disabled={!form.badge?.type}
              />
            </div>
          </div>

          <div className="section-label">Состав набора</div>
          <div className="repeat-list">
            {form.composition.map((row, i) => (
              <div className="repeat-row" key={i}>
                <div className="field">
                  <label>Ингредиент</label>
                  <input
                    type="text"
                    value={row[0] || ''}
                    onChange={(e) => updateCompositionItem(i, 0, e.target.value)}
                    placeholder="например, Морковь"
                  />
                </div>
                <div className="field">
                  <label>Количество</label>
                  <input
                    type="text"
                    value={row[1] || ''}
                    onChange={(e) => updateCompositionItem(i, 1, e.target.value)}
                    placeholder="например, 0.5 кг"
                  />
                </div>
                <button type="button" className="remove-btn" onClick={() => removeCompositionItem(i)}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="add-row-btn" onClick={addCompositionItem}>
              + Добавить ингредиент
            </button>
          </div>

          <div className="section-label">Поставщики</div>
          <div className="repeat-list">
            {form.suppliers.map((s, i) => (
              <div className="repeat-row" key={i}>
                <div className="field" style={{ flex: '0 0 80px' }}>
                  <label>Эмодзи</label>
                  <input
                    type="text"
                    value={s.emoji || ''}
                    onChange={(e) => updateSupplier(i, 'emoji', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Имя поставщика</label>
                  <input
                    type="text"
                    value={s.name || ''}
                    onChange={(e) => updateSupplier(i, 'name', e.target.value)}
                    placeholder="например, Сергей Иванов"
                  />
                </div>
                <div className="field">
                  <label>Регион</label>
                  <input
                    type="text"
                    value={s.region || ''}
                    onChange={(e) => updateSupplier(i, 'region', e.target.value)}
                    placeholder="например, Краснодарский край"
                  />
                </div>
                <div className="field">
                  <label>Примечание</label>
                  <input
                    type="text"
                    value={s.note || ''}
                    onChange={(e) => updateSupplier(i, 'note', e.target.value)}
                    placeholder="например, собрано вчера"
                  />
                </div>
                <button type="button" className="remove-btn" onClick={() => removeSupplier(i)}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="add-row-btn" onClick={addSupplier}>
              + Добавить поставщика
            </button>
          </div>

          <div className="section-label">Из чего складывается цена</div>
          <div className="repeat-list">
            {form.pricing.map((p, i) => (
              <div className="repeat-row" key={i}>
                <div className="field">
                  <label>Статья</label>
                  <input
                    type="text"
                    value={p.label || ''}
                    onChange={(e) => updatePricingItem(i, 'label', e.target.value)}
                    placeholder="например, Поставщику"
                  />
                </div>
                <div className="field">
                  <label>Пояснение</label>
                  <input
                    type="text"
                    value={p.sub || ''}
                    onChange={(e) => updatePricingItem(i, 'sub', e.target.value)}
                    placeholder="например, фермер получает напрямую"
                  />
                </div>
                <div className="field" style={{ flex: '0 0 90px' }}>
                  <label>Процент</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={p.pct}
                    onChange={(e) => updatePricingItem(i, 'pct', e.target.value)}
                  />
                </div>
                <div className="field" style={{ flex: '0 0 100px' }}>
                  <label>Сумма, ₽</label>
                  <input
                    type="number"
                    min="0"
                    value={p.amount}
                    onChange={(e) => updatePricingItem(i, 'amount', e.target.value)}
                  />
                </div>
                <div className="field" style={{ flex: '0 0 100px' }}>
                  <label>Цвет</label>
                  <input
                    type="text"
                    value={p.color || ''}
                    onChange={(e) => updatePricingItem(i, 'color', e.target.value)}
                    placeholder="#5C8A52"
                  />
                </div>
                <button type="button" className="remove-btn" onClick={() => removePricingItem(i)}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="add-row-btn" onClick={addPricingItem}>
              + Добавить статью
            </button>
            <div className="hint">Сумма процентов обычно должна равняться 100%.</div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/products')}
            disabled={saving}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
