import { useEffect, useState } from 'react';
import { api } from './api';

const STARS = [1, 2, 3, 4, 5];

export default function Reviews() {
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState('😊');
  const [sortOrder, setSortOrder] = useState(0);
  const [imageUrl, setImageUrl] = useState('');

  const load = () => {
    api
      .getReviews()
      .then(setReviews)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!name.trim() || !area.trim() || !text.trim() || !emoji.trim()) {
      setError('Заполните все обязательные поля');
      return;
    }
    setSaving(true);
    try {
      await api.createReview({ name: name.trim(), area: area.trim(), stars, text: text.trim(), emoji: emoji.trim(), sortOrder: Number(sortOrder) || 0, imageUrl: imageUrl.trim() || null });
      setSuccess('Отзыв добавлен');
      setName('');
      setArea('');
      setStars(5);
      setText('');
      setEmoji('😊');
      setSortOrder(0);
      setImageUrl('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id) => {
    setError('');
    try {
      await api.publishReview(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот отзыв?')) return;
    setError('');
    try {
      await api.deleteReview(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Отзывы</h2>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="rName">Имя</label>
              <input
                id="rName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="например, Анна"
              />
            </div>
            <div className="field">
              <label htmlFor="rArea">Район</label>
              <input
                id="rArea"
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="например, Митино"
              />
            </div>
            <div className="field">
              <label htmlFor="rStars">Оценка</label>
              <select id="rStars" value={stars} onChange={(e) => setStars(Number(e.target.value))}>
                {STARS.map((s) => (
                  <option key={s} value={s}>{s} {'★'.repeat(s)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rEmoji">Эмодзи</label>
              <input
                id="rEmoji"
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="😊"
              />
            </div>
            <div className="field full">
              <label htmlFor="rText">Текст отзыва</label>
              <textarea
                id="rText"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Текст отзыва…"
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '6px 8px', boxSizing: 'border-box' }}
              />
            </div>
            <div className="field full">
              <label htmlFor="rImageUrl">URL фото клиента (опционально)</label>
              <input
                id="rImageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
              />
            </div>
            <div className="field">
              <label htmlFor="rSort">Порядок сортировки</label>
              <input
                id="rSort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Добавление…' : 'Добавить отзыв'}
            </button>
          </div>
        </form>
      </div>

      {reviews === null ? (
        <div className="loading">Загрузка…</div>
      ) : reviews.length === 0 ? (
        <div className="card"><div className="empty-hint">Пока нет отзывов.</div></div>
      ) : (
        <table className="product-table">
          <thead>
            <tr>
              <th>Статус</th>
              <th>Эмодзи</th>
              <th>Имя</th>
              <th>Район</th>
              <th>Оценка</th>
              <th>Текст</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} style={{ opacity: r.status === 'pending' ? 0.75 : 1 }}>
                <td>
                  {r.status === 'pending'
                    ? <span style={{ fontSize: 12, background: '#FFF3CD', color: '#856404', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>На модерации</span>
                    : <span style={{ fontSize: 12, background: '#D4EDDA', color: '#155724', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>Опубликован</span>}
                </td>
                <td style={{ fontSize: 22 }}>{r.emoji}</td>
                <td><b>{r.name}</b></td>
                <td>{r.area}</td>
                <td>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</td>
                <td style={{ maxWidth: 280 }}>{r.text}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {r.status === 'pending' && (
                    <button className="btn-primary" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => handlePublish(r.id)}>Опубликовать</button>
                  )}
                  <button className="btn-danger" onClick={() => handleDelete(r.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
