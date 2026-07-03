import { useEffect, useState } from 'react';
import { api } from './api';

export default function Districts() {
  const [districts, setDistricts] = useState(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    api
      .getDistricts()
      .then(setDistricts)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.createDistrict({
        name: newName.trim(),
        sortOrder: (districts?.length || 0) + 1,
      });
      setNewName('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Удалить район «${name}»?`)) return;
    setDeletingId(id);
    setError('');
    try {
      await api.deleteDistrict(id);
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
        <h2>Районы доставки</h2>
      </div>

      {error && <div className="alert error">{error}</div>}

      {districts === null ? (
        <div className="loading">Загрузка…</div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <table className="product-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>№</th>
                <th>Название</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {districts.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ color: 'var(--ink-soft)', textAlign: 'center' }}>
                    Районов нет
                  </td>
                </tr>
              )}
              {districts.map((d) => (
                <tr key={d.id}>
                  <td style={{ color: 'var(--ink-soft)' }}>{d.sortOrder}</td>
                  <td>{d.name}</td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn-danger"
                        onClick={() => handleDelete(d.id, d.name)}
                        disabled={deletingId === d.id}
                      >
                        {deletingId === d.id ? 'Удаление…' : 'Удалить'}
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
        <div className="section-label" style={{ marginTop: 0 }}>Новый район</div>
        <form onSubmit={handleAdd} className="form-grid">
          <div className="field">
            <label htmlFor="districtName">Название</label>
            <input
              id="districtName"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="например, Тропарёво"
              required
            />
          </div>
          <div className="full">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Добавление…' : '+ Добавить район'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
