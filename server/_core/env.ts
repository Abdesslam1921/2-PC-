export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  aiApiUrl: process.env.AI_API_URL ?? process.env.BUILT_IN_FORGE_API_URL ?? "",
  aiApiKey: process.env.AI_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? "",
  aiApiModel: process.env.AI_API_MODEL ?? "",
  shopifyStoreDomain: process.env.SHOPIFY_STORE_DOMAIN ?? "",
  shopifyStorefrontApiAccessToken:
    process.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN ?? "",
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
  forshipCallbackUrl: process.env.FORSHIP_CALLBACK_URL ?? "",
};
