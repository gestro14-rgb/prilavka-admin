import { useEffect, useRef, useState } from 'react';
import { api, uploadStoryFile } from './api';

// 7 -> "0:07" — тот же формат, что на карточке в приложении (StoryRow.jsx).
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const EMPTY_FORM = {
  title: '',
  priceLabel: '',
  coverImageUrl: '',
  videoUrl: '',
  durationSeconds: '',
  badgeText: '',
  productId: '',
  sortOrder: '',
  isActive: true,
};

/**
 * Кнопка загрузки файла прямо в S3 (видео или обложка) с индикатором
 * прогресса. Не переиспользует ImageUploadField: тот шлёт файл в
 * Cloudinary через бэкенд-прокси и не умеет ни видео, ни прогресс.
 */
function StoryFileUpload({ kind, value, onChange, accept, label }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setProgress(0);
    try {
      const url = await uploadStoryFile(file, kind, setProgress);
      onChange(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
      e.target.value = '';
    }
  };

  const uploading = progress !== null;

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={uploading} style={{ fontSize: 13 }}>
          {uploading ? 'Загрузка…' : value ? `⬆ Заменить ${label}` : `⬆ Загрузить ${label}`}
        </button>
        {value && !uploading && (
          <>
            <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>открыть</a>
            <button
              type="button"
              onClick={() => onChange('')}
              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}
            >
              удалить
            </button>
          </>
        )}
      </div>
      {uploading && (
        <div style={{ marginTop: 6 }}>
          <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', maxWidth: 260 }}>
            {/* progress === null уже отсеян выше; здесь null означает
                "размер неизвестен" — показываем полосу целиком. */}
            <div style={{ width: `${progress ?? 100}%`, height: '100%', background: '#2563eb', transition: 'width 0.15s' }} />
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
            {progress != null ? `${progress}%` : 'загрузка…'}
          </div>
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export default function StoryCards() {
  const [cards, setCards] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  // null — форма создания; число — редактируем карточку с этим id.
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = () => {
    api.getStoryCards().then(setCards).catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // Список товаров — для необязательной привязки product_id. Ошибку тут
    // намеренно глотаем: привязка опциональна, без неё экран работает.
    api.getProducts().then(setProducts).catch(() => {});
  }, []);

  const setField = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (card) => {
    setForm({
      title: card.title || '',
      priceLabel: card.priceLabel || '',
      coverImageUrl: card.coverImageUrl || '',
      videoUrl: card.videoUrl || '',
      durationSeconds: String(card.durationSeconds ?? ''),
      badgeText: card.badgeText || '',
      productId: card.productId || '',
      sortOrder: String(card.sortOrder ?? ''),
      isActive: card.isActive,
    });
    setEditingId(card.id);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.title.trim()) {
      setError('Укажите заголовок');
      return;
    }
    const payload = {
      title: form.title.trim(),
      priceLabel: form.priceLabel.trim(),
      coverImageUrl: form.coverImageUrl || null,
      videoUrl: form.videoUrl || null,
      durationSeconds: Number(form.durationSeconds) || 0,
      badgeText: form.badgeText.trim() || null,
      productId: form.productId || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };
    setSaving(true);
    try {
      if (editingId != null) {
        await api.updateStoryCard(editingId, payload);
        setSuccess('Карточка обновлена');
      } else {
        await api.createStoryCard(payload);
        setSuccess('Карточка создана');
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (card) => {
    setError('');
    try {
      await api.updateStoryCard(card.id, { isActive: !card.isActive });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (card) => {
    if (!window.confirm(`Удалить карточку «${card.title}»?\n\nВидео и обложка останутся в хранилище.`)) return;
    setError('');
    try {
      await api.deleteStoryCard(card.id);
      if (editingId === card.id) resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Сторис на Главной</h2>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="storyTitle">Заголовок</label>
              <input id="storyTitle" type="text" value={form.title} onChange={setField('title')} placeholder="например, Как выбрать арбуз" />
            </div>
            <div className="field">
              <label htmlFor="storyPrice">Цена (текстом)</label>
              <input id="storyPrice" type="text" value={form.priceLabel} onChange={setField('priceLabel')} placeholder="299 ₽ или от 99 ₽" />
            </div>
            <div className="field">
              <label htmlFor="storyDuration">Длительность видео, сек</label>
              <input id="storyDuration" type="number" min="0" value={form.durationSeconds} onChange={setField('durationSeconds')} placeholder="7" />
              {Number(form.durationSeconds) > 0 && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                  на карточке: {formatDuration(form.durationSeconds)}
                </div>
              )}
            </div>
            <div className="field">
              <label htmlFor="storyBadge">Бейдж (необязательно)</label>
              <input id="storyBadge" type="text" value={form.badgeText} onChange={setField('badgeText')} placeholder="НОВОЕ / СЕГОДНЯ" />
            </div>
            <div className="field">
              <label htmlFor="storySort">Порядок</label>
              <input id="storySort" type="number" value={form.sortOrder} onChange={setField('sortOrder')} placeholder="0" />
            </div>
            <div className="field">
              <label htmlFor="storyProduct">Товар (необязательно)</label>
              <select id="storyProduct" value={form.productId} onChange={setField('productId')}>
                <option value="">— без привязки —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                На Главной пока не используется — понадобится на странице просмотра.
              </div>
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Обложка (фото)</label>
              {form.coverImageUrl && (
                <img
                  src={form.coverImageUrl}
                  alt="Обложка"
                  style={{ width: 90, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb', display: 'block', marginBottom: 6 }}
                />
              )}
              <StoryFileUpload
                kind="cover"
                accept="image/*"
                label="обложку"
                value={form.coverImageUrl}
                onChange={(url) => setForm((prev) => ({ ...prev, coverImageUrl: url }))}
              />
            </div>
            <div className="field">
              <label>Видео</label>
              {form.videoUrl && (
                <video
                  src={form.videoUrl}
                  controls
                  preload="metadata"
                  style={{ width: 160, borderRadius: 6, border: '1px solid #e5e7eb', display: 'block', marginBottom: 6 }}
                />
              )}
              <StoryFileUpload
                kind="video"
                accept="video/*"
                label="видео"
                value={form.videoUrl}
                onChange={(url) => setForm((prev) => ({ ...prev, videoUrl: url }))}
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isActive} onChange={setField('isActive')} />
              Показывать на Главной
            </label>
          </div>

          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Сохранение…' : editingId != null ? 'Сохранить изменения' : 'Создать карточку'}
            </button>
            {editingId != null && (
              <button type="button" className="btn-secondary" onClick={resetForm} style={{ marginLeft: 8 }}>
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>

      {cards === null ? (
        <div className="loading">Загрузка…</div>
      ) : cards.length === 0 ? (
        <div className="card">
          <div className="empty-hint">Пока нет сторис-карточек. Лента на Главной не показывается, пока нет ни одной активной.</div>
        </div>
      ) : (
        <table className="product-table">
          <thead>
            <tr>
              <th>Обложка</th>
              <th>Заголовок</th>
              <th>Цена</th>
              <th>Длит.</th>
              <th>Бейдж</th>
              <th>Порядок</th>
              <th>Видео</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.5 }}>
                <td>
                  {c.coverImageUrl ? (
                    <img src={c.coverImageUrl} alt="" style={{ width: 45, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb' }} />
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>нет</span>
                  )}
                </td>
                <td><b>{c.title}</b></td>
                <td>{c.priceLabel || '—'}</td>
                <td>{formatDuration(c.durationSeconds)}</td>
                <td>{c.badgeText || '—'}</td>
                <td>{c.sortOrder}</td>
                <td>
                  {c.videoUrl
                    ? <a href={c.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>открыть</a>
                    : <span style={{ color: '#dc2626', fontSize: 12 }}>не загружено</span>}
                </td>
                <td>
                  <button className={c.isActive ? 'btn-secondary' : 'btn-primary'} onClick={() => handleToggle(c)}>
                    {c.isActive ? 'Отключить' : 'Включить'}
                  </button>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn-secondary" onClick={() => startEdit(c)}>Изменить</button>
                  <button className="btn-danger" onClick={() => handleDelete(c)} style={{ marginLeft: 6 }}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
