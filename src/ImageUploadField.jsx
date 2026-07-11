import { useRef, useState } from 'react';
import { uploadImage } from './api';

// Общий виджет загрузки фото — единая точка входа в POST /api/admin/upload-image
// для товаров, доставок и картинок витрин Главной. Не дублировать: если нужна
// загрузка фото где-то ещё — импортировать этот компонент, а не копировать.
export default function ImageUploadField({ value, onChange, label = 'Фотография' }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {value && (
        <img
          src={value}
          alt={label}
          style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb', flexShrink: 0 }}
        />
      )}
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ fontSize: 13 }}
        >
          {uploading ? 'Загрузка…' : value ? '⬆ Заменить фото' : '⬆ Загрузить фото'}
        </button>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ marginLeft: 6, background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}
          >
            удалить
          </button>
        )}
        {uploadError && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{uploadError}</div>}
      </div>
    </div>
  );
}
