import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { ClientDetailPage } from "@/features/clients/client-detail-page";
import { ClientsPage } from "@/features/clients/clients-page";
import { ExpenseDetailPage } from "@/features/expenses/expense-detail-page";
import { ExpensesPage } from "@/features/expenses/expenses-page";
import { MaintenancePage } from "@/features/maintenance/maintenance-page";
import { NotificationsPage } from "@/features/notifications/notifications-page";
import { PaymentDetailPage } from "@/features/payments/payment-detail-page";
import { PaymentsPage } from "@/features/payments/payments-page";
import { ProjectDetailPage } from "@/features/projects/project-detail-page";
import { ProjectsPage } from "@/features/projects/projects-page";
import { ReportsPage } from "@/features/reports/reports-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { SubscriptionDetailPage } from "@/features/subscriptions/subscription-detail-page";
import { SubscriptionsPage } from "@/features/subscriptions/subscriptions-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { LoginPage } from "@/pages/login-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="subscriptions" element={<SubscriptionsPage />} />
                <Route
                  path="subscriptions/:id"
                  element={<SubscriptionDetailPage />}
                />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="clients/:id" element={<ClientDetailPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:id" element={<ProjectDetailPage />} />
                <Route path="maintenance" element={<MaintenancePage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="payments/:id" element={<PaymentDetailPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="expenses/:id" element={<ExpenseDetailPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
