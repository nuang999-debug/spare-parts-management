import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : undefined;
}

export default function AppShell() {
  const { user, logout } = useAuth();

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
