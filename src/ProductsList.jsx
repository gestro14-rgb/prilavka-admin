import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from './api';

const CATEGORY_LABELS = {
  bundles: 'Наборы',
  vegetables: 'Овощи',
  fruits: 'Фрукты',
  greens: 'Зелень',
};

export default function ProductsList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    api
      .getProducts()
      .then(setProducts)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Удалить товар «${title}»? Это действие нельзя отменить.`)) return;
    setDeletingId(id);
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Товары</h2>
        <button className="btn-primary" onClick={() => navigate('/products/new')}>
          + Добавить товар
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      {products === null ? (
        <div className="loading">Загрузка…</div>
      ) : products.length === 0 ? (
        <div className="card">
          <div className="empty-hint">
            Товаров пока нет. Нажмите «Добавить товар», чтобы создать первый.
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="product-table">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Категория</th>
                <th>Цена</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="product-cell">
                      <div className="product-emoji">{p.emoji}</div>
                      <div>
                        <div className="product-title">{p.title}</div>
                        <div className="product-id">{p.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>{CATEGORY_LABELS[p.category] || p.category}</td>
                  <td>{p.price.toLocaleString('ru-RU')} ₽</td>
                  <td>
                    <span className={'badge' + (p.isActive ? '' : ' inactive')}>
                      {p.isActive ? 'Активен' : 'Скрыт'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <Link to={`/products/${p.id}`} className="btn-secondary">
                        Изменить
                      </Link>
                      <button
                        className="btn-danger"
                        onClick={() => handleDelete(p.id, p.title)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? 'Удаление…' : 'Удалить'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
