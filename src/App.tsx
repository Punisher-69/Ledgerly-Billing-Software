import { useCallback, useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Login } from "@/pages/Login";
import { Layout } from "@/pages/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Products } from "@/pages/Products";
import { Invoice } from "@/pages/Invoice";
import { Bills } from "@/pages/Bills";
import { Reports } from "@/pages/Reports";
// import { Settings } from "@/pages/Settings";
import { getApi } from "@/lib/api";

export default function App() {
  const [auth, setAuth] = useState<boolean | null>(null);

  const refreshAuth = useCallback(async () => {
    try {
      const s = await getApi().authStatus();
      setAuth(s.authenticated);
    } catch {
      setAuth(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  if (auth === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-yellow-200">
        Loading…
      </div>
    );
  }

  if (!auth) {
    return <Login onLoggedIn={() => setAuth(true)} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout onLogout={() => setAuth(false)} />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="invoice" element={<Invoice />} />
          <Route path="bills" element={<Bills />} />
          <Route path="reports" element={<Reports />} />
          {/* <Route path="settings" element={<Settings />} /> */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
