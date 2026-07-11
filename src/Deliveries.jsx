import { useEffect, useState } from 'react';
import { api } from './api';
import ImageUploadField from './ImageUploadField';

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingRow, setSavingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [edits, setEdits] = useState({});

  const [emoji, setEmoji] = useState('🥦');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState(0);

  const load = () => {
    api
      .getDeliveries()
      .then((rows) => {
        setDeliveries(rows);
        setEdits(Object.fromEntries(rows.map((d) => [
          d.id,
          { emoji: d.emoji, title: d.title, text: d.text, imageUrl: d.imageUrl || '', sortOrder: d.sortOrder },
        ])));
      })
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
      await api.createDelivery({
        emoji: emoji.trim(),
        title: title.trim(),
        text: text.trim(),
        imageUrl: imageUrl || null,
        sortOrder: Number(sortOrder) || 0,
      });
      setSuccess('Запись добавлена');
      setEmoji('🥦');
      setTitle('');
      setText('');
      setImageUrl('');
      setSortOrder(0);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRow = async (id) => {
    setSavingRow(id);
    setError('');
    try {
      const draft = edits[id];
      await api.updateDelivery(id, {
        emoji: draft.emoji,
        title: draft.title,
        text: draft.text,
        imageUrl: draft.imageUrl || null,
        sortOrder: Number(draft.sortOrder) || 0,
      });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingRow(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить эту запись?')) return;
    setDeletingRow(id);
    setError('');
    try {
      await api.deleteDelivery(id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingRow(null);
    }
  };

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div className="section-label" style={{ marginTop: 0 }}>Новая запись</div>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="dEmoji">Эмодзи (запасной вариант, если нет фото)</label>
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
            <div className="field full">
              <label>Фото (опционально)</label>
              <ImageUploadField value={imageUrl} onChange={setImageUrl} label="Фото доставки" />
              <div className="hint" style={{ marginTop: 6 }}>Не загружено — на Главной покажется эмодзи.</div>
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
              {saving ? 'Добавление…' : '+ Добавить запись'}
            </button>
          </div>
        </form>
      </div>

      {deliveries === null ? (
        <div className="loading">Загрузка…</div>
      ) : deliveries.length === 0 ? (
        <div className="card"><div className="empty-hint">Пока нет записей о доставках.</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {deliveries.map((d) => {
            const draft = edits[d.id] || { emoji: d.emoji, title: d.title, text: d.text, imageUrl: d.imageUrl || '', sortOrder: d.sortOrder };
            return (
              <div className="card" style={{ padding: 18 }} key={d.id}>
                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <div className="field" style={{ flex: '0 0 90px' }}>
                    <label>Эмодзи</label>
                    <input
                      type="text"
                      value={draft.emoji}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...draft, emoji: e.target.value } }))}
                    />
                  </div>
                  <div className="field">
                    <label>Заголовок</label>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...draft, title: e.target.value } }))}
                    />
                  </div>
                  <div className="field">
                    <label>Порядок</label>
                    <input
                      type="number"
                      value={draft.sortOrder}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...draft, sortOrder: e.target.value } }))}
                      style={{ width: 90 }}
                    />
                  </div>
                  <div className="field full">
                    <label>Текст</label>
                    <input
                      type="text"
                      value={draft.text}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...draft, text: e.target.value } }))}
                    />
                  </div>
                  <div className="field full">
                    <label>Фото</label>
                    <ImageUploadField
                      value={draft.imageUrl}
                      onChange={(url) => setEdits((prev) => ({ ...prev, [d.id]: { ...draft, imageUrl: url } }))}
                      label="Фото доставки"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    className="btn-primary"
                    onClick={() => handleSaveRow(d.id)}
                    disabled={savingRow === d.id}
                  >
                    {savingRow === d.id ? 'Сохранение…' : 'Сохранить'}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => handleDelete(d.id)}
                    disabled={deletingRow === d.id}
                  >
                    {deletingRow === d.id ? 'Удаление…' : 'Удалить'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
