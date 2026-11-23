import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { IdentityShell } from "./components/IdentityShell";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import StorePublic from "@/pages/StorePublic";

/**
 * Route-level code splitting: the public storefront entry must not ship the
 * dashboard, builder, editor or the other public pages. Each route loads its
 * own chunk only when visited.
 */
const BundleLanding = lazy(() => import("@/pages/BundleLanding"));
const Customers = lazy(() => import("@/pages/Customers"));
const DigitalProducts = lazy(() => import("@/pages/DigitalProducts"));
const CallCenter = lazy(() => import("@/pages/CallCenter"));
const Connecteurs = lazy(() => import("@/pages/Connecteurs"));
const Delivery = lazy(() => import("@/pages/Delivery"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const Funnels = lazy(() => import("@/pages/Funnels"));
const FunnelAiSetup = lazy(() => import("@/pages/FunnelAiSetup"));
const FunnelAbTesting = lazy(() => import("@/pages/FunnelAbTesting"));
const FunnelImportSetup = lazy(() => import("@/pages/FunnelImportSetup"));
const LandingPreview = lazy(() => import("@/pages/LandingPreview"));
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Orders = lazy(() => import("@/pages/Orders"));
const OrderEdit = lazy(() => import("@/pages/OrderEdit"));
const ProductCreate = lazy(() => import("@/pages/ProductCreate"));
const ProductEdit = lazy(() => import("@/pages/ProductEdit"));
const ProductLanding = lazy(() => import("@/pages/ProductLanding"));
const Products = lazy(() => import("@/pages/Products"));
const Categories = lazy(() => import("@/pages/Categories"));
const Offers = lazy(() => import("@/pages/Offers"));
const StoreCategory = lazy(() => import("@/pages/StoreCategory"));
const Profitability = lazy(() => import("@/pages/Profitability"));
const MediaBuying = lazy(() => import("@/pages/MediaBuying"));
const ForShip = lazy(() => import("@/pages/ForShip"));
const Settings = lazy(() => import("@/pages/Settings"));
const AiAnalytics = lazy(() => import("@/pages/AiAnalytics"));
const StoreCreate = lazy(() => import("@/pages/StoreCreate"));
const Templates = lazy(() => import("@/pages/Templates"));
const TemplateAi = lazy(() => import("@/pages/TemplateAi"));
const Storefront = lazy(() => import("@/pages/Storefront"));
const BuilderPage = lazy(() => import("@/storefront/builder/BuilderPage"));
const ThemeEditorPage = lazy(
  () => import("@/storefront/builder/ThemeEditorPage")
);
const StoreEditorPage = lazy(() => import("@/storefront/editor/StoreEditorPage"));
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));

function RouteFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--paper)]">
      <div className="size-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
    </div>
  );
}

/** Redirect helper: lands on the exact tab, not the default. */
function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to, { replace: true });
  }, [setLocation, to]);
  return null;
}

function DashboardPage({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/">{() => <StorePublic />}</Route>
        <Route
          path="/dashboard"
          component={() => (
            <DashboardPage>
              <Home />
            </DashboardPage>
          )}
        />
        <Route path="/login" component={Login} />
        <Route
          path="/categories"
          component={() => (
            <DashboardPage>
              <Categories />
            </DashboardPage>
          )}
        />
        <Route
          path="/offers"
          component={() => (
            <DashboardPage>
              <Offers />
            </DashboardPage>
          )}
        />
        <Route
          path="/products"
          component={() => (
            <DashboardPage>
              <Products />
            </DashboardPage>
          )}
        />
        <Route
          path="/profitability"
          component={() => (
            <DashboardPage>
              <Profitability />
            </DashboardPage>
          )}
        />
        <Route
          path="/media-buying"
          component={() => (
            <DashboardPage>
              <MediaBuying />
            </DashboardPage>
          )}
        />
        <Route
          path="/ai-analytics"
          component={() => (
            <DashboardPage>
              <AiAnalytics />
            </DashboardPage>
          )}
        />
        <Route
          path="/for-ship"
          component={() => (
            <DashboardPage>
              <ForShip />
            </DashboardPage>
          )}
        />
        <Route
          path="/digital-products"
          component={() => (
            <DashboardPage>
              <DigitalProducts />
            </DashboardPage>
          )}
        />
        <Route
          path="/products/create"
          component={() => (
            <DashboardPage>
              <ProductCreate />
            </DashboardPage>
          )}
        />
        <Route
          path="/products/:id/edit"
          component={() => (
            <DashboardPage>
              <ProductEdit />
            </DashboardPage>
          )}
        />
        <Route
          path="/delivery"
          component={() => (
            <DashboardPage>
              <Delivery />
            </DashboardPage>
          )}
        />
        <Route
          path="/connecteurs/:kind"
          component={() => (
            <DashboardPage>
              <Connecteurs />
            </DashboardPage>
          )}
        />
        <Route
          path="/connecteurs"
          component={() => (
            <DashboardPage>
              <Connecteurs />
            </DashboardPage>
          )}
        />
        <Route
          path="/call-center"
          component={() => (
            <DashboardPage>
              <CallCenter />
            </DashboardPage>
          )}
        />
        <Route
          path="/call-center/login"
          component={() => (
            <IdentityShell>
              <CallCenter />
            </IdentityShell>
          )}
        />
        <Route
          path="/call-center/agent"
          component={() => (
            <IdentityShell>
              <CallCenter />
            </IdentityShell>
          )}
        />
        <Route
          path="/funnels"
          component={() => (
            <DashboardPage>
              <Funnels />
            </DashboardPage>
          )}
        />
        <Route
          path="/funnels/create"
          component={() => (
            <DashboardPage>
              <Funnels />
            </DashboardPage>
          )}
        />
        <Route
          path="/funnels/ai"
          component={() => (
            <DashboardPage>
              <FunnelAiSetup />
            </DashboardPage>
          )}
        />
        <Route
          path="/funnels/ai/preview/:id"
          component={() => (
            <DashboardPage>
              <LandingPreview />
            </DashboardPage>
          )}
        />
        <Route
          path="/funnels/ab-testing"
          component={() => (
            <DashboardPage>
              <FunnelAbTesting />
            </DashboardPage>
          )}
        />
        <Route
          path="/funnels/import"
          component={() => (
            <DashboardPage>
              <FunnelImportSetup />
            </DashboardPage>
          )}
        />
        <Route path="/p/:id" component={ProductLanding} />
        <Route path="/b/:slug" component={BundleLanding} />
        <Route
          path="/orders/:id/edit"
          component={() => (
            <DashboardPage>
              <OrderEdit />
            </DashboardPage>
          )}
        />
        <Route
          path="/orders"
          component={() => (
            <DashboardPage>
              <Orders />
            </DashboardPage>
          )}
        />
        <Route
          path="/customers"
          component={() => (
            <DashboardPage>
              <Customers />
            </DashboardPage>
          )}
        />
        <Route
          path="/settings"
          component={() => (
            <DashboardPage>
              <Settings />
            </DashboardPage>
          )}
        />
        <Route
          path="/stores/new"
          component={() => (
            <DashboardPage>
              <StoreCreate />
            </DashboardPage>
          )}
        />
        <Route
          path="/templates"
          component={() => (
            <DashboardPage>
              <Templates />
            </DashboardPage>
          )}
        />
        <Route
          path="/templates/ai"
          component={() => (
            <DashboardPage>
              <TemplateAi />
            </DashboardPage>
          )}
        />
        <Route path="/store">{() => <StorePublic />}</Route>
        {/* Public category page: fail-closed on the server (no store / unknown
            slug / inactive category → NOT_FOUND). */}
        <Route path="/store/category/:slug" component={StoreCategory} />
        <Route path="/store/editor" component={StoreEditorPage} />
        {/* The editor is one merged page (content + theme); legacy entries redirect to it. */}
        <Route
          path="/store/builder"
          component={() => <RedirectTo to="/store/editor" />}
        />
        <Route
          path="/store/theme"
          component={() => <RedirectTo to="/store/editor" />}
        />
        {/* Legacy editors kept reachable as a backup until the unified one is validated. */}
        <Route path="/store/builder-legacy" component={BuilderPage} />
        <Route path="/store/theme-legacy" component={ThemeEditorPage} />
        <Route path="/store/cart">{() => <Storefront view="cart" />}</Route>
        <Route path="/store/checkout" component={Checkout} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" dir="rtl" richColors closeButton />
          <CartProvider>
            <Router />
          </CartProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
