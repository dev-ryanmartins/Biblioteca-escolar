import { createContext, useContext, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import { invoke } from "./lib/invoke";
import Books from "./pages/Books";
import Dashboard from "./pages/Dashboard";
import Fines from "./pages/Fines";
import Loans from "./pages/Loans";
import Login from "./pages/Login";
import Reports from "./pages/Reports";
import Students from "./pages/Students";
import Users from "./pages/Users";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthCtx>({
  user: null,
  setUser: () => { },
  logout: () => { },
});

export const useAuth = () => useContext(AuthContext);

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (user) invoke("mark_overdue_loans").catch(() => { });
  }, [user]);

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/students" element={<Students />} />
                    <Route path="/books" element={<Books />} />
                    <Route path="/loans" element={<Loans />} />
                    <Route path="/fines" element={<Fines />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/users" element={<Users />} />
                  </Routes>
                </AppLayout>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
