import { Link, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

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
          <Link to="/">Items</Link>
          {user?.role === "ADMIN" && (
            <>
              <Link to="/admin/import">Import</Link>
              <Link to="/admin/packing-rules">Packing Rules</Link>
              <Link to="/admin/users">Users</Link>
              <Link to="/audit/login-history">Login History</Link>
              <Link to="/audit/edit-history">Edit History</Link>
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
