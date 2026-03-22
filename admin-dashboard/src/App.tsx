import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import EventManagement from './pages/EventManagement';
import EventDetail from './pages/EventDetail';
import LeagueManagement from './pages/LeagueManagement';
import PlayerManagement from './pages/PlayerManagement';
import PlayerDetail from './pages/PlayerDetail';
import DiscRegistry from './pages/DiscRegistry';
import TreasuryDashboard from './pages/TreasuryDashboard';
import ClubSettings from './pages/ClubSettings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="events" element={<EventManagement />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="leagues" element={<LeagueManagement />} />
        <Route path="players" element={<PlayerManagement />} />
        <Route path="players/:id" element={<PlayerDetail />} />
        <Route path="discs" element={<DiscRegistry />} />
        <Route path="treasury" element={<TreasuryDashboard />} />
        <Route path="settings" element={<ClubSettings />} />
      </Route>
    </Routes>
  );
}
