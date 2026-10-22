import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate } from "react-router-dom";
import {
  Boxes,
  ClipboardList,
  FileUp,
  History,
  LogIn,
  LogOut,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Sprout,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { THEMES, useTheme, type Theme } from "../lib/useTheme";
import SideGarden from "./SideGarden";

const NAV_KEY = "spareparts_nav_collapsed";
const GARDEN_KEY = "spareparts_garden_off";

function readGardenOn(): boolean {
  try {
    return localStorage.getItem(GARDEN_KEY) !== "1";
  } catch {
    return true;
  }
}
/** Below this width the full menu would squeeze the table (especially with the detail panel
 *  open), so it starts collapsed to icons; the user can still open it for the moment. */
const NARROW_QUERY = "(max-width: 1279px)";

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(NAV_KEY) === "1";
  } catch {
    return false;
  }
}

function NavItem({ to, end, icon: Icon, label }: { to: string; end?: boolean; icon: LucideIcon; label: string }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `side-link${isActive ? " active" : ""}`} title={label}>
      <Icon size={18} strokeWidth={1.8} aria-hidden />
      <span className="side-label">{label}</span>
    </NavLink>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useTheme();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const narrow = useNarrow();
  const [narrowOpen, setNarrowOpen] = useState(false);
  useEffect(() => setNarrowOpen(false), [narrow]);
  const isCollapsed = narrow ? !narrowOpen : collapsed;
  const [gardenOn, setGardenOn] = useState(readGardenOn);

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  function toggleCollapsed() {
    if (narrow) {
      setNarrowOpen((o) => !o);
      return;
    }
    setCollapsed((c) => {
      try {
        localStorage.setItem(NAV_KEY, c ? "0" : "1");
      } catch {
        /* per-viewer convenience only */
      }
      return !c;
    });
  }

  function toggleGarden() {
    setGardenOn((on) => {
      try {
        localStorage.setItem(GARDEN_KEY, on ? "1" : "0");
      } catch {
        /* per-viewer convenience only */
      }
      return !on;
    });
  }

  const initials = (user?.displayName ?? "?").trim().slice(0, 2).toUpperCase();

  return (
    <div className={`app-shell-layout${isCollapsed ? " nav-collapsed" : ""}`}>
      <aside className="side-nav">
        <div className="side-brand">
          <span className="side-logo" aria-hidden>
            <Wrench size={16} strokeWidth={2} />
          </span>
          <span className="side-label side-brand-text">
            Spare Parts
            <small>Management</small>
          </span>
        </div>

        <nav className="side-links">
          <span className="side-section side-label">การวางแผน</span>
          <NavItem to="/" end icon={ClipboardList} label="วางแผนสั่งซื้อ" />
          {user?.role === "ADMIN" && (
            <>
              <span className="side-section side-label">ข้อมูล</span>
              <NavItem to="/admin/import" icon={FileUp} label="Import" />
              <NavItem to="/admin/packing-rules" icon={Boxes} label="Packing Rules" />
              <span className="side-section side-label">ผู้ดูแล</span>
              <NavItem to="/admin/users" icon={Users} label="Users" />
              <NavItem to="/audit/login-history" icon={LogIn} label="Login History" />
              <NavItem to="/audit/edit-history" icon={History} label="Edit History" />
            </>
          )}
        </nav>

        {gardenOn && <SideGarden collapsed={isCollapsed} />}

        <div className="side-bottom">
          <label className="side-theme" title="เลือกธีม">
            <Palette size={18} strokeWidth={1.8} aria-hidden />
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="เลือกธีม">
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="side-user" title={user?.displayName}>
            <span className="side-avatar" aria-hidden>
              {initials}
            </span>
            <span className="side-label side-user-name">{user?.displayName}</span>
            <button type="button" className="icon-btn" onClick={() => logout()} title="ออกจากระบบ" aria-label="ออกจากระบบ">
              <LogOut size={16} strokeWidth={1.8} />
            </button>
          </div>
          <div className="side-tools">
            <button
              type="button"
              className={`icon-btn side-garden-toggle${gardenOn ? " on" : ""}`}
              onClick={toggleGarden}
              title={gardenOn ? "ซ่อนสวนน้องแมว" : "แสดงสวนน้องแมว"}
              aria-label={gardenOn ? "ซ่อนสวนน้องแมว" : "แสดงสวนน้องแมว"}
              aria-pressed={gardenOn}
            >
              <Sprout size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="icon-btn side-collapse"
              onClick={toggleCollapsed}
              title={isCollapsed ? "ขยายเมนู" : "ย่อเมนู"}
              aria-label={isCollapsed ? "ขยายเมนู" : "ย่อเมนู"}
            >
              {isCollapsed ? <PanelLeftOpen size={16} strokeWidth={1.8} /> : <PanelLeftClose size={16} strokeWidth={1.8} />}
            </button>
          </div>
        </div>
      </aside>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
