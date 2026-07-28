import { useEffect, useState } from 'react';
import { api } from './api';
import ImageUploadField from './ImageUploadField';

// Список известных ключей — жёстко задан здесь, а не в БД: набор мест
// интерфейса, которые можно так переопределить, меняется только вместе с
// кодом (см. миграции 039_ui_icons.sql / 040_ui_icons_more.sql и
// SectionIcon.jsx в prilavka-app).
// fallbackLabel — что видит пользователь, если картинка не загружена: для
// большинства это буквально эмодзи, а для "Адрес доставки"/"Мои заказы"
// (линейная SVG-иконка IconPin/IconBag) и "Индикатор адреса на Главной"
// (просто цветная точка) — запасной вариант не эмодзи, его не положить в
// БД, поэтому здесь текстовое пояснение.
const KNOWN_ICONS = [
  { key: 'profile_section_other', label: 'Заголовок: Прочее', fallbackLabel: '⚙️' },
  { key: 'profile_section_delivery', label: 'Заголовок: Как работает доставка', fallbackLabel: '🚚' },
  { key: 'profile_section_contacts', label: 'Заголовок: Контакты', fallbackLabel: '💬' },
  { key: 'profile_section_address', label: 'Заголовок: Адрес доставки', fallbackLabel: 'сейчас: линейная иконка (не эмодзи)' },
  { key: 'profile_section_orders', label: 'Заголовок: Мои заказы', fallbackLabel: 'сейчас: линейная иконка (не эмодзи)' },
  { key: 'home_address_indicator', label: 'Главная: индикатор адреса в шапке', fallbackLabel: 'сейчас: цветная точка (не эмодзи)' },
  { key: 'profile_row_write_to_us', label: 'Профиль → Прочее: «Написать нам»', fallbackLabel: '💬' },
  { key: 'profile_row_about', label: 'Профиль → Прочее: «О «Прилавке»»', fallbackLabel: '🌿' },
  { key: 'profile_address_card_icon', label: 'Профиль → Адрес доставки: иконка в карточке', fallbackLabel: '🏠' },
  { key: 'about_row_delivery_zone', label: 'О «Прилавке»: «Зона доставки»', fallbackLabel: '📍' },
  { key: 'about_row_delivery_time', label: 'О «Прилавке»: «Время доставки»', fallbackLabel: '🕒' },
  { key: 'about_row_packaging', label: 'О «Прилавке»: «Упаковка»', fallbackLabel: '📦' },
  { key: 'about_row_payment', label: 'О «Прилавке»: «Оплата»', fallbackLabel: '💳' },
  { key: 'about_row_telegram_contact', label: 'О «Прилавке» → Контакты: «Написать в Telegram»', fallbackLabel: '✈️' },
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
