import { useEffect, useState } from 'react';
import { api } from './api';

export default function Categories() {
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState('');
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    api
      .getCategories()
      .then(setCategories)
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
        sortOrder: (categories?.length || 0) + 1,
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
                <th>ID</th>
                <th>Название</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.label}</td>
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
