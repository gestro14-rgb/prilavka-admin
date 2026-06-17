import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Прилавка</h1>
        <div className="sub">{user?.username}</div>
        <nav>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? 'active' : '')}>
            📊 Статистика
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
            🧾 Заказы
          </NavLink>
          <NavLink to="/products" className={({ isActive }) => (isActive ? 'active' : '')}>
            🧺 Товары
          </NavLink>
          <NavLink to="/categories" className={({ isActive }) => (isActive ? 'active' : '')}>
            🏷️ Категории
          </NavLink>
          <NavLink to="/delivery-zone" className={({ isActive }) => (isActive ? 'active' : '')}>
            📍 Зона доставки
          </NavLink>
          <NavLink to="/promo-codes" className={({ isActive }) => (isActive ? 'active' : '')}>
            🎁 Промокоды
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
            👥 Пользователи
          </NavLink>
          <NavLink to="/rewards" className={({ isActive }) => (isActive ? 'active' : '')}>
            🏆 Награды
          </NavLink>
          <NavLink to="/reviews" className={({ isActive }) => (isActive ? 'active' : '')}>
            ⭐ Отзывы
          </NavLink>
          <NavLink to="/deliveries" className={({ isActive }) => (isActive ? 'active' : '')}>
            🚚 Доставки
          </NavLink>
        </nav>
        <button className="logout-btn" onClick={handleLogout}>
          ⎋ Выйти
        </button>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
