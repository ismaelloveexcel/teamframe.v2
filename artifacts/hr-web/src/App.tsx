import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AdminRoute, ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { ActivatePage } from "./pages/ActivatePage";
import { BootstrapPage } from "./pages/BootstrapPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { EmployeeDetailPage } from "./pages/EmployeeDetailPage";
import { PositionsPage } from "./pages/PositionsPage";
import { OrgChartPage } from "./pages/OrgChartPage";
import { CompensationPage } from "./pages/CompensationPage";
import { LeavePage } from "./pages/LeavePage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { OffboardingPage } from "./pages/OffboardingPage";
import { FinanceReportPage } from "./pages/FinanceReportPage";
import { ExitReportPage } from "./pages/ExitReportPage";

export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/bootstrap" element={<BootstrapPage />} />

      {/* Protected (AppShell) */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/org" element={<OrgChartPage />} />
        <Route path="/compensation" element={<CompensationPage />} />
        <Route path="/policies" element={<PoliciesPage />} />

        {/* Admin-only modules */}
        <Route
          path="/employees"
          element={
            <AdminRoute>
              <EmployeesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/employees/:id"
          element={
            <AdminRoute>
              <EmployeeDetailPage />
            </AdminRoute>
          }
        />
        <Route
          path="/positions"
          element={
            <AdminRoute>
              <PositionsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/leave"
          element={
            <AdminRoute>
              <LeavePage />
            </AdminRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <AdminRoute>
              <DocumentsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/offboarding"
          element={
            <AdminRoute>
              <OffboardingPage />
            </AdminRoute>
          }
        />
        <Route
          path="/reports/finance"
          element={
            <AdminRoute>
              <FinanceReportPage />
            </AdminRoute>
          }
        />
        <Route
          path="/reports/exit"
          element={
            <AdminRoute>
              <ExitReportPage />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
