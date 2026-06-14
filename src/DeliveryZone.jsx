import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from './api';

// Иконка маркера по умолчанию у Leaflet ссылается на файлы, которые не подключаются
// автоматически при сборке через Vite — настраиваем вручную через CDN.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Центр карты по умолчанию — юго-запад Москвы (район доставки "Прилавки")
const DEFAULT_CENTER = [55.655, 37.505];
const DEFAULT_ZOOM = 13;

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function DeliveryZone() {
  const [zone, setZone] = useState(null); // { id, label, coordinates, isActive } | null
  const [points, setPoints] = useState([]); // [[lat, lng], ...] — рабочая копия для редактирования
  const [label, setLabel] = useState('Зона доставки');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    setLoading(true);
    api
      .getDeliveryZones()
      .then((zones) => {
        const active = zones.find((z) => z.isActive) || zones[0] || null;
        setZone(active);
        setPoints(active?.coordinates || []);
        setLabel(active?.label || 'Зона доставки');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleMapClick = (point) => {
    setPoints((prev) => [...prev, point]);
    setSuccess('');
  };

  const removeLastPoint = () => {
    setPoints((prev) => prev.slice(0, -1));
    setSuccess('');
  };

  const clearPoints = () => {
    if (!window.confirm('Удалить все точки и начать заново?')) return;
    setPoints([]);
    setSuccess('');
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (points.length < 3) {
      setError('Нужно минимум 3 точки, чтобы получился многоугольник');
      return;
    }
    setSaving(true);
    try {
      if (zone) {
        await api.updateDeliveryZone(zone.id, { label, coordinates: points, isActive: true });
      } else {
        await api.createDeliveryZone({ label, coordinates: points, isActive: true });
      }
      }
      setSuccess('Зона доставки сохранена');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Загрузка…</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Зона доставки</h2>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="zoneLabel">Название зоны</label>
            <input
              id="zoneLabel"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="например, Зона доставки"
            />
          </div>
        </div>
        <div className="hint" style={{ marginTop: 16, marginBottom: 4 }}>
          Тапайте по карте, чтобы добавить точки границы района — точки соединятся в многоугольник
          в том порядке, в котором вы их поставили. Когда обведёте весь район — нажмите «Сохранить».
        </div>
        <div className="hint">Точек на карте: {points.length}</div>
      </div>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <MapContainer
          center={points[0] || DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '480px', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onMapClick={handleMapClick} />
          {points.length >= 3 && (
            <Polygon
              positions={points}
              pathOptions={{ color: '#2F6F3E', fillColor: '#C8F056', fillOpacity: 0.35 }}
            />
          )}
          {points.map((p, i) => (
            <Marker key={i} position={p} />
          ))}
        </MapContainer>
      </div>

      <div className="form-actions" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить зону'}
        </button>
        <button className="btn-secondary" onClick={removeLastPoint} disabled={points.length === 0}>
          Убрать последнюю точку
        </button>
        <button className="btn-danger" onClick={clearPoints} disabled={points.length === 0}>
          Очистить всё
        </button>
      </div>
    </div>
  );
}
