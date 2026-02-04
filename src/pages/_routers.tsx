import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { BaseErrorBoundary } from "@/components/base";
import { Loader2 } from "lucide-react";

// Lazy load pages
const MinimalHomePage = lazy(() => import("./home"));
const ProxiesPage = lazy(() => import("./proxies"));
const ProfilesPage = lazy(() => import("./profiles"));
const ConnectionsPage = lazy(() => import("./connections"));
const RulesPage = lazy(() => import("./rules"));
const LogsPage = lazy(() => import("./logs"));
const UnlockPage = lazy(() => import("./unlock"));
const SettingsPage = lazy(() => import("./settings"));

const PageLoader = () => (
  <div className="flex h-full w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const routers = [
  {
    path: "/",
    element: <Navigate to="/home" replace />,
  },
  {
    label: "Label-Home",
    path: "/home",
    element: withSuspense(MinimalHomePage),
  },
  {
    label: "Label-Proxies",
    path: "/proxies",
    element: withSuspense(ProxiesPage),
  },
  {
    label: "Label-Profiles",
    path: "/profile",
    element: withSuspense(ProfilesPage),
  },
  {
    label: "Label-Connections",
    path: "/connections",
    element: withSuspense(ConnectionsPage),
  },
  {
    label: "Label-Rules",
    path: "/rules",
    element: withSuspense(RulesPage),
  },
  {
    label: "Label-Logs",
    path: "/logs",
    element: withSuspense(LogsPage),
  },
  {
    label: "Label-Unlock",
    path: "/unlock",
    element: withSuspense(UnlockPage),
  },
  {
    label: "Label-Settings",
    path: "/settings",
    element: withSuspense(SettingsPage),
  },
].map((router) => ({
  ...router,
  element: (
    <BaseErrorBoundary key={router.label}>{router.element}</BaseErrorBoundary>
  ),
}));
