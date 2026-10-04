import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from './api';
import ImageUploadField from './ImageUploadField';
import MediaUploadField from './MediaUploadField';
import { BadgePreview } from './Badges';
import { calcPricing, pricingStatus, calcCurrentPriceMargin, effectivePurchaseCost } from './pricingCalc';

// ���������� ���� � "�� ���� ������������ ����": ������� Math.round ���������
// ����� .5 ����� (49.5 > 50), � ����� �� ���� ������� ����� ���� (49.5 > 49).
// �� ��� ��������� (��-.5 ������) ���� ���� ��� ������� ����������.
function roundHalfDown(value) {
  return Math.ceil(value - 0.5);
}

// ����������� �������� "�� ���� ������������ ����" � �� �� 5 �����, ���
// ������ � prilavka-agent/agent.js (buildPricing) ��� �������� ������ �
// ����; ����� ����� ������ ��, ����� �� ����������� ����� ������������.
const STANDARD_PRICING_TEMPLATE = [
  { label: '��������', sub: '������� �������� � ��������������', pct: 33, color: '#2A7A2A' },
  { label: '���������', sub: '�������� � ��������', pct: 25, color: '#E0A458' },
  { label: '��������', sub: '�������� �������� ��� ��������', pct: 12, color: '#8B6F47' },
  { label: '�������� ��������', sub: '����� � �������� ��������', pct: 15, color: '#6B92B8' },
  { label: '������', sub: '������ ��������� � ���������', pct: 15, color: '#C4782A' },
];

// ����� ��, ��� ��������� ������ ��� �������� ������ (POST
// /api/admin/products). ������ ����� �� �� ���������, ��� � ���: id �
// ������� ����, �� ���� ��������� ������, ������ �������, �������� �������
// � ������� �������, ������� ������ ������� � ����� �������� �� ��������.
const PRODUCT_ID_RE = /^[a-z0-9-]+$/;

// ��������� > ��������. ����� �� ��� �������: ���� �ID ������ ���������
// �������, ������� ������ ��-������, � �������� �� ������ ����������.
// ������ ����� ���� ����� ������� �� ������� � ����������� ������� ���
// ����� ������� ����������� � ������ ������������ � �pomidor� ����� � ����.
const TRANSLIT = {
  �: 'a', �: 'b', �: 'v', �: 'g', �: 'd', �: 'e', �: 'e', �: 'zh', �: 'z',
  �: 'i', �: 'y', �: 'k', �: 'l', �: 'm', �: 'n', �: 'o', �: 'p', �: 'r',
  �: 's', �: 't', �: 'u', �: 'f', �: 'h', �: 'c', �: 'ch', �: 'sh', �: 'sch',
  �: '', �: 'y', �: '', �: 'e', �: 'yu', �: 'ya',
};

/**
 * �������� ���� � ����������� id: ��������������, ������ �������, ��
 * ��������� � � �����.
 *
 * ������ ������ ������ �� ���������� � ��������� �� �������: ����� ������
 * ���� �� ������� �tomato-cherry� � ����� ������� �� ����� ����� �����, ��
 * ���������� ��������� �����. ����������� ������ normalizeProductId ����,
 * ��� �� ��������.
 */
function productIdFromInput(raw) {
  return String(raw)
    .toLowerCase()
    .split('')
    .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9-]+/g, '-');
}

// ��������� ������������ ����� ���������: ������ ������ �� ����� � ������
// ������ ������� �����, ����� ���� ��� ��������.
function normalizeProductId(raw) {
  return productIdFromInput(raw).replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const EMPTY_PRODUCT = {
  id: '',
  slug: '',
  title: '',
  price: 0,
  // Nullable � '' � �����, null �� ������� (��� purchasePrice ����): ���
  // ������, ������ ������ � ����������� (��. PriceTag.jsx � prilavka-app).
  oldPrice: '',
  weight: '',
  emoji: '??',
  bg: 'linear-gradient(135deg, #F4F7F2, #fff)',
  category: 'vegetables',
  badge: null,
  origin: '',
  composition: [],
  suppliers: [],
  pricing: [],
  isActive: true,
  inStock: true,
  sortOrder: 0,
  imageUrl: '',
  homeImageUrl: '',
  homeVideoUrl: '',
  // �������� ����������� ������� ��������� �������� ������� (������ 10
  // �������, migrations/051) � "�� 1-2 ��������" ������ ������� title
  // "����� �������� �� ������ (3-4 ���)". �� ������ title/weight: ��
  // ������������ � ���� ������ � ������, ��� ����� ��������, �� ���������.
  // ����� > ����� ��� ���� title/weight, ��� ������.
  cardEmoji: '',
  cardTitle: '',
  cardSubtitle: '',
  // ������� ������-��� ������ �������� �� �������� �� �������
  // (migrations/052) � ��� ����/�������� ������, �������� �� ������ ��
  // �������� ���� (�� ��� ������: ��� / ������� / ���� �����). ��������
  // tagLabel ��� ������� ����� � ������, ��������� ������� ���.
  tagLabel: '',
  tagColor: '',
  // ��� �������� ������� � ��� ����� ���� ������ (migrations/053) � ���
  // ������ ����� � ����� �� hero-�������� �������. ����� > ����� �������
  // ������� ����� �� �������� ������, ��� ����� ������.
  audienceLabel: '',
  termLabel: '',
  // ��������� ������ ������� ������ (migrations/055) � ���� ���� ������
  // ������ �� �������� ������. ����� > ����� ������� ��� �� �������.
  contentsSummary: [],
  isBundle: false,
  subcategoryId: null,
  // Nullable � � ��� ��������� ������� �����, ���� �� �� ������� � ��
  // �������� ������ ������. '' � �����, null �� �������, ��. handleSubmit.
  purchasePrice: '',
  // 'piece' � ������� ��� ���� �� �������; 'kg' � ������� �� ���������,
  // ����������� ������� �������� = ������� ? weightKg (migrations/036).
  // weightKg � ����������������� ��� � �� ��� ������� ������� � (��.
  // pricePerKg ����, migrations/045) ��� ������� ��������� ����; ���������
  // weight ("700 �", "1 �����") ������� ��������� ��������� � �� ��������.
  pricingUnit: 'piece',
  weightKg: '',
  // ��������� ���� �� �� ��� ���������� (customer-facing, �� ������ �
  // purchasePrice ���� � �� ����������/�������������) � ��������� ������
  // "39 ?/��" �� �������� ������. ��������� ������ � weightKg � price
  // ��������������� ������������� (��. ������ ����), �� ������� �������
  // ������������� �����: ��� �������������� ������ ����� price, �� ������.
  pricePerKg: '',
  // �������������� ����� ������ (%, �������������) � ������� �������
  // ���������� �����: ����� > ������������ > ���������� (migrations/038).
  individualMarginPercent: '',
};

const PRICING_STATUS_COLOR = { green: '#1C8F1C', yellow: '#D07812', red: 'var(--danger)' };
const PRICING_STATUS_LABEL = {
  green: '���� ? ������������� � ������� �����',
  yellow: '� �����, �� ����� ���� ��������',
  red: '���� ���� ������������� � ������',
};
const PRICING_STATUS_VERDICT = {
  green: '������� �������',
  yellow: '������ �����',
  red: '������!',
};

const fmtRub = (n) => Math.round(n).toLocaleString('ru-RU');

// � ����� ������ ������� pricing �����-�� �������� ��� ������ �����-��������
// (�� �������� �� ��������� ����� {label,sub,pct,amount,color}). ��������
// ������ ������ � ������ ������ ���� � updatePricingItem �������� ������
// ����������� ({...'����������'} > {0:'�',1:'�',...}) � ������ ����� ������
// � ������� "0","1","2". ��������������� ����� �������� ��� �������� �����,
// � �� �������� ������� �������� ����� � �� ���������� �������.
function normalizePricing(pricing) {
  if (!Array.isArray(pricing)) return [];
  return pricing.filter(
    (p) => p && typeof p === 'object' && !Array.isArray(p)
      && typeof p.label === 'string' && p.label.trim() !== ''
  );
}

const BADGE_TYPES = [
  { value: '', label: '��� �����' },
  { value: 'popular', label: '���� �����' },
  { value: 'deal', label: '�������' },
  { value: 'hit', label: '���' },
];

// 4 ����������������� ������� ������-������� (DESIGN.md �1) � �� ���������
// RGB-�����, ����� �� ��������� �������. ����� = ���� �� ��������� ���
// ���������� ���� ����� (��. HitBadge/EcoBadge/Badge �� ������).
// ������� ����� ��� ������-���� ����� �������� �� �������� (migrations/052).
// �����, � �� hex � �����������: � badge_color ���� �� ���� ������
// ������������ ��������, � ����� � ����� �������� ��� ���� ������������
// (��. Badge.jsx � ����-����). ���� ���/����� ��� ������ ��� �������������
// ����� �� �������, ������� ��� ������� ����� ��� ����� ���������� ����.
// ������� ��� ������ ���������� �� �������. �������� � �������� �
// CONTENTS_DICT � ����-���� (src/format.js): ����� ������ ������ ����� ��,
// ��� ���������� ������ ��� ������ ������. ����������� �� ������ � �����
// ����������� ��������� ���� �����, � �������� ������� ������.
const CONTENTS_DICT = [
  ['vegetables', '�����', /������|���|������|����|�����|������|����|�������|�����|�����|��������|�����|�����|����|�����|������|�������|����|�����|�����|�������|�������|����|�����/i],
  ['fruits',     '������', /�����|����|��������|��������|�����|����|�����|���������|������|��������|�������|����|��������|����|������|������|�����|�������|�����|���/i],
  ['greens',     '������', /�����|�����|�����|�������|����|�������|������|������|�����|��������|���|��������|������|�����|������|�������|�����/i],
  ['berries',    '�����',  /�������|��������|�����|������|�������|��������|������|����|������|�������|�������|�����/i],
];

const TAG_COLORS = [
  { value: '',       label: '������ (�� ���������)' },
  { value: 'green',  label: '������ � ��������, �����' },
  { value: 'orange', label: '��������� � ��������' },
  { value: 'ochre',  label: '���� � ��������, ��' },
  { value: 'berry',  label: '������� � ��������' },
];

const BADGE_COLORS = [
  { value: '', label: '�� ���������' },
  { value: '#1C8F1C', label: '������' },
  { value: '#D07812', label: '���������' },
  { value: '#153F15', label: 'Ҹ���-������' },
  { value: '#5A5550', label: '�����' },
];

const CATEGORIES = [
  { value: 'bundles', label: '������' },
  { value: 'vegetables', label: '�����' },
  { value: 'fruits', label: '������' },
  { value: 'greens', label: '������' },
];

const EMPTY_BUNDLE_ITEM = { id: 'new', itemName: '', itemEmoji: '', alternatives: [], isRemovable: true };

// ������� �������� �� 100 � � ������������ ����, �������� �������� �� form,
// ������ ��� �������� � ������� ������ ���� �������� (� �.�. �������), �
// � products.nutrition (JSON) � ������� ��� null ��� ��������� �������.
const EMPTY_NUTRITION = { calories: '', protein: '', fat: '', carbs: '' };

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  // �������� ����� ������
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ������ � ������� ����� � ����� ����� ��������, � ������ ����������� � �
  // ����� �����, ������� ������ � ��������� �������. ��� ����� ������� ��
  // ����������� � ���������� ID ��������� ���, ����� ������ �� ���������:
  // ��������� ���������� ������ ������, ��� ������� �������.
  // ������ �� ���������� (migrations/057). ���������� � ���� ������
  // ��������� �������, badgeIds � ����������� ����� ������ � ������
  // �������. ������� �������� �������� � �������: ������ ��������� ������
  // ������� � ��� ����������� sort_order.
  const [badgeLibrary, setBadgeLibrary] = useState(null);
  const [badgeIds, setBadgeIds] = useState([]);

  useEffect(() => {
    // ���������� ����� � ������ ������ � ��������, ��� ��� �����, �
    // ���������, ��� � ���������.
    api.getBadges().then(setBadgeLibrary).catch(() => setBadgeLibrary([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    api.getProductBadges(id).then((rows) => setBadgeIds(rows.map((r) => r.id))).catch(() => {});
  }, [id, isNew]);

  const moveBadge = (index, delta) => {
    setBadgeIds((prev) => {
      const next = [...prev];
      const to = index + delta;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const errorRef = useRef(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  // ������������ � �� �� ����� categories > subcategories, ��� � � �������
  // "������������" �������; ������ ������� �� ��������� ��������� ������.
  const [subcategories, setSubcategories] = useState([]);
  useEffect(() => {
    api.getSubcategories().then(setSubcategories).catch(() => {});
  }, []);
  const availableSubcategories = subcategories.filter((sc) => sc.categoryId === form.category);

  // ��������� ������ ��������������� (������ "���������������" � ��������)
  // � ������ ���� ���, ������ calcPricing() ��������������� �� ������ ����
  // ���������� ���� ����� �� ������, ��� ������ �� ������.
  const [pricingSettings, setPricingSettings] = useState(null);
  const [pricingSettingsError, setPricingSettingsError] = useState('');
  useEffect(() => {
    api.getPricingSettings()
      .then(setPricingSettings)
      .catch((e) => setPricingSettingsError(e.message));
  }, []);

  // ��������� ������� ����� (migrations/038): �������������� ����� ������ >
  // ����� ������������ > ���������� ���������. ������������ ������ �� ���
  // ������������ ������ subcategories; String() � ����� ������ � � �����
  // subcategoryId ���� ������� �� <select>, � DTO �������� ������.
  const currentSubcategory = subcategories.find((sc) => String(sc.id) === String(form.subcategoryId ?? ''));
  const subcategoryMarginPercent = currentSubcategory?.targetMarginPercent ?? null;
  const productMarginPercent = form.individualMarginPercent !== '' && form.individualMarginPercent != null
    ? Number(form.individualMarginPercent)
    : null;

  const purchasePriceNum = form.purchasePrice !== '' && form.purchasePrice != null ? Number(form.purchasePrice) : null;
  // ��� ������� �� �� ��� ������������ ���� effectiveCost = null � ����
  // ������� ���������� ������� ������� ���, � �� ������� �� ���� �� ��.
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

  // ������� �������� �� 100 � (�����������)
  const [nutrition, setNutrition] = useState(EMPTY_NUTRITION);

  // ��������������� ������ ������
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
          contentsSummary: Array.isArray(p.contentsSummary) ? p.contentsSummary : [],
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

  // ===== �������� ���� =====
  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // ===== ������ ������� ������ =====
  const updateContentsRow = (index, patch) => setForm((prev) => ({
    ...prev,
    contentsSummary: (prev.contentsSummary || []).map((r, i) => (i === index ? { ...r, ...patch } : r)),
  }));
  const addContentsRow = () => setForm((prev) => ({
    ...prev,
    contentsSummary: [...(prev.contentsSummary || []), { key: '', label: '', count: '' }],
  }));
  const removeContentsRow = (index) => setForm((prev) => ({
    ...prev,
    contentsSummary: (prev.contentsSummary || []).filter((_, i) => i !== index),
  }));

  // ������� �� �� �����, ��� ����-��� ������� ��� ��� ������ ���� � �����
  // ����� ���� ����� ����������� �� ������ � ��������� ������ ������ ��,
  // ��� ������� ������.
  const computeContentsFromComposition = () => {
    const counts = new Map();
    let unmatched = 0;
    for (const row of form.composition || []) {
      const name = Array.isArray(row) ? row[0] : null;
      const amount = Array.isArray(row) ? row[1] : null;
      if (!name || !amount) continue;
      const hit = CONTENTS_DICT.find(([, , re]) => re.test(name));
      if (hit) counts.set(hit[0], (counts.get(hit[0]) || 0) + 1);
      else unmatched += 1;
    }
    const rows = CONTENTS_DICT
      .filter(([key]) => counts.get(key) > 0)
      .map(([key, label]) => ({ key, label, count: counts.get(key) }));
    if (unmatched > 0 && rows.length < 5) rows.push({ key: 'other', label: '��� ���������', count: unmatched });
    updateField('contentsSummary', rows.slice(0, 5));
  };

  // ��������������� price = pricePerKg ? weightKg � ������, ��������������
  // ������ ����� ���� (������ � ������� ������ ���� "����, ?" ����). ����,
  // � �� ������ deps �� pricePerKg/weightKg: ��� �������� ����� ���
  // ������������� ������ �������� ����� setForm ����� ����������� �
  // pricePerKg, � weightKg � ��� ����� ������ �������� �� �� ���� ��
  // �������� � ����� ��������� �� price, ���� ���� ����� �����-�� ���������
  // ��������� � ������� ������ ������ �����������. �������� � true ������
  // �� onChange ����� "���� �� ��"/"��� ��� �������" ���� � �� ���� ������
  // �� �������� ����, �� �� ����������� ���������� �����.
  const pricingInputsTouchedRef = useRef(false);
  useEffect(() => {
    if (!pricingInputsTouchedRef.current || form.pricingUnit !== 'kg') return;
    const perKg = Number(form.pricePerKg);
    const weight = Number(form.weightKg);
    if (!(perKg > 0) || !(weight > 0)) return;
    setForm((prev) => ({ ...prev, price: String(Math.round(perKg * weight)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pricePerKg, form.weightKg, form.pricingUnit]);

  // ����� ��������� ���������� ������������ � ����� ��������� �������������
  // ���� (������������ ������ ���������, ������� ������������ ������ �� �����).
  const updateCategory = (value) =>
    setForm((prev) => ({ ...prev, category: value, subcategoryId: null }));

  const updateBadgeField = (field, value) =>
    setForm((prev) => {
      const badge = prev.badge || { type: '', label: '' };
      return { ...prev, badge: { ...badge, [field]: value } };
    });

  const updateNutritionField = (field, value) =>
    setNutrition((prev) => ({ ...prev, [field]: value }));

  // ===== ������ (����������� ��� ������� ��������) =====
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

  // ===== ���������� =====
  const updateSupplier = (index, field, value) =>
    setForm((prev) => {
      const suppliers = [...prev.suppliers];
      suppliers[index] = { ...suppliers[index], [field]: value };
      return { ...prev, suppliers };
    });
  const addSupplier = () =>
    setForm((prev) => ({
      ...prev,
      suppliers: [...prev.suppliers, { emoji: '?????', name: '', region: '', note: '', imageUrl: '' }],
    }));
  const removeSupplier = (index) =>
    setForm((prev) => ({ ...prev, suppliers: prev.suppliers.filter((_, i) => i !== index) }));

  // ===== ������� �������� =====
  // ����� ��-������� (��. normalizePricing ����) � �������� ���� �����
  // ������, ������� pricing[index] ��������������� ������� ��������, ����
  // �� ����� �������� �� {label,sub,pct,amount,color}.
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
  // amount ������� �� ��� �������� ����, ���� ��� ���� � ����� 0, �����
  // ��������� ���� ����� � ����� ����� ����� ����������� �������.
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

  // �� blur �������� (����� ���� ��� ���� ��������, �� �� ������ �������
  // ������� � ����� �������� �������� ����� ������ ������ ������ ��
  // ������������� ������������������ � ��������� �����) ���������������
  // ������������ ��������� ������, ����� ����� ��������� ����� ���� 100,
  // �������� �� �������� �����������. ���� ��������� � ����� ���� 0 �
  // ������ ��������������� ������, ����� ������� �������.
  // ��� ����� � ���� ���� ������������� amount ���� ����� pricing ��� �����
  // ���� �� �� ������� ��������� � ���� �������� �� �������, ������ �����.
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
      // ����� ��������, �� ������� � ������� ��������� �������� �� step
      // ���� ����� step="0.1" �� ������ (��. ������), ������� ������ ��
      // ����������� ������� �������� ������.
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

      // ���������� ������ ������ �� ����������� ����� ������ ����� ��
      // ������� �� ������� � ������������ ������� ��������� �������, �����
      // ����� ���� ����� (������� ���������) ���� ����� 100 �����.
      const drift = remainder - newOtherValues.reduce((a, b) => a + b, 0);
      newOtherValues[newOtherValues.length - 1] += drift;

      otherIndices.forEach((i, idx) => {
        next[i] = { ...next[i], pct: newOtherValues[idx], amount: amountFor(newOtherValues[idx]) };
      });
      return { ...prev, pricing: next };
    });

  // ===== ��������������� ������ ������ =====
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
      setBundleError('������� �������� �������');
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
    if (!window.confirm('������� ������� �� �������?')) return;
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

  // ===== ���������� ������ =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // ������� �� ����� ������� �����, � �� ������ � ��������: ������
    // �������� ��� �� form.id.trim(), � �� ������ ������ ����� form.id �
    // ���� ������ � ����� (������, ��� ������� �� ������) ��������
    // �������� � ����� ��� ���������� �������.
    const productId = normalizeProductId(form.id);
    const title = form.title.trim();
    const slug = form.slug.trim();
    if (!productId || !title || !form.category) {
      setError('��������� ������������ ����: ID, ��������, ���������');
      return;
    }
    // �� �� ���������, ��� �� �������. �������� ��� �� ���� ������������, �
    // ���� �������� ���������: ������ ������� ������� ��������� �����,
    // ����� � �����, � �������, ��������� �Tomato-1�, �� �������, ���
    // ������ �� ��� � ��� ������ ������� ��� �� ������� �� �����.
    if (!PRODUCT_ID_RE.test(productId)) {
      setError('ID: ������ �������� ��������� �����, ����� � ����� � ��������, tomato-cherry');
      return;
    }
    // ������� �������� ����������� �������: ���� �� ���� ���� �� ��������� �
    // nutrition = null (������ � ������ ��� ������), ����� �������� ������
    // ������ (������ ���� ������ ������������ ����� ��������� ����).
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
      id: productId,
      title,
      slug,
      price: Number(form.price) || 0,
      oldPrice: form.oldPrice !== '' && form.oldPrice != null ? Number(form.oldPrice) : null,
      purchasePrice: form.purchasePrice !== '' && form.purchasePrice != null ? Number(form.purchasePrice) : null,
      pricingUnit: form.pricingUnit === 'kg' ? 'kg' : 'piece',
      weightKg: form.pricingUnit === 'kg' && form.weightKg !== '' ? Number(form.weightKg) : null,
      pricePerKg: form.pricingUnit === 'kg' && form.pricePerKg !== '' ? Number(form.pricePerKg) : null,
      individualMarginPercent: form.individualMarginPercent !== '' ? Number(form.individualMarginPercent) : null,
      sortOrder: Number(form.sortOrder) || 0,
      badge: form.badge && form.badge.type ? form.badge : null,
      origin: form.origin?.trim() || null,
      composition: form.composition.filter((row) => row[0] || row[1]),
      suppliers: form.suppliers.filter((s) => s.name),
      pricing: form.pricing.map((p) => ({
        ...p,
        pct: Number(p.pct) || 0,
        amount: Number(p.amount) || 0,
      })),
      isBundle: form.isBundle === true,
      // ������ � ��������������� ������ �� ���������: � �������� ������ ����
      // � �������, � �����, ����� �� �������� ������ ��������� ������ ������.
      contentsSummary: (form.contentsSummary || [])
        .filter((r) => r.label && Number(r.count) > 0)
        .map((r) => ({ key: r.key || 'other', label: r.label, count: Number(r.count) }))
        .slice(0, 5),
      nutrition: nutritionPayload,
    };
    setSaving(true);
    try {
      if (isNew) {
        await api.createProduct(payload);
      } else {
        await api.updateProduct(id, payload);
        // ������ � ��������� ������ � ������ � ������������� ������:
        // �������� ��������� �� products.id, �������� � ������ ������ ��
        // �������� ��� ���. ������ ����� updateProduct � ���� ����� ��
        // ����������, ������ ��� ������ �������.
        await api.setProductBadges(id, badgeIds);
      }
      navigate('/products');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">��������</div>;

  return (
    <div>
      <div className="page-header">
        <h2>{isNew ? '����� �����' : `��������������: ${form.title}`}</h2>
      </div>

      {error && <div ref={errorRef} className="alert error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: 24 }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="id">ID ������</label>
              <input
                id="id"
                type="text"
                value={form.id}
                // �������� ���� � ����������� ���� ����� � ����, � ��
                // �������� ����� �����������: ��������� ����������
                // �����������������, ��������� ����������, ������� �
                // ������������� ���������� �������. � ���� ��������� ��
                // ����� ��������� ��������, ������� ��������� ������.
                onChange={(e) => updateField('id', productIdFromInput(e.target.value))}
                disabled={!isNew}
                placeholder="��������, tomato-cherry"
                required
              />
              <div className="hint">
                {isNew
                  ? '�������� ��������, ����� � �����. ����� �������� ��-������ � ���������� ����. ������������ �� ���������� ������ (������, ������, ��������), �������� ����� ������.'
                  : 'ID ������ �������� ������ ����� �������� � ��� ���������� �����, �� ������������ ����������. ��� �������������� ����������� ���� "����" ����.'}
              </div>
            </div>

            <div className="field">
              <label htmlFor="slug">���� (����� ������)</label>
              <input
                id="slug"
                type="text"
                value={form.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                placeholder="��������, tomato"
              />
              <div className="hint">
                ���������������� ������������� ��� ������� � � ������� �� ID, ����� ������ � �����
                ������. �� ������������ � ������� ����������.
              </div>
            </div>

            <div className="field">
              <label htmlFor="title">��������</label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="��������, ������ ��������"
                required
              />
            </div>

            {/* ������������� � ��������� �����, � �� ������ ��������:
                �� ������� ��� ��������� ����� ������� ��� ���������.
                ������ ��������� � �������������� (����������,
                ����������� ��������, ���л) � ����������� �������� �
                ������� ���. ����� � ������ �� ������� �� ��������. */}
            <div className="field">
              <label htmlFor="origin">�������������</label>
              <input
                id="origin"
                type="text"
                value={form.origin || ''}
                onChange={(e) => updateField('origin', e.target.value)}
                placeholder="��������, ���������"
              />
              <div className="hint">
                �����, ������ ��� ������. ������������ �� ������� ��������� ������� ���
                ��������� � ��������� ��� � ���� �������� �� �����. ������� �� ��������.
              </div>
            </div>

            <div className="field">
              <label htmlFor="price">����, ?</label>
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
                  ? ���� ���� ������������� � �� ������� � ������!
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="oldPrice">������ ���� (��� ������������)</label>
              <input
                id="oldPrice"
                type="number"
                min="0"
                value={form.oldPrice}
                onChange={(e) => updateField('oldPrice', e.target.value)}
                placeholder="�� ��������� � ������ �� ������������"
              />
              <div className="hint">
                ������������ ����������� ����� � ������� �����, ������ ���� ������ �������.
              </div>
            </div>

            <div className="field">
              <label htmlFor="pricingUnit">������� �������</label>
              <select
                id="pricingUnit"
                value={form.pricingUnit}
                onChange={(e) => updateField('pricingUnit', e.target.value)}
              >
                <option value="piece">�� ����� / ��������</option>
                <option value="kg">�� ���������</option>
              </select>
              <div className="hint">
                ��� ��������� � ���������� ���� �������� �� ��, ��������� ��������
                ��������� ����� ��� ��� ������� ����. ��������� ���� ���� / ��������
                ������ �� ��� �� ������ � ��� ������ ��� ����������.
              </div>
            </div>

            <div className="field">
              <label htmlFor="purchasePrice">
                {form.pricingUnit === 'kg' ? '���������� ���� �� ��, ?' : '���������� ����, ?'}
              </label>
              <input
                id="purchasePrice"
                type="number"
                min="0"
                step="any"
                value={form.purchasePrice ?? ''}
                onChange={(e) => updateField('purchasePrice', e.target.value)}
                placeholder="��������, 120"
              />
              <div className="hint">
                {form.pricingUnit === 'kg'
                  ? '������� �� ������� ���������� �� ���������. ������������� � ���� �����, ������ ������������� ���� ���� ������ �� ������������.'
                  : '������� �� ������� ���������� �� �������. ������������� � ���� �����, ������ ������������� ���� ���� ������ �� ������������.'}
              </div>
            </div>

            {form.pricingUnit === 'kg' && (
              <div className="field">
                <label htmlFor="weightKg">��� ��� �������, ��</label>
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
                  placeholder="��������, 0.7"
                />
                <div className="hint">
                  {effectiveCost != null && purchasePriceNum != null
                    ? `������� ��������: ${purchasePriceNum.toLocaleString('ru-RU')} ?/�� ? ${Number(form.weightKg).toLocaleString('ru-RU')} �� = ${fmtRub(effectiveCost)} ?`
                    : '����������� ��� ��������/������ � ����������� � �� ������������ ���������� ��������. ������������ ��� ������� �������, � ���� ��������� ����� �� �� ��� ����������� ���� � �� � ��� ��������������� ��������� ����.'}
                </div>
              </div>
            )}

            {form.pricingUnit === 'kg' && (
              <div className="field">
                <label htmlFor="pricePerKg">���� �� �� ��� ����������, ? (�������������)</label>
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
                  placeholder="��������, 39"
                />
                <div className="hint">
                  {form.pricePerKg && form.weightKg
                    ? `�� �������� ������ ������� ������� �������� �${Number(form.pricePerKg).toLocaleString('ru-RU')} ?/�� ������ ������� ����. ���� ������ ����������� �������������: ${Number(form.pricePerKg).toLocaleString('ru-RU')} ?/�� ? ${Number(form.weightKg).toLocaleString('ru-RU')} �� = ${Math.round(Number(form.pricePerKg) * Number(form.weightKg)).toLocaleString('ru-RU')} ? � ����� ��������� ������� ����.`
                    : '��� ��������� ���� ��� ���������� (�� ����������!) � ��������� ������ ����� �39 ?/��, ��� � �������/���� �� Ozon. ��������� ������ � ����� ���� � ���� ������ ����������� ����. ����� � �������� �������� ��� ������.'}
                </div>
              </div>
            )}

            <div className="field">
              <label htmlFor="individualMarginPercent">�������������� �����, % (�������������)</label>
              <input
                id="individualMarginPercent"
                type="number"
                min="0"
                step="any"
                value={form.individualMarginPercent ?? ''}
                onChange={(e) => updateField('individualMarginPercent', e.target.value)}
                placeholder="����� ������������ ��� �����"
              />
              <div className="hint">
                ��� ��������� ������� ��� ���������� � �������������� ����� ������������.
                ����� � ��������� ����� ������������, � ���� � � ���, ����� ���������
                �� ������� ����������������.
              </div>
            </div>

            {purchasePriceNum != null && (
              <div className="field full">
                {pricingSettingsError ? (
                  <div className="hint" style={{ color: 'var(--danger)' }}>
                    �� ������� ��������� ��������� ���������������: {pricingSettingsError}
                  </div>
                ) : effectiveCost == null ? (
                  <div className="hint" style={{ color: 'var(--danger)' }}>
                    ������� ������� �� ��������� � ������� ���� ��� �������, ��, ����� ���������
                    ��������� �������� � ������������ �� ����.
                  </div>
                ) : !pricingSettings ? (
                  <div className="hint">�������� �������� ����������������</div>
                ) : pricingResult.error ? (
                  <div className="hint" style={{ color: 'var(--danger)' }}>{pricingResult.error}</div>
                ) : (
                  <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '6px 20px', fontSize: 13, color: 'var(--ink)', marginBottom: 16,
                    }}>
                      {form.pricingUnit === 'kg' && (
                        <div>������� ��������: <b>{fmtRub(effectiveCost)} ?</b></div>
                      )}
                      <div>������������� �������: <b>{fmtRub(pricingResult.unitCost)} ?</b></div>
                      <div>���� ���������� ��������: <b>{fmtRub(pricingResult.fixedShare)} ?</b></div>
                      <div>
                        ������� �����: <b>{pricingResult.marginPercent.toLocaleString('ru-RU')}%</b>{' '}
                        <span style={{ color: 'var(--ink-soft)' }}>
                          {pricingResult.marginSource === 'product'
                            ? '(��������������)'
                            : pricingResult.marginSource === 'subcategory'
                              ? `(������������${currentSubcategory?.name ? ` �${currentSubcategory.name}�` : ''})`
                              : '(����� ���������)'}
                        </span>
                      </div>
                    </div>
                    {/* �������� ���: ��������� > ������������� > �����������
                        (����� ?1.5 � ��� �� �������, ��. pricingCalc.js). */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 12, marginBottom: 12,
                    }}>
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)', fontWeight: 800 }}>
                          ����������� (���������)
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
                          {fmtRub(pricingResult.breakEvenPrice)} ?
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)', fontWeight: 800 }}>
                          �������������
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)' }}>
                          {fmtRub(pricingResult.recommendedPrice)} ?
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)', fontWeight: 800 }}>
                          ����������� (����� ?1.5)
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
                          {pricingResult.premiumPrice != null ? `${fmtRub(pricingResult.premiumPrice)} ?` : '�'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => updateField('price', String(Math.round(pricingResult.recommendedPrice)))}
                      >
                        ���������� �������������
                      </button>
                    </div>

                    {currentPriceMargin && Number(form.price) > 0 && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '6px 20px', fontSize: 13, color: 'var(--ink)', marginBottom: 8,
                        }}>
                          <div>����� �� ������� ����: <b>{currentPriceMargin.marginPercent.toFixed(1)}%</b></div>
                          <div>������� � �������: <b>{fmtRub(currentPriceMargin.profitPerUnit)} ?</b></div>
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
              <label htmlFor="weight">��� / �������� ������</label>
              <input
                id="weight"
                type="text"
                value={form.weight}
                onChange={(e) => updateField('weight', e.target.value)}
                placeholder="��������, 1 ��, ���� ������"
              />
            </div>

            <div className="field">
              <label htmlFor="category">���������</label>
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
              <label htmlFor="subcategory">������������ (�����������)</label>
              <select
                id="subcategory"
                value={form.subcategoryId ?? ''}
                onChange={(e) => updateField('subcategoryId', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">��� ������������</option>
                {availableSubcategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
              {availableSubcategories.length === 0 && (
                <div className="hint">��� ���� ��������� ������������ ���� ���</div>
              )}
            </div>

            <div className="field">
              <label htmlFor="emoji">������ (�������� ������)</label>
              <input
                id="emoji"
                type="text"
                value={form.emoji}
                onChange={(e) => updateField('emoji', e.target.value)}
                placeholder="??"
              />
            </div>

            <div className="field full">
              <label>���������� ������ (�����������)</label>
              <ImageUploadField
                value={form.imageUrl || ''}
                onChange={(url) => updateField('imageUrl', url)}
                label="���� ������"
              />
              <div className="hint" style={{ marginTop: 6 }}>���� ��������� � ���� ������������ ������ ������ � �������� � �������� ������.</div>
            </div>

            <div className="field full">
              <label>���� ��� ������� (�����������)</label>
              <ImageUploadField
                value={form.homeImageUrl || ''}
                onChange={(url) => updateField('homeImageUrl', url)}
                label="���� ��� �������"
              />
              <div className="hint" style={{ marginTop: 6 }}>
                ������ ��� ����� �������� ������� �� ������� � ���������� �� ���� ������ ����. �� ��������� � ������� ������ ������� ���� ������.
              </div>
            </div>

            <div className="field full">
              <label>����� ��� ������� (�����������)</label>
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
                label="�����"
                value={form.homeVideoUrl || ''}
                onChange={(url) => updateField('homeVideoUrl', url)}
              />
              <div className="hint" style={{ marginTop: 6 }}>
                ����������� ����� ����� ������� ����� � hero-�������� �������� ������� �� ������� � �������� �������� ������ �� �����.
                ��������� ������� � ����� � �������� �� �������, ���� � ��������� ��������. ����� �� �����: ����� ������ ������ ��� ����.
                ���� ��� ������� ���� ������� ��������, ���� ����� ��������.
              </div>
            </div>

            <div className="field full">
              <label>��� ������ ������ � �������� ��������� (�����������)</label>
              {(form.contentsSummary || []).map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input
                    type="text"
                    value={row.label || ''}
                    onChange={(e) => updateContentsRow(i, { label: e.target.value })}
                    placeholder="�����"
                    style={{ flex: 2 }}
                  />
                  <input
                    type="text"
                    value={row.key || ''}
                    onChange={(e) => updateContentsRow(i, { key: e.target.value })}
                    placeholder="vegetables"
                    style={{ flex: 2 }}
                  />
                  <input
                    type="number"
                    value={row.count ?? ''}
                    onChange={(e) => updateContentsRow(i, { count: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="12"
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn-secondary" onClick={() => removeContentsRow(i)}>?</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn-secondary" onClick={addContentsRow} disabled={(form.contentsSummary || []).length >= 5}>
                  + ������
                </button>
                <button type="button" className="btn-secondary" onClick={computeContentsFromComposition}>
                  ��������� �� �������
                </button>
                {(form.contentsSummary || []).length > 0 && (
                  <button type="button" className="btn-secondary" onClick={() => updateField('contentsSummary', [])}>
                    ��������
                  </button>
                )}
              </div>
              <div className="hint" style={{ marginTop: 6 }}>
                �� ���� �������� � ����� ���� ������ ������ �� �������� ������. ���� � id ��������� ��������
                (vegetables / fruits / greens / berries) � �� ���� ������������� ��������; ��� ��������� ��������
                ����� ������� <code>other</code>. �������� ������ ������ � ���������� ��������� ��������� ���� ��
                ������� ������, � ������ ��� ����� ������ ���, ��� ����������� ������.
              </div>
            </div>

            <div className="field">
              <label htmlFor="audienceLabel">�� �������� ������� (�����������)</label>
              <input
                id="audienceLabel"
                type="text"
                value={form.audienceLabel || ''}
                onChange={(e) => updateField('audienceLabel', e.target.value)}
                placeholder="1-2 ��������"
              />
            </div>
            <div className="field">
              <label htmlFor="termLabel">�� ����� ���� (�����������)</label>
              <input
                id="termLabel"
                type="text"
                value={form.termLabel || ''}
                onChange={(e) => updateField('termLabel', e.target.value)}
                placeholder="�� 5-7 ����"
              />
            </div>
            <div className="field full">
              <div className="hint">
                ��� ������ ���� ����� ����� � ����� �� ������� �������� ������ �� ������� (?? / ?? / ??) � ��������� ��������, ��� �������� �
                ������� �� ��������. �� ��������� � ����� ��������� ������� ����� �� �������� ������ (����� ����� �� ������� > ���� ������ /
                ��� �������), ��� ���� ������.
              </div>
            </div>

            <div className="field">
              <label htmlFor="cardEmoji">������-��� ��� �������� ������ (�����������)</label>
              <input
                id="cardEmoji"
                type="text"
                value={form.cardEmoji || ''}
                onChange={(e) => updateField('cardEmoji', e.target.value)}
                placeholder="??"
              />
            </div>
            <div className="field">
              <label htmlFor="cardTitle">�������� �������� ��� �������� (�����������)</label>
              <input
                id="cardTitle"
                type="text"
                value={form.cardTitle || ''}
                onChange={(e) => updateField('cardTitle', e.target.value)}
                placeholder="�� 1-2 ��������"
              />
            </div>
            <div className="field full">
              <label htmlFor="cardSubtitle">�������� ��������� ��� �������� (�����������)</label>
              <input
                id="cardSubtitle"
                type="text"
                value={form.cardSubtitle || ''}
                onChange={(e) => updateField('cardSubtitle', e.target.value)}
                placeholder="�� ��������� ����"
              />
              <div className="hint" style={{ marginTop: 6 }}>
                ��� ���� ���� � ������ ��� ��������� �������� �������� ������� �� ������� � � ������ �������: �������� �������� �� ��������
                ������ ������� �������� ������. �������� � ��� ���� (������������ � ���� ������, ������ ��������) �� ��������. �� ��������� �
                �������� ������� ������� �������� � ���, ��� ������.
              </div>
            </div>

            <div className="field">
              <label htmlFor="bg">��� �������� (CSS)</label>
              <input
                id="bg"
                type="text"
                value={form.bg}
                onChange={(e) => updateField('bg', e.target.value)}
                placeholder="linear-gradient(135deg, #FCE9E6, #fff)"
              />
              <div className="hint">�������� ��� ���� ���� �� ������ �� �������� ������.</div>
            </div>

            <div className="field">
              <label htmlFor="sortOrder">������� ����������</label>
              <input
                id="sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={(e) => updateField('sortOrder', e.target.value)}
              />
              <div className="hint">������ ����� � ���� � ��������.</div>
            </div>

            <div className="field checkbox-field full">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => updateField('isActive', e.target.checked)}
              />
              <label htmlFor="isActive">���������� ����� � ����������</label>
            </div>

            <div className="field checkbox-field full">
              <input
                id="inStock"
                type="checkbox"
                checked={form.inStock === false}
                onChange={(e) => updateField('inStock', !e.target.checked)}
              />
              <label htmlFor="inStock">����� ����������</label>
              <div className="hint" style={{ marginTop: 4 }}>
                � ������� �� ����������� ����� � ���������� � ����� �������
                � ��������, �� � ����� ����, ������� ���������� � �������
                ��������� � ������ ������ �� ������� (DESIGN.md �4.1).
              </div>
            </div>

            <div className="field checkbox-field full">
              <input
                id="isBundle"
                type="checkbox"
                checked={form.isBundle || false}
                onChange={(e) => updateField('isBundle', e.target.checked)}
              />
              <label htmlFor="isBundle">����� � ��������������� ��������</label>
              <div className="hint" style={{ marginTop: 4 }}>
                ���� ��������, ���������� ������ �������� ������ ������ ��� ���������� ������.
              </div>
            </div>
          </div>

          <div className="section-label">��� ��� ����� �������� �� �������� (�����������)</div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="tagLabel">����� ����</label>
              <input
                id="tagLabel"
                type="text"
                value={form.tagLabel || ''}
                onChange={(e) => updateField('tagLabel', e.target.value)}
                placeholder="��������, �������!"
              />
            </div>
            <div className="field">
              <label htmlFor="tagColor">���� ����</label>
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
                ����������� ����� ���� ��� ������� ����� � ���� �������� �� �������� �� ������� � �������� �������� ������ �� �����.
                ������� � ������ ������ ����� ����� ������ ������� �� ������� �������� �� �������� ������� �������� ��������; ���� ��������
                ��� �����, � ���� �������� ��� ������ � ����������� �����. ��� ��� �� ������� �� ���������� � �� ������ �������� ������.
                ������ ��, ��� ������ ��� ��� ������� (��������!�, ����������, �������), � ��� �� ������ ����� ����, ��� ���� ����
                ������ �� �������� ����.
              </div>
            </div>
          </div>

          <div className="section-label">����� �� �������� (�����������)</div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="badgeType">��� �����</label>
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
              <label htmlFor="badgeLabel">����� �����</label>
              <input
                id="badgeLabel"
                type="text"
                value={form.badge?.label || ''}
                onChange={(e) => updateBadgeField('label', e.target.value)}
                placeholder="��������, ���"
                disabled={!form.badge?.type}
              />
            </div>
            <div className="field">
              <label htmlFor="badgeColor">���� �����</label>
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

          {/* -- ������ �� ���������� (migrations/057) ------------------
              �������� �� ������ �� �������� ����: �� ����� �
              products.badge_type �, ����� ����, ��������� � �������
              ������ ������. ����� � ������ ����������, ���� ����������
              ������������� � ������� ������� �������.

              ����������� ������ � �������, ����� ������� �����������
              ����� �����: ��������� ������ ����� �� ������� �������� ��,
              ��� ����� ������ ������ �� ������, � ����� ���. � ������
              ������ ���� �� ������������ � ����������� ������ �� � ����,
              ���� � ������ ��� id. */}
          <div className="section-label">������ ({badgeIds.length})</div>
          <div className="form-grid">
            <div className="field full">
              {badgeLibrary === null ? (
                <div className="hint">�������� ���������� �������</div>
              ) : badgeLibrary.length === 0 ? (
                <div className="hint">
                  ���������� �����. �������� ����� � ������� ������� ������� � �� �������� � ���� ������.
                </div>
              ) : isNew ? (
                <div className="hint">
                  ������ ����� ����� ��������� ����� �������� ������.
                </div>
              ) : (
                <>
                  {badgeIds.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {badgeIds.map((id, i) => {
                        const b = badgeLibrary.find((x) => x.id === id);
                        if (!b) return null;
                        return (
                          <div
                            key={id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                              padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)',
                              opacity: b.isActive ? 1 : 0.55,
                            }}
                          >
                            <span style={{ width: 22, textAlign: 'center', fontWeight: 800, color: 'var(--ink-soft)' }}>{i + 1}</span>
                            <BadgePreview badge={b} scale={1.6} />
                            {!b.isActive && <span className="hint">�������� � �� ������������ ����������</span>}
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                              {/* ������ �����/����, � �� drag-and-drop:
                                  � ������� ��� �� ����� ���������������
                                  �������, � �������� � ���� ����-���
                                  ����� ������������. */}
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => moveBadge(i, -1)}
                                disabled={i === 0}
                                aria-label="����"
                              >
                                ^
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => moveBadge(i, 1)}
                                disabled={i === badgeIds.length - 1}
                                aria-label="����"
                              >
                                v
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => setBadgeIds((prev) => prev.filter((x) => x !== id))}
                              >
                                ������
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value=""
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        if (id) setBadgeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                      }}
                      style={{ flex: '1 1 220px', minWidth: 0 }}
                      aria-label="�������� �����"
                    >
                      <option value="">+ �������� �����</option>
                      {badgeLibrary
                        .filter((b) => !badgeIds.includes(b.id))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {(b.icon ? b.icon + ' ' : '') + b.label + (b.isActive ? '' : ' (��������)')}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="hint" style={{ marginTop: 8 }}>
                    ������ � ������ � ���, ��� ������ �� �������� ������ � �������� � �� �������: ��� ����������
                    ���� �����. �� �������� ������ ������������ ��� ����������.
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="section-label">������� �������� �� 100 � (�����������)</div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="nutCalories">�������, ����</label>
              <input
                id="nutCalories"
                type="number"
                min="0"
                step="1"
                value={nutrition.calories}
                onChange={(e) => updateNutritionField('calories', e.target.value)}
                placeholder="��������, 52"
              />
            </div>
            <div className="field">
              <label htmlFor="nutProtein">�����, �</label>
              <input
                id="nutProtein"
                type="number"
                min="0"
                step="0.1"
                value={nutrition.protein}
                onChange={(e) => updateNutritionField('protein', e.target.value)}
                placeholder="��������, 1.1"
              />
            </div>
            <div className="field">
              <label htmlFor="nutFat">����, �</label>
              <input
                id="nutFat"
                type="number"
                min="0"
                step="0.1"
                value={nutrition.fat}
                onChange={(e) => updateNutritionField('fat', e.target.value)}
                placeholder="��������, 0.2"
              />
            </div>
            <div className="field">
              <label htmlFor="nutCarbs">��������, �</label>
              <input
                id="nutCarbs"
                type="number"
                min="0"
                step="0.1"
                value={nutrition.carbs}
                onChange={(e) => updateNutritionField('carbs', e.target.value)}
                placeholder="��������, 11.3"
              />
            </div>
            <div className="field full">
              <div className="hint">
                �������� ��� ���� �������, ���� ������� �������� �� ��������� (��������, � �������).
              </div>
            </div>
          </div>

          <div className="section-label">������ ������</div>
          <div className="repeat-list">
            {form.composition.map((row, i) => (
              <div className="repeat-row" key={i}>
                <div className="field">
                  <label>����������</label>
                  <input
                    type="text"
                    value={row[0] || ''}
                    onChange={(e) => updateCompositionItem(i, 0, e.target.value)}
                    placeholder="��������, �������"
                  />
                </div>
                <div className="field">
                  <label>����������</label>
                  <input
                    type="text"
                    value={row[1] || ''}
                    onChange={(e) => updateCompositionItem(i, 1, e.target.value)}
                    placeholder="��������, 0.5 ��"
                  />
                </div>
                <button type="button" className="remove-btn" onClick={() => removeCompositionItem(i)}>
                  ?
                </button>
              </div>
            ))}
            <button type="button" className="add-row-btn" onClick={addCompositionItem}>
              + �������� ����������
            </button>
          </div>

          <div className="section-label">����������</div>
          <div className="repeat-list">
            {form.suppliers.map((s, i) => (
              <div className="repeat-row" key={i}>
                <div className="field" style={{ flex: '0 0 80px' }}>
                  <label>������</label>
                  <input
                    type="text"
                    value={s.emoji || ''}
                    onChange={(e) => updateSupplier(i, 'emoji', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>��� ����������</label>
                  <input
                    type="text"
                    value={s.name || ''}
                    onChange={(e) => updateSupplier(i, 'name', e.target.value)}
                    placeholder="��������, ������ ������"
                  />
                </div>
                <div className="field">
                  <label>���� ����������</label>
                  <ImageUploadField
                    value={s.imageUrl || ''}
                    onChange={(url) => updateSupplier(i, 'imageUrl', url)}
                    label="���� ����������"
                  />
                </div>
                <div className="field">
                  <label>������</label>
                  <input
                    type="text"
                    value={s.region || ''}
                    onChange={(e) => updateSupplier(i, 'region', e.target.value)}
                    placeholder="��������, ������������� ����"
                  />
                </div>
                <div className="field">
                  <label>����������</label>
                  <input
                    type="text"
                    value={s.note || ''}
                    onChange={(e) => updateSupplier(i, 'note', e.target.value)}
                    placeholder="��������, ������� �����"
                  />
                </div>
                <button type="button" className="remove-btn" onClick={() => removeSupplier(i)}>
                  ?
                </button>
              </div>
            ))}
            <button type="button" className="add-row-btn" onClick={addSupplier}>
              + �������� ����������
            </button>
          </div>

          <div className="section-label">�� ���� ������������ ����</div>
          <div className="repeat-list">
            {form.pricing.length === 0 && (
              <button type="button" className="add-row-btn" onClick={fillStandardPricingTemplate}>
                ��������� ����������� ��������
              </button>
            )}
            {form.pricing.map((p, i) => (
              <div className="repeat-row" key={i}>
                <div className="field">
                  <label>������</label>
                  <input
                    type="text"
                    value={p.label || ''}
                    onChange={(e) => updatePricingItem(i, 'label', e.target.value)}
                    placeholder="��������, ����������"
                  />
                </div>
                <div className="field">
                  <label>���������</label>
                  <input
                    type="text"
                    value={p.sub || ''}
                    onChange={(e) => updatePricingItem(i, 'sub', e.target.value)}
                    placeholder="��������, ������ �������� ��������"
                  />
                </div>
                <div className="field" style={{ flex: '0 0 90px' }}>
                  <label>�������</label>
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
                  <label>�����, ?</label>
                  <input
                    type="number"
                    min="0"
                    value={p.amount}
                    onChange={(e) => updatePricingItem(i, 'amount', e.target.value)}
                  />
                </div>
                <div className="field" style={{ flex: '0 0 100px' }}>
                  <label>����</label>
                  <input
                    type="text"
                    value={p.color || ''}
                    onChange={(e) => updatePricingItem(i, 'color', e.target.value)}
                    placeholder="#5C8A52"
                  />
                </div>
                <button type="button" className="remove-btn" onClick={() => removePricingItem(i)}>
                  ?
                </button>
              </div>
            ))}
            <button type="button" className="add-row-btn" onClick={addPricingItem}>
              + �������� ������
            </button>
            <div className="hint">����� ��������� ������ ������ ��������� 100%.</div>
          </div>
        </div>

        {/* ��������������� ������ � ������ ��� ������������ ������� � isBundle */}
        {form.isBundle && (
          <div className="card" style={{ padding: 24, marginTop: 16 }}>
            <div className="section-label" style={{ marginTop: 0 }}>��������������� ������ ������</div>

            {isNew ? (
              <div className="hint">��������� ����� ������� � ����� �������� ������� ������� �����.</div>
            ) : (
              <>
                {bundleError && <div className="alert error" style={{ marginBottom: 12 }}>{bundleError}</div>}

                {/* ������ ������� */}
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
                          /* ����� �������������� ������� */
                          <div>
                            <div className="form-grid" style={{ marginBottom: 10 }}>
                              <div className="field" style={{ flex: '0 0 80px' }}>
                                <label>������</label>
                                <input
                                  type="text"
                                  value={editingItem.itemEmoji}
                                  onChange={(e) => setEditingItem((p) => ({ ...p, itemEmoji: e.target.value }))}
                                  placeholder="??"
                                />
                              </div>
                              <div className="field">
                                <label>�������� *</label>
                                <input
                                  type="text"
                                  value={editingItem.itemName}
                                  onChange={(e) => setEditingItem((p) => ({ ...p, itemName: e.target.value }))}
                                  placeholder="��������, �������"
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
                                <label htmlFor={`removable-${item.id}`}>����� ������</label>
                              </div>
                            </div>

                            <div style={{ marginBottom: 10 }}>
                              <div className="hint" style={{ marginBottom: 6 }}>�������� ������:</div>
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
                                      ?
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                <div className="field" style={{ flex: '0 0 70px', marginBottom: 0 }}>
                                  <label style={{ fontSize: 11 }}>������</label>
                                  <input
                                    type="text"
                                    value={newAltEmoji}
                                    onChange={(e) => setNewAltEmoji(e.target.value)}
                                    placeholder="??"
                                  />
                                </div>
                                <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                                  <label style={{ fontSize: 11 }}>�������� ������</label>
                                  <input
                                    type="text"
                                    value={newAltName}
                                    onChange={(e) => setNewAltName(e.target.value)}
                                    placeholder="��������, ������"
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
                                  + ��������
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
                                {bundleItemSaving ? '����������' : '���������'}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={cancelEditBundleItem}
                                disabled={bundleItemSaving}
                              >
                                ������
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ����� ��������� ������� */
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20, flexShrink: 0 }}>{item.itemEmoji || '�'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.itemName}</div>
                              <div style={{ fontSize: 12, color: '#6b7280' }}>
                                {item.isRemovable ? '����� ������' : '������ ������'}
                                {item.alternatives?.length > 0 && (
                                  <span> � ������: {item.alternatives.map((a) => `${a.emoji} ${a.name}`).join(', ')}</span>
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
                                ��������
                              </button>
                              <button
                                type="button"
                                className="remove-btn"
                                onClick={() => deleteBundleItem(item.id)}
                              >
                                ?
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ����� ���������� ����� ������� */}
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
                    <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>����� �������</div>
                    <div className="form-grid" style={{ marginBottom: 10 }}>
                      <div className="field" style={{ flex: '0 0 80px' }}>
                        <label>������</label>
                        <input
                          type="text"
                          value={editingItem.itemEmoji}
                          onChange={(e) => setEditingItem((p) => ({ ...p, itemEmoji: e.target.value }))}
                          placeholder="??"
                        />
                      </div>
                      <div className="field">
                        <label>�������� *</label>
                        <input
                          type="text"
                          value={editingItem.itemName}
                          onChange={(e) => setEditingItem((p) => ({ ...p, itemName: e.target.value }))}
                          placeholder="��������, �������"
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
                        <label htmlFor="removable-new">����� ������</label>
                      </div>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div className="hint" style={{ marginBottom: 6 }}>�������� ������:</div>
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
                              ?
                            </button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div className="field" style={{ flex: '0 0 70px', marginBottom: 0 }}>
                          <label style={{ fontSize: 11 }}>������</label>
                          <input
                            type="text"
                            value={newAltEmoji}
                            onChange={(e) => setNewAltEmoji(e.target.value)}
                            placeholder="??"
                          />
                        </div>
                        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                          <label style={{ fontSize: 11 }}>�������� ������</label>
                          <input
                            type="text"
                            value={newAltName}
                            onChange={(e) => setNewAltName(e.target.value)}
                            placeholder="��������, ������"
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
                          + ��������
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
                        {bundleItemSaving ? '����������' : '��������'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={cancelEditBundleItem}
                        disabled={bundleItemSaving}
                      >
                        ������
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
                    + �������� �������
                  </button>
                )}

                {bundleComposition.length === 0 && !editingItem && (
                  <div className="hint" style={{ marginTop: 8 }}>
                    �������� �������, ������� ���������� ������ ��������������� (������ ��� ��������).
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="form-actions">
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? '����������' : '���������'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/products')}
            disabled={saving}
          >
            ������
          </button>
        </div>
      </form>
    </div>
  );
}