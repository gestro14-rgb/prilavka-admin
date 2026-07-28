import { useEffect, useState } from 'react';
import { api } from './api';
import ImageUploadField from './ImageUploadField';

// Список известных ключей — жёстко задан здесь, а не в БД: набор мест
// интерфейса, которые можно так переопределить, меняется только вместе с
// кодом (см. миграцию 039_ui_icons.sql и SectionIcon.jsx в prilavka-app).
// fallbackLabel — что видит пользователь, если картинка не загружена:
// для трёх заголовков это буквально эмодзи, а для "Адрес доставки" и "Мои
// заказы" сейчас не эмодзи, а линейная SVG-иконка (IconPin/IconBag) —
// её не положить в БД, поэтому здесь просто текстовое пояснение.
const KNOWN_ICONS = [
  { key: 'profile_section_other', label: 'Заголовок: Прочее', fallbackLabel: '⚙️' },
  { key: 'profile_section_delivery', label: 'Заголовок: Как работает доставка', fallbackLabel: '🚚' },
  { key: 'profile_section_contacts', label: 'Заголовок: Контакты', fallbackLabel: '💬' },
  { key: 'profile_section_address', label: 'Заголовок: Адрес доставки', fallbackLabel: 'сейчас: линейная иконка (не эмодзи)' },
  { key: 'profile_section_orders', label: 'Заголовок: Мои заказы', fallbackLabel: 'сейчас: линейная иконка (не эмодзи)' },
];

export default function UiIcons() {
  const [icons, setIcons] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    api.getUiIcons().then((rows) => {
      setIcons(Object.fromEntries(rows.map((r) => [r.key, r])));
    }).catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const handleImageChange = async (key, url) => {
    setError('');
    try {
      await api.updateUiIcon(key, url || null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Иконки интерфейса</h2>
      </div>

      <div className="empty-hint" style={{ marginBottom: 16 }}>
        Иконки статичных мест интерфейса (сейчас — заголовки секций в Профиле). Пока картинка не загружена, показывается текущий вид — эмодзи или линейная иконка.
      </div>

      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

      {icons === null ? (
        <div className="loading">Загрузка…</div>
      ) : (
        <table className="product-table">
          <thead>
            <tr>
              <th>Место</th>
              <th>Картинка</th>
              <th>Запасной вариант</th>
            </tr>
          </thead>
          <tbody>
            {KNOWN_ICONS.map(({ key, label, fallbackLabel }) => (
              <tr key={key}>
                <td><b>{label}</b></td>
                <td>
                  <ImageUploadField
                    value={icons[key]?.imageUrl || ''}
                    onChange={(url) => handleImageChange(key, url)}
                    label={label}
                  />
                </td>
                <td style={{ color: 'var(--text-soft, #888)' }}>{fallbackLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
