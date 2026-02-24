import '@/App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Header from '@/components/Header';
import HomePage from '@/pages/HomePage';
import AuthPage from '@/pages/AuthPage';
import MyOffersPage from '@/pages/MyOffersPage';
import AdminPage from '@/pages/AdminPage';
import MediationPage from '@/pages/MediationPage';
import OfferDetailsPage from '@/pages/OfferDetailsPage';
import ProfilePage from '@/pages/ProfilePage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/minhas-ofertas" element={<MyOffersPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/mediacao" element={<MediationPage />} />
          <Route path="/oferta/:id" element={<OfferDetailsPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </div>
    </BrowserRouter>
  );
}

export default App;
