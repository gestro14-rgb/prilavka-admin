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
          <NavLink to="/schedule" className={({ isActive }) => (isActive ? 'active' : '')}>
            📅 Расписание
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
          <NavLink to="/subcategories" className={({ isActive }) => (isActive ? 'active' : '')}>
            📂 Подкатегории
          </NavLink>
          <NavLink to="/delivery-zone" className={({ isActive }) => (isActive ? 'active' : '')}>
            📍 Зона доставки
          </NavLink>
          <NavLink to="/districts" className={({ isActive }) => (isActive ? 'active' : '')}>
            🏘️ Районы
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
          <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'active' : '')}>
            📈 Аналитика
          </NavLink>
          <NavLink to="/home-content" className={({ isActive }) => (isActive ? 'active' : '')}>
            🏠 Главная страница
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            ⚙️ Настройки
          </NavLink>
          <NavLink to="/pricing" className={({ isActive }) => (isActive ? 'active' : '')}>
            💰 Ценообразование
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
