import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import ItemsTable from "./pages/ItemsTable";
import Import from "./pages/admin/Import";
import PackingRules from "./pages/admin/PackingRules";
import Users from "./pages/admin/Users";
import LoginHistory from "./pages/audit/LoginHistory";
import EditHistory from "./pages/audit/EditHistory";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePassword />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<ItemsTable />} />
                <Route element={<ProtectedRoute requireRole="ADMIN" />}>
                  <Route path="/admin/import" element={<Import />} />
                  <Route path="/admin/packing-rules" element={<PackingRules />} />
                  <Route path="/admin/users" element={<Users />} />
                  <Route path="/audit/login-history" element={<LoginHistory />} />
                  <Route path="/audit/edit-history" element={<EditHistory />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
