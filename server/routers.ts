import { authRouter } from "./routers/auth";
import { storesRouter } from "./routers/stores";
import { commerceRouter } from "./routers/commerce";
import { connecteursRouter } from "./routers/connecteurs";
import { dashboardRouter } from "./routers/dashboard";
import { deliveryRouter } from "./routers/delivery";
import { landingsRouter } from "./routers/landings";
import { ordersRouter } from "./routers/orders";
import { productsRouter } from "./routers/products";
import { categoriesRouter } from "./routers/categories";
import { offersRouter } from "./routers/offers";
import { systemRouter } from "./_core/systemRouter";
import { sharkCodRouter } from "./routers/sharkCod";
import { orderCleanRouter } from "./routers/orderClean";
import { thankYouRouter } from "./routers/thankYou";
import { contactBarRouter } from "./routers/contactBar";
import { contentGuardRouter } from "./routers/contentGuard";
import { trackingRetargetRouter } from "./routers/trackingRetarget";
import { callCenterRouter } from "./routers/callCenter";
import { digitalRouter } from "./routers/digital";
import { profitabilityRouter } from "./routers/profitability";
import { mediaBuyingRouter } from "./routers/mediaBuying";
import { templatesRouter } from "./routers/templates";
import { storefrontRouter } from "./routers/storefront";
import { chatbotRouter } from "./routers/chatbot";
import { forshipRouter } from "./routers/forship";
import { abTestingRouter } from "./routers/abTesting";
import { messageOrderRouter } from "./routers/messageOrder";
import { negotiatorRouter } from "./routers/negotiator";
import { router } from "./_core/trpc";

export const appRouter = router({
  system: systemRouter,
  commerce: commerceRouter,
  connecteurs: connecteursRouter,
  sharkCod: sharkCodRouter,
  orderClean: orderCleanRouter,
  thankYou: thankYouRouter,
  contactBar: contactBarRouter,
  contentGuard: contentGuardRouter,
  trackingRetarget: trackingRetargetRouter,
  callCenter: callCenterRouter,
  dashboard: dashboardRouter,
  delivery: deliveryRouter,
  orders: ordersRouter,
  products: productsRouter,
  categories: categoriesRouter,
  offers: offersRouter,
  digital: digitalRouter,
  profitability: profitabilityRouter,
  mediaBuying: mediaBuyingRouter,
  templates: templatesRouter,
  storefront: storefrontRouter,
  chatbot: chatbotRouter,
  landings: landingsRouter,
  abTesting: abTestingRouter,
  auth: authRouter,
  stores: storesRouter,
  forship: forshipRouter,
  messageOrder: messageOrderRouter,
  negotiator: negotiatorRouter,

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
