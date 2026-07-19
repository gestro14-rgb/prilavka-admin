import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Login from './Login';
import Layout from './Layout';
import Stats from './Stats';
import Schedule from './Schedule';
import ProductsList from './ProductsList';
import ProductForm from './ProductForm';
import Categories from './Categories';
import DeliveryZone from './DeliveryZone';
import Orders from './Orders';
import PromoCodes from './PromoCodes';
import Users from './Users';
import Rewards from './Rewards';
import Reviews from './Reviews';
import Districts from './Districts';
import Subcategories from './Subcategories';
import Analytics from './Analytics';
import HomeContent from './HomeContent';
import Settings from './Settings';
import Pricing from './Pricing';
import PriceAnalytics from './PriceAnalytics';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Загрузка…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/stats" replace />} />
        <Route path="stats" element={<Stats />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="orders" element={<Orders />} />
        <Route path="products" element={<ProductsList />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="categories" element={<Categories />} />
        <Route path="subcategories" element={<Subcategories />} />
        <Route path="delivery-zone" element={<DeliveryZone />} />
        <Route path="promo-codes" element={<PromoCodes />} />
        <Route path="users" element={<Users />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="districts" element={<Districts />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="home-content" element={<HomeContent />} />
        <Route path="settings" element={<Settings />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="price-analytics" element={<PriceAnalytics />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
