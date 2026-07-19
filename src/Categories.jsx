import { useEffect, useState } from 'react';
import { api } from './api';

export default function Categories() {
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState('');
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [reorderingId, setReorderingId] = useState(null);
  // Черновики целевой маржи по id категории — строки инпутов; сохраняются
  // по уходу из поля (blur), если значение реально изменилось.
  const [marginDrafts, setMarginDrafts] = useState({});
  const [marginSavingId, setMarginSavingId] = useState(null);

  // target_margin_percent приходит сырой строкой NUMERIC из Postgres
  // (эндпоинт отдаёт строки таблицы как есть); null — маржа не задана,
  // действует глобальная из настроек ценообразования.
  const toMarginDraft = (c) => (c.target_margin_percent != null ? String(Number(c.target_margin_percent)) : '');

  const load = () => {
    api
      .getCategories()
      .then((list) => {
        setCategories(list);
        setMarginDrafts(Object.fromEntries(list.map((c) => [c.id, toMarginDraft(c)])));
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newId.trim() || !newLabel.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.createCategory({
        id: newId.trim(),
        label: newLabel.trim(),
        // Шаг 10, как у PUT /api/admin/categories/reorder — иначе новая
        // категория (1,2,3…) окажется раньше уже переупорядоченных (10,20…).
        sortOrder: ((categories?.length || 0) + 1) * 10,
      });
      setNewId('');
      setNewLabel('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // direction: -1 = вверх, +1 = вниз. Меняем местами с соседом и одним
  // запросом перезаписываем sort_order всего списка (см. комментарий у
  // PUT /api/admin/categories/reorder) — не только у переставленных двух.
  const handleMove = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const reordered = categories.slice();
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    const movedId = categories[index].id;
    setReorderingId(movedId);
    setError('');
    setCategories(reordered); // оптимистично — без ожидания ответа сервера
    try {
      const saved = await api.reorderCategories(reordered.map((c) => c.id));
      setCategories(saved);
    } catch (e) {
      setError(e.message);
      load(); // откат к реальному состоянию на сервере
    } finally {
      setReorderingId(null);
    }
  };

  const handleMarginBlur = async (c) => {
    const draft = marginDrafts[c.id] ?? '';
    if (draft === toMarginDraft(c)) return; // не менялось — не дёргаем сервер
    const value = draft === '' ? null : Number(draft);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setError('Целевая маржа должна быть неотрицательным числом');
      setMarginDrafts((d) => ({ ...d, [c.id]: toMarginDraft(c) }));
      return;
    }
    setMarginSavingId(c.id);
    setError('');
    try {
      const updated = await api.updateCategory(c.id, { targetMarginPercent: value });
      setCategories((list) => list.map((row) => (row.id === c.id ? updated : row)));
      setMarginDrafts((d) => ({ ...d, [c.id]: toMarginDraft(updated) }));
    } catch (e) {
      setError(e.message);
      setMarginDrafts((d) => ({ ...d, [c.id]: toMarginDraft(c) }));
    } finally {
      setMarginSavingId(null);
    }
  };

  const handleDelete = async (id, label) => {
    if (!window.confirm(`Удалить категорию «${label}»?`)) return;
    setDeletingId(id);
    setError('');
    try {
      await api.deleteCategory(id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Категории</h2>
      </div>

      {error && <div className="alert error">{error}</div>}

      {categories === null ? (
        <div className="loading">Загрузка…</div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <table className="product-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Порядок</th>
                <th>ID</th>
                <th>Название</th>
                <th style={{ width: 160 }}>Целевая маржа, %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 8px', minWidth: 0 }}
                        onClick={() => handleMove(i, -1)}
                        disabled={i === 0 || reorderingId !== null}
                        aria-label={`Поднять «${c.label}»`}
                        title="Выше"
                      >
                        ↑
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 8px', minWidth: 0 }}
                        onClick={() => handleMove(i, 1)}
                        disabled={i === categories.length - 1 || reorderingId !== null}
                        aria-label={`Опустить «${c.label}»`}
                        title="Ниже"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td>{c.id}</td>
                  <td>{c.label}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={marginDrafts[c.id] ?? ''}
                      onChange={(e) => setMarginDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                      onBlur={() => handleMarginBlur(c)}
                      placeholder="глобальная"
                      disabled={marginSavingId === c.id}
                      aria-label={`Целевая маржа категории «${c.label}»`}
                      style={{ width: 120 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn-danger"
                        onClick={() => handleDelete(c.id, c.label)}
                        disabled={deletingId === c.id}
                      >
                        {deletingId === c.id ? 'Удаление…' : 'Удалить'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="hint" style={{ padding: '10px 16px' }}>
            Целевая маржа категории используется в расчёте рекомендуемой цены её товаров.
            Пусто — действует глобальная маржа из раздела «Ценообразование». Сохраняется
            при уходе из поля.
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 24, maxWidth: 480 }}>
        <div className="section-label" style={{ marginTop: 0 }}>Новая категория</div>
        <form onSubmit={handleAdd} className="form-grid">
          <div className="field">
            <label htmlFor="catId">ID</label>
            <input
              id="catId"
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="например, dairy"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="catLabel">Название</label>
            <input
              id="catLabel"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="например, Молочное"
              required
            />
          </div>
          <div className="full">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Добавление…' : '+ Добавить категорию'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
