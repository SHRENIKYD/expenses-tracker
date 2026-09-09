import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import SignIn from './components/SignIn.jsx';
import Goals from './pages/SavingsGoals.jsx';
import Overview from './pages/Overview.jsx';
import Transactions from './pages/Transactions.jsx';
import Accounts from './pages/Accounts.jsx';
import BudgetsPage from './pages/BudgetsPage.jsx';
import Reports from './pages/Reports.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AddExpense from './pages/AddExpense.jsx';
import useExpensesData from './useExpensesData.js';
import { readSession, writeSession, clearSession } from './session.js';
import { login, logout, recoverAccount, register, setUnauthorisedHandler } from './data/index.js';

function Workspace({ session, onSignOut }) {
  const data = useExpensesData();
  const context = { ...data, session, onSignOut };

  return (
    <Routes>
      <Route element={<AppShell context={context} />}>
        <Route index element={<Overview />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="goals" element={<Goals />} />
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
    // Recovery ends in a signed-in session too, so it is stored the same way;
    // otherwise the token never reaches localStorage and the next call 401s.
    const call = { register, recover: recoverAccount }[mode] || login;
    const result = await call(payload);
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
