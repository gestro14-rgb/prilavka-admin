import { useEffect, useState } from 'react';
import { api } from './api';

export default function Rewards() {
  const [rewards, setRewards] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [pointsCost, setPointsCost] = useState('');

  const load = () => {
    api.getRewards().then(setRewards).catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!title.trim() || !pointsCost) {
      setError('Укажите название и стоимость в баллах');
      return;
    }
    setSaving(true);
    try {
      await api.createReward({
        title: title.trim(),
        description: description.trim() || null,
        emoji: emoji.trim() || null,
        pointsCost: Number(pointsCost),
      });
      setSuccess('Награда создана');
      setTitle('');
      setDescription('');
      setEmoji('');
      setPointsCost('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (reward) => {
    setError('');
    try {
      await api.updateReward(reward.id, { isActive: !reward.isActive });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить эту награду?')) return;
    setError('');
    try {
      await api.deleteReward(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Награды</h2>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="rewardEmoji">Эмодзи</label>
              <input
                id="rewardEmoji"
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🎁"
                style={{ width: 80 }}
              />
            </div>
            <div className="field">
              <label htmlFor="rewardTitle">Название</label>
              <input
                id="rewardTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="например, Скидка 200 ₽"
              />
            </div>
            <div className="field">
              <label htmlFor="rewardDesc">Описание (необязательно)</label>
              <input
                id="rewardDesc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Подробности награды"
              />
            </div>
            <div className="field">
              <label htmlFor="rewardCost">Стоимость в баллах</label>
              <input
                id="rewardCost"
                type="number"
                min="1"
                value={pointsCost}
                onChange={(e) => setPointsCost(e.target.value)}
                placeholder="например, 500"
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Создание…' : 'Создать награду'}
            </button>
          </div>
        </form>
      </div>

      {rewards === null ? (
        <div className="loading">Загрузка…</div>
      ) : rewards.length === 0 ? (
        <div className="card">
          <div className="empty-hint">Пока нет наград.</div>
        </div>
      ) : (
        <table className="product-table">
          <thead>
            <tr>
              <th></th>
              <th>Название</th>
              <th>Описание</th>
              <th>Баллы</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rewards.map((r) => (
              <tr key={r.id} style={{ opacity: r.isActive ? 1 : 0.5 }}>
                <td style={{ fontSize: 22, textAlign: 'center' }}>{r.emoji || '—'}</td>
                <td><b>{r.title}</b></td>
                <td style={{ color: 'var(--text-soft, #888)' }}>{r.description || '—'}</td>
                <td><b>{r.pointsCost.toLocaleString('ru-RU')}</b></td>
                <td>
                  <button
                    className={r.isActive ? 'btn-secondary' : 'btn-primary'}
                    onClick={() => handleToggle(r)}
                  >
                    {r.isActive ? 'Отключить' : 'Включить'}
                  </button>
                </td>
                <td>
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
