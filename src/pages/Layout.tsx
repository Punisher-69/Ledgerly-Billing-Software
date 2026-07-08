import { NavLink, Outlet } from "react-router-dom";
import { getApi } from "@/lib/api";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-yellow-400 text-zinc-950 shadow-sm"
      : "text-yellow-100/90 hover:bg-zinc-800"
  }`;

export function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-yellow-50">
      <header className="border-b border-amber-500/40 bg-zinc-950 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
          <span className="font-semibold text-yellow-400 tracking-tight">
            Ledgerly
          </span>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            <NavLink to="/products" className={navClass}>
              Products
            </NavLink>
            <NavLink to="/invoice" className={navClass}>
              New bill
            </NavLink>
            <NavLink to="/bills" className={navClass}>
              Bills
            </NavLink>
            <NavLink to="/reports" className={navClass}>
              Reports
            </NavLink>
            {/* <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink> */}
          </nav>
          <button
            type="button"
            onClick={async () => {
              await getApi().authLogout();
              onLogout();
            }}
            className="text-sm text-yellow-200/80 hover:text-yellow-300 px-2 py-1 rounded-lg hover:bg-zinc-800"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
