import { useEffect, useState } from 'react';
import { api } from './api';

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [emoji, setEmoji] = useState('🥦');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sortOrder, setSortOrder] = useState(0);

  const load = () => {
    api
      .getDeliveries()
      .then(setDeliveries)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!emoji.trim() || !title.trim() || !text.trim()) {
      setError('Заполните все обязательные поля');
      return;
    }
    setSaving(true);
    try {
      await api.createDelivery({ emoji: emoji.trim(), title: title.trim(), text: text.trim(), sortOrder: Number(sortOrder) || 0 });
      setSuccess('Запись добавлена');
      setEmoji('🥦');
      setTitle('');
      setText('');
      setSortOrder(0);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить эту запись?')) return;
    setError('');
    try {
      await api.deleteDelivery(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Последние доставки</h2>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="dEmoji">Эмодзи</label>
              <input
                id="dEmoji"
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🥦"
              />
            </div>
            <div className="field">
              <label htmlFor="dTitle">Заголовок</label>
              <input
                id="dTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="например, Набор «Зелень недели»"
              />
            </div>
            <div className="field full">
              <label htmlFor="dText">Текст</label>
              <input
                id="dText"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="например, Митино · вчера"
              />
            </div>
            <div className="field">
              <label htmlFor="dSort">Порядок сортировки</label>
              <input
                id="dSort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Добавление…' : 'Добавить запись'}
            </button>
          </div>
        </form>
      </div>

      {deliveries === null ? (
        <div className="loading">Загрузка…</div>
      ) : deliveries.length === 0 ? (
        <div className="card"><div className="empty-hint">Пока нет записей о доставках.</div></div>
      ) : (
        <table className="product-table">
          <thead>
            <tr>
              <th>Эмодзи</th>
              <th>Заголовок</th>
              <th>Текст</th>
              <th>Порядок</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td style={{ fontSize: 22 }}>{d.emoji}</td>
                <td><b>{d.title}</b></td>
                <td>{d.text}</td>
                <td>{d.sortOrder}</td>
                <td>
                  <button className="btn-danger" onClick={() => handleDelete(d.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
