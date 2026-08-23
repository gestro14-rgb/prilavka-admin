import { useRef, useState } from 'react';
import { uploadStoryFile } from './api';

/**
 * Кнопка загрузки файла прямо в S3 (видео или картинка) с индикатором
 * прогресса. Не переиспользует ImageUploadField: тот шлёт файл в
 * Cloudinary через бэкенд-прокси и не умеет ни видео, ни прогресс.
 *
 * kind — что грузим, из STORY_ALLOWED_KINDS на бэкенде ('video' и 'cover'
 * для сторис, 'setVideo' для видео набора на Главной). От него зависит
 * только префикс в бакете и ожидаемый тип файла — сама механика одна.
 *
 * Переехал сюда из StoryCards.jsx, когда тот же виджет понадобился в
 * ProductForm.jsx: логика не менялась, только место.
 */
export default function MediaUploadField({ kind, value, onChange, accept, label }) {
  const [progress, setProgress] = useState(null);
  // Отдельная фаза после 100%: байты ушли, сервер перекодирует видео под веб
  // (десятки секунд). Без неё полоса зависала бы на 100% без объяснений.
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setProgress(0);
    setProcessing(false);
    try {
      const url = await uploadStoryFile(file, kind, setProgress, () => setProcessing(true));
      onChange(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
      setProcessing(false);
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
            <div style={{
              width: `${processing ? 100 : (progress ?? 100)}%`, height: '100%',
              background: processing ? '#f59e0b' : '#2563eb', transition: 'width 0.15s',
            }} />
          </div>
          <div style={{ fontSize: 11, color: processing ? '#b45309' : '#6b7280', marginTop: 3 }}>
            {processing
              ? 'Обрабатываем видео, не закрывайте страницу — это займёт до минуты'
              : progress != null ? `${progress}%` : 'загрузка…'}
          </div>
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
