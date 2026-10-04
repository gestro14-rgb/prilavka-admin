import { useEffect, useState } from 'react';
import { api } from './api';

const STARS = [1, 2, 3, 4, 5];

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {reviews.map((r) => (
            <div className="card" key={r.id} style={{ padding: 0, minWidth: 0, overflow: 'hidden' }}>
              {/* Один отзыв — одна карточка и одна кнопка. Товары приезжают
                  массивом из review_products (migrations/060); склеивать
                  строки на экране, как раньше, больше не нужно — их нет. */}
              <div style={{ padding: '12px 14px 10px', borderBottom: r.products.length ? '1px solid var(--line)' : 'none', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{r.emoji}</span>
                  <b style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</b>
                  <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{r.area}</span>
                  {(r.orderId != null || r.products.length > 0) && (
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)', background: 'var(--surface)', borderRadius: 6, padding: '2px 8px' }}>
                      {[
                        r.orderId != null ? 'Заказ №' + r.orderId : null,
                        r.products.length > 0
                          ? r.products.length + ' ' + plural(r.products.length, 'товар', 'товара', 'товаров')
                          : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  )}

                  <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    {r.status === 'pending'
                      ? <span style={{ fontSize: 12, background: '#FFF3CD', color: '#856404', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>Ожидает</span>
                      : <span style={{ fontSize: 12, background: '#D4EDDA', color: '#155724', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>Опубликован</span>}
                  </span>
                </div>

                {/* Общая оценка отзыва. Оценки отдельных товаров стоят в
                    строках ниже — там, где они что-то значат. */}
                <div style={{ marginTop: 6, fontSize: 14 }} title={r.stars + ' из 5'}>
                  {'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}
                </div>

                {r.text && (
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink)', wordBreak: 'break-word', minWidth: 0 }}>
                    {r.text}
                  </div>
                )}
                {r.imageUrl && (
                  <a href={r.imageUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 12 }}>
                    фото клиента
                  </a>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {r.status === 'pending' && (
                    <button className="btn-primary" style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => handlePublish(r.id)}>
                      Опубликовать отзыв
                    </button>
                  )}
                  <button className="btn-danger" style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => handleDelete(r.id)}>
                    Удалить
                  </button>
                </div>
              </div>

              {/* Товары отзыва — справочно: одна публикация накрывает их все,
                  отдельной кнопки у товара больше нет. Оценка рядом с
                  названием: именно она идёт в рейтинг этой карточки. */}
              {r.products.length > 0 && (
                <div style={{ padding: '6px 14px 10px' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>Товары:</div>
                  {r.products.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, padding: '2px 0' }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title}
                      </span>
                      <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--ink-soft)' }} title={p.stars + ' из 5'}>
                        {'★'.repeat(p.stars)}{'☆'.repeat(5 - p.stars)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}