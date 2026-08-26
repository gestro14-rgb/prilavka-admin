import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from './api';
import ImageUploadField from './ImageUploadField';
import MediaUploadField from './MediaUploadField';
import { calcPricing, pricingStatus, calcCurrentPriceMargin, effectivePurchaseCost } from './pricingCalc';

// Округление сумм в "Из чего складывается цена": обычный Math.round округляет
// ровно .5 вверх (49.5 → 50), а здесь на этой границе нужно вниз (49.5 → 49).
// Во всём остальном (не-.5 случаи) ведёт себя как обычное округление.
function roundHalfDown(value) {
  return Math.ceil(value - 0.5);
}

// Стандартная разбивка "Из чего складывается цена" — те же 5 строк, что
// зашиты в prilavka-agent/agent.js (buildPricing) для карточки товара в
// боте; цвета взяты оттуда же, чтобы не расходились между приложениями.
const STANDARD_PRICING_TEMPLATE = [
  { label: 'Фермерам', sub: 'закупка напрямую у производителей', pct: 33, color: '#2A7A2A' },
  { label: 'Логистика', sub: 'доставка и хранение', pct: 25, color: '#E0A458' },
  { label: 'Упаковка', sub: 'бережная упаковка без пластика', pct: 12, color: '#8B6F47' },
  { label: 'Контроль качества', sub: 'отбор и проверка свежести', pct: 15, color: '#6B92B8' },
  { label: 'Сервис', sub: 'работа платформы и эквайринг', pct: 15, color: '#C4782A' },
];

const EMPTY_PRODUCT = {
  id: '',
  slug: '',
  title: '',
  price: 0,
  // Nullable — '' в форме, null на бэкенде (как purchasePrice ниже): нет
  // скидки, значит нечего и зачёркивать (см. PriceTag.jsx в prilavka-app).
  oldPrice: '',
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
  homeVideoUrl: '',
  // Короткая ситуативная подпись витринной карточки наборов (задача 10
  // воронки, migrations/051) — "На 1-2 человека" вместо полного title
  // "Набор семейный на неделю (3-4 чел)". Не замена title/weight: те
  // используются в чеке заказа и поиске, где нужна точность, не краткость.
  // Пусто → фронт сам берёт title/weight, как раньше.
  cardEmoji: '',
  cardTitle: '',
  cardSubtitle: '',
  // Цветная плашка-тег секции «Сегодня особенно хорошее» на Главной
  // (migrations/052) — про вкус/текстуру товара, отдельно от «Метки на
  // карточке» ниже (та про статус: Хит / Выгодно / Чаще берут). Непустой
  // tagLabel сам заводит товар в секцию, отдельной галочки нет.
  tagLabel: '',
  tagColor: '',
  // «На скольких человек» и «на какой срок» набора (migrations/053) — две
  // строки рядом с весом на hero-карточке Главной. Пусто → фронт пробует
  // достать фразу из названия товара, как делал раньше.
  audienceLabel: '',
  termLabel: '',
  isBundle: false,
  subcategoryId: null,
  // Nullable — у уже заведённых товаров пусто, пока их не откроют и не
  // заполнят задним числом. '' в форме, null на бэкенде, см. handleSubmit.
  purchasePrice: '',
  // 'piece' — закупка как есть за единицу; 'kg' — закупка за килограмм,
  // эффективная закупка упаковки = закупка × weightKg (migrations/036).
  // weightKg — структурированный вес в кг для расчёта закупки И (см.
  // pricePerKg ниже, migrations/045) для расчёта продажной цены; текстовое
  // weight ("700 г", "1 пучок") остаётся витринным описанием и не парсится.
  pricingUnit: 'piece',
  weightKg: '',
  // Продажная цена за кг для покупателя (customer-facing, НЕ путать с
  // purchasePrice выше — та закупочная/себестоимость) — витринный акцент
  // "39 ₽/кг" на карточке товара. Заполнена вместе с weightKg — price
  // пересчитывается автоматически (см. эффект ниже), но остаётся обычным
  // редактируемым полем: это дополнительный способ ввода price, не замена.
  pricePerKg: '',
  // Индивидуальная маржа товара (%, необязательно) — верхний уровень
  // приоритета маржи: товар → подкатегория → глобальная (migrations/038).
  individualMarginPercent: '',
};

const PRICING_STATUS_COLOR = { green: '#1C8F1C', yellow: '#D07812', red: 'var(--danger)' };
const PRICING_STATUS_LABEL = {
  green: 'Цена ≥ рекомендуемой — хорошая маржа',
  yellow: 'В плюсе, но маржа ниже желаемой',
  red: 'Цена ниже себестоимости — убыток',
};
const PRICING_STATUS_VERDICT = {
  green: 'Хорошая прибыль',
  yellow: 'Тонкая маржа',
  red: 'Убыток!',
};

const fmtRub = (n) => Math.round(n).toLocaleString('ru-RU');

// У части старых товаров pricing когда-то хранился как массив строк-подписей
// (до перехода на объектную схему {label,sub,pct,amount,color}). Открытие
// такого товара и правка любого поля в updatePricingItem спредили строку
// поэлементно ({...'Поставщику'} → {0:'П',1:'о',...}) — отсюда битые записи
// с ключами "0","1","2". Отфильтровываем такие элементы при загрузке формы,
// а не пытаемся угадать исходный текст — он необратимо потерян.
function normalizePricing(pricing) {
  if (!Array.isArray(pricing)) return [];
  return pricing.filter(
    (p) => p && typeof p === 'object' && !Array.isArray(p)
      && typeof p.label === 'string' && p.label.trim() !== ''
  );
}

const BADGE_TYPES = [
  { value: '', label: 'Без метки' },
  { value: 'popular', label: 'Чаще берут' },
  { value: 'deal', label: 'Выгодно' },
  { value: 'hit', label: 'Хит' },
];

// 4 предустановленных акцента дизайн-системы (DESIGN.md §1) — не свободный
// RGB-пикер, чтобы не размывать палитру. Пусто = цвет по умолчанию для
// выбранного типа метки (см. HitBadge/EcoBadge/Badge на фронте).
// Пресеты цвета для плашки-тега «Сегодня особенно хорошее» (migrations/052).
// Имена, а не hex — сознательно: в badge_color выше за годы налили
// произвольных оттенков, и фронт в итоге вынужден это поле игнорировать
// (см. Badge.jsx в мини-аппе). Пару фон/текст под каждое имя разворачивает
// фронт из палитры, поэтому она остаётся целой при любом содержимом поля.
const TAG_COLORS = [
  { value: '',       label: 'Зелёный (по умолчанию)' },
  { value: 'green',  label: 'Зелёный — свежесть, хруст' },
  { value: 'orange', label: 'Оранжевый — сочность' },
  { value: 'ochre',  label: 'Охра — мягкость, мёд' },
  { value: 'berry',  label: 'Ягодный — сладость' },
];

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

  // Приоритет целевой маржи (migrations/038): индивидуальная маржа товара →
  // маржа подкатегории → глобальная настройка. Подкатегория берётся из уже
  // загруженного списка subcategories; String() с обеих сторон — в форме
  // subcategoryId живёт строкой из <select>, в DTO приходит числом.
  const currentSubcategory = subcategories.find((sc) => String(sc.id) === String(form.subcategoryId ?? ''));
  const subcategoryMarginPercent = currentSubcategory?.targetMarginPercent ?? null;
  const productMarginPercent = form.individualMarginPercent !== '' && form.individualMarginPercent != null
    ? Number(form.individualMarginPercent)
    : null;

  const purchasePriceNum = form.purchasePrice !== '' && form.purchasePrice != null ? Number(form.purchasePrice) : null;
  // При закупке за кг без заполненного веса effectiveCost = null — блок
  // расчёта показывает просьбу указать вес, а не считает по цене за кг.
  const effectiveCost = effectivePurchaseCost({
    purchasePrice: form.purchasePrice,
    pricingUnit: form.pricingUnit,
    weightKg: form.weightKg,
  });
  const pricingResult = effectiveCost != null && pricingSettings
    ? calcPricing({ purchasePrice: effectiveCost, settings: pricingSettings, productMarginPercent, subcategoryMarginPercent })
    : null;
  const pricingIndicatorColor = pricingResult && !pricingResult.error
    ? pricingStatus(Number(form.price) || 0, pricingResult)
    : null;
  const currentPriceMargin = pricingIndicatorColor
    ? calcCurrentPriceMargin(form.price, pricingResult)
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
        setForm({
          ...EMPTY_PRODUCT,
          ...p,
          badge: p.badge || null,
          isBundle: p.isBundle || false,
          purchasePrice: p.purchasePrice ?? '',
          oldPrice: p.oldPrice ?? '',
          pricingUnit: p.pricingUnit || 'piece',
          weightKg: p.weightKg ?? '',
          pricePerKg: p.pricePerKg ?? '',
          individualMarginPercent: p.individualMarginPercent ?? '',
          pricing: normalizePricing(p.pricing),
        });
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

  // Автоподстановка price = pricePerKg × weightKg — второй, дополнительный
  // способ ввода цены (первый — обычное ручное поле "Цена, ₽" ниже). Флаг,
  // а не просто deps на pricePerKg/weightKg: при открытии формы уже
  // существующего товара загрузка одним setForm сразу проставляет и
  // pricePerKg, и weightKg — без флага эффект сработал бы на этой же
  // загрузке и молча переписал бы price, даже если админ когда-то осознанно
  // подправил её вручную поверх старой подстановки. Ставится в true только
  // из onChange полей "Цена за кг"/"Вес для расчёта" ниже — то есть только
  // на реальный ввод, не на программное заполнение формы.
  const pricingInputsTouchedRef = useRef(false);
  useEffect(() => {
    if (!pricingInputsTouchedRef.current || form.pricingUnit !== 'kg') return;
    const perKg = Number(form.pricePerKg);
    const weight = Number(form.weightKg);
    if (!(perKg > 0) || !(weight > 0)) return;
    setForm((prev) => ({ ...prev, price: String(Math.round(perKg * weight)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pricePerKg, form.weightKg, form.pricingUnit]);

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
  // Спред не-объекта (см. normalizePricing выше) — источник бага порчи
  // данных, поэтому pricing[index] подстраховываем базовым объектом, если
  // он вдруг оказался не {label,sub,pct,amount,color}.
  const updatePricingItem = (index, field, value) =>
    setForm((prev) => {
      const pricing = [...prev.pricing];
      const current = pricing[index];
      const base = current && typeof current === 'object' && !Array.isArray(current)
        ? current
        : { label: '', sub: '', pct: 0, amount: 0, color: '#5C8A52' };
      pricing[index] = { ...base, [field]: value };
      return { ...prev, pricing };
    });
  const addPricingItem = () =>
    setForm((prev) => ({
      ...prev,
      pricing: [...prev.pricing, { label: '', sub: '', pct: 0, amount: 0, color: '#5C8A52' }],
    }));
  const removePricingItem = (index) =>
    setForm((prev) => ({ ...prev, pricing: prev.pricing.filter((_, i) => i !== index) }));
  // amount считаем от уже введённой цены, если она есть — иначе 0, админ
  // подставит цену позже и суммы можно будет пересчитать вручную.
  const fillStandardPricingTemplate = () =>
    setForm((prev) => {
      const price = Number(prev.price) || 0;
      return {
        ...prev,
        pricing: STANDARD_PRICING_TEMPLATE.map((row) => ({
          ...row,
          amount: price > 0 ? roundHalfDown(price * row.pct / 100) : 0,
        })),
      };
    });

  // На blur процента (после того как ввод закончен, не на каждое нажатие
  // клавиши — иначе стирание значения перед вводом нового мигало бы
  // промежуточным перераспределением у остальных строк) пропорционально
  // подстраиваем остальные строки, чтобы сумма процентов снова была 100,
  // сохраняя их взаимное соотношение. Если остальные в сумме дают 0 —
  // делить пропорционально нечего, делим остаток поровну.
  // При уходе с поля цены пересчитываем amount всех строк pricing под новую
  // цену по их текущим процентам — сами проценты не трогаем, только суммы.
  const recalcPricingAmounts = () =>
    setForm((prev) => {
      if (prev.pricing.length === 0) return prev;
      const price = Number(prev.price) || 0;
      return {
        ...prev,
        pricing: prev.pricing.map((p) => ({
          ...p,
          amount: price > 0 ? roundHalfDown(price * (Number(p.pct) || 0) / 100) : 0,
        })),
      };
    });

  const redistributePricingPct = (index) =>
    setForm((prev) => {
      const pricing = prev.pricing;
      // Целые проценты, не дробные — браузер продолжал ругаться на step
      // даже после step="0.1" на инпуте (см. коммит), надёжнее просто не
      // производить дробные значения вообще.
      const clamped = Math.max(0, Math.min(100, Math.round(Number(pricing[index]?.pct) || 0)));
      const otherIndices = pricing.map((_, i) => i).filter((i) => i !== index);
      const price = Number(prev.price) || 0;
      const amountFor = (pct) => (price > 0 ? roundHalfDown(price * pct / 100) : 0);

      const next = [...pricing];
      next[index] = { ...next[index], pct: clamped, amount: amountFor(clamped) };

      if (otherIndices.length === 0) {
        return { ...prev, pricing: next };
      }

      const remainder = 100 - clamped;
      const oldOtherValues = otherIndices.map((i) => Number(pricing[i]?.pct) || 0);
      const oldOtherSum = oldOtherValues.reduce((a, b) => a + b, 0);

      const newOtherValues = oldOtherSum > 0
        ? oldOtherValues.map((v) => Math.round(v * remainder / oldOtherSum))
        : otherIndices.map(() => Math.round(remainder / otherIndices.length));

      // Округление каждой строки по отдельности может увести сумму от
      // остатка на единицы — компенсируем разницу последней строкой, чтобы
      // сумма всех строк (включая изменённую) была равна 100 точно.
      const drift = remainder - newOtherValues.reduce((a, b) => a + b, 0);
      newOtherValues[newOtherValues.length - 1] += drift;

      otherIndices.forEach((i, idx) => {
        next[i] = { ...next[i], pct: newOtherValues[idx], amount: amountFor(newOtherValues[idx]) };
      });
      return { ...prev, pricing: next };
    });

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
      oldPrice: form.oldPrice !== '' && form.oldPrice != null ? Number(form.oldPrice) : null,
      purchasePrice: form.purchasePrice !== '' && form.purchasePrice != null ? Number(form.purchasePrice) : null,
      pricingUnit: form.pricingUnit === 'kg' ? 'kg' : 'piece',
      weightKg: form.pricingUnit === 'kg' && form.weightKg !== '' ? Number(form.weightKg) : null,
      pricePerKg: form.pricingUnit === 'kg' && form.pricePerKg !== '' ? Number(form.pricePerKg) : null,
      individualMarginPercent: form.individualMarginPercent !== '' ? Number(form.individualMarginPercent) : null,
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
                  onBlur={recalcPricingAmounts}
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
              <label htmlFor="oldPrice">Старая цена (для зачёркивания)</label>
              <input
                id="oldPrice"
                type="number"
                min="0"
                value={form.oldPrice}
                onChange={(e) => updateField('oldPrice', e.target.value)}
                placeholder="не заполнено — скидка не показывается"
              />
              <div className="hint">
                Показывается зачёркнутой рядом с обычной ценой, только если больше текущей.
              </div>
            </div>

            <div className="field">
              <label htmlFor="pricingUnit">Закупка указана</label>
              <select
                id="pricingUnit"
                value={form.pricingUnit}
                onChange={(e) => updateField('pricingUnit', e.target.value)}
              >
                <option value="piece">За штуку / упаковку</option>
                <option value="kg">За килограмм</option>
              </select>
              <div className="hint">
                «За килограмм» — закупочная цена вводится за кг, стоимость упаковки
                считается через вес для расчёта ниже. Текстовое поле «Вес / описание
                объёма» на это не влияет — оно только для покупателя.
              </div>
            </div>

            <div className="field">
              <label htmlFor="purchasePrice">
                {form.pricingUnit === 'kg' ? 'Закупочная цена за кг, ₽' : 'Закупочная цена, ₽'}
              </label>
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
                {form.pricingUnit === 'kg'
                  ? 'Сколько вы платите поставщику за килограмм. Необязательно — пока пусто, расчёт рекомендуемой цены ниже просто не показывается.'
                  : 'Сколько вы платите поставщику за единицу. Необязательно — пока пусто, расчёт рекомендуемой цены ниже просто не показывается.'}
              </div>
            </div>

            {form.pricingUnit === 'kg' && (
              <div className="field">
                <label htmlFor="weightKg">Вес для расчёта, кг</label>
                <input
                  id="weightKg"
                  type="number"
                  min="0"
                  step="any"
                  value={form.weightKg ?? ''}
                  onChange={(e) => {
                    pricingInputsTouchedRef.current = true;
                    updateField('weightKg', e.target.value);
                  }}
                  placeholder="например, 0.7"
                />
                <div className="hint">
                  {effectiveCost != null && purchasePriceNum != null
                    ? `Закупка упаковки: ${purchasePriceNum.toLocaleString('ru-RU')} ₽/кг × ${Number(form.weightKg).toLocaleString('ru-RU')} кг = ${fmtRub(effectiveCost)} ₽`
                    : 'Фактический вес упаковки/порции в килограммах — не показывается покупателю напрямую. Используется для расчёта закупки, а если заполнено «Цена за кг для покупателя» ниже — то и для автоподстановки продажной цены.'}
                </div>
              </div>
            )}

            {form.pricingUnit === 'kg' && (
              <div className="field">
                <label htmlFor="pricePerKg">Цена за кг для покупателя, ₽ (необязательно)</label>
                <input
                  id="pricePerKg"
                  type="number"
                  min="0"
                  step="any"
                  value={form.pricePerKg ?? ''}
                  onChange={(e) => {
                    pricingInputsTouchedRef.current = true;
                    updateField('pricePerKg', e.target.value);
                  }}
                  placeholder="например, 39"
                />
                <div className="hint">
                  {form.pricePerKg && form.weightKg
                    ? `На карточке товара покажем крупным акцентом «${Number(form.pricePerKg).toLocaleString('ru-RU')} ₽/кг» вместо обычной цены. Цена товара подставится автоматически: ${Number(form.pricePerKg).toLocaleString('ru-RU')} ₽/кг × ${Number(form.weightKg).toLocaleString('ru-RU')} кг = ${Math.round(Number(form.pricePerKg) * Number(form.weightKg)).toLocaleString('ru-RU')} ₽ — можно поправить вручную ниже.`
                    : 'Это розничная цена для покупателя (не закупочная!) — витринный акцент вроде «39 ₽/кг», как у арбузов/дынь на Ozon. Заполните вместе с весом выше — цена товара посчитается сама. Пусто — карточка выглядит как обычно.'}
                </div>
              </div>
            )}

            <div className="field">
              <label htmlFor="individualMarginPercent">Индивидуальная маржа, % (необязательно)</label>
              <input
                id="individualMarginPercent"
                type="number"
                min="0"
                step="any"
                value={form.individualMarginPercent ?? ''}
                onChange={(e) => updateField('individualMarginPercent', e.target.value)}
                placeholder="маржа подкатегории или общая"
              />
              <div className="hint">
                Для акционных товаров или исключений — переопределяет маржу подкатегории.
                Пусто — действует маржа подкатегории, а если и её нет, общая настройка
                из раздела «Ценообразование».
              </div>
            </div>

            {purchasePriceNum != null && (
              <div className="field full">
                {pricingSettingsError ? (
                  <div className="hint" style={{ color: 'var(--danger)' }}>
                    Не удалось загрузить настройки ценообразования: {pricingSettingsError}
                  </div>
                ) : effectiveCost == null ? (
                  <div className="hint" style={{ color: 'var(--danger)' }}>
                    Закупка указана за килограмм — укажите «Вес для расчёта, кг», чтобы посчитать
                    стоимость упаковки и рекомендации по цене.
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
                      {form.pricingUnit === 'kg' && (
                        <div>Закупка упаковки: <b>{fmtRub(effectiveCost)} ₽</b></div>
                      )}
                      <div>Себестоимость единицы: <b>{fmtRub(pricingResult.unitCost)} ₽</b></div>
                      <div>Доля постоянных расходов: <b>{fmtRub(pricingResult.fixedShare)} ₽</b></div>
                      <div>
                        Целевая маржа: <b>{pricingResult.marginPercent.toLocaleString('ru-RU')}%</b>{' '}
                        <span style={{ color: 'var(--ink-soft)' }}>
                          {pricingResult.marginSource === 'product'
                            ? '(индивидуальная)'
                            : pricingResult.marginSource === 'subcategory'
                              ? `(подкатегория${currentSubcategory?.name ? ` «${currentSubcategory.name}»` : ''})`
                              : '(общая настройка)'}
                        </span>
                      </div>
                    </div>
                    {/* Диапазон цен: безубыток → рекомендуемая → премиальная
                        (маржа ×1.5 в том же расчёте, см. pricingCalc.js). */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 12, marginBottom: 12,
                    }}>
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)', fontWeight: 800 }}>
                          Минимальная (безубыток)
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
                          {fmtRub(pricingResult.breakEvenPrice)} ₽
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)', fontWeight: 800 }}>
                          Рекомендуемая
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)' }}>
                          {fmtRub(pricingResult.recommendedPrice)} ₽
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)', fontWeight: 800 }}>
                          Премиальная (маржа ×1.5)
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
                          {pricingResult.premiumPrice != null ? `${fmtRub(pricingResult.premiumPrice)} ₽` : '—'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => updateField('price', String(Math.round(pricingResult.recommendedPrice)))}
                      >
                        Подставить рекомендуемую
                      </button>
                    </div>

                    {currentPriceMargin && Number(form.price) > 0 && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '6px 20px', fontSize: 13, color: 'var(--ink)', marginBottom: 8,
                        }}>
                          <div>Маржа по текущей цене: <b>{currentPriceMargin.marginPercent.toFixed(1)}%</b></div>
                          <div>Прибыль с единицы: <b>{fmtRub(currentPriceMargin.profitPerUnit)} ₽</b></div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: PRICING_STATUS_COLOR[pricingIndicatorColor] }}>
                          {PRICING_STATUS_VERDICT[pricingIndicatorColor]}
                        </div>
                      </div>
                    )}
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

            <div className="field full">
              <label>Видео для Главной (опционально)</label>
              {form.homeVideoUrl && (
                <video
                  src={form.homeVideoUrl}
                  controls
                  preload="metadata"
                  style={{ width: 220, borderRadius: 6, border: '1px solid #e5e7eb', display: 'block', marginBottom: 6 }}
                />
              )}
              <MediaUploadField
                kind="setVideo"
                accept="video/*"
                label="видео"
                value={form.homeVideoUrl || ''}
                onChange={(url) => updateField('homeVideoUrl', url)}
              />
              <div className="hint" style={{ marginTop: 6 }}>
                Загруженное видео сразу выводит набор в hero-карусель «Готовые наборы» на Главной — отдельно включать ничего не нужно.
                Несколько наборов с видео — карусель со свайпом, один — статичная карточка. Звука не будет: видео всегда играет без него.
                Фото для Главной выше остаётся постером, пока видео грузится.
              </div>
            </div>

            <div className="field">
              <label htmlFor="audienceLabel">На скольких человек (опционально)</label>
              <input
                id="audienceLabel"
                type="text"
                value={form.audienceLabel || ''}
                onChange={(e) => updateField('audienceLabel', e.target.value)}
                placeholder="1-2 человека"
              />
            </div>
            <div className="field">
              <label htmlFor="termLabel">На какой срок (опционально)</label>
              <input
                id="termLabel"
                type="text"
                value={form.termLabel || ''}
                onChange={(e) => updateField('termLabel', e.target.value)}
                placeholder="на 5-7 дней"
              />
            </div>
            <div className="field full">
              <div className="hint">
                Две строки выше стоят рядом с весом на большой карточке набора на Главной (👥 / ⚖️ / 📅) и выводятся дословно, как написаны —
                регистр не правится. Не заполнены — фронт попробует достать фразу из названия товара («…для двоих на неделю» → «Для двоих» /
                «На неделю»), как было раньше.
              </div>
            </div>

            <div className="field">
              <label htmlFor="cardEmoji">Эмодзи-тег для карточки набора (опционально)</label>
              <input
                id="cardEmoji"
                type="text"
                value={form.cardEmoji || ''}
                onChange={(e) => updateField('cardEmoji', e.target.value)}
                placeholder="🥬"
              />
            </div>
            <div className="field">
              <label htmlFor="cardTitle">Короткое название для карточки (опционально)</label>
              <input
                id="cardTitle"
                type="text"
                value={form.cardTitle || ''}
                onChange={(e) => updateField('cardTitle', e.target.value)}
                placeholder="На 1-2 человека"
              />
            </div>
            <div className="field full">
              <label htmlFor="cardSubtitle">Короткое пояснение для карточки (опционально)</label>
              <input
                id="cardSubtitle"
                type="text"
                value={form.cardSubtitle || ''}
                onChange={(e) => updateField('cardSubtitle', e.target.value)}
                placeholder="на несколько дней"
              />
              <div className="hint" style={{ marginTop: 6 }}>
                Три поля выше — только для витринных карточек «Готовых наборов» на Главной и в пустой корзине: короткое название по ситуации
                вместо полного названия товара. Название и вес выше (используются в чеке заказа, поиске каталога) не меняются. Не заполнено —
                карточка покажет обычные название и вес, как сейчас.
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

          <div className="section-label">Тег для блока «Сегодня особенно хорошее» (опционально)</div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="tagLabel">Текст тега</label>
              <input
                id="tagLabel"
                type="text"
                value={form.tagLabel || ''}
                onChange={(e) => updateField('tagLabel', e.target.value)}
                placeholder="например, Сладкая!"
              />
            </div>
            <div className="field">
              <label htmlFor="tagColor">Цвет тега</label>
              <select
                id="tagColor"
                value={form.tagColor || ''}
                onChange={(e) => updateField('tagColor', e.target.value)}
                disabled={!form.tagLabel}
              >
                {TAG_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <div className="hint">
                Заполненный текст тега сам заводит товар в блок «Сегодня особенно хорошее» на Главной — отдельно включать ничего не нужно.
                Порядок и точный состав блока можно задать вручную во вкладке «Особенно хорошее» раздела «Главная страница»; пока подборка
                там пуста, в блок попадают все товары с заполненным тегом. Пишите то, что правда про сам продукт («Сладкая!», «Хрустящие»,
                «Мягкие»), — это не статус вроде «Хит», для него есть «Метка на карточке» ниже.
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
            {form.pricing.length === 0 && (
              <button type="button" className="add-row-btn" onClick={fillStandardPricingTemplate}>
                Заполнить стандартным шаблоном
              </button>
            )}
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
                    step="0.1"
                    value={p.pct}
                    onChange={(e) => updatePricingItem(i, 'pct', e.target.value)}
                    onBlur={() => redistributePricingPct(i)}
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
