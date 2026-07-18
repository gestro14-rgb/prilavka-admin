import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from './api';
import ImageUploadField from './ImageUploadField';
import { calcPricing, pricingStatus } from './pricingCalc';

const EMPTY_PRODUCT = {
  id: '',
  slug: '',
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
  inStock: true,
  sortOrder: 0,
  imageUrl: '',
  homeImageUrl: '',
  isBundle: false,
  subcategoryId: null,
  // Nullable — у уже заведённых товаров пусто, пока их не откроют и не
  // заполнят задним числом. '' в форме, null на бэкенде, см. handleSubmit.
  purchasePrice: '',
};

const PRICING_STATUS_COLOR = { green: '#1C8F1C', yellow: '#D07812', red: 'var(--danger)' };
const PRICING_STATUS_LABEL = {
  green: 'Цена ≥ рекомендуемой — хорошая маржа',
  yellow: 'В плюсе, но маржа ниже желаемой',
  red: 'Цена ниже себестоимости — убыток',
};

const fmtRub = (n) => Math.round(n).toLocaleString('ru-RU');

const BADGE_TYPES = [
  { value: '', label: 'Без метки' },
  { value: 'popular', label: 'Чаще берут' },
  { value: 'deal', label: 'Выгодно' },
  { value: 'hit', label: 'Хит' },
];

// 4 предустановленных акцента дизайн-системы (DESIGN.md §1) — не свободный
// RGB-пикер, чтобы не размывать палитру. Пусто = цвет по умолчанию для
// выбранного типа метки (см. HitBadge/EcoBadge/Badge на фронте).
const BADGE_COLORS = [
  { value: '', label: 'По умолчанию' },
  { value: '#1C8F1C', label: 'Зелёный' },
  { value: '#D07812', label: 'Оранжевый' },
  { value: '#153F15', label: 'Тёмно-зелёный' },
  { value: '#5A5550', label: 'Серый' },
];

const CATEGORIES = [
  { value: 'bundles', label: 'Наборы' },
  { value: 'vegetables', label: 'Овощи' },
  { value: 'fruits', label: 'Фрукты' },
  { value: 'greens', label: 'Зелень' },
];

const EMPTY_BUNDLE_ITEM = { id: 'new', itemName: '', itemEmoji: '', alternatives: [], isRemovable: true };

// Пищевая ценность на 100 г — опциональный блок, хранится отдельно от form,
// потому что значения в инпутах должны быть строками (в т.ч. пустыми), а
// в products.nutrition (JSON) — числами или null для составных товаров.
const EMPTY_NUTRITION = { calories: '', protein: '', fat: '', carbs: '' };

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  // Основная форма товара
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Подкатегории — та же связь categories → subcategories, что и в разделе
  // "Подкатегории" админки; список зависит от выбранной категории товара.
  const [subcategories, setSubcategories] = useState([]);
  useEffect(() => {
    api.getSubcategories().then(setSubcategories).catch(() => {});
  }, []);
  const availableSubcategories = subcategories.filter((sc) => sc.categoryId === form.category);

  // Настройки модуля ценообразования (раздел "Ценообразование" в сайдбаре)
  // — грузим один раз, дальше calcPricing() пересчитывается на каждый ввод
  // закупочной цены чисто на фронте, без похода на сервер.
  const [pricingSettings, setPricingSettings] = useState(null);
  const [pricingSettingsError, setPricingSettingsError] = useState('');
  useEffect(() => {
    api.getPricingSettings()
      .then(setPricingSettings)
      .catch((e) => setPricingSettingsError(e.message));
  }, []);

  const purchasePriceNum = form.purchasePrice !== '' && form.purchasePrice != null ? Number(form.purchasePrice) : null;
  const pricingResult = purchasePriceNum != null && pricingSettings
    ? calcPricing({ purchasePrice: purchasePriceNum, settings: pricingSettings })
    : null;
  const pricingIndicatorColor = pricingResult && !pricingResult.error
    ? pricingStatus(Number(form.price) || 0, pricingResult)
    : null;

  // Пищевая ценность на 100 г (опционально)
  const [nutrition, setNutrition] = useState(EMPTY_NUTRITION);

  // Кастомизируемый состав набора
  const [bundleComposition, setBundleComposition] = useState([]);
  const [editingItem, setEditingItem] = useState(null); // null | {...EMPTY_BUNDLE_ITEM}
  const [bundleItemSaving, setBundleItemSaving] = useState(false);
  const [bundleError, setBundleError] = useState('');
  const [newAltName, setNewAltName] = useState('');
  const [newAltEmoji, setNewAltEmoji] = useState('');

  useEffect(() => {
    if (isNew) return;
    api
      .getProduct(id)
      .then((p) => {
        setForm({ ...EMPTY_PRODUCT, ...p, badge: p.badge || null, isBundle: p.isBundle || false, purchasePrice: p.purchasePrice ?? '' });
        setBundleComposition(p.bundleComposition || []);
        setNutrition(
          p.nutrition
            ? {
                calories: p.nutrition.calories ?? '',
                protein: p.nutrition.protein ?? '',
                fat: p.nutrition.fat ?? '',
                carbs: p.nutrition.carbs ?? '',
              }
            : EMPTY_NUTRITION
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // ===== Основные поля =====
  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // Смена категории сбрасывает подкатегорию — иначе останется несовместимая
  // пара (подкатегория другой категории, которую пользователь больше не видит).
  const updateCategory = (value) =>
    setForm((prev) => ({ ...prev, category: value, subcategoryId: null }));

  const updateBadgeField = (field, value) =>
    setForm((prev) => {
      const badge = prev.badge || { type: '', label: '' };
      return { ...prev, badge: { ...badge, [field]: value } };
    });

  const updateNutritionField = (field, value) =>
    setNutrition((prev) => ({ ...prev, [field]: value }));

  // ===== Состав (ингредиенты для ценовой разбивки) =====
  const updateCompositionItem = (index, field, value) =>
    setForm((prev) => {
      const composition = [...prev.composition];
      const row = [...(composition[index] || ['', ''])];
      row[field] = value;
      composition[index] = row;
      return { ...prev, composition };
    });
  const addCompositionItem = () =>
    setForm((prev) => ({ ...prev, composition: [...prev.composition, ['', '']] }));
  const removeCompositionItem = (index) =>
    setForm((prev) => ({ ...prev, composition: prev.composition.filter((_, i) => i !== index) }));

  // ===== Поставщики =====
  const updateSupplier = (index, field, value) =>
    setForm((prev) => {
      const suppliers = [...prev.suppliers];
      suppliers[index] = { ...suppliers[index], [field]: value };
      return { ...prev, suppliers };
    });
  const addSupplier = () =>
    setForm((prev) => ({
      ...prev,
      suppliers: [...prev.suppliers, { emoji: '🧑‍🌾', name: '', region: '', note: '', imageUrl: '' }],
    }));
  const removeSupplier = (index) =>
    setForm((prev) => ({ ...prev, suppliers: prev.suppliers.filter((_, i) => i !== index) }));

  // ===== Ценовая разбивка =====
  const updatePricingItem = (index, field, value) =>
    setForm((prev) => {
      const pricing = [...prev.pricing];
      pricing[index] = { ...pricing[index], [field]: value };
      return { ...prev, pricing };
    });
  const addPricingItem = () =>
    setForm((prev) => ({
      ...prev,
      pricing: [...prev.pricing, { label: '', sub: '', pct: 0, amount: 0, color: '#5C8A52' }],
    }));
  const removePricingItem = (index) =>
    setForm((prev) => ({ ...prev, pricing: prev.pricing.filter((_, i) => i !== index) }));

  // ===== Кастомизируемый состав набора =====
  const startEditBundleItem = (item) => {
    setEditingItem({ ...item, alternatives: item.alternatives ? [...item.alternatives] : [] });
    setNewAltName('');
    setNewAltEmoji('');
    setBundleError('');
  };

  const startAddBundleItem = () => {
    setEditingItem({ ...EMPTY_BUNDLE_ITEM, alternatives: [] });
    setNewAltName('');
    setNewAltEmoji('');
    setBundleError('');
  };

  const cancelEditBundleItem = () => {
    setEditingItem(null);
    setNewAltName('');
    setNewAltEmoji('');
    setBundleError('');
  };

  const saveBundleItem = async () => {
    if (!editingItem?.itemName?.trim()) {
      setBundleError('Укажите название позиции');
      return;
    }
    setBundleItemSaving(true);
    setBundleError('');
    try {
      const data = {
        itemName: editingItem.itemName.trim(),
        itemEmoji: editingItem.itemEmoji || '',
        alternatives: editingItem.alternatives || [],
        isRemovable: editingItem.isRemovable !== false,
        sortOrder: editingItem.sortOrder ?? bundleComposition.length,
      };
      if (editingItem.id === 'new') {
        const newItem = await api.addBundleItem(id, data);
        setBundleComposition((prev) => [...prev, newItem]);
      } else {
        const updated = await api.updateBundleItem(id, editingItem.id, data);
        setBundleComposition((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)));
      }
      setEditingItem(null);
      setNewAltName('');
      setNewAltEmoji('');
    } catch (e) {
      setBundleError(e.message);
    } finally {
      setBundleItemSaving(false);
    }
  };

  const deleteBundleItem = async (itemId) => {
    if (!window.confirm('Удалить позицию из состава?')) return;
    setBundleError('');
    try {
      await api.deleteBundleItem(id, itemId);
      setBundleComposition((prev) => prev.filter((i) => i.id !== itemId));
      if (editingItem?.id === itemId) setEditingItem(null);
    } catch (e) {
      setBundleError(e.message);
    }
  };

  const addAltToEditing = () => {
    if (!newAltName.trim()) return;
    setEditingItem((prev) => ({
      ...prev,
      alternatives: [...(prev.alternatives || []), { name: newAltName.trim(), emoji: newAltEmoji.trim() }],
    }));
    setNewAltName('');
    setNewAltEmoji('');
  };

  const removeAltFromEditing = (index) =>
    setEditingItem((prev) => ({
      ...prev,
      alternatives: prev.alternatives.filter((_, i) => i !== index),
    }));

  // ===== Сохранение товара =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.id.trim() || !form.title.trim() || !form.category) {
      setError('Заполните обязательные поля: ID, название, категория');
      return;
    }
    // Пищевая ценность опциональна целиком: если ни одно поле не заполнено —
    // nutrition = null (наборы и товары без данных), иначе собираем полный
    // объект (пустые поля внутри заполненного блока считаются нулём).
    const nutritionFilled = Object.values(nutrition).some((v) => v !== '' && v !== null && v !== undefined);
    const nutritionPayload = nutritionFilled
      ? {
          calories: Math.round(Number(nutrition.calories) || 0),
          protein: Number(nutrition.protein) || 0,
          fat: Number(nutrition.fat) || 0,
          carbs: Number(nutrition.carbs) || 0,
        }
      : null;

    const payload = {
      ...form,
      price: Number(form.price) || 0,
      purchasePrice: form.purchasePrice !== '' && form.purchasePrice != null ? Number(form.purchasePrice) : null,
      sortOrder: Number(form.sortOrder) || 0,
      badge: form.badge && form.badge.type ? form.badge : null,
      composition: form.composition.filter((row) => row[0] || row[1]),
      suppliers: form.suppliers.filter((s) => s.name),
      pricing: form.pricing.map((p) => ({
        ...p,
        pct: Number(p.pct) || 0,
        amount: Number(p.amount) || 0,
      })),
      isBundle: form.isBundle === true,
      nutrition: nutritionPayload,
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
                  ? 'Латиницей, без пробелов. Используется во внутренних связях (отзывы, наборы, подборки), изменить позже нельзя.'
                  : 'ID товара изменить нельзя после создания — это внутренняя связь, не показывается покупателю. Для переименования используйте поле "Слаг" ниже.'}
              </div>
            </div>

            <div className="field">
              <label htmlFor="slug">Слаг (можно менять)</label>
              <input
                id="slug"
                type="text"
                value={form.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                placeholder="например, tomato"
              />
              <div className="hint">
                Человекочитаемый идентификатор для админки — в отличие от ID, можно менять в любой
                момент. Не используется в ссылках приложения.
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
              <div style={{ position: 'relative' }}>
                <input
                  id="price"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  required
                  style={pricingIndicatorColor ? { paddingRight: 34 } : undefined}
                />
                {pricingIndicatorColor && (
                  <span
                    title={PRICING_STATUS_LABEL[pricingIndicatorColor]}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      width: 12, height: 12, borderRadius: '50%',
                      background: PRICING_STATUS_COLOR[pricingIndicatorColor],
                    }}
                  />
                )}
              </div>
              {pricingIndicatorColor === 'red' && (
                <div className="hint" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                  ⚠ Цена ниже себестоимости — вы продаёте в убыток!
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="purchasePrice">Закупочная цена, ₽</label>
              <input
                id="purchasePrice"
                type="number"
                min="0"
                step="any"
                value={form.purchasePrice ?? ''}
                onChange={(e) => updateField('purchasePrice', e.target.value)}
                placeholder="например, 120"
              />
              <div className="hint">
                Сколько вы платите поставщику за единицу. Необязательно — пока
                пусто, расчёт рекомендуемой цены ниже просто не показывается.
              </div>
            </div>

            {purchasePriceNum != null && (
              <div className="field full">
                {pricingSettingsError ? (
                  <div className="hint" style={{ color: 'var(--danger)' }}>
                    Не удалось загрузить настройки ценообразования: {pricingSettingsError}
                  </div>
                ) : !pricingSettings ? (
                  <div className="hint">Загрузка настроек ценообразования…</div>
                ) : pricingResult.error ? (
                  <div className="hint" style={{ color: 'var(--danger)' }}>{pricingResult.error}</div>
                ) : (
                  <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '6px 20px', fontSize: 13, color: 'var(--ink)', marginBottom: 16,
                    }}>
                      <div>Себестоимость единицы: <b>{fmtRub(pricingResult.unitCost)} ₽</b></div>
                      <div>Доля постоянных расходов: <b>{fmtRub(pricingResult.fixedShare)} ₽</b></div>
                      <div>Цена безубыточности: <b>{fmtRub(pricingResult.breakEvenPrice)} ₽</b></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)', fontWeight: 800 }}>
                          Рекомендуемая цена
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)' }}>
                          {fmtRub(pricingResult.recommendedPrice)} ₽
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => updateField('price', String(Math.round(pricingResult.recommendedPrice)))}
                      >
                        Подставить рекомендуемую
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                onChange={(e) => updateCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="subcategory">Подкатегория (опционально)</label>
              <select
                id="subcategory"
                value={form.subcategoryId ?? ''}
                onChange={(e) => updateField('subcategoryId', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Без подкатегории</option>
                {availableSubcategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
              {availableSubcategories.length === 0 && (
                <div className="hint">Для этой категории подкатегорий пока нет</div>
              )}
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

            <div className="field full">
              <label>Фотография товара (опционально)</label>
              <ImageUploadField
                value={form.imageUrl || ''}
                onChange={(url) => updateField('imageUrl', url)}
                label="Фото товара"
              />
              <div className="hint" style={{ marginTop: 6 }}>Если загружено — фото показывается вместо эмодзи в каталоге и карточке товара.</div>
            </div>

            <div className="field full">
              <label>Фото для Главной (опционально)</label>
              <ImageUploadField
                value={form.homeImageUrl || ''}
                onChange={(url) => updateField('homeImageUrl', url)}
                label="Фото для Главной"
              />
              <div className="hint" style={{ marginTop: 6 }}>
                Только для блока «Готовые наборы» на Главной — независимо от фото товара выше. Не загружено — Главная возьмёт обычное фото товара.
              </div>
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

            <div className="field checkbox-field full">
              <input
                id="inStock"
                type="checkbox"
                checked={form.inStock === false}
                onChange={(e) => updateField('inStock', !e.target.checked)}
              />
              <label htmlFor="inStock">Товар закончился</label>
              <div className="hint" style={{ marginTop: 4 }}>
                В отличие от «Показывать товар в приложении» — товар остаётся
                в каталоге, но с серым фото, бейджем «Разобрали» и кнопкой
                «Сообщить о завозе» вместо «В корзину» (DESIGN.md §4.1).
              </div>
            </div>

            <div className="field checkbox-field full">
              <input
                id="isBundle"
                type="checkbox"
                checked={form.isBundle || false}
                onChange={(e) => updateField('isBundle', e.target.checked)}
              />
              <label htmlFor="isBundle">Набор с кастомизируемым составом</label>
              <div className="hint" style={{ marginTop: 4 }}>
                Если включено, покупатели смогут изменить состав набора при оформлении заказа.
              </div>
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
            <div className="field">
              <label htmlFor="badgeColor">Цвет метки</label>
              <select
                id="badgeColor"
                value={form.badge?.color || ''}
                onChange={(e) => updateBadgeField('color', e.target.value)}
                disabled={!form.badge?.type}
              >
                {BADGE_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="section-label">Пищевая ценность на 100 г (опционально)</div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="nutCalories">Калории, ккал</label>
              <input
                id="nutCalories"
                type="number"
                min="0"
                step="1"
                value={nutrition.calories}
                onChange={(e) => updateNutritionField('calories', e.target.value)}
                placeholder="например, 52"
              />
            </div>
            <div className="field">
              <label htmlFor="nutProtein">Белки, г</label>
              <input
                id="nutProtein"
                type="number"
                min="0"
                step="0.1"
                value={nutrition.protein}
                onChange={(e) => updateNutritionField('protein', e.target.value)}
                placeholder="например, 1.1"
              />
            </div>
            <div className="field">
              <label htmlFor="nutFat">Жиры, г</label>
              <input
                id="nutFat"
                type="number"
                min="0"
                step="0.1"
                value={nutrition.fat}
                onChange={(e) => updateNutritionField('fat', e.target.value)}
                placeholder="например, 0.2"
              />
            </div>
            <div className="field">
              <label htmlFor="nutCarbs">Углеводы, г</label>
              <input
                id="nutCarbs"
                type="number"
                min="0"
                step="0.1"
                value={nutrition.carbs}
                onChange={(e) => updateNutritionField('carbs', e.target.value)}
                placeholder="например, 11.3"
              />
            </div>
            <div className="field full">
              <div className="hint">
                Оставьте все поля пустыми, если пищевая ценность не применима (например, у наборов).
              </div>
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
                  <label>Фото поставщика</label>
                  <ImageUploadField
                    value={s.imageUrl || ''}
                    onChange={(url) => updateSupplier(i, 'imageUrl', url)}
                    label="Фото поставщика"
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

        {/* Кастомизируемый состав — только для существующих товаров с isBundle */}
        {form.isBundle && (
          <div className="card" style={{ padding: 24, marginTop: 16 }}>
            <div className="section-label" style={{ marginTop: 0 }}>Кастомизируемый состав набора</div>

            {isNew ? (
              <div className="hint">Сохраните товар сначала — затем добавьте позиции состава здесь.</div>
            ) : (
              <>
                {bundleError && <div className="alert error" style={{ marginBottom: 12 }}>{bundleError}</div>}

                {/* Список позиций */}
                {bundleComposition.length > 0 && (
                  <div className="repeat-list" style={{ marginBottom: 16 }}>
                    {bundleComposition.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: '10px 14px',
                          marginBottom: 8,
                          background: editingItem?.id === item.id ? '#f0fdf4' : '#fff',
                        }}
                      >
                        {editingItem?.id === item.id ? (
                          /* Форма редактирования позиции */
                          <div>
                            <div className="form-grid" style={{ marginBottom: 10 }}>
                              <div className="field" style={{ flex: '0 0 80px' }}>
                                <label>Эмодзи</label>
                                <input
                                  type="text"
                                  value={editingItem.itemEmoji}
                                  onChange={(e) => setEditingItem((p) => ({ ...p, itemEmoji: e.target.value }))}
                                  placeholder="🥕"
                                />
                              </div>
                              <div className="field">
                                <label>Название *</label>
                                <input
                                  type="text"
                                  value={editingItem.itemName}
                                  onChange={(e) => setEditingItem((p) => ({ ...p, itemName: e.target.value }))}
                                  placeholder="например, Морковь"
                                  autoFocus
                                />
                              </div>
                              <div className="field checkbox-field" style={{ alignItems: 'center', paddingTop: 22 }}>
                                <input
                                  id={`removable-${item.id}`}
                                  type="checkbox"
                                  checked={editingItem.isRemovable !== false}
                                  onChange={(e) => setEditingItem((p) => ({ ...p, isRemovable: e.target.checked }))}
                                />
                                <label htmlFor={`removable-${item.id}`}>Можно убрать</label>
                              </div>
                            </div>

                            <div style={{ marginBottom: 10 }}>
                              <div className="hint" style={{ marginBottom: 6 }}>Варианты замены:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                {(editingItem.alternatives || []).map((alt, ai) => (
                                  <span
                                    key={ai}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      background: '#f3f4f6', borderRadius: 16, padding: '3px 10px', fontSize: 13,
                                    }}
                                  >
                                    {alt.emoji} {alt.name}
                                    <button
                                      type="button"
                                      onClick={() => removeAltFromEditing(ai)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                <div className="field" style={{ flex: '0 0 70px', marginBottom: 0 }}>
                                  <label style={{ fontSize: 11 }}>Эмодзи</label>
                                  <input
                                    type="text"
                                    value={newAltEmoji}
                                    onChange={(e) => setNewAltEmoji(e.target.value)}
                                    placeholder="🍅"
                                  />
                                </div>
                                <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                                  <label style={{ fontSize: 11 }}>Название замены</label>
                                  <input
                                    type="text"
                                    value={newAltName}
                                    onChange={(e) => setNewAltName(e.target.value)}
                                    placeholder="например, Томаты"
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAltToEditing())}
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={addAltToEditing}
                                  disabled={!newAltName.trim()}
                                  style={{ flexShrink: 0 }}
                                >
                                  + Добавить
                                </button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={saveBundleItem}
                                disabled={bundleItemSaving}
                              >
                                {bundleItemSaving ? 'Сохранение…' : 'Сохранить'}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={cancelEditBundleItem}
                                disabled={bundleItemSaving}
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Режим просмотра позиции */
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20, flexShrink: 0 }}>{item.itemEmoji || '•'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.itemName}</div>
                              <div style={{ fontSize: 12, color: '#6b7280' }}>
                                {item.isRemovable ? 'Можно убрать' : 'Нельзя убрать'}
                                {item.alternatives?.length > 0 && (
                                  <span> · Замены: {item.alternatives.map((a) => `${a.emoji} ${a.name}`).join(', ')}</span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => startEditBundleItem(item)}
                                style={{ padding: '4px 10px', fontSize: 13 }}
                              >
                                Изменить
                              </button>
                              <button
                                type="button"
                                className="remove-btn"
                                onClick={() => deleteBundleItem(item.id)}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Форма добавления новой позиции */}
                {editingItem?.id === 'new' ? (
                  <div
                    style={{
                      border: '1px dashed #9ca3af',
                      borderRadius: 8,
                      padding: '14px',
                      marginBottom: 8,
                      background: '#fafafa',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>Новая позиция</div>
                    <div className="form-grid" style={{ marginBottom: 10 }}>
                      <div className="field" style={{ flex: '0 0 80px' }}>
                        <label>Эмодзи</label>
                        <input
                          type="text"
                          value={editingItem.itemEmoji}
                          onChange={(e) => setEditingItem((p) => ({ ...p, itemEmoji: e.target.value }))}
                          placeholder="🥕"
                        />
                      </div>
                      <div className="field">
                        <label>Название *</label>
                        <input
                          type="text"
                          value={editingItem.itemName}
                          onChange={(e) => setEditingItem((p) => ({ ...p, itemName: e.target.value }))}
                          placeholder="например, Морковь"
                          autoFocus
                        />
                      </div>
                      <div className="field checkbox-field" style={{ alignItems: 'center', paddingTop: 22 }}>
                        <input
                          id="removable-new"
                          type="checkbox"
                          checked={editingItem.isRemovable !== false}
                          onChange={(e) => setEditingItem((p) => ({ ...p, isRemovable: e.target.checked }))}
                        />
                        <label htmlFor="removable-new">Можно убрать</label>
                      </div>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div className="hint" style={{ marginBottom: 6 }}>Варианты замены:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {(editingItem.alternatives || []).map((alt, ai) => (
                          <span
                            key={ai}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: '#f3f4f6', borderRadius: 16, padding: '3px 10px', fontSize: 13,
                            }}
                          >
                            {alt.emoji} {alt.name}
                            <button
                              type="button"
                              onClick={() => removeAltFromEditing(ai)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div className="field" style={{ flex: '0 0 70px', marginBottom: 0 }}>
                          <label style={{ fontSize: 11 }}>Эмодзи</label>
                          <input
                            type="text"
                            value={newAltEmoji}
                            onChange={(e) => setNewAltEmoji(e.target.value)}
                            placeholder="🍅"
                          />
                        </div>
                        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                          <label style={{ fontSize: 11 }}>Название замены</label>
                          <input
                            type="text"
                            value={newAltName}
                            onChange={(e) => setNewAltName(e.target.value)}
                            placeholder="например, Томаты"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAltToEditing())}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={addAltToEditing}
                          disabled={!newAltName.trim()}
                          style={{ flexShrink: 0 }}
                        >
                          + Добавить
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={saveBundleItem}
                        disabled={bundleItemSaving}
                      >
                        {bundleItemSaving ? 'Сохранение…' : 'Добавить'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={cancelEditBundleItem}
                        disabled={bundleItemSaving}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="add-row-btn"
                    onClick={startAddBundleItem}
                    disabled={!!editingItem}
                  >
                    + Добавить позицию
                  </button>
                )}

                {bundleComposition.length === 0 && !editingItem && (
                  <div className="hint" style={{ marginTop: 8 }}>
                    Добавьте позиции, которые покупатель сможет кастомизировать (убрать или заменить).
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
