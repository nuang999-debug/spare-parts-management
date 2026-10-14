import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { THEMES, useTheme, type Theme } from "../lib/useTheme";

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : undefined;
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useTheme();

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <div className="app-shell-layout">
      <header className="app-nav">
        <span className="app-nav-title">Spare Parts Management</span>
        <nav>
          <NavLink to="/" end className={navClassName}>
            Items
          </NavLink>
          {user?.role === "ADMIN" && (
            <>
              <NavLink to="/admin/import" className={navClassName}>
                Import
              </NavLink>
              <NavLink to="/admin/packing-rules" className={navClassName}>
                Packing Rules
              </NavLink>
              <NavLink to="/admin/users" className={navClassName}>
                Users
              </NavLink>
              <NavLink to="/audit/login-history" className={navClassName}>
                Login History
              </NavLink>
              <NavLink to="/audit/edit-history" className={navClassName}>
                Edit History
              </NavLink>
            </>
          )}
        </nav>
        <div className="app-nav-user">
          <label className="theme-select">
            <span>ธีม</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="เลือกธีม">
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <span>{user?.displayName}</span>
          <button type="button" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
