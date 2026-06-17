import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Login from './Login';
import Layout from './Layout';
import ProductsList from './ProductsList';
import ProductForm from './ProductForm';
import Categories from './Categories';
import DeliveryZone from './DeliveryZone';
import Orders from './Orders';
import PromoCodes from './PromoCodes';
import Users from './Users';
import Rewards from './Rewards';
import Reviews from './Reviews';
import Deliveries from './Deliveries';

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
        <Route index element={<Navigate to="/orders" replace />} />
        <Route path="orders" element={<Orders />} />
        <Route path="products" element={<ProductsList />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="categories" element={<Categories />} />
        <Route path="delivery-zone" element={<DeliveryZone />} />
        <Route path="promo-codes" element={<PromoCodes />} />
        <Route path="users" element={<Users />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="deliveries" element={<Deliveries />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
