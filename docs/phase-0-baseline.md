# Phase 0 — Baseline Verification (خط الأساس الوظيفي)

مرجع مرتبط بـ commit الأساس: `e25f8d5` — "baseline: existing app snapshot before storefront work (phase 0 audit)".

- تاريخ التنفيذ: 2026-09-12
- مدير الحزم: pnpm 10.4.1 (استُخدم `pnpm.cmd` لأن PowerShell يمنع `pnpm.ps1` بسبب سياسة تنفيذ السكربتات)
- Node/TS: TypeScript 5.9.3، Vitest 2.1.4، React 19.2.1، Vite 7.1.7

> هذا المستند يسجّل **الوضع القائم قبل أي تعديل**. كل الإخفاقات أدناه **سابقة للمرحلة 0** ولم يقدّمها هذا العمل.

## 1) `pnpm check` (tsc --noEmit)

**النتيجة: فشل (exit code 2)** — 6 أخطاء من نوع TypeScript في ملف واحد:

```
client/src/pages/AiAnalytics.tsx(117,18): error TS2448: Block-scoped variable 'selectedProductId' used before its declaration.
client/src/pages/AiAnalytics.tsx(117,18): error TS2454: Variable 'selectedProductId' is used before being assigned.
client/src/pages/AiAnalytics.tsx(118,18): error TS2448: Block-scoped variable 'selectedProductId' used before its declaration.
client/src/pages/AiAnalytics.tsx(118,18): error TS2454: Variable 'selectedProductId' is used before being assigned.
client/src/pages/AiAnalytics.tsx(118,39): error TS2448: Block-scoped variable 'hasProductData' used before its declaration.
client/src/pages/AiAnalytics.tsx(149,26): error TS2353: Object literal may only specify known properties, and 'productId' does not exist in type 'RefetchOptions'.
```

التصنيف: أخطاء ترتيب/تهيئة متغيرات في `AiAnalytics.tsx` (خطأ `useRef`/`useQuery` على الأرجح). ليست لها علاقة بالمتجر أو القوالب.

## 2) `pnpm test` (vitest run)

**النتيجة: فشل** — مع اكتشاف 54 ملف اختبار فقط (وليس ~268 كما ظهر في العدّ الأولي الخاطئ).

```
Test Files  11 failed | 41 passed | 2 skipped (54)
     Tests  20 failed | 124 passed | 3 skipped (147)
  Duration  121.97s
```

### ملفات الاختبار الفاشلة (11)
1. `client/src/pages/Orders.ui.test.tsx`
2. `client/src/pages/ProductCreate.ui.test.tsx`
3. `client/src/pages/ProductLanding.ui.test.tsx`
4. `client/src/pages/Storefront.ui.test.tsx`
5. `client/src/pages/StorefrontJourney.ui.test.tsx`
6. `client/src/ui.contract.test.ts`
7. `server/googleOAuth.test.ts`
8. `server/metaOAuthCredentials.test.ts`
9. `server/routers/connecteurs.test.ts`
10. `server/routers/digital.test.ts`
11. `server/routers/products.test.ts`

### أسماء الاختبارات الفاشلة (20)
- `connecteurs contract > exposes all supported integrations in stable order`
- `dashboard route contracts > keeps the mobile navigation open and close controls keyboard-accessible`
- `digital products and offers > requires a file for a digital product`
- `digital products and offers > uploads a digital file and forwards its metadata without delivery fields`
- `Google OAuth configuration > has configured client credentials and reaches the Google token endpoint`
- `Meta OAuth application credentials > validates the OAuth app credentials against Meta`
- `Orders > sends the selected operational status for an order`
- `presentation-state contracts > keeps the catalog, cart, and checkout connected to the independent storefront journey`
- `ProductCreate variant interactions > adds a quantity offer with free delivery`
- `ProductCreate variant interactions > adds and removes a color option, then regenerates the variant rows`
- `ProductCreate variant interactions > saves a product to the independent catalog and returns to the products list`
- `ProductCreate variant interactions > saves owner-only Costs & Profitability settings`
- `ProductCreate variant interactions > shows digital delivery settings and sends the uploaded file metadata`
- `ProductLanding > submits the selected live variant through the direct COD form`
- `products management actions > updates, duplicates, deletes, and exposes an active product through its landing query`
- `products.create > returns the database error after images upload when local product persistence fails`
- `products.create > stops product creation when independent image storage fails`
- `products.create > stores local product data and uploads attached images without using an external catalog`
- `Storefront > renders the live public catalog and adds an available product to the independent cart`
- `Storefront shopping journey > sends a published product directly to COD without passing through the cart`

### تصنيف الأسباب (تحليل ثابت من المخرجات)

**أ) اختبارات واجهة/عقود قديمة مقابل تطور التطبيق (الأغلب):**
- `TypeError: Cannot read properties of undefined (reading 'list')` في `Orders.tsx:122` عبر `trpc.messageOrder.list` — mock الـ trpc في الاختبار لا يحتوي `messageOrder`.
- `TypeError: Cannot read properties of undefined (reading 'publicForProduct')` في `MessageOrderWidget.tsx:31` — نفس السبب.
- `TypeError: Cannot read properties of undefined (reading 'useQuery')` في `ProductCreate.tsx:202` — mock ناقص لـ `products.list`.
- `ui.contract.test.ts` يتوقّع نصوص/بنية لم تعد موجودة: `'منتجات متوفرة الآن'` و`<SheetContent` و`<SheetClose` — انحرف بعد إعادة كتابة `Storefront`/`DashboardLayout`.
- `connecteurs contract` يتوقّع قائمة ثابتة من الأنواع بينما أُضيف النوع `message_order`.

**ب) اختبارات تعتمد على أسرار/شبكة خارجية (بيئة):**
- `server/googleOAuth.test.ts` — `expect(appId/clientId/appSecret/clientSecret).toBeTruthy()` يتطلب بيانات اعتماد حقيقية غير موجودة في بيئة الاختبار.
- `server/metaOAuthCredentials.test.ts` — يتحقق من صحة بيانات OAuth عبر Meta (شبكة/أسرار).

**ج) اختبارات رسائل خطأ/تحقق قديمة:**
- `products.create` و`digital` تتوقّع رسائل محددة (`'Database unavailable'`, `'Storage unavailable'`, `'أرفق الملف الرقمي'`) لكنها تحصل على `ZodError` — تغيّر ترتيب/شكل التحقق.

### إخفاقات بيئية/مشروطة
- اختبارات Google/Meta OAuth مشروطة بالأسرار والشبكة؛ لا تعكس منطق الأعمال.

## 3) الخلاصة
- لا يوجد أساس «أخضر»: `check` و`test` فاشلان قبل بدء أي عمل على القوالب.
- أي مرحلة لاحقة يجب ألا **تزيد** عدد هذه الإخفاقات؛ ويجب مقارنة النتائج بهذا المستند.
- القرار المعلّق (يحتاج موافقة): هل نُصلح هذه الإخفاقات السابقة كجزء من عمل لاحق، أم تُترك كما هي مع ضمان عدم زيادتها؟

## 4) ما لم يُقَس بعد
- خط أساس الأداء (LCP/INP/CLS/TTFB/JS/الوزن/عدد الطلبات/وزن الصور): يتطلب بناء إنتاجيًا وتشغيل التطبيق مع قاعدة بيانات، ولم يُنفَّذ في المرحلة 0.
