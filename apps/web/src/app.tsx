import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/pages/home-page";
import { PlaceholderPage } from "@/pages/placeholder-page";

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
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route
              path="subscriptions"
              element={<PlaceholderPage title="Subscriptions" />}
            />
            <Route
              path="clients"
              element={<PlaceholderPage title="Clients" />}
            />
            <Route
              path="projects"
              element={<PlaceholderPage title="Projects" />}
            />
            <Route
              path="maintenance"
              element={<PlaceholderPage title="Maintenance" />}
            />
            <Route
              path="payments"
              element={<PlaceholderPage title="Payments" />}
            />
            <Route
              path="expenses"
              element={<PlaceholderPage title="Expenses" />}
            />
            <Route
              path="reports"
              element={<PlaceholderPage title="Reports" />}
            />
            <Route
              path="settings"
              element={<PlaceholderPage title="Settings" />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
