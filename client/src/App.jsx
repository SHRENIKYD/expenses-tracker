import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import SignIn from './components/SignIn.jsx';
import Overview from './pages/Overview.jsx';
import Transactions from './pages/Transactions.jsx';
import BudgetsPage from './pages/BudgetsPage.jsx';
import Reports from './pages/Reports.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AddExpense from './pages/AddExpense.jsx';
import useExpensesData from './useExpensesData.js';
import { readSession, writeSession, clearSession } from './session.js';
import { login, logout, register, setUnauthorisedHandler } from './api.js';

function Workspace({ session, onSignOut }) {
  const data = useExpensesData();
  const context = { ...data, session, onSignOut };

  return (
    <Routes>
      <Route element={<AppShell context={context} />}>
        <Route index element={<Overview />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="add" element={<AddExpense />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [session, setSession] = useState(() => readSession());

  useEffect(() => {
    setUnauthorisedHandler(() => setSession(null));
  }, []);

  async function handleAuth(mode, payload) {
    const result = mode === 'register' ? await register(payload) : await login(payload);
    writeSession(result);
    return result;
  }

  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // the token may already be invalid; clearing locally is what matters
    }
    clearSession();
    setSession(null);
  }

  if (!session) {
    return <SignIn onSubmit={handleAuth} onAuthenticated={setSession} />;
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Workspace session={session} onSignOut={handleSignOut} />
    </BrowserRouter>
  );
}
