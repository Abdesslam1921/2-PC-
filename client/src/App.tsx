import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import AbandonedOrders from "@/pages/AbandonedOrders";
import Customers from "@/pages/Customers";
import DigitalProducts from "@/pages/DigitalProducts";
import CallCenter from "@/pages/CallCenter";
import Connecteurs from "@/pages/Connecteurs";
import Delivery from "@/pages/Delivery";
import Checkout from "@/pages/Checkout";
import Funnels from "@/pages/Funnels";
import FunnelAiSetup from "@/pages/FunnelAiSetup";
import FunnelAbTesting from "@/pages/FunnelAbTesting";
import FunnelImportSetup from "@/pages/FunnelImportSetup";
import LandingPreview from "@/pages/LandingPreview";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Orders from "@/pages/Orders";
import OrderEdit from "@/pages/OrderEdit";
import ProductCreate from "@/pages/ProductCreate";
import ProductEdit from "@/pages/ProductEdit";
import ProductLanding from "@/pages/ProductLanding";
import Products from "@/pages/Products";
import Profitability from "@/pages/Profitability";
import MediaBuying from "@/pages/MediaBuying";
import ForShip from "@/pages/ForShip";
import Settings from "@/pages/Settings";
import AiAnalytics from "@/pages/AiAnalytics";
import StoreCreate from "@/pages/StoreCreate";
import Templates from "@/pages/Templates";
import TemplateAi from "@/pages/TemplateAi";
import Storefront from "@/pages/Storefront";
import { Route, Switch, useLocation } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function DashboardPage({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Storefront />}</Route>
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
          <div className="dash-identity min-h-screen" dir="rtl">
            <main>
              <CallCenter />
            </main>
          </div>
        )}
      />
      <Route
        path="/call-center/agent"
        component={() => (
          <div className="dash-identity min-h-screen" dir="rtl">
            <main>
              <CallCenter />
            </main>
          </div>
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
        path="/abandoned-orders"
        component={() => (
          <DashboardPage>
            <AbandonedOrders />
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
      <Route path="/store">{() => <Storefront />}</Route>
      <Route path="/store/cart">{() => <Storefront view="cart" />}</Route>
      <Route path="/store/checkout" component={Checkout} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
