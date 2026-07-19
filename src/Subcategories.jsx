import { useEffect, useState } from 'react';
import { api } from './api';

// Русское склонение по числу: pluralRu(3, 'товар', 'товара', 'товаров') → 'товара'
function pluralRu(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export default function Subcategories() {
  const [subcategories, setSubcategories] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [edits, setEdits] = useState({});
  const [newItems, setNewItems] = useState({});

  const load = () => {
    Promise.all([api.getSubcategories(), api.getCategories()])
      .then(([scs, cats]) => {
        setSubcategories(scs);
        setCategories(cats);
        const initialEdits = {};
        scs.forEach((sc) => {
          initialEdits[sc.id] = {
            name: sc.name,
            sortOrder: sc.sortOrder,
            categoryId: sc.categoryId,
            // null (маржа не задана — действует глобальная) → пустая строка
            // в инпуте, а не "0": ноль — валидная маржа "по себестоимости".
            targetMarginPercent: sc.targetMarginPercent != null ? String(sc.targetMarginPercent) : '',
          };
        });
        setEdits(initialEdits);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (id) => {
    setSaving(id);
    setError('');
    try {
      await api.updateSubcategory(id, {
        name: edits[id].name,
        sortOrder: Number(edits[id].sortOrder),
        categoryId: edits[id].categoryId,
        targetMarginPercent: edits[id].targetMarginPercent === '' ? null : Number(edits[id].targetMarginPercent),
      });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Удалить подкатегорию «${name}»?`)) return;
    setDeleting(id);
    setError('');
    try {
      await api.deleteSubcategory(id);
      load();
    } catch (e) {
      // 409 с { error: 'has_products', count } — к подкатегории привязаны
      // товары. Предупреждаем явно (не удаляем молча) и переспрашиваем
      // отдельным подтверждением с конкретным числом; при согласии повторяем
      // запрос с force=true — бэкенд отвяжет товары (subcategory_id → NULL)
      // и удалит подкатегорию.
      if (e.status === 409 && e.body?.error === 'has_products') {
        const count = e.body.count;
        const confirmed = window.confirm(
          `К этой подкатегории привязано ${count} ${pluralRu(count, 'товар', 'товара', 'товаров')} — при удалении их подкатегория станет пустой (subcategory_id = NULL). Продолжить?`
        );
        if (confirmed) {
          try {
            await api.deleteSubcategory(id, { force: true });
            load();
          } catch (e2) {
            setError(e2.message);
          }
        }
      } else {
        setError(e.message);
      }
    } finally {
      setDeleting(null);
    }
  };

  const handleAdd = async (categoryId) => {
    const item = newItems[categoryId] || { name: '', sortOrder: 0 };
    if (!item.name.trim()) return;
    setSaving(`new-${categoryId}`);
    setError('');
    try {
      await api.createSubcategory({
        name: item.name.trim(),
        categoryId,
        sortOrder: Number(item.sortOrder) || 0,
      });
      setNewItems((prev) => ({ ...prev, [categoryId]: { name: '', sortOrder: 0 } }));
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  if (subcategories === null) return <div className="loading">Загрузка…</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Подкатегории</h2>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="hint" style={{ marginBottom: 16 }}>
        Целевая маржа подкатегории используется в расчёте рекомендуемой цены её товаров
        (если у товара не задана индивидуальная маржа). Пусто — действует глобальная
        маржа из раздела «Ценообразование».
      </div>

      {categories.map((cat) => {
        const items = subcategories.filter((sc) => sc.categoryId === cat.id);
        const newItem = newItems[cat.id] || { name: '', sortOrder: 0 };
        const addingKey = `new-${cat.id}`;

        return (
          <div key={cat.id} className="card" style={{ marginBottom: 24 }}>
            <div className="section-label" style={{ marginTop: 0 }}>
              {cat.label}
            </div>

            {items.length > 0 && (
              <table className="product-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th style={{ width: 180 }}>Категория</th>
                    <th style={{ width: 100 }}>Порядок</th>
                    <th style={{ width: 140 }}>Целевая маржа, %</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((sc) => (
                    <tr key={sc.id}>
                      <td>
                        <input
                          type="text"
                          value={edits[sc.id]?.name ?? sc.name}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [sc.id]: { ...prev[sc.id], name: e.target.value },
                            }))
                          }
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <select
                          value={edits[sc.id]?.categoryId ?? sc.categoryId}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [sc.id]: { ...prev[sc.id], categoryId: e.target.value },
                            }))
                          }
                          style={{ width: '100%' }}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={edits[sc.id]?.sortOrder ?? sc.sortOrder}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [sc.id]: { ...prev[sc.id], sortOrder: e.target.value },
                            }))
                          }
                          style={{ width: 80 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={edits[sc.id]?.targetMarginPercent ?? ''}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [sc.id]: { ...prev[sc.id], targetMarginPercent: e.target.value },
                            }))
                          }
                          placeholder="глобальная"
                          aria-label={`Целевая маржа подкатегории «${sc.name}»`}
                          style={{ width: 110 }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            className="btn-primary"
                            onClick={() => handleSave(sc.id)}
                            disabled={saving === sc.id}
                          >
                            {saving === sc.id ? 'Сохранение…' : 'Сохранить'}
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => handleDelete(sc.id, sc.name)}
                            disabled={deleting === sc.id}
                          >
                            {deleting === sc.id ? 'Удаление…' : 'Удалить'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {items.length === 0 && (
              <div style={{ color: 'var(--ink-soft)', marginBottom: 12 }}>Подкатегорий нет</div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Название подкатегории"
                value={newItem.name}
                onChange={(e) =>
                  setNewItems((prev) => ({
                    ...prev,
                    [cat.id]: { ...prev[cat.id], name: e.target.value },
                  }))
                }
                style={{ flex: 1 }}
              />
              <input
                type="number"
                placeholder="Порядок"
                value={newItem.sortOrder}
                onChange={(e) =>
                  setNewItems((prev) => ({
                    ...prev,
                    [cat.id]: { ...prev[cat.id], sortOrder: e.target.value },
                  }))
                }
                style={{ width: 80 }}
              />
              <button
                className="btn-primary"
                onClick={() => handleAdd(cat.id)}
                disabled={saving === addingKey || !newItem.name.trim()}
              >
                {saving === addingKey ? 'Добавление…' : '+ Добавить'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
