import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import SignIn from './components/SignIn.jsx';
import Unlock from './components/Unlock.jsx';
import BrandMark from './components/BrandMark.jsx';
import ResetPassword from './components/ResetPassword.jsx';
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
import {
  loadVault,
  login,
  logout,
  onLockChange,
  recoveryPending,
  register,
  setUnauthorisedHandler,
  unlockVault,
  unlockVaultWithRecoveryKey,
  vaultState
} from './data/index.js';

// Pages serves the app under /<repo>/; the Android build serves it from the
// root of a WebView, where Vite's relative base ('./') is not a path a router
// can be mounted on.
const routerBase = import.meta.env.BASE_URL.startsWith('/') ? import.meta.env.BASE_URL : '/';

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
  // Opened from a password-reset email: nothing else is shown until the new
  // password is set, because the link's session exists for that alone.
  const [recovering, setRecovering] = useState(recoveryPending);

  const [lock, setLock] = useState(vaultState);
  // Whether this tab has asked the database about the vault yet. Until it has,
  // nothing is known: before the answer, "no vault" and "vault not read yet"
  // look the same, and treating the second as the first let the workspace
  // fetch sealed rows with no key to open them — every row reported locked,
  // the categories never loaded, and the unlock screen arrived afterwards.
  const [vaultKnown, setVaultKnown] = useState(false);

  useEffect(() => {
    setUnauthorisedHandler(() => setSession(null));
    return onLockChange(() => setLock(vaultState()));
  }, []);

  // A restored session has no key with it: the vault row is fetched so the tab
  // knows whether it is locked, and a key cached for this tab is adopted.
  useEffect(() => {
    if (!session) {
      setVaultKnown(false);
      return undefined;
    }
    let current = true;
    setVaultKnown(false);
    loadVault()
      .then((state) => current && setLock(state))
      .catch(() => current && setLock(vaultState()))
      .finally(() => current && setVaultKnown(true));
    return () => {
      current = false;
    };
  }, [session]);

  async function handleAuth(mode, payload) {
    const call = mode === 'register' ? register : login;
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

  if (recovering) {
    return (
      <ResetPassword
        onDone={(result) => {
          writeSession(result);
          setRecovering(false);
          setSession(result);
        }}
        onCancel={async () => {
          await logout().catch(() => {});
          window.history.replaceState(null, '', window.location.pathname);
          setRecovering(false);
        }}
      />
    );
  }

  if (!session) {
    return <SignIn onSubmit={handleAuth} onAuthenticated={setSession} />;
  }

  if (!vaultKnown) {
    return (
      <div className="signin" aria-busy="true">
        <div className="signin-card">
          <BrandMark size={40} />
          <p className="hint">Opening your ledger…</p>
        </div>
      </div>
    );
  }

  if (lock.exists && !lock.unlocked) {
    return (
      <Unlock
        email={session.user.email}
        onUnlock={unlockVault}
        onUnlockWithKey={unlockVaultWithRecoveryKey}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <BrowserRouter basename={routerBase}>
      <Workspace session={session} onSignOut={handleSignOut} />
    </BrowserRouter>
  );
}
