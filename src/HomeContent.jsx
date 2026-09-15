import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import Deliveries from './Deliveries';

// Ручная подборка + порядок товаров для одной витрины Главной (shelf:
// 'hits' | 'seasonal' | 'special'). Переиспользуется всеми витринами —
// структурно это одна и та же сущность (см. home_product_shelves):
// строка = shelf + product_id + sort_order, ключ витрины произвольный.
// Ничего специфичного для конкретной витрины тут нет и быть не должно.
function ProductShelfPicker({ shelf, allProducts }) {
  const [items, setItems] = useState(null);
  const [edits, setEdits] = useState({});
  const [error, setError] = useState('');
  const [savingRow, setSavingRow] = useState(null);
  const [removingRow, setRemovingRow] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => {
    api
      .getHomeShelf(shelf)
      .then((rows) => {
        setItems(rows);
        setEdits(Object.fromEntries(rows.map((r) => [r.id, { sortOrder: r.sortOrder }])));
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelf]);

  if (items === null) return <div className="loading">Загрузка…</div>;

  const pickedIds = new Set(items.map((i) => i.productId));
  const availableProducts = allProducts.filter((p) => !pickedIds.has(p.id));

  const handleAdd = async () => {
    if (!selectedProductId) return;
    setAdding(true);
    setError('');
    try {
      await api.addToHomeShelf({ shelf, productId: selectedProductId, sortOrder: items.length });
      setSelectedProductId('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleSave = async (id) => {
    setSavingRow(id);
    setError('');
    try {
      await api.updateHomeShelfItem(id, { sortOrder: Number(edits[id]?.sortOrder) || 0 });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingRow(null);
    }
  };

  const handleRemove = async (id, productTitle) => {
    if (!window.confirm(`Убрать «${productTitle}» из подборки?`)) return;
    setRemovingRow(id);
    setError('');
    try {
      await api.removeFromHomeShelf(id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRemovingRow(null);
    }
  };

  return (
    <div>
      {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Текст пустого состояния объясняет, что происходит сейчас и что
          изменится, — прежний («автоподбор по меткам товара (как раньше)»)
          требовал знать, что такое метки и какое было «раньше». */}
      {items.length === 0 ? (
        <div className="empty-hint" style={{ marginBottom: 16 }}>
          Список пуст: сейчас товары для блока подбираются автоматически.
          <br />
          Добавьте хотя бы один товар ниже — и состав блока начнёт управляться отсюда.
        </div>
      ) : (
        <table className="product-table" style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th></th>
              <th>Товар</th>
              {/* Подпись столбца объясняет, как читать число: без неё
                  было непонятно, растёт порядок сверху вниз или наоборот. */}
              <th style={{ width: 140 }}>
                Порядок
                <div className="hint" style={{ fontSize: 11, fontWeight: 500, textTransform: 'none', letterSpacing: 'normal', marginTop: 2 }}>
                  меньше — выше в блоке
                </div>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td style={{ width: 44 }}>
                  {it.productImageUrl ? (
                    <img src={it.productImageUrl} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface)' }} />
                  )}
                </td>
                <td style={{ fontWeight: 700 }}>{it.productTitle}</td>
                <td>
                  <input
                    type="number"
                    value={edits[it.id]?.sortOrder ?? it.sortOrder}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [it.id]: { sortOrder: e.target.value } }))}
                    style={{ width: 80 }}
                  />
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-primary" onClick={() => handleSave(it.id)} disabled={savingRow === it.id}>
                      {savingRow === it.id ? '…' : 'Сохранить'}
                    </button>
                    <button className="btn-danger" onClick={() => handleRemove(it.id, it.productTitle)} disabled={removingRow === it.id}>
                      {removingRow === it.id ? '…' : 'Убрать'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Подпись над строкой добавления: селект с кнопкой снизу таблицы
          легко принять за фильтр списка, а не за добавление в блок. */}
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
        Добавить товар в блок
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} style={{ flex: '1 1 200px', minWidth: 0 }}>
          <option value="">Выберите товар…</option>
          {availableProducts.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <button className="btn-primary" onClick={handleAdd} disabled={!selectedProductId || adding}>
          {adding ? 'Добавление…' : '+ Добавить'}
        </button>
      </div>
    </div>
  );
}

// Заголовок/подзаголовок "Сейчас в сезоне" — хранятся в общей таблице
// settings (тот же механизм, что и остальные настройки), просто редактируются
// здесь, а не на странице "Настройки", чтобы всё про Главную было в одном месте.
function SeasonalTextEditor() {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [initial, setInitial] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getSettings()
      .then((rows) => {
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        const t = map.home_seasonal_title ?? 'Сейчас в сезоне';
        const s = map.home_seasonal_subtitle ?? '';
        setTitle(t);
        setSubtitle(s);
        setInitial({ title: t, subtitle: s });
      })
      .catch((e) => setError(e.message));
  }, []);

  if (initial === null) return <div className="loading">Загрузка…</div>;

  const isDirty = title !== initial.title || subtitle !== initial.subtitle;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await Promise.all([
        api.updateSetting('home_seasonal_title', title),
        api.updateSetting('home_seasonal_subtitle', subtitle),
      ]);
      setInitial({ title, subtitle });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="seasonalTitle">Заголовок блока</label>
          <input
            id="seasonalTitle"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Сейчас в сезоне"
          />
        </div>
        <div className="field full">
          <label htmlFor="seasonalSubtitle">Подзаголовок (опционально)</label>
          <input
            id="seasonalSubtitle"
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="например, свежий урожай этой недели"
          />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn-primary" onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? 'Сохранение…' : saved ? '✓ Сохранено' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// "Готовые наборы" — картинка редактируется на самой странице товара (поле
// "Фото для Главной", тот же upload-виджет, что и обычное фото товара — см.
// ProductForm.jsx), здесь только обзор + быстрый переход, чтобы не дублировать
// загрузку фото в двух местах. Какой набор показан — по-прежнему считается
// автоматически (badge "Выгодно" → первый не-хит → первый попавшийся);
// ручная подборка не запрашивалась для этого блока.
function BundlesOverviewTab({ allProducts }) {
  const navigate = useNavigate();
  const bundles = allProducts.filter((p) => p.category === 'bundles');
  const featured = bundles.find((p) => p.badge?.type === 'deal')
    || bundles.find((p) => p.badge?.type !== 'hit')
    || bundles[0]
    || null;

  return (
    <div>
      <div className="empty-hint" style={{ marginBottom: 16 }}>
        На Главной показывается один набор — автоматически (сначала с меткой «Выгодно», иначе первый без метки «Хит», иначе первый попавшийся). Отдельная картинка для Главной загружается на странице товара — поле «Фото для Главной», независимо от обычного фото.
      </div>
      {bundles.length === 0 ? (
        <div className="card"><div className="empty-hint">Наборов нет</div></div>
      ) : (
        <table className="product-table">
          <thead>
            <tr>
              <th></th>
              <th>Набор</th>
              <th>На Главной сейчас</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((p) => {
              const thumb = p.homeImageUrl || p.imageUrl;
              return (
                <tr key={p.id}>
                  <td style={{ width: 44 }}>
                    {thumb ? (
                      <img src={thumb} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <span style={{ fontSize: 20 }}>{p.emoji}</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>{p.title}</td>
                  <td>
                    {featured?.id === p.id ? (
                      <span style={{ color: 'var(--accent)', fontWeight: 800 }}>✓ Сейчас показан</span>
                    ) : '—'}
                  </td>
                  <td>
                    <button className="btn-secondary" onClick={() => navigate(`/products/${p.id}`)}>Редактировать →</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const TABS = [
  { key: 'seasonal', label: 'Сейчас в сезоне' },
  { key: 'bundles', label: 'Готовые наборы' },
  { key: 'special', label: 'Сегодня на прилавке' },
  { key: 'hits', label: 'Хиты недели' },
  { key: 'deliveries', label: 'Последние доставки' },
];

export default function HomeContent() {
  const [tab, setTab] = useState('seasonal');
  const [allProducts, setAllProducts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProducts().then(setAllProducts).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Главная страница</h2>
      </div>

      {/* Переключатель разделов, а не ряд кнопок. Логика та же — tab в
          локальном состоянии; меняется только вид: подложка вокруг всего
          ряда, активная вкладка белой плашкой, остальные приглушены.
          Раньше это были .btn-primary и .btn-secondary, то есть ровно та
          же пара, что у «Сохранить» и «Отмена», и ряд читался набором
          действий — вкладку «Сегодня на прилавке» на этом экране не
          находили. */}
      <div className="tab-bar" role="tablist" aria-label="Разделы Главной">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}

      {allProducts === null ? (
        <div className="loading">Загрузка…</div>
      ) : (
        <>
          {tab === 'seasonal' && (
            <>
              <SeasonalTextEditor />
              <div className="section-label" style={{ marginTop: 0 }}>Подборка товаров</div>
              <div className="card" style={{ padding: 20 }}>
                <ProductShelfPicker shelf="seasonal" allProducts={allProducts} />
              </div>
            </>
          )}

          {tab === 'bundles' && <BundlesOverviewTab allProducts={allProducts} />}

          {tab === 'special' && (
            <div className="card" style={{ padding: 20 }}>
              {/* Подборка здесь опциональна: пока она пуста, в блок
                  «Сегодня на прилавке» на Главной попадают товары с
                  заполненным тегом (карточка товара → поле «Тег»). Список
                  ниже нужен, когда важен точный состав и порядок. */}
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
                Товары блока «Сегодня на прилавке» на Главной
              </h3>
              <div className="section-hint">
                Выберите товары, которые покупатель увидит в этом блоке, и задайте их порядок. Ряд прокручивается
                вбок: на телефоне в экран помещается четыре карточки, остальные доступны свайпом.
                <br />
                Пока список пуст, в блок попадают все товары с заполненным полем «Тег» на карточке товара
                (сам тег на витрине не печатается — он только отбирает товары).
              </div>
              <ProductShelfPicker shelf="special" allProducts={allProducts} />
            </div>
          )}

          {tab === 'hits' && (
            <div className="card" style={{ padding: 20 }}>
              <ProductShelfPicker shelf="hits" allProducts={allProducts} />
            </div>
          )}

          {tab === 'deliveries' && <Deliveries />}
        </>
      )}
    </div>
  );
}
