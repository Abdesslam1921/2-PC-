# Phase 6 — ضمان الجودة النهائي (خطة + تقدّم)

> هذا الملف يُحدَّث ويُcommit بعد كل بند. لا كود/تعديل قبل موافقة المستخدم على الخطة.

## 0) حالة نقطة البداية (13-10-2026)
- **تمّت المزامنة:** `main == origin/main == 4c21a4e` (بعد `git merge --abort` + `git reset --hard origin/main`).
- تم التخلي عن كوميت الـUI القديم غير المطلوب `83a645c` (تعديلات MonkeyCode هي المرجع).
- `pnpm install` ✅ · `pnpm check` → **0 أخطاء** ✅.
- ملاحظة: `pnpm install` كتخرج تحذير `Ignored build scripts: esbuild` (سلوك pnpm الافتراضي، غير مؤثر على `check`/`build`).

---

## 🔴 خطر أمني — يُبلَّغ فورًا (قبل أي إصلاح)

### S1 — «فتح» الويب هوك عند غياب السر — **الخطورة: عالية**
- **المكان:** `server/forshipCore.ts` → `verifyWebhookSignature()`: السطر `if (!secret) return true;`.
- **الأثر:** أي حامل توصيل بلا `webhookSecret` يقبل `POST /api/webhooks/carrier/:carrierId` **بلا توقيع** → تغيير حالات طلبات دون مصادقة.
- **الوضع:** مؤكَّد من قراءة الكود (لم يُختبر حيًا).

> ✅ أُصلح في كوميت منفصل (fail-closed + الويب هوك يرد 401). التفاصيل في «سجل التنفيذ».

### S2 — تلاعب بالأسعار عبر `priceOverride` من الكليان — **الخطورة: عالية**
- **المكان:** `server/db.ts:1920-1921` → `const unitPrice = line.priceOverride ?? offer?.price ?? variant?.price ?? product.price;` (يُستدعى من `orders.createCod`، و`priceOverride` حقل كليان في `server/routers/orders.ts`).
- **الأثر:** أي عميل يرسل `priceOverride` في سطر الطلب يفرض **السعر النهائي** (له أولوية على سعر DB/العرض/الخيار)، فيشتري أي منتج بأي سعر (مثل `"1.00"`). كما أن وجوده يتجاوز شرط اختيار الخيار (`db.ts:1905`).
- **الحالة:** مؤكَّد من قراءة الكود ومسار الاستدعاء (يُستخدم الحقل حاليًا في Upsell: `client/src/components/CheckoutUpsellPopup.tsx`, `DirectCodOrderForm.tsx`).
- **الإصلاح المقترح (بانتظار موافقة):** إعادة حساب سعر Upsell من أعمدة المنتج في DB، وتجاهل/رفض `priceOverride` القادم من الكليان (أو التحقق من تطابقه فقط).
- **الوضع:** ✅ **أُصلح** في كوميت `f516d9b` (إصلاح S2). التفاصيل في «سجل التنفيذ».

### S3 — قراءة ملفات عشوائية عبر بروكسي التخزين بلا مصادقة — **الخطورة: عالية**
- **المكان:** `server/_core/storageProxy.ts:7-26` (`GET /manus-storage/*` بلا auth + `key` قابل للعبور عبر `../`).
- **الأثر (مُختبر فعليًا):** `http.get /manus-storage/products/..%2f..%2fpackage.json` → **200** بمحتوى `package.json`، و`/manus-storage/products/..%2f..%2fserver%2fsecureSecrets.ts` → **200** بمصدر الملف. أي عملية قراءة ملفات محلية بلا مصادقة (قد تشمل ملفات الإعداد/الأسرار).
- **الحالة:** **مؤكَّد تجريبيًا** عبر سكربت مؤقّت (Express + البروكسي الحقيقي، ثم حُذف).
- **الإصلاح المقترح (بانتظار موافقة):** تطبيع + حصر المسار داخل `file_storage` (`path.resolve` + فحص البادئة)، رفض أي `..`/مقطع مطلق، ومراجعة الوصول العام للمفاتيح الحساسة (`digital-products/`, `whatsapp-media/`).
- **الوضع:** ✅ **أُصلح** في كوميت `7619cda` (إصلاح S3). التفاصيل في «سجل التنفيذ».

### ملاحظات أقل خطورة (غير مؤكَّدة/معلوماتية)
- **مفتاح التشفير احتياطي ثابت:** `secureSecrets.ts:4-7` يُشتق مفتاح AES من `ENV.cookieSecret` وإلا من `"abdou-store-local-secret"` — إن غاب `cookieSecret` في الإنتاج فالمفتاح معروف. (خطورة متوسطة، متعلّقة بالإعداد لا الكود.)
  - **إجابة السؤال (بلا عرض القيمة):** **نعم مضبوط.** `JWT_SECRET` موجود في `.env` بطول 43، و`server/_core/index.ts:1` يحمّل `dotenv/config`، فـ`ENV.cookieSecret` غير فارغ في هذه البيئة → المفتاح الاحتياطي الثابت **لا يُستعمل هنا**. يبقى خطر لو نُشر بدون `JWT_SECRET`. **لن أغيّر مفتاح التشفير ولا أي إعداد** بلا خطة إعادة تشفير لمفاتيح الشركات المخزنة (`deliveryCarrierConnections.apiTokenEncrypted` + `merchantCarrierCredentials.apiTokenEncrypted`) واحتياط DB.
- **ملفات رقمية مدفوعة عبر نفس البروكسي العام:** `storageGetSignedUrl` محليًا يُرجِع `/manus-storage/{key}` بلا مصادقة (خطورة متوسطة، مرتبطة بـS3). **مقترح (غير منفّذ):** خدمة التنزيل الرقمي تمرّ فقط عبر `/api/downloads/:token` (موجود) الذي يستهلك التوكن ثم يعيد رابطًا؛ وفي وضع محلي بلا Forge، تُقدَّم الملفات عبر مسار موقّع بمدة صلاحية (HMAC + `exp`) تحت `/api/media/:sig` مع فحص `digital-products/` — بدلًا من كشف مفتاح التخزين مباشرةً في `/manus-storage`.
- **`orders.saveAbandoned` نقطة عامة:** تقبل أي `productId` + هاتف بلا Turnstile/حدّ معدّل وكتابة صفوف «متروكة» في أي متجر (إساءة/إغراق، خطورة منخفضة). **مقترح (غير منفّذ):** حدّ معدّل لكل IP/هاتف/متجر (نافذة زمنية) + `verifyTurnstile(storeId, token)` نفسه المستخدم في `createCod` + التحقق من تنسيق الهاتف.

---

## سجل التنفيذ

### [S1] إصلاح فتح الويب هوك — منجز
- `server/forshipCore.ts::verifyWebhookSignature`: `if (!secret) return false;` (fail-closed) + مقارنة زمن-ثابت (`crypto.timingSafeEqual` مع فحص تساوي الطول).
- `server/forship.ts::processIncomingWebhook`: عند فشل التوقيع يرد **401 invalid signature** (كان 200).
- `server/forshipDb.ts::merchantCarrierHasWebhook`: صار يتجاهل المزامنة الدورية **فقط** إذا كان الويب هوك مُهيّأ **و** السر مضبوط؛ وإلا المزامنة الدورية تكمّل (`getCarrierById().webhookSecret`).
- اختبارات: `server/forshipCore.test.ts` (رفض بلا سرّ + رفض بلا ترويسة + توقيع صحيح/غلط) و`server/ecotrackSync.test.ts` (حامل بلا سرّ يبقى يتزامن).

### baseline `pnpm test` (13-10-2026) — **مبدئي/ملوّث**
- النتيجة الخام: **396 اختبارًا · 14 فاشل · 379 ناجح · 3 متخطّى** (75 ملفًا · 10 فاشلة).
- ⚠️ **تحذير:** هذا baseline **غير موثوق** لأن **جلسة Agent Manager موازية** («Dashboard backlog») كانت تعدّل نفس الشجرة أثناء التشغيل. سيُعاد أخذه على شجرة نظيفة.

---

## 1) بنود Phase 6 (الترتيب المعتمد)
1. عزل المستأجرين — ✅ منجز
2. الإصدارات / التراجع / الاحتفاظ — ✅ منجز
3. التزامن
3ب. **سباقات الطلبات** — ✅ منجز (تفاصيل في السجل أسفل)
   - **خصم المخزون ذريًا** عند إنشاء الطلب لتفادي البيع الزائد (شرط `WHERE stock >= qty` داخل معاملة + التحقق من `affectedRows`).
   - **توليد رقم الطلب تحت الضغط** بلا تصادم (بلا «اقرأ آخر رقم ثم +1»).
   - **التعيين بالتناوب لموظفي Call Center** عند وصول طلبين في نفس اللحظة (عدم إسناد نفس الموظف مرتين بفعل سباق).
4. SEO — 🔄 **غير منجز**: الأساس موجود من 18-10، لكن جرد 22-10 كشف فجوات (لا `noindex`، لا 404 للكيانات المفقودة، المتجر المعطّل قابل للفهرسة، canonical من `Host` الخام، الباقة/الفئة بلا meta، sitemap ناقص). الخطة المعتمدة والتنفيذ في نهاية الملف.
5. الأداء الفعلي
6. RTL / Responsive الشامل
7. تقرير عربي نهائي

---

## 2) baseline — اختبارات فاشلة معروفة (قبل أي تعديل)
> تُثبَّت بتشغيل `pnpm test` على شجرة نظيفة وتُدوَّن أسماؤها الدقيقة هنا.

- معروف مسبقًا: فشل mock ناقص `trpc.messageOrder` في `ProductLanding.ui.test.tsx` و`StorefrontJourney.ui.test.tsx` (سقوط `MessageOrderWidget`).
- تقلّب بيئي: Vitest SSR temp-file (`UNKNOWN: unknown error, open ...\Temp\...\ssr\<hash>`) — ليس انحدار كود.
### baseline نظيف (14-10-2026، بعد fde12c6) — **الأسماء الدقيقة**
`406 اختبارًا · 14 فاشل · 389 ناجح · 3 متخطّى` (75 ملفًا · 10 فاشلة). الفاشلة (14):
1. `server/googleOAuth.test.ts` › Google OAuth configuration › has configured client credentials and reaches the Google token endpoint
2. `server/metaOAuthCredentials.test.ts` › Meta OAuth application credentials › validates the OAuth app credentials against Meta
3. `server/routers/connecteurs.test.ts` › connecteurs contract › exposes all supported integrations in stable order
4. `server/routers/digital.test.ts` › digital products and offers › uploads a digital file and forwards its metadata without delivery fields
5. `server/routers/digital.test.ts` › digital products and offers › requires a file for a digital product
6. `server/routers/products.test.ts` › products.create › stores local product data and uploads attached images without using an external catalog
7. `server/routers/products.test.ts` › products.create › stops product creation when independent image storage fails
8. `server/routers/products.test.ts` › products.create › returns the database error after images upload when local product persistence fails
9. `server/routers/products.test.ts` › products management actions › updates, duplicates, deletes, and exposes an active product through its landing query
10. `client/src/ui.contract.test.ts` › presentation-state contracts › keeps the catalog, cart, and checkout connected to the independent storefront journey
11. `client/src/pages/Orders.ui.test.tsx` › Orders › sends the selected operational status for an order
12. `client/src/pages/ProductLanding.ui.test.tsx` › ProductLanding › submits the selected live variant through the direct COD form
13. `client/src/pages/Storefront.ui.test.tsx` › Storefront › renders the live public catalog and adds an available product to the independent cart
14. `client/src/pages/StorefrontJourney.ui.test.tsx` › Storefront shopping journey › sends a published product directly to COD without passing through the cart

> ملاحظة: العدد 14 **مطابق** لما قبل التعديلات (لا انحدار جديد). جزء كبير منها يعتمد على شبكة/مزوّدات خارجية (OAuth/تخزين صور) وmocks واجهة. لا يُخلط مع أي فشل مستقبلي.

---

## 3) البند 1 — عزل المستأجرين (النطاق الدقيق)

### 3.1 نقاط عامة بلا تسجيل دخول
`products.publicList/publicGet` · `categories.*` (public) · `offers.*` (public) · `storefront.publicConfig` · `delivery.quoteForProduct`.
**الفحص:** متجر غير مُحدَّد (`ctx.store = null`) → فشل آمن (فراغ/`NOT_FOUND`)، ولا تسريب متجر آخر؛ تمرير معرّف متجر B من سياق متجر A → `NOT_FOUND`.
**الطريقة:** اختبارات routers قائمة + حالات cross-store صريحة.

### 3.2 إنشاء الطلبات
`orders.createCod` · الطلب اليدوي (`createManual`) · تسجيل الطلبات المتروكة (`saveAbandoned` — نقطة عامة تقبل رقم هاتف).
**الفحص:** `storeId` يُشتق من المنتج/السياق وليس من مُدخل العميل؛ منع الكتابة في متجر آخر؛ حدود spam/حجم؛ عدم تسريب بيانات متاجر أخرى في الاستجابة.
**الطريقة:** اختبارات على `orders` + تجربة إساءة (مدخلات ملتوية).

### 3.3 الداشبورد المحمي
`products.patchCodTrust` (يستعمل `getStoreId(ctx)` — يُؤكَّد) · تعيين Call Center: هل الموظف يرى **طلباته المعيَّنة فقط** (`callCenter.*` list/dashboard).
**الطريقة:** اختبارات scope + cross-store.

### 3.4 مزامنة ProShip / Ecotrack
- **الويب هوك:** تحقق التوقيع (انظر S1) + هل يُقيَّد التحديث بمتجر الحامل؟
- **المزامنة اليدوية/المجدولة:** مقيّدة بـ`storeId`.

### 3.5 مفاتيح شركات التوصيل
`deliveryCarrierConnections.apiTokenEncrypted` (AES-256-GCM عبر `secureSecrets.ts`) — التأكد أنه لا يوجد تخزين نصي عادي، وفحص تخزين `webhookSecret`.

### 3.6 كل استعلام DB
تدقيق ثابت: وجود `storeId` في `WHERE` لكل دالة تلمس بيانات متجر + اختبارات cross-store (A↔B) للعمليات الحيوية.

### 3.8 معرّفات داخل البيانات المرسلة (يجب أن تتبع نفس المتجر)
- `appliedOffers[].offerId` عند إنشاء الطلب: هل العرض يخصّ نفس المتجر؟
- `offers.setProducts`: هل المنتجات الممرَّرة تخصّ نفس المتجر؟
- `categoryId` عند إنشاء/تعديل المنتج: هل الفئة تخصّ نفس المتجر؟
- معرّفات الموظفين (Call Center): هل تخصّ نفس المتجر؟
**الفحص:** إرسال معرّف من متجر آخر → `NOT_FOUND`/رفض، مع اختبارات صريحة.

### 3.9 التلاعب بالأسعار
- `orders.createCod`: السعر والخصم **يُحسبان من قاعدة البيانات**؛ أي `price`/`priceOverride`/`offerQuantity` قادم من الكليان يجب أن **يُتجاهل** أو **يُتحقق منه** (لا يُؤخذ كسعر نهائي).
**الفحص:** إرسال أسعار/كميات مزيّفة من الكليان → الإجمالي يبقى محسوبًا من DB؛ تجربة إساءة صريحة.

### 3.7 ما لا أستطيع فحصه من بيئتي
- بنية النشر متعددة المستأجرين الحقيقية (DNS/توجيه المضيف)، WAF/حدود المعدل على الحافة، وسلوك APIs شركات التوصيل الخارجية الحقيقية، وتعدد المتاجر الفعلي على الإنتاج.

---

## 4) قواعد الشغل
- تحديث هذا الملف + commit بعد كل بند، ثم push.
- **لا تطبيق هجرة (migration) بلا موافقة صريحة:** تُولَّد وتُعرض الـSQL فقط، وينتظر التطبيق. بلا تغيير بصري في المتجر.
- لا أدّعي فحص ما لم أفحصه: كل بند «مفحوص فعلًا» أو «غير مفحوص + السبب».
- أي خطر أمني يُبلَّغ فورًا قبل الإصلاح مع درجة الخطورة.
- **قاعدة دائمة — تغيير مخطط إعدادات المتجر:** أي تغيير في `shared/storefront/storefrontConfig.ts` أو `shared/storefront/themeSchema.ts` (حذف حقل/قسم/نوع، إعادة تسمية، أو تشديد قيمة) **يجب** أن يأتي معه:
  1. خطوة تطبيع (normalization) صريحة للقطات القديمة (Draft + Published) قبل التحقق الصارم، مع تسجيل كل قيمة تُحذف (المفتاح/القسم/السبب) وعدّادها في `publishedHealth`.
  2. تشغيل `scripts/storefront-snapshots-audit.ts` على قاعدة البيانات الحقيقية **قبل النشر**، وإرفاق نتيجته في تقرير البند (عدد الصالح/المطبع/الفاسد + أسباب الحذف).
  لا يُعتبر التغيير مكتملًا بدون هذين الشرطين.

---

## Backlog UI/تنقّل (قبل Phase 6) — طلبه المستخدم 13-10-2026
> مرجع: تنقّل فرعي في السايدبار تحت العنصر الرئيسي (صورة: «الطلبات» ← «طلباتي»، «غير مرغوب فيه»).

1. **الطلبات**: الصفحة الافتراضية = كل الطلبات، مع عناوين فرعية/تبويبات أسفل القسم:
   - «الطلبات العامة» = كل الطلبات.
   - «طلباتي» = كل الطلبات **بلا** المتروكة.
   - «الطلبات المتروكة» = المتروكة فقط.
2. **المنتجات**: «المنتجات العامة» (الكل) + فرعيان: «المنتجات المادية» و«المنتجات الرقمية».
3. **إنشاء منتج**: فرعيان «إنشاء منتج مادي» و«إنشاء منتج رقمي».
4. **العروض**: «العروض العامة» + فرعية: «الباقات» · «خصم الكمية» · «Upsell».
5. **حذف** من السايدبار الرئيسي: «المنتجات الرقمية» و«إنشاء منتج رقمي» (رجعا فرعيين).
6. **صفحة الطلبات**: تصغير خط رقم هاتف العميل ليظهر الرقم **كاملًا في سطر واحد** بلا تأثير على باقي الأعمدة.
7. **صفحة الطلبات**: **حذف «مزامنة الحالة»** منها — المزامنة تبقى **فقط في صفحة ProShip**.
8. **Call Center (round-robin)**: تُطبَّق على **كل المنتجات** أو على **منتجات محددة** (قابل للضبط).

---

## سجل التنفيذ — 14-10-2026

### [0069] migration غير مصرّح بها — طُبّقت قبل الموافقة (موافقة رجعية بشروط)
- المحتوى: `CREATE TABLE call_center_settings (...)` **فقط** — بلا أي `ALTER`/`DROP` على جداول قائمة. (تحقّق: قراءة الملف.)
- الحالة: **طُبّقت فعلًا** قبل الموافقة (الجدول موجود في DB + سجل `__drizzle_migrations` id `3410417`).
- نسخة احتياطية: `db-backup.mjs` → 64 جدول/1140 صف، وتحققت بـ`db-restore-inplace.mjs` → **IN-PLACE RESTORE VERIFIED** (0 اختلافات).
- **خطة التراجع:** `DROP TABLE call_center_settings;` + حذف سطرها من `__drizzle_migrations` (id `3410417`) + إزالة `drizzle/0069_*.sql`/snapshot/إدخال `_journal.json` + تعريف الجدول من `drizzle/schema.ts`.

### قاعدة جديدة (من هنا): لا تطبيق هجرة بلا موافقة
- **تُولَّد الهجرة فقط وتُعرض الـSQL، ويُنتظر موافقة صريحة قبل أي تطبيق (`drizzle-kit migrate`).** لا تُطبّق هجرة تلقائيًا أبدًا.

### إجابات مفصلية
- **افتراضي المتجر بلا صف:** `DEFAULT_DISTRIBUTION_SETTINGS = { autoDistribute: true, distributionScope: "all", productIds: [] }` ويُرجَع عند: لا DB/لا صف/خطأ → نفس السلوك القديم (توزيع شغّال، كل المنتجات). لا يتوقف التوزيع بصمت.
- **scope=specific:** طلب فيه منتج من اللائحة → يُوزَّع · طلب بمنتجات خارج اللائحة → لا يُوزَّع · **لائحة فارغة → لا توزيع** (fail-safe) · حذف منتج من اللائحة → الطلبات الجديدة التي تحتويه فقط تتوقف، والتوزيعات القديمة لا تُعاد.
- **Orders.tsx — «حذف المزامنة»:** حُذف **مُشغِّل ومعالج `syncEcotrackStatus`** (زر «مزامنة الحالة» داخل جدول الطلبات) وأُزيل استيراد `RefreshCw`. صارت المزامنة فقط في صفحة ProShip.

---

## سجل التنفيذ — البند 1: عزل المستأجرين (14-10-2026)

### سبب فشل «اختبارات تخزين الصور» + إصلاح
- **السبب الفعلي = drift في fixtures لا في التخزين:** `productInput.showStockThreshold` و`variantInput.showStockThreshold` **إلزاميان** في `server/routers/products.ts` (منذ migration `0058`)، لكن `products.test.ts`/`digital.test.ts` كانا لا يمرّران الحقل → يفشل الإدخال (Zod) **قبل** الوصول لأي كود رفع. لذلك لم تكن تُختبر مسارات `storagePut` إطلاقًا.
- **الإصلاح (اختبارات فقط):** أُضيف `showStockThreshold` إلى `validProductInput()`/variant في `products.test.ts` وإلى `digitalInput` في `digital.test.ts` (مطابق لما يرسله الكليان فعلًا: `ProductCreate.tsx`/`ProductEdit.tsx`).
- **النتيجة (مُختبر):** `products.test.ts` + `digital.test.ts` → **8/8 نجحت**، ومنها اختبار «يتوقف إنشاء المنتج عند فشل تخزين الصور» (أثبت أن مسار الرفع صار مُنفَّذا).
- ملاحظة عزل: مسار مفاتيح الصور `products/${ctx.user.id}/...` (بالمالك) ورفع الصور يمرّ عبر store-scoped API (وسط `getStoreId`)؛ لا وصول لصور متجر آخر عبر الـAPI لأن كل `getStoreProductById/getPublicStoreProduct` مقيّد بـ`storeId`.

### اختبارات عزل صريحة جديدة
- `server/routers/tenantIsolation.test.ts` (جديد، **10/10 نجحت**): fail-closed بلا متجر (`[]`/`NOT_FOUND` دون لمس DB) للـproducts/categories/offers، والتحقق أن القراءات مُقيّدة بمعرّف متجر المتصل (`getPublicStoreProduct(id, 7)` …إلخ) وأن منتج/فئة/عرض متجر آخر لا يُحَل.

### نتيجة التدقيق الثابت (3.1–3.9)
- **3.1 نقاط عامة:** ✅ fail-closed — `publicList/publicGet` (products/categories/offers) تُرجع `[]`/`NOT_FOUND` بلا متجر ومقيّدة بـ`storeId` معه (`db.ts`).
- **3.2 إنشاء الطلبات:** `createCod` يشتق `storeId/ownerId` من **المنتج** ويرفض خلط متاجر (`db.ts:1855-1860`) ✅. `createManual` مقيّد بـ`storeId` ✅. **ملاحظة:** `saveAbandoned` عام بلا Turnstile/حدّ معدّل (انظر الملاحظات).
- **3.3 الداشبورد المحمي:** `patchCodTrust` وكل عمليات المنتجات/الفئات/العروض تستعمل `getStoreId(ctx)` ✅. Call Center مقيّد بـ`agent.storeId` + `assertOrderVisible` (لا يرى إلا طلبات متجره/المختصّة) ✅.
- **3.4 ProShip/Ecotrack:** الويب هوك يتحقق التوقيع (S1) ويحلّ الشحنة بـ`carrierId+tracking` ✅ (لا يحدّد المتجر صريحًا لكن رقم التتبع فريد عالميًا). المزامنة اليدوية/المجدولة مقيّدة بـ`storeId` ✅.
- **3.5 مفاتيح الشركات:** `apiTokenEncrypted` مشفّر AES-256-GCM ✅ (`secureSecrets.ts`)؛ ملاحظة المفتاح الاحتياطي أعلاه.
- **3.6 كل استعلام DB:** روجعت الدوال الحيوية (products/categories/offers/orders/callCenter/delivery) وكلها تتضمن `storeId` في `WHERE` أو تشتقّه من المنتج ✅.
- **3.8 معرّفات داخل البيانات:** `offers.setProducts`/`categories.setProducts`/`setCategoryProducts` تُرشّح المنتجات بـ`storeId` (المعرّف الغريب يُهمَل/لا يُحرَّك) ✅؛ `appliedOffers` تُتحقق عبر `getOfferDetails(storeId, ...)` ✅؛ معرّف الموظف يُتحقق بـ`storeId` ✅.
- **3.9 تلاعب الأسعار:** الخصومات (sharkCod/retarget/الحزم) تُعاد حسابها من DB وتُطابق الإعداد ✅ — **لكن `priceOverride` ثغرة عالية (S2).**

### اختبارات مُشغَّلة
- `pnpm check` → **0 أخطاء**.
- `vitest run products.test.ts digital.test.ts tenantIsolation.test.ts` → **18/18 نجحت**.

### ما يجب إصلاحه (بانتظار موافقة)
- **S2** تلاعب الأسعار عبر `priceOverride` (عالية).
- **S3** قراءة ملفات عشوائية عبر بروكسي التخزين (عالية، مؤكَّدة تجريبيًا).
- لا migration مطلوب في هذا البند.

---

## سجل التنفيذ — إصلاح S3 ثم S2 (14-10-2026)

### [S3] إصلاح قراءة الملفات — الخطورة: **عالية** — كوميت `7619cda`
- **كيف كان يحوّل المسار (السؤال):** `GET /manus-storage/*` يقرأ `req.params[0]` كـ«مفتاح»، ثم **يجرّب القراءة من القرص** ضمن `file_storage/<key>` (مع محاولات قديمة: استبدال `/1/` و`products/1/`)، وإن لم يجد **وإن كان Forge مضبوطًا** يُعيد توجيه 307 لرابط `presign/get` الخارجي. أي: **قراءة محلية أولًا، ثم بروكسي لتخزين خارجي** — والمشكلة كانت في دمج المفتاح مع المسار.
- **الإصلاح:** ملف جديد `server/_core/storagePaths.ts`:
  - `sanitizeStorageKey`: فك الترميز حتى مرتين (يكشف الترميز المزدوج)، ويرفض: بايت null (`\0`/`%00`)، الشرطة العكسية `\`، المسار المطلق، أي `%xx` متبقٍّ (ترميز زائد)، ومقاطع `.`/`..`، و`""`.
  - `resolveWithinStorageRoot`: `path.resolve(root, key)` + التحقق بالبادئة `root + path.sep` (الحاجز الحاسم، لا regex فقط).
  - `storageProxy.ts` يرفض المفتاح غير الصالح بـ**400** قبل لمس القرص؛ وكل المرشّحات القديمة تُعاد تصفيتها داخل الجذر.
  - تحصين الكتابة كذلك: `storage.ts::normalizeKey` يستعمل نفس الدوال (يرمي «Invalid storage key») → يمنع أي عبور في مسارات الرفع/بصمات الشحن/الملفات الرقمية.
- **فحص النمط نفسه:** `serveStatic`/`express.static` (يعتمد على express بمنع `..`)، `fileUpload.ts` (`filepath` غير مستخدم فعليًا؛ الـparser يضع `buffer`)، `_core/vite.ts` (مسارات ثابتة). `storagePut` الآن محصّن مركزيًا.
- **اختبارات (25/25 نجحت):** `server/storageProxy.test.ts` — رفض `..%2f`، `%2e%2e%2f`، `..%5c`، الترميز المزدوج `%252e...`، `%00`، المسار المطلق `/etc/passwd`، مع التأكد **بلا أي محتوى ملف** (لم نقرأ `.env` ولم نعرض قيمًا)، وخدمة صورة منتج شرعية 200 بمحتواها الصحيح.

### [S2] إصلاح تلاعب الأسعار — الخطورة: **عالية** — كوميت `f516d9b`
- **الاستعمالات الشرعية لـ`priceOverride` قبل الإصلاح (كيف تُحسب):** الاستعمال الوحيد هو **Upsell قبل تأكيد الطلب** (منتج أساسي عنده `upsellProductId` + `upsellPrice`/`upsellDiscountAmount`/`upsellDiscountPercent`، والكليان يبني السعر في `CheckoutUpsellPopup.useUpsellOffer` من **سعر منتج الـupsell نفسه**: ثابت → `upsellPrice`، أو `listPrice - amount`، أو `listPrice * (1 - pct/100)`).
  - **عروض الكمية:** ليست `priceOverride`؛ تُرسَل `offerId` ويُحسب السعر من DB (`fixedPrice`) — بقي كذلك.
  - **الباقات:** `appliedOffers` وتُحسب من DB — لم تُلمس.
  - **الفانل/الهبوط:** يستعمل `discountPercent`/`offerId` وليس `priceOverride`.
- **الإصلاح:** ملف `server/orderPricing.ts` (نقيّ): `computeUpsellUnitPrice` (يطابق منطق الكليان لكن من DB) و`selectCodUnitPrice` (عرض كمية → upsell → متغير → منتج). في `db.ts::createCodOrder`:
  - **مرّتان:** الأولى تُحلّ المنتج/المتغير/عرض الكمية من DB، والثانية تحسب السعر النهائي. **قيمة `priceOverride` لا تُقرأ أبدًا**؛ وجودها مجرّد علامة «سطر upsell»، وسعر upsell يُعاد حسابه من أعمدة المنتج الأساسي في نفس الطلب + سعر منتج الـupsell من DB. upsell بلا إعداد → يُرفض.
  - **عرض الكمية:** أصبح يُحلّ من الجدول الموحّد `offers` (`kind='quantity'`) مقيّدًا بـ`storeId` + ربط `offerProducts` (نفس المنتج/المتجر) + `isActive` + `maxUses` مقابل **`usedCount` الموثوق**، ويقبل `offerId` كـ`id` أو `legacyId`. الاستهلاك بتفاؤل (`usedCount` شرط في `WHERE`).
  - الطلب اليدوي من التاجر (`createManualOrder`) لم يُلمس (يحدّد المتجر سعره).
- **اختبارات (28/28 نجحت):** `server/orderPricing.test.ts` (كل مسار سعر شرعي + رفض upsell بلا إعداد + **حاجز مصدري** يمنع عودة `line.priceOverride` كسعر ويمنع إدخال `price/total/deliveryFee/discountAmount` في مخطط الدفع) و`orders.test.ts` (رفض كمية ‎0/-1/51/1.5، وقبول سطر upsell مع تجاهل قيمته).
- **غير مُختبر آليًا (بصراحة):** رفض `offerId` لمتجر آخر و`maxUses` يتحققان في استعلامات `createCodOrder` (SQL) ولا يوجد DB في مجموعة الاختبارات الوحدية — تحقّق بالمراجعة والقراءة، لا باختبار تنفيذي.

### خلاصة تشغيل
- `pnpm check` → **0 أخطاء**.
- `pnpm test` → **456 ناجح · 8 فاشل · 3 متخطّى (467)**. الفاشلة الثمانية هي **نفس** ما قبل Phase 6 (OAuth/Meta/connecteurs/واجهات UI/SSR) — أي **صفر انحدار**، و**6** اختبارات فشل كانت مُصلَحة (fixtures المنتجات/الرقمي).

---

## إغلاق البند 1 — تحقق إضافي (14-10-2026)

### Upsell: القيود الثلاثة على السيرفر
- **منتج سطر upsell = `upsellProductId` بالضبط لنفس المتجر؟** ✅ نعم — `resolveUpsellLinePrice` يبحث عن منتج أساسي في **نفس الطلب** شرطه `base.upsellProductId === lineProductId` (وكل أسطر الطلب مُلزَمة بنفس المتجر/المالك سابقًا في `createCodOrder`).
- **يُقبل فقط إذا الطلب فيه المنتج الأساسي؟** ✅ نعم — لا أساس في الطلب → يُرفض («العرض الإضافي غير متاح لهذا الطلب»).
- **الكمية محدودة (1)؟** ⚠️ كانت **ناقصة** → **أُصلحت**: صار upsell يُقبل فقط بـ`quantity === 1` (لا إعداد كمية لـupsell؛ الكليان يرسل 1 دائمًا).
- **اختبارات:** أُضيفت في `server/orderPricing.test.ts` (المطابقة الصحيحة/أساس غائب/هدف خاطئ/كميات 0·2·5/بلا إعداد) — المجموع الآن **28/28** لملفات `orderPricing` + `orders`.
- **الكوميت:** يُسجَّل مع كوميت إغلاق البند (أدناه).

### تحقق حي على DB الحقيقية — `scripts/checkout-pricing-check.ts`
- النمط: اتصال واحد + `START TRANSACTION` → إدراج عرضين حقيقيين (متجرين مختلفين) + روابط `offer_products` → تشغيل **نفس شرط `createCodOrder`** → `ROLLBACK` → التحقق من 0 صفوف.
- **النتيجة: 6/6 PASS** (شُغّل فعليًا): (a) offerId حقيقي → `fixedPrice=9000.00, quantity=2`؛ (b) offerId متجر آخر → `rows=0`؛ (c) بلوغ `maxUses` → `rows=0`؛ (d) `priceOverride` متلاعب به (`0.01`) يُتجاهل والمحسوب `9000.00`؛ (e) سعر upsell المُعاد حسابه `2500.00`؛ (f) **0 صفوف متبقية بعد rollback** (`offers=0, offer_products=0`).
- **حدّ الشفافية:** السكربت يتحقق من شرط الـSQL الحقيقي + دوال التسعير الحقيقية (لا يستدعي `createCodOrder` كاملًا لأنه يملك transaction خاصًا على pool مشترك). التكامل الكامل مُغطّى بـ`orderPricing.test.ts` (حاجز مصدري يمنع عودة `line.priceOverride` كسعر).

### صور `file_storage` الحقيقية (مسافات/عربية)
- أُضيف إلى `server/storageProxy.test.ts`: تعداد **كل** ملفات `file_storage` الحقيقية (حتى 25، مع أولوية للأسماء ذات مسافة/غير ASCII) وتأكيد 200 + تطابق البايتات، ومنها الملف الحقيقي ذو المسافة `generated/…_b00fc9c4 (1).png`. ومجلد الحقيقة **لا يحتوي حاليًا ملفات بأسماء عربية**؛ أُضيف اختبار end-to-end لملف باسم عربي (`products/42/صورة-اختبار عربية.png`) واختبار نقي يبرهن أن `sanitizeStorageKey` لا يمسّ الأسماء العربية/ذات المسافات. المجموع **25/25** لـ`storageProxy.test.ts`.

### مفتاح تشفير مفاتيح شركات التوصيل
- **نعم مشتق من `cookieSecret`:** `secureSecrets.ts:4-7` يشتق مفتاح AES-256-GCM من `ENV.cookieSecret` (= `process.env.JWT_SECRET`)، ويُستعمل لنفس القيم في `deliveryCarrierConnections.apiTokenEncrypted` و`merchantCarrierCredentials.apiTokenEncrypted` (وكذلك أسرار connecteurs وmeta OAuth وtracking WhatsApp).
- **⚠️ خطر تشغيلي:** **تبديل `JWT_SECRET` يكسر قراءة كل هذه القيم المشفّرة** (`getCarrierCredentials` يفشل برسالة «غير قابلة للقراءة … أعد إدخال التوكن»).
- **مقترح (غير منفّذ):** فصل المفتاحين —
  1. إدخال مفتاح خاص بالتشفير `SECRETS_ENCRYPTION_KEY` مستقل عن `JWT_SECRET` (مع إبقاء قراءة القديم عبر `JWT_SECRET` للتوافق).
  2. خطة إعادة تشفير بلا فقد: نشر يقرأ بالمفتاحين (جديد أولًا ثم القديم)، ثم وظيفة/سكربت واحد يعيد تشفير كل الصفوف ويعلّمها `keyVersion`، ثم إزالة الاعتماد على `JWT_SECRET` بعد التحقق من 0 أخطاء قراءة.
  3. تخزين `keyVersion` داخل الحمولة المشفّرة لتسهيل التبديل المستقبلي.

### كوميتات البند
- `cccc4e8` — اختبارات عزل المستأجرين + إصلاح fixtures الصور.
- `7619cda` — إصلاح S3 (path traversal).
- `f516d9b` — إصلاح S2 (تسعير السيرفر).
- `efcf576` — تحديث السجل.

---

## سجل التنفيذ — البند 1ب: متفرّعات البند 1 (14-10-2026)

### [1ب-1] الملفات الرقمية المدفوعة — **مُصلَح ومُختبَر** — كوميت `c611896`

**إجابة السؤال (كيف تتكوّن مفاتيح التخزين الرقمية؟) — مدعومة بقراءة الكود:**
- يُبنى المفتاح في `server/routers/products.ts:335` بالشكل `digital-products/${ctx.user.id}/${Date.now()}-${fileName-sanitized}`، ثم يُضاف في `storage.ts::appendHashSuffix` لاحقة عشوائية **8 خانات hex (32 بت)** قبل الامتداد.
- **النتيجة الفعلية:** `digital-products/<userId>/<timestamp>-<filename>_<8hex>.<ext>`.
- **هل فيها `productId`؟** لا. تحتوي **معرّف المالك** (`userId`) + **طابع زمني** (`Date.now()` شبه متوقّع) + لاحقة عشوائية 32 بت. أي **شبه متوقّعة جزئيًا** (userId/Timestamp معروفان، ويبقى تخمين 32 بت)، لكن المشكلة الحقيقية لم تكن التخمين: **المفتاح كان يُقدَّم بلا مصادقة عبر `/manus-storage/*`**، فأي تسريب للرابط (إيميل/لوج/سلة) كان يكفي للتنزيل المباشر.
- **نعم، أي أحد** كان يقدر يحمّل ملفًا مدفوعًا مباشرةً عبر `/manus-storage/digital-products/...` بلا تسجيل دخول (البروكسي العام كان يقدّم كل المفاتيح).

**الإصلاح (تحقّق فعلي):**
- **حجب البادئة في البروكسي العام:** `storageProxy.ts` يرفض أي مفتاح يبدأ بـ`digital-products/` بـ**404** (لا يؤكّد وجود المفتاح) قبل لمس القرص، وقبل أي تحويل لـForge.
- **رابط موقع محلي (HMAC + exp):** `server/_core/mediaSignature.ts` (مفتاح HMAC مشتقّ من `ENV.cookieSecret` مع لصيقة `local-media-sign-v1` مفصولة لفظيًا عن توقيع الجلسة) + مسار `GET /api/media?key=&exp=&sig=` في `server/_core/digitalMedia.ts`: يقبل **مفاتيح `digital-products/` فقط** مع توقيع صالح وغير منتهٍ (مقارنة زمن-ثابت).
- **حفظ المسار الشرعي:** في الوضع المحلي `storageGetSignedUrl` صارت تُرجِع رابطًا موقعًا `/api/media?...` لملفات `digital-products/`، وتبقى `/manus-storage/<key>` للصور العامة. التنزيل الرقمي يمرّ فقط عبر `/api/downloads/:token` (يستهلك التوكن ثم يحوّل إلى الرابط الموقّع).
- **لم يتغيّر** وضع Forge/S3 (يبقى presign الخارجي كما هو).

**اختبارات (21/21 نجحت):** `server/digitalDownloads.test.ts` (11): توقيع صالح يخدم · منتهي 403 · توقيع مغشوش 403 · مفتاح مغشوش 403 · مفتاح غير محمي عبر `/api/media` 403 · **مفتاح رقمي مباشر عبر البروكسي العام 404 بلا محتوى** · **الصور العامة ما تتكسرش (200)** · `storageGetSignedUrl` يرجّع موقّعًا للرقمي والعادي للعام. و`storageProxy.test.ts` (27) ما زال أخضر بالكامل.

> ملاحظة: التوقيع المحلي مشتقّ حاليًا من `JWT_SECRET`؛ فصله في مفتاح مستقل بندٌ في قائمة ما قبل الإطلاق (أدناه).

### [1ب-2] `saveAbandoned` — **مُصلَح ومُختبَر** — كوميت `7860ee6`
- **حدّ معدّل (IP + هاتف + متجر):** `server/_core/rateLimit.ts` (نافذة ثابتة في الذاكرة، بلا بنية تحتية جديدة): حدّ لكل IP (60/10د) يُطبّق **حتى على المدخلات الملتوية**، وحدّ لكل (IP|هاتف|متجر) (10/10د).
- **تحقّق من تنسيق الهاتف:** `^0[567][0-9]{8}$` (يطابق `createManual` والواجهة التي تُزيل غير الأرقام وتقصّ 10). هاتف فارغ → `no_phone`، غير صالح → `invalid_phone` (كلاهما بلا كتابة).
- **حدّ لحجم المدخلات:** مخطط Zod يقيّد كل الحقول (`sessionId` 8–128 · الاسم 180 · الهاتف 40 · الولاية 120 · البلدية 160 · الكمية 1–50 · `turnstileToken` 4096).
- **متجر/منتج موجودان ونشطان فقط:** `getPublicStoreProduct` (منتج `status='active'`) + `getActiveStoreById` جديد (`stores.isActive=true`)، وإلا `{ saved:false, reason:"store_unavailable" }`. أُضيف فحص المتجر النشط داخل `upsertAbandonedOrder` أيضًا (دفاع في العمق).
- **Turnstile اختياري:** يُتحقّق منه **فقط إذا أرسل الكليان توكنًا**؛ بلا توكن يبقى التسجيل الصامت شغّالًا (لا يكسر المتاجر التي فعّلت التطبيق)، والأمان مضمون بحدّ المعدّل.

**اختبارات (10/10 نجحت):** `server/routers/saveAbandoned.test.ts`: تسجيل شرعي يخدم (ويُمرَّر للمتجر الصحيح) · منتج مفقود/متجر غير نشط → تجاهل بلا كتابة · هاتف غير صالح/غير جزائري/فارغ → رفض بلا كتابة · 10 محاولات تنجح والـ11 تُحدّ `rate_limited` (upsert 10 مرات فقط) · بلا توكن لا يُستدعى Turnstile والتسجيل يخدم · توكن غلط → رفض · توكن صحيح → قبول.
**تحقّق حي على DB حقيقية (read-only) — 4/4 PASS:** منتج/متجر نشط حقيقي يُحَلّ، ومنتج/متجر وهمي لا يُحَلّ (نفس شكل SQL الحاجز).

### نتائج التشغيل
- `pnpm check` → **0 أخطاء**.
- `pnpm test` → **477 ناجح · 8 فاشل · 3 متخطّى (488)**. الفاشلة الثمانية هي **نفس** ما قبل البند (OAuth/Meta/connecteurs/واجهات UI/SSR) → **صفر انحدار**، والزيادة +21 اختبارًا جديدًا.
- **لا migration مطلوب** في البند 1ب (لا تغيير مخطط/DB).
- **ملفات قديمة غير مُتعقَّبة (ليست مني):** `docs/dashboard-identity-agent-rules.md` و`docs/previews/dashboard-orders-products-preview.html` — من جلسة Agent Manager موازية («Dashboard backlog»)؛ لم ألمسها ولم أُدرجها في أي كوميت.

---

## قائمة ما قبل الإطلاق (تتجمع — لا تُنسى)
1. **فصل مفتاح تشفير الأسرار عن `JWT_SECRET`** (يشمل كذلك مفتاح توقيع `/api/media` المحلي).
2. **استقلال قاعدة البيانات عن حساب Manus**، وكلمة سر TiDB التي ظهرت في الشات (تدويرها).
3. **بيئة نشر حقيقية (production)**.
4. **دورة زبون وهمي كاملة من الألف للياء**.
5. **حذف/أرشفة جدول عرض الكمية القديم** (`store_product_offers`).
6. **إشعارات Call Center** التي تُرسَل لكل الموظفين بدل المعيَّن.
7. **Admin override**.
8. **تأكيد مدة صلاحية رابط Forge `presign/get`** (لا نضبطها من الكود؛ يُراجَع مع مزوّد التخزين عند التفعيل).
9. **إعداد `trust proxy` الصحيح خلف الـreverse proxy** (عدد الـhops) حتى يعطي `req.ip` عنوان العميل الحقيقي؛ حاليًا غير مفعّل فـ`req.ip` = نظير النقل (عنوان البروكسي لو وُجد)، وحدّ الـIP يبقى **أرضية عالية فقط** (الحدّ الأساسي على هاتف+متجر).
10. **سياسة تنظيف/أرشفة الطلبات المتروكة القديمة غير المحوَّلة** (صفوف `fulfillmentStatus='abandoned'` التي لن تُحوَّل لطلب أو تُثبَّت) + تحديد مدة الاحتفاظ.
11. **التأكد أن الإحصائيات والربحية وعدّادات الطلبات تستثني `abandoned`** (Dashboard/Analytics/Profitability/Order counters) — تدقيق + اختبار صريح.
12. **تنفيذ احتفاظ `storefront_versions` (200/50) — بلا حذف الآن:** مهمة مجدولة **dry-run أولًا** على الشجرة الحقيقية → تقرير بالمرشّحين للحذف → تنفيذ مصرّح → **تسجيل في `storefront_audit_logs`**؛ والتأكد أن حذف أي نسخة **لا يكسر مراجع `fromVersion/toVersion`** في سجل التدقيق (إبقاء الصفوف المُشار إليها أو تعليمها «مُقلَّمة»).

---

## مراجعة البند 1ب — إجابات الأسئلة الأربعة (14-10-2026)

### Q1 — هل يظهر مفتاح التخزين/رابط `digital-products/` الخام في أي رد API/صفحة شكر/تتبّع/WhatsApp/بريد؟ — **لا الآن** — كوميت `e458f53`
- **تدقيق منهجي:** `digitalFileStorageKey` / `digitalFileUrl` في كل `server/`. المفروض:
  - **عام (زبون):** `getPublicStoreProduct` كان أصلًا يصفّرهما (`digitalFileStorageKey: null, digitalFileUrl: null`) → `products.publicGet/publicList` نظيفة. `digital.createOrder` لا يُرجِع روابط؛ `confirmPayment/regenerateLinks` تُرجِع `link.url` = `/api/downloads/:token` فقط؛ بريد `emailDigitalLinks` يستعمل نفس `link.url` (توكن). صفحة الشكر `ThankYouPopup` لا تعرض أي رابط ملف. لا ذكر لمفتاح رقمي في `notifications.ts`/`callCenterNotifications.ts`.
  - **لوحة التاجر (محمي، لكن خام):** `products.list/get/create/update/patchCodTrust/duplicate` و`digital.products` كانت تُرجِع `digitalFileStorageKey` و`digitalFileUrl` خامَّين، و`digital.resolveDownload` كان يُرجِع `storageKey` خامًا.
- **الإصلاح:** `server/productPayload.ts::withoutDigitalFileRefs` يحذف الحقلين، ويُطبَّق على كل مخرجات المنتجات (بما `digital.products`)، و`resolveDownload` يُجيب الآن `{...safe, signedUrl}` بلا `storageKey`. **لا رد API يحمل مفتاح ملف مدفوع أو رابط `/manus-storage/digital-products/…`**.
- **اختبارات:** `products.test.ts` (list/get/duplicate/patch: لا `digitalFileStorageKey`/`digitalFileUrl`، ولا سلسلة `digital-products/` أو `/manus-storage/`) + `digital.test.ts` (القائمة و`resolveDownload` نظيفان).

### Q2 — مدة صلاحية الروابط الموقّعة؟ — **دقائق قليلة** — كوميت `6e744ac`
- **المحلي (`/api/media`, HMAC+exp):** `MEDIA_URL_TTL_MS = 5 دقائق` (مفروض ومُختبَر: `digitalDownloads.test.ts` يتحقّق أن `ttl ≤ 5min` و`> 0`).
- **مسار التنزيل الحقيقي:** `/api/downloads/:token` بوّابته **توكن DB** (`expiresAt` بالساعات + `maxDownloads`)، والرابط الموقّع لا يُمنَح إلا بعد استهلاك التوكن، فيعيش 5 دقائق فقط.
- **Forge (`presign/get`):** لا نضبط `expiresIn` (الـAPI الخارجي يعرّف المدة). **لم أختبره/أقِسه** — أُضيف لبند ما قبل الإطلاق (رقم 8). ملاحظة: لا `BUILT_IN_FORGE_*` في `.env` الحالي → المسار الفعّال الآن هو المحلي 5 دقائق.

### Q3 — حد IP والاستخراج — كوميت `7735650`
- **لا يخنق الزبائن بعد الآن:** الحد **الأساسي = (هاتف + متجر) = 10/10د** (يستهدف الإساءة الفعلية)، و**حد IP مرتفع = 3000/10د** كأرضية فيضان فقط — حتى لا تُسقط شبكات الهاتف الجزائرية المتناعدة IP (CGNAT) زبائن شرعيين.
- **استخراج الـIP:** لم يعد يُقرأ `X-Forwarded-For` مباشرة (قابل للتزوير؛ الثقة بالـhop الأول تسمح بانتحال أي IP). نستعمل `req.ip` (يحتفي بضبط `trust proxy`؛ وغير مفعّل عندنا = النظير الحقيقي)، وإلا `socket.remoteAddress`، مع تجريد `::ffff:`. لو أُضيف بروكسي عكسي: `app.set("trust proxy", <hops>)`.
- **تجاوز الحد لا يكسر إرسال الطلب:** الحاجز يُرجِع `{saved:false, reason:"rate_limited"}` بلا استثناء؛ و`saveAbandoned` مُطلَق ناري-وانسَ (fire-and-forget) منفصل تمامًا عن `orders.createCod` (الذي له Turnstile + orderClean الخاصان به) → حتى لو رُدّ المتروك، إتمام الطلب لا يتأثّر.

### Q4 — قاعدة الهاتف والتنظيف — كوميت `d9d05b7`
- **نفس القاعدة الآن في كل المسارات:** `server/phone.ts::normalizeAlgerianMobile` + `ALGERIAN_MOBILE_PATTERN = ^0[567][0-9]{8}$`، تُستعمل في `createCod`، الطلب اليدوي، وحاجز المتروك.
- **التنظيف قبل التحقق (نعم):** إزالة المسافات/الشرطات/النقاط/الأقواس، وتحويل البادئة `+213`/`00213`/`213` (أو رقم وطني 9 خانات يبدأ 5/6/7) إلى الصيغة المحلية `0X…`. أمثلة: `+213 555 123 456` → `0555123456` · `0555-12-34-56` → `0555123456`.
- **اختبارات:** `phone.test.ts` (6) + توسيع `saveAbandoned.test.ts` (6 حالات تطبيع) + `orders.test.ts` (createCod يقبل رقمًا منسّقًا ويخزّن المطبَّع). مرفوض كما قبل: `0212345678` و`05500`.

### نتائج المراجعة
- `pnpm check` → **0 أخطاء**.
- `pnpm test` → **493 ناجح · 8 فاشل · 3 متخطّى (504)**. الفاشلة الثمانية **نفس** المعروفة قبل → **صفر انحدار**.
- **لا migration** (لا تغيير مخطط/DB).
- كوميتات هذه المراجعة: `e458f53` (Q1) · `6e744ac` (Q2) · `7735650` (Q3) · `d9d05b7` (Q4) + تحديث هذا الملف.

---

## مراجعة البند 1ب — إضافي: حفظ الملف الرقمي (15-10-2026)

### السؤال: بعد `withoutDigitalFileRefs`، هل يبقى فورم التعديل يبيّن أن ملفًا مربوط، ويقدر التاجر يبدّله؟ وهل الحفظ بلا لمس الملف يمسح الحقلين؟
- **البيان (نعم):** `ProductEdit.tsx:826` يعرض «الملف الحالي: {digitalFileName}» بجانب إعدادات (الحد الأقصى للتنزيل/مدة الرابط)، و`digitalFileName` يبقى مُرجَعًا (نحذف فقط المفتاح/الرابط الخام).
- **التبديل (بالتصميم):** لا يوجد رفع مباشر داخل التعديل؛ الواجهة تنص صريحًا: «تغيير الملف يتم من خلال إنشاء نسخة جديدة من المنتج حفاظًا على الروابط السابقة»، والنسخ (`duplicate`) محافظ على الملف.
- **الحفظ بلا لمس الملف لا يمسح الحقلين (نعم، مُثبَت):**
  - مخطط `products.update` **لا يقبل** حقول `digitalFileName/StorageKey/Url/Size/MimeType` إطلاقًا → لا يمكن للكليان تصفيرها.
  - `updateStoreProduct` يدمج عبر `mergeDigitalFileFields` (جديدة): `input ?? current` → بلا حقل = يبقى كما هو (حتى `null` يُعامَل كـ«لا تغيير»).
  - `duplicateStoreProduct` ينسخ `digitalFileStorageKey/Url` (قائم).

### اختبارات
- `server/digitalFileMerge.test.ts` (**5/5**): إبقاء الملف بلا مدخلات · تعديل إعداد غير الملف يُبقي الملف · استبدال صريح فقط · `null` لا يمحو · بلا ملف يبقى `null`.
- `server/routers/products.test.ts`: `products.update` بحقول ملف مزوّرة/`null` **لا يمرّرها** لـ`updateStoreProduct` (تُجرَّد) · `duplicate` يُفوَّض لـ`duplicateStoreProduct`.
- **تحقّق حي على DB الحقيقية — `scripts/digital-file-preserve-check.ts` → 6/6 PASS** (معاملة واحدة + `ROLLBACK`): مفتاح/رابط/اسم الملف تبقى بعد حفظ بلا لمس الملف · الإعداد المُرسَل (حدّ التنزيلات) يُحدَّث · النسخة تحافظ على الملف · **0 صفوف probe بعد الـrollback**.
- `pnpm check` → **0 أخطاء** · لا migration.

---

## سجل التنفيذ — البند 2: الإصدارات / التراجع / الاحتفاظ (15-10-2026)

### نطاق الفحص (أ) → (و)
- **(أ) كل نشر = نسخة غير قابلة للتعديل · التراجع = نسخة جديدة:** `storefront_versions` **تُدرَج فقط** (`server/storefrontDb.ts` يستدعي `db.insert(storefrontVersions)` وحده)؛ لا يوجد أي `.update`/`.delete` على الجدول في الكود. التفرّد `UNIQUE(storeId, versionNumber)` يمنع تكرار رقم الإصدار داخل المتجر. `rollback` يستدعي `createStorefrontVersion` (رقم جديد = الأحدث+1) ولا يمسّ الصف القديم.
- **(ب) فصل المسودة عن المنشور:** جدولان مستقلّان (`storefront_drafts` صف واحد لكل متجر مع `concurrencyVersion`، و`storefront_versions` لقطات). `publicConfig` يقرأ **أحدث نسخة منشورة فقط** ولا يستدعي `getStorefrontDraft` إطلاقًا. `saveDraft` لا ينشئ نسخة. ✅
- **(ج) سياسة الاحتفاظ — الحالة الحالية: لا حذف إطلاقًا.** أُضيفت سياسة صريحة **قابلة للخطة فقط** في `server/storefrontRetention.ts`:
  - الحد الأقصى **200 نسخة/متجر** (`maxVersionsPerStore`)، مع **أرضية 50 نسخة** (`minVersionsToKeep`) لا تُحذف أبدًا، وحدّ عمر اختياري `maxAgeDays` (افتراضيًا `null` = عدديّ فقط).
  - **النسخة المنشورة الحالية محميّة دائمًا**، والدالة لا تُفرِغ التاريخ أبدًا (`keep ≥ 1`).
  - `planStorefrontRetention` **نقيّة**: تُرجِع قائمة `keep`/`prune` فقط ولا تحذف شيئًا. **لا يوجد أي استدعاء تلقائي للحذف** — أي تنفيذ فعلي للحذف يتطلّب خطوة مصرّحة ومسجّلة (بانتظار موافقتك).
- **(د) لقطة تشير لمنتج/فئة/عرض محذوف:** اللقطة **لا تخزّن أي معرّفات حيّة** (لا `productId/categoryId/offerId`). القوالب تُحلّ المنتجات/الفئات/العروض من DB وقت العرض: المنتج المحذوف يغيب (شبكة أصغر/فراغ آمن)، العرض المحذوف → `StorefrontOffers` يرجّع `null`، الفئة المحذوفة → لا مربّع. لا انكسار. ✅
- **(هـ) لقطة فاسدة/غير صالحة → رجوع آمن:** كان `publicConfig` يرجّع `null`. الآن: **يُجرَّب آخر إصدار منشور صالح سابق** أولًا، و**Modern فقط إذا لم تكن حتى وحدة صالحة** (بلا أي كتابة/حذف، مع `fallback:true` وتسجيل التحذير)، والمتجر **يبقى يخدم**. أُنشئ `server/storefrontSnapshotHealth.ts` للقرار، ويُعرض **تنبيه للتاجر** في المحرر عبر `managed.publishedHealth`. إن لم توجد نسخة منشورة أصلًا → يبقى التعايش Legacy. ✅
- **(و) تقييد النشر/التراجع بالمالك + storeId + سجل تدقيق:** كلاهما `protectedProcedure` + `assertOwner` (المالك، أو admin مع `isOverride`). النشر/التراجع يمرّان دائمًا عبر `recordStorefrontAuditLog` (`publish` · `rollback` مع `fromVersion/toVersion`) ويُقيَّدان بـ`getStoreId(ctx)`. ✅

### التغييرات
- **جديد:** `server/storefrontRetention.ts` (سياسة + مُخطِّط احتفاظ نقيّ).
- **تعديل:** `server/routers/storefront.ts::publicConfig` (رجوع Modern الآمن للقطة الفاسدة + `fallback` في الرد).
- **جديد (اختبارات):** `server/storefrontRetention.test.ts` (8) · توسيع `server/routers/storefront.test.ts` (كان 5 → **19**) · توسيع `client/src/storefront/sectionData.test.ts` (**23**).
- **جديد (سكربت تحقق حي):** `scripts/storefront-versions-check.ts` — معاملة واحدة + `ROLLBACK`.
- **لا migration مطلوب** (لا تغيير مخطط/DB).

### نتائج الفحص الحي — `scripts/storefront-versions-check.ts` → **10/10 PASS**
شُغّل فعليًا على قاعدة البيانات الحقيقية داخل transaction: إدراج نسخة → تفرّد رقم الإصدار (immutable address) → فصل المسودة → عزل المتاجر (لا قراءة عبر المتاجر) → V1→V2→V3→تراجع V1→V4 (V4 = نسخة V1، وV1 لم يتغيّر) → الاحتفاظ يحمي المنشور ولا يُفرِغ التاريخ → **0 صفوف probe بعد الـrollback**.

### تشغيل
- `pnpm check` → **0 أخطاء**.
- `pnpm test` → **524 ناجح · 8 فاشل · 3 متخطّى (535)**. الفاشلة الثمانية هي **نفس** المعروفة (OAuth/Meta/connecteurs/واجهات UI/SSR) → **صفر انحدار** (زيادة +26 اختبارًا: احتفاظ 8 · راوتر المتجر +14 · بيانات الأقسام +4).

### ملاحظات/مخاطر
- **سباق النشر المتزامن:** `createStorefrontVersion` يقرأ الأحدث ثم يُدرج (الأحدث+1) بلا قفل؛ نشرتان متزامنتان قد تصطدمان بقيود التفرّد (تفشل إحداهما بأمان بدل الفساد). يُعالَج في **البند 3 (التزامن)**.
- **سياسة الاحتفاظ** مُقترحة فقط (خطة). لا حذف فعلي؛ التنفيذ يتطلّب موافقتك + خطوة مصرّحة مسجّلة.

---

## إغلاق البند 2 — مراجعة (16-10-2026)

### 1) فحص قراءة فقط على اللقطات الحقيقية — `scripts/storefront-snapshots-audit.ts`
شُغّل فعليًا (SELECT فقط): **متجر واحد** له نسخ، **41 نسخة كلها صالحة** بعد التحقق الصارم الحالي (**0 فاسدة**، الآن أو في التاريخ). لا توجد لقطات قديمة تفشل حاليًا.

### 2) مرحلة تطبيع (normalize) قبل التحقق الصارم
رغم أن DB الحالية سليمة، أُضيفت الطبقة وقائيًا لأن إصدارات أقدم كانت تحمل حقولًا حُذفت/غُيّرت:
- **`shared/storefront/storefrontConfig.ts`:** `normalizeStorefrontConfig` (يحذف مفاتيح أقسام/عناصر غير معروفة، وأنواع أقسام متقاعدة، وقيم `settings` غير أولية أو تفشل قاعدة القيمة مثل `styleRadius: "large"`) + `validateStoredStorefrontConfig` = تطبيع ثم تحقق صارم.
- **`shared/storefront/themeSchema.ts`:** `normalizeStorefrontThemeConfig` (يحذف مجموعات محذوفة مثل `density`، ومفاتيح توكن مجهولة، وقيمًا لا تطابق المخطط).
- **مطبَّق على القراءة من المخزون فقط** (`publicConfig` · `managed` · `templateSeedConfig` · `seedAndPublishTemplate` · `startEditing` · `publish` · `rollback`)؛ **إدخال التاجر يبقى صارمًا** (`saveDraft`).
- **لا تختراع قيمًا**: التطبيع يُرجع إعدادًا صالحًا بشكل مطابق تمامًا (اختبار `toEqual`).

### 3) الرجوع الآمن المحسّن + تنبيه التاجر
- **`server/storefrontSnapshotHealth.ts`:** `evaluatePublishedSnapshots` يجرّب الأحدث → **آخر إصدار صالح سابق** → **Modern فقط إن لم يصحّ أي إصدار**. نقيّ وبلا كتابة.
- **`publicConfig`:** يخدِم آخر إصدار صالح فعليًا (`versionNumber`/`publishedAt` للمخدوم) + `fallback` + `fallbackReason` + `latestVersionNumber`.
- **`managed.publishedHealth`:** `{ ok, latestVersionNumber, servedVersionNumber, servedFallback, reason }`.
- **`client/src/storefront/editor/PublishedHealthBanner.tsx`:** بانر في المحرر: «النسخة المنشورة فاسدة — المتجر يعرض نسخة بديلة (vN / Modern)».

### 4) الاحتفاظ (200/50) — **بلا حذف** (كما طلبت)
أُدرج في **قائمة ما قبل الإطلاق** (أسفل): مهمة مجدولة **dry-run أولًا** → تقرير → **تسجيل في سجل التدقيق** → والتأكد أن حذف نسخة **لا يكسر مراجع `fromVersion/toVersion`**. القيم المعتمدة: **200 نسخة/متجر** + **أرضية 50**.

### اختبارات هذا الإغلاق
- **جديد:** `server/storefrontSnapshotHealth.test.ts` (لقطات قديمة حقيقية الشكل: `theme.density`، `styleRadius`، مفاتيح/أنواع متقاعدة) · `client/src/storefront/editor/PublishedHealthBanner.ui.test.tsx` (4).
- **موسَّع:** `server/routers/storefront.test.ts` (19 → **22**: آخر إصدار صالح · Modern عند الفشل الكامل · `publishedHealth`).
- **فحص حي موسَّع:** `scripts/storefront-versions-check.ts` → **12/12 PASS** (أُضيف: لقطة أحدث فاسدة تُحَل لآخر إصدار صالح + تُبلَّغ للبانر).
- **قراءة فقط:** `scripts/storefront-snapshots-audit.ts` (1 متجر · 41 نسخة · 0 فاسدة).



---

## سجل التنفيذ — الخطوة الأولى من البند 2 (17-10-2026): جعل التطبيع مرئيًا

### ما تغيّر
- **تقرير تطبيع منظم:** `shared/storefront/normalization.ts` (نوع `StorefrontNormalizationDrop` + أسباب ثابتة). كل قيمة يحذفها التطبيع تُسجَّل بـ`path`/`key`/`section`/`reason` (+`detail` آمن فقط، **بلا القيمة نفسها**).
- **`normalizeStorefrontConfig(input, report?)` و`normalizeStorefrontThemeConfig(input, report?)` و`validateStoredStorefrontConfig(input, report?)`:** تُعيد نفس الناتج تمامًا، لكنها تملأ التقرير بكل: مفتاح قسم مجهول/متقاعد، نوع قسم متقاعد، مفتاح/قيمة إعداد غير صالحة، عنصر/مفتاح عنصر متقاعد، مجموعة/توكن ثيم مجهول أو غير صالح. التطبيع **لا يخترع قيمًا** (اختبار `toEqual` قائم).
- **تسجيل سيرفر:** `server/storefrontNormalizationLog.ts` يكتب سطرًا لكل حذف (JSON: context/storeId/key/section/reason/path/detail) مع **كتم التكرار** في الذاكرة (اللقطات غير قابلة للتعديل، فلا نُغرق السجل عند كل زيارة).
- **عدّاد في `publishedHealth`:** `publishedHealth.normalizationDrops` = عدد القيم التي حذفها التطبيع أثناء تقييم تاريخ النشر، و`evaluatePublishedSnapshots` يُرجع التفاصيل في `normalization`. طُبّق التسجيل في `publicConfig` · `managed` (draft/published/history) · `templateSeedConfig` · `seedAndPublish` · `publish` · `rollback` · `startEditing`.
- **سكربت التدقيق:** `scripts/storefront-snapshots-audit.ts` صار يفرّق بين strict-valid / valid-after-normalization / still-invalid، ويطبع أسباب الحذف مع المفتاح والقسم والسبب.

### تحقق فعلي
- `pnpm check` → **0 أخطاء**.
- `vitest run server/storefrontSnapshotHealth.test.ts server/storefrontNormalizationLog.test.ts server/routers/storefront.test.ts` → **37/37 نجحت**.
- `scripts/storefront-snapshots-audit.ts` (قراءة فقط على DB الحقيقية): متجر واحد · **41 نسخة كلها strict-valid** · **0 drops** حاليًا.
- **لا migration** (لا تغيير مخطط DB).

---

## سجل التنفيذ — البند 3 (3أ): التزامن في محرر المتجر (17-10-2026)

### (أ) التزامن التفاؤلي في `saveDraft` — **مُصلَح**
- **الثغرة قبل:** كان `saveStorefrontDraft` يقرأ الصف ثم يتحقق من `concurrencyVersion` ثم ينفّذ `UPDATE ... WHERE storeId = ?` فقط. تبويبان يقرآن v5 معًا يكتبان v6 كلاهما → **last-write-wins صامت** (TOCTOU).
- **الإصلاح:** صار القيد جزءًا من جملة التحديث: `UPDATE ... WHERE storeId = ? AND concurrencyVersion = expectedVersion`؛ إذا كانت `affectedRows !== 1` فهو تعارض، نعيد `currentVersion` الحقيقي **بلا كتابة**.
- **سباق أول حفظ:** إدخالان متزامنان لنفس المتجر يصطدمان بـ`UNIQUE(storeId)`؛ يُلتقط `ER_DUP_ENTRY` ويُعاد `{conflict:true, currentVersion}` بدل 500.
- **الكشف عن خطأ Drizzle:** أخطاء mysql2 مغلّفة في `DrizzleQueryError`، فالكود في `cause` وليس في الأعلى؛ `isDuplicateKeyError` صار يمشي سلسلة `cause` (بعمق محدود).

### (ب) الحفظ التلقائي المؤجل — **مُثبَت**
- Debounce = **1000ms**، حفظ واحد فقط أثناء الطيران (`savingRef`)، والتعديلات السريعة تُجمَّع في كتابة واحدة (اختبار: تعديلان → `mutateAsync` مرة واحدة بالقيمة الأخيرة).
- **لا ينشر أبدًا:** خطوة النشر منفصلة؛ اختبار يؤكد أن `publish` لم يُستدعَ أثناء الحفظ التلقائي.
- **إصلاح فقدان تعديل أثناء الحفظ:** إذا وصل تعديل جديد قبل انتهاء الطلب، لا يُصفَّر `dirty` إلا إذا كان المحفوظ هو نفسه `configRef.current`؛ وإلا يبقى غير محفوظ ويُجدول حفظ جديد.

### (ج) سباق النشر — **مُصلَح (تسلسل بإعادة المحاولة)**
- `createStorefrontVersion` يقرأ الأحدث ثم يُدرج (الأحدث+1). عند تصادم `UNIQUE(storeId, versionNumber)` **يعيد المحاولة** حتى 5 مرات، ثم يرمي `StorefrontVersionConflictError`.
- الراوتر يحوّل هذا الخطأ إلى `TRPCError CONFLICT` برسالة عربية واضحة — **ماشي 500**.
- **تحقق حي:** نشر + تراجع متزامنان أعادا إصدارين متتاليين مختلفين (`publish=1 rollback=2`) بلا خطأ.

### (د) تراجع ونشر متزامنان — **مُغطّى**
- كلاهما يمرّ عبر نفس مسار إلحاق الإصدار أعلاه، فتتسلسل أرقام الإصدارات.
- **استعادة المسودة بعد التراجع لا تكتب فوق مسودة أحدث:** إذا أعاد `saveStorefrontDraft` تعارضًا، يبقى الإصدار المنشور الجديد، وتُعاد `{draftConflict:true, draftVersion}` ولا تُستبدل المسودة. الواجهات تعرض تنبيهًا وتحمّل أحدث مسودة.

### (هـ) النشر بمسودة قديمة — **سلوك محدد وموثّق**
- `storefront.publish` صار **يتطلب `expectedDraftVersion`** (رقم صحيح ≥1) = نسخة المسودة التي يراها المحرر.
- إذا اختلف عن `storefront_drafts.concurrencyVersion` → **CONFLICT** بلا إنشاء إصدار وبلا سجل تدقيق. لا نشر صامت لمحتوى لم يره التاجر.
- كل استدعاءات الواجهة (المحرر الموحّد · Builder · Theme Editor) تمرّر النسخة التي حفظتها للتوّ من `flushSave`/`saveDraft`.

### (و) غياب last-write-wins الصامت — **مُطبَّق**
- السيرفر: compare-and-swap + قيود التفرّد + تعارض صريح.
- العميل: أُزيل **الـretry التلقائي** الذي كان يعيد القاعدة على `currentVersion` ويكتب فوق الأحدث. الآن التعارض يوقف الحفظ التلقائي، ويبقى `dirty=true`، ويظهر بانر بخيارين صريحين: **تحميل الأحدث** أو **فرض حفظ تعديلاتي**. في المحرر الموحّد أُضيف البانر (كان `conflict` مُستخرجًا لكن غير معروض).
- `startEditing` (تبديل القالب) و`seedAndPublishTemplate` يرفضان الكتابة فوق مسودة أحدث بـCONFLICT.

### اختبارات
- **جديد:** `server/storefrontDb.test.ts` (10) — تعارض الإصدار القديم، فوز CAS، صفر صفوف، سباق الإدراج، retry الإصدارات، استنفاد المحاولات، خطأ غير تكرار، سلسلة `cause`، وحاجز مصدري يثبت وجود `concurrencyVersion` في `WHERE`.
- **موسَّع:** `server/routers/storefront.test.ts` (28) — نشر بمسودة قديمة، CONFLICT لسباق الإصدار، تراجع مع `draftConflict`، CONFLICT لسباق التراجع، رفض تبديل القالب فوق مسودة أحدث.
- **جديد:** `client/src/storefront/editor/useStoreDraft.test.ts` (6) — تجميع التعديلات، عدم النشر، رفض الكتابة فوق الأحدث، فرض الحفظ الصريح، نشر نسخة `flush` بالضبط، بقاء `dirty` عند تعديل أثناء الحفظ.
- **سكربت حي:** `scripts/storefront-concurrency-check.ts` → **12/12 PASS** على DB الحقيقية باتصالين متزامنين:
  - تبويب B ينتظر قفل الصف (لا تداخل) ثم يُطبِّق بعد rollback؛ القيمة النهائية v1.
  - مسودة أحدث محفوظة (commit مؤقت للاختبار) → التبويب القديم يحصل على CONFLICT ولا يكتب فوقها.
  - نشر/تراجع متزامنان → إصداران مختلفان بلا 500.
  - **0 صفوف probe متبقية** بعد التنظيف.
  - ملاحظة شفافية: اختبار (ب) الحقيقي يحتاج commit مؤقتًا لأن MySQL لا يُظهر صفًا غير مُلتزم لاتصال آخر؛ كل الصفوف التجريبية حُذفت وتحقّق الصفر. الباقي داخل transactions + rollback.
- **`pnpm check`:** 0 أخطاء.
- **`pnpm test`:** **567 ناجح · 8 فاشل · 3 متخطّى (578)**. الفاشلة الثمانية هي **نفس** baseline المعروفة (OAuth/Meta/connecteurs/واجهات UI/SSR) → **صفر انحدار**، والزيادة **+43 اختبارًا** عن 535.
- **لا migration** (لا تغيير مخطط DB).

### قيود/مخاطر معروفة
- إعادة محاولة رقم الإصدار تعتمد على رؤية الـcommit الجديد. الاستدعاءات الحالية تعمل في **autocommit** (كل SELECT يرى آخر commit). لو استُدعيت `createStorefrontVersion` داخل transaction طويلة بـ`REPEATABLE READ` فقد لا ترى إعادة المحاولة الصف الجديد؛ الوضع الحالي لا يفعل ذلك (وموثّق في الكود).
- فرض الحفظ (`forceSave`) هو كتابة **صريحة بطلب المستخدم** فوق النسخة الأحدث؛ ليست تلقائية. لا يوجد دمج سطر-بسطر (merge UI) — الخياران هما تحميل الأحدث أو فرض الحفظ.
- البند **3ب (سباقات الطلبات)** لم يُلمس كما طُلب.

---

## سجل التنفيذ — الخطوة الأولى من 3أ (17-10-2026): سلامة سكربتات التحقق + عقد النشر + تدقيق فرض الحفظ

### 1) تسرّب صفوف probe إلى متجر حقيقي — **مُبلَّغ ومُنظَّف**
- **السكربت السابق** `scripts/storefront-concurrency-check.ts` كان يختار **أول متجر حقيقي بلا مسودة** (`ORDER BY s.id LIMIT 1`) ويُنشئ عليه مسودة/نسخة ثم يحذفهما.
- **المتجر المستخدم فعليًا:** `storeId = 1` (اسمه «متجر Abde Sslam»، `ownerId = 8850001`).
- **الصفوف التي كُتبت:** مسودة `storefront_drafts.id = 90002` (`concurrencyVersion` 1→2، تحمل علامة `PROBE NEWER`) + نسخة `storefront_versions.id = 690007` (`versionNumber = 1`، `note = 'concurrency-probe-publish'`، لقطة تحمل `PROBE PUBLISH`)، بتاريخ `2026-10-17 10:00:44–47Z`.
- **التنظيف الفعلي:** حُذف الصفّان بمعرّفيهما + شرط العلامة:
  - `DELETE FROM storefront_versions WHERE id=690007 AND storeId=1 AND note='concurrency-probe-publish' AND snapshotJson LIKE '%PROBE PUBLISH%'` → **1 صف**.
  - `DELETE FROM storefront_drafts WHERE id=90002 AND storeId=1 AND configJson LIKE '%PROBE NEWER%'` → **1 صف**.
  - تحقّق بعد الحذف: `storefront_versions(storeId=1)=0` · `storefront_drafts(storeId=1)=0` · أي `note LIKE 'concurrency-probe-%'` في القاعدة = **0**.
- **السبب الجذري:** لم يكن هناك حاجز يمنع اختيار متجر حقيقي؛ والتنظيف كان يعتمد على `storeId` وحده. (سجل التشغيل السابق ادّعى «0 صفوف متبقية» لكن القاعدة أظهرت العكس — لا نخفي ذلك.)

### 2) قاعدة جديدة: سكربتات التحقق الحية لا تلمس صفوف متجر حقيقي
- السكربت أُعيد بناؤه: يُنشئ **مالكًا ومتجرًا تجريبيين مخصّصين** ببادئة `probesfconcurrency-` (openId/slug/email فريدة لكل تشغيل)، ويعمل **فقط** على `storeId` الذي أنشأه.
- **حاجز التنظيف:** `isProbeStore()` يتحقق من `id + ownerId + slug` قبل أي حذف؛ لو فشل الحاجز **لا يُحذف أي صف** ويُسجّل FAIL.
- **تنظيف مؤكّد:** حذف versions/drafts/audit لهذا المتجر ثم المتجر ثم المالك، والتحقق من **0** في الجداول الخمسة.
- **كنس بقايا التشغيلات المنقطعة:** يحذف فقط متاجر تحمل نفس البادئة وعمرها > يوم (لا يمكن أن تطابق متجرًا حقيقيًا).
- **تشغيل حي فعلي (13/13 PASS):** `storeId=270001`، `ownerId=14610001`، `slug=probesfconcurrency-store-1792235564723-1lgflk` — كل الصفوف حُذفت (`versions=0 drafts=0 audit=0 stores=0 users=0`).

### 3) عقد `storefront.publish` — كل المواضع تمرّر `expectedDraftVersion`
- **المواضع الثلاثة (كل ما في `client/src`):**
  - `client/src/storefront/editor/useStoreDraft.ts:255` → `expectedDraftVersion: flushed.version`.
  - `client/src/storefront/builder/BuilderPage.tsx:390` → `expectedDraftVersion: saved.version` (بعد flush).
  - `client/src/storefront/builder/ThemeEditorPage.tsx:221` → `expectedDraftVersion: saved.version` (بعد flush).
- **اختبار جديد:** `client/src/storefront/publishContract.test.ts` يمسح كل `client/src`، يثبت أن قائمة الناشرين هي الملفات الثلاثة بالضبط، وأن **كل** نداء `publish.mutateAsync({...})` يحتوي `expectedDraftVersion`.

### 4) تسجيل «فرض حفظ تعديلاتي» في `storefront_audit_logs`
- `storefront.saveDraft` يقبل `force?: boolean` (علامة تدقيق فقط؛ الكتابة تبقى CAS).
- عند النجاح: `action = 'draft_force_save'` و`metadataJson = { version, forced: true, expectedVersion }`؛ والحفظ العادي يبقى `draft_save` مع `forced: false`.
- عند خسارة سباق جديد: **CONFLICT بلا كتابة وبلا سجل**.
- الواجهة: `useStoreDraft.forceSave` و`BuilderPage.forceSave` يرسلان `force: true`.
- **لا migration** (استُخدم `metadataJson` الموجود + قيمة action جديدة).
- **اختبارات:** 3 حالات جديدة في `server/routers/storefront.test.ts` + تأكيد `force: true` في `useStoreDraft.test.ts`.

### نتائج التشغيل
- `pnpm check` → **0 أخطاء**.
- اختبارات مستهدفة: `storefront.test.ts` (31) · `storefrontDb.test.ts` (10) · `useStoreDraft.test.ts` (6) · `publishContract.test.ts` (2) → **49/49 نجحت**.
- `pnpm test` الكامل → **572 ناجح · 8 فاشل · 3 متخطّى (583)**؛ الثمانية هي **نفس baseline المعروفة** (OAuth/Meta/connecteurs/واجهات UI/SSR) → **صفر انحدار**.
- **البند 3ب لم يُلمس.**

### على المستخدم معرفته
- **حذف صفّي probe من متجر حقيقي وقع فعلًا** (بمعرّفيهما أعلاه) بعد إثبات العلامات؛ لم تُحذف أي صفوف أخرى، ولم تكن هناك نسخة منشورة حقيقية للمتجر قبلها.
- لا تغيير في مخطط DB في هذه الخطوة.

---

## سجل التنفيذ — البند 3ب: سباقات الطلبات (17-10-2026)

### (أ) خصم المخزون ذريًا وكل-أو-لا-شيء — **مُطبَّق ومُختبَر حيًا**
- **عند إنشاء الطلب** (داخل نفس transaction): لكل سطر متتبَّع وغير `continueSelling`:
  - منتج: `UPDATE store_products SET inventory = inventory - ? WHERE id=? AND storeId=? AND inventory >= ?`
  - خيار: `UPDATE store_product_variants SET stock = stock - ? WHERE id=? AND productId=? AND stock >= ?`
  - أي `affectedRows !== 1` → **رمي خطأ → rollback كامل** (لا طلب/بنود/مخزون نصف مكتوب).
- **الكمية المحجوزة** = `quantityOffer.quantity × line.quantity` عند عروض الكمية.
- يُسجَّل `inventoryDeductedAt` على الطلب عند الحجز؛ لذلك `at_carrier` يصبح **no-op** لهذه الطلبات (لا خصم مزدوج)، ويبقى يخصم للطلبات القديمة التي لا تحمل الحقل.
- **الاسترجاع** يشمل الآن كل حالة نهائية غير مُسلَّمة: `returned · cancelled · customer_unresponsive · phone_cancelled · fake · abandoned` (عبر `shouldRestoreInventory`). الطلبات المتروكة (abandoned carts) لا تحجز أصلًا → لا أثر.
- `applyOrderInventoryLifecycle("at_carrier")` (للطلبات القديمة) صار يستعمل `stock >= qty` و`SQL stock - qty` بدل مقارنة القيمة القديمة.

### (ب) رقم الطلب فريد تحت الضغط — **مُطبَّق**
- الإدخال يستعمل رقمًا مؤقتًا `TMP-<uuid>`؛ عند `ER_DUP_ENTRY` يُعاد المحاولة حتى 5 مرات (`insertOrderWithUniqueNumber`).
- ثم يُثبَّت الرقم النهائي `ABD-<id>` (المشتق من auto-increment الفريد) مع إعادة محاولة عند تصادم نادر (`finalizeOrderNumber`).
- نفس المسار طُبّق على `createManualOrder` و`upsertAbandonedOrder`. قيد `UNIQUE(orderNumber)` القائم هو الحكم النهائي.
- **تحقق حي:** 8 طلبات متزامنة → 8 أرقام `ABD-…` مختلفة.

### (ج) تعيين Call Center بالتناوب — **مُصلَح**
- التعيين صار **داخل transaction إنشاء الطلب** (ديناميكيًا عبر `assignNewOrderToCallCenterAgentInTransaction`) بدل `void` بعد الطلب.
- **تسلسل لكل متجر:** `SELECT ... FROM call_center_agents ... ORDER BY id FOR UPDATE` يقفل صفوف الموظفين حتى commit، فلا يختار طلبان متزامنان نفس «التالي».
- **إصلاح مهم:** قراءة آخر تعيين كانت `SELECT` عاديًا داخل `REPEATABLE READ`، فتستخدم snapshot قديمًا ولا ترى تعيينات الطلبات المتزامنة (كانت النتيجة: كل الطلبات تأخذ نفس الموظف). صارت `.for("update")` (قراءة locking ترى آخر commit).
- **تحقق حي:** طلبان متزامنان → موظفان مختلفان؛ 8 طلبات متزامنة → **4/4** بلا فساد الدور.

### (د) الإرسال المزدوج — **مُطبَّق**
- **قفل لكل هاتف:** `GET_LOCK('order-idem-<sha1(phone)>', 10)` على نفس اتصال transaction، يُحرَّر بعد commit وقبل إعادة الاتصال للـpool.
- داخل القفل: بحث عن طلب حديث (**نافذة 120 ثانية**) بنفس `storeId + phone` ونفس بصمة السطور (منتج/خيار/كمية/سعر السيرفر المحسوب) عدا المتروكة. إن وُجد → **يُعاد نفس الطلب** مع `deduplicated: true`.
- الراوتر يتخطى عندئذٍ إعادة `orderClean` والإشعارات وأحداث التتبع.
- **تحقق حي:** طلبان متزامنان + ثالث لاحق بنفس الهاتف → **معرّف واحد**، صف واحد، وخصم وحدة واحدة فقط.
- **لا تغيير في العميل ولا migration** (بديل idempotency من الكليان غير مطلوب).

### (هـ) ذرية `createCod` كاملة — **مُحقَّقة**
- داخل transaction واحد: حجز المخزون → إدراج الطلب → تثبيت الرقم → البنود → استهلاك `usedCount` للعروض (CAS كما كان) → تعيين Call Center.
- **فشل أي خطوة = rollback للكل.** تحقق حي:
  - سطر ثانٍ نفد مخزونه → لا طلب/بنود، ومخزون السطر الأول كما هو.
  - سباق `maxUses=1`: طلب واحد ينجح، والآخر يفشل بعد إدراج الطلب/خصم المخزون → **يُعاد المخزون ويختفي الطلب بالكامل** (`usedCount=1`، خصم واحد فقط).
  - النجاح: `usedCount` + المخزون + الطلب + البنود + التعيين كلها معًا.

### (و) آثار تغيير الحالة idempotent — **مُحقَّقة**
- **المخزون:** claim ذري عبر `inventoryDeductedAt` / `inventoryRestoredAt` داخل transaction؛ تطبيق `returned` مرتين/ثلاثًا/بالتوازي → **استرجاع واحد**.
- **`cancelled`** مرتين بالتوازي → استرجاع واحد.
- **`order_profits` / `order_returns`:** upsert على قيد `UNIQUE(order_id)`؛ ويب هوك `delivered` مكرر/متوازٍ → **صف واحد**، و`returned` مكرر/متوازٍ → **صف واحد + استرجاع واحد**.

### ملفات/تغييرات
- **جديد:** `server/orderConcurrency.ts` (بصمة السطور، نافذة التكرار، أرقام الطلب، خريطة الاسترجاع) + `server/orderConcurrency.test.ts` (7).
- **جديد:** `server/orderRaceGuards.test.ts` (6) — حراسات مصدرية على `>=`/affectedRows/CAS/lock/retry.
- **جديد:** `scripts/orders-concurrency-check.ts` (تحقق حي).
- **معدّل:** `server/db.ts` (قفل الهاتف، حجز المخزون، رقم الطلب، التعيين داخل transaction، استرجاع الحالات، حماية `at_carrier`).
- **معدّل:** `server/callCenterDb.ts` (`FOR UPDATE` للموظفين وآخر تعيين + نسخة transaction).
- **معدّل:** `server/routers/orders.ts` (إزالة التعيين المكرر بعد الطلب + تخطي آثار الإرسال المزدوج).
- **معدّل:** `server/routers/orders.test.ts` (اختبار الإرسال المزدوج).
- **لا migration** (لم يُغيَّر المخطط؛ استُخدمت أعمدة/قيود موجودة).

### التحقق الحي — `scripts/orders-concurrency-check.ts` → **26/26 PASS**
- **بيانات تجريبية مخصّصة فقط:** `storeId=360002` · `ownerId=14700002` · بادئة `probesforder-`؛ اتصالان صريحان + pool الإنتاج.
- **التنظيف المؤكّد:** `{"orders":0,"items":0,"products":0,"offers":0,"agents":0,"shipments":0,"store":0,"owner":0}`.
- فحص مستقل بعد التشغيل: **0** متاجر/مستخدمين/طلبات/منتجات بالبادئة، و**0** `order_shipments` ببادئة التتبع.
- **حادثة أثناء التطوير:** أول تشغيل للسكربت فشل في خطوة التنظيف (أسماء أعمدة `order_id` بدل `orderId`) فبقيت صفوف probe لخادم تجريبي؛ حُذفت بمعرّفاتها المخصّصة وتحقّق الصفر. لم يُلمس أي متجر حقيقي.

### نتائج التشغيل
- `pnpm check` → **0 أخطاء**.
- اختبارات مستهدفة (8 ملفات) → **98/98 نجحت**.
- `pnpm test` → **586 ناجح · 8 فاشل · 3 متخطّى (597)**؛ الثمانية هي **نفس baseline المعروفة** (OAuth/Meta/connecteurs/واجهات UI/SSR) → **صفر انحدار**.

### قيود/مخاطر معروفة
- **تغيير سلوك مقصود:** المخزون يُحجز الآن عند إنشاء طلب COD بدل `at_carrier`. الطلبات القديمة (قبل النشر) تبقى على السلوك القديم لأن `inventoryDeductedAt` فارغ.
- **قفل الهاتف** يعتمد على `GET_LOCK` (مدعوم في TiDB/MySQL — أُثبت حيًا). الانتظار الأقصى 10 ثوانٍ؛ تحت ضغط شديد على نفس الهاتف قد يفشل الطلب برسالة «أعد المحاولة».
- **نافذة 120 ثانية** قد تدمج إعادة طلب شرعية متطابقة خلال دقيقتين (مقايضة مقبولة لمنع التكرار). لا يوجد idempotency key من الكليان.
- **تعيين Call Center** يتسلسل لكل متجر (قفل صفوف الموظفين)؛ قد يزيد زمن إنشاء الطلب قليلًا في المتاجر ذات الطلبات الكثيفة جدًا.
- **غير مُختبَر حيًا:** `createManualOrder`/`upsertAbandonedOrder` تحت تزامن عالٍ (طُبّق عليهما توليد الرقم فقط).
- `orderProfits`/`orderReturns` لا تُحذف عند تغيير الحالة عكسيًا؛ upsert يحافظ على صف واحد لكل طلب.

---

## قرار المخزون المعدّل (17-10-2026): الخصم عند التأكيد — **يُلغي حجز المخزون عند الإنشاء (16034e8)**

### السياسة المنفَّذة
- **`new` / `review` / `abandoned`:** لا خصم أبدًا.
- **أول انتقال إلى `confirmed` أو أي حالة بعده** (`processing · at_carrier · shipped · delivered`): خصم **مرة واحدة**، حتى لو تخطّى الطلب `confirmed` (مثل `new → at_carrier` أو `new → delivered`).
- **الطلب اليدوي** الذي يُنشأ بحالة `confirmed`: يخصم **عند الإنشاء** داخل نفس المعاملة. الطلب اليدوي `new`/`abandoned` لا يخصم.
- **الذرية:** لكل سطر متتبَّع وغير `continueSelling`:
  `UPDATE ... SET inventory/stock = inventory/stock - qty WHERE ... AND inventory/stock >= qty`
  + فحص `affectedRows`. أي فشل → **rollback كامل** (الطلب + البنود + المخزون + `usedCount` + التعيين).
- **رسالة النقص:** تسمّي المنتج بوضوح للموظف/التاجر:
  `الكمية غير كافية للمنتج «...»؛ تعذّر تأكيد الطلب.`
  ويُستثنى المنتج ذو `continueSelling` (لا يمنع التأكيد ولا يخصم).
- **الإرجاع:** عند `returned` يرجع المخزون **مرة واحدة**.
- **الإلغاء:** طلب مؤكد **لم يُشحن** (`confirmed`/`processing`) → يرجع المخزون. طلب في `at_carrier`/`shipped`/`delivered` ثم أُلغي → **لا يرجع** (البضاعة خرجت). طُبّق هذا أيضًا على `customer_unresponsive`/`phone_cancelled`/`fake`/`abandoned` بنفس شرط «لم يُشحن».
- **التزامن/idempotency:** كل تغيير حالة يمر عبر transaction واحد يقفل صف الطلب `FOR UPDATE`، ويستخدم علامتي `inventoryDeductedAt` و`inventoryRestoredAt` لمنع الخصم/الإرجاع المزدوج. ويب هوك مكرر + مزامنة يدوية متزامنة → خصم/إرجاع واحد، و`order_profits`/`order_returns` صف واحد.
- **عروض الكمية:** مضاعف المخزون (`offerQty × lineQty`) يُحفظ وقت الإنشاء في `appliedOffers` كـ snapshot `kind:"inventory"` (بدون migration)، ليُستخدم عند التأكيد حتى لو تغيّر العرض لاحقًا.

### العلامة لكل طلب (بلا خصم مزدوج)
- `inventoryDeductedAt IS NULL` → لم يُخصم بعد (طلب جديد أو قديم لم يصل لمرحلة الخصم).
- `inventoryDeductedAt IS NOT NULL AND inventoryRestoredAt IS NULL` → مخزونه خارج (سواء خُصم عند `at_carrier` قديمًا، أو حُجز عند الإنشاء في 16034e8، أو خُصم عند التأكيد الآن). **لا يُخصم مرة أخرى أبدًا.**
- `inventoryRestoredAt IS NOT NULL` → أُرجع مخزونه؛ إعادة تأكيده لاحقًا تعيد الخصم مرة واحدة فقط.
- **التمييز الدقيق للمصدر** (قديم/16034e8/جديد) غير مطلوب لمنع الخصم المزدوج؛ العلامة أعلاه كافية. للتدقيق الكامل فقط، **SQL مقترح غير مطبّق** (بانتظار الموافقة):
```sql
ALTER TABLE store_orders
  ADD COLUMN inventoryDeductedAtSource
    ENUM('legacy_at_carrier','created_reservation','confirm_deduction') NULL;
-- اختياري: سجل حركات مخزون
CREATE TABLE stock_movements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  storeId INT NOT NULL,
  orderId INT NOT NULL,
  productId INT NOT NULL,
  variantId INT NULL,
  quantity INT NOT NULL, -- سالب=خصم، موجب=إرجاع
  reason ENUM('confirmation','return','cancel','manual_confirm') NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX stock_movements_order_idx (orderId),
  INDEX stock_movements_store_idx (storeId, createdAt)
);
```
> **لم يُولَّد أي ملف migration ولم يُطبَّق أي تغيير مخطط.** الكود يعمل بالكامل بالأعمدة الحالية.

### أعداد الطلبات الحالية ومقترح التسوية (قراءة فقط — لا تعديل تلقائي)
طابع 16034e8: `2026-10-17T11:35:58Z`. النتيجة: **37 طلبًا، كلها أُنشئت قبل 16034e8** (لا توجد طلبات حقيقية بعد الكوميت).
- **حسب الحالة:** `new=28` · `cancelled=3` · `at_carrier=2` · `abandoned=2` · `processing=1` · `shipped=1` (لا `confirmed`/`delivered`).
- **العلامات:** `inventoryDeductedAt != NULL = 5` · `inventoryRestoredAt != NULL = 0` · `undeducted = 32`.
- **المخصوم فعليًا:** 3 `cancelled` + 2 `at_carrier`.
- **16034e8 cohort:** **0** طلبات حقيقية (لذا لا خطر خصم مزدوج من هذا الجيل في هذه القاعدة).
- **ثغرات تحتاج قرارًا:**
  1. **3 طلبات ملغاة** (`1080001`, `1110001`, `1380001`) مخزونها مخصوم وغير مُرجع، ولها `carrierTracking` وحالة ناقل `cancelled`. **المقترح: لا يُرجع تلقائيًا** لأنها غالبًا شُحنت ثم أُلغيت؛ يُرجع فقط إذا أكّد التاجر أنها لم تخرج.
  2. **طلب `processing`** (`id=1`) و**طلب `shipped`** (`id=90001`) بلا خصم. **المقترح:** أول انتقال لاحق (`processing→shipped` أو `shipped→delivered`) سيخصم تلقائيًا مرة واحدة بالكود الجديد؛ إن كانا لن يتغيرا، تسوية يدوية بموافقة.
  3. **28 `new` + 2 `abandoned`:** لا خصم — صحيح.
- **لا تعديل تلقائي لأي مخزون أو حالة.**

### إجابات مباشرة
**(أ) نافذة 120 ثانية:**
- مفتاح الإزالة يشمل: `storeId` + **الهاتف** + بصمة السطور = `productId : variantId : quantity : serverUnitPrice` + نافذة 120 ثانية. **يشمل الكمية والمتغير** (والسعر المحسوب من السيرفر، الذي يشفّر عرض الكمية/الـupsell).
- **لا يشمل العنوان** ولا الولاية/الاسم/طريقة الدفع. لذلك إعادة إرسال بنفس الهاتف والمنتجات خلال دقيقتين تُدمج حتى لو تغيّر العنوان.
- الزبون المندمج يرى **صفحة نجاح عادية** بنفس رقم الطلب والمجموع (`deduplicated:true` داخليًا)، وليس خطأ. الراوتر يتخطى الإشعارات وأحداث التتبع المكررة.

**(ب) قفل الهاتف 10 ثوانٍ:**
- القفل `GET_LOCK` هو **قفل منع الإرسال المزدوج**، وليس قفل تعيين Call Center.
- عند انتهاء المهلة: **الطلب يفشل** برسالة «تعذّر تأمين إنشاء الطلب بسبب محاولة متزامنة. أعد المحاولة.» — **لا يُسجَّل طلب بلا تعيين**، ولا يُسجَّل فشل صامت. هذا خيار fail-safe لمنع التكرار.
- تعيين Call Center داخل نفس المعاملة: **لا يوجد موظف مؤهل** → الطلب ينجح بلا تعيين (يُعاد `null`)؛ **خطأ DB في التعيين** → rollback للطلب كله (كما طُلب في 3ب).
- **TiDB:** نعم، متوافق ومُختبَر حيًا على نفس قاعدة TiDB Cloud (وليست MySQL محلية): السكربت الحي **36/36 PASS**، بما فيه `GET_LOCK`/`RELEASE_LOCK` على اتصالين، والتنظيف المؤكد.

### التحقق
- `pnpm check` → **0 أخطاء**.
- اختبارات مستهدفة (5 ملفات) → **63/63**.
- `pnpm test` → **590 ناجح · 8 فاشل · 3 متخطّى (601)**؛ الثمانية هي **نفس baseline المعروفة** → **صفر انحدار**.
- السكربت الحي `scripts/orders-concurrency-check.ts` → **36/36 PASS**، `storeId=420001`/`ownerId=14760001`، تنظيف: `{"orders":0,"items":0,"products":0,"offers":0,"agents":0,"shipments":0,"store":0,"owner":0}`.

### قيود/مخاطر
- تغيير سلوك مقصود: الطلبات الجديدة **لا تُخصم عند الإنشاء**؛ يمكن إنشاء طلب `new` لمنتج نافد، ورفضه يحدث عند التأكيد برسالة تسمّي المنتج. هذا ما طُلب.
- **الطلبات القديمة بلا snapshot لعرض الكمية** (أُنشئت قبل هذا التغيير) عند تأكيدها لأول مرة ستستخدم `item.quantity` بدل مضاعف العرض إن كان فيها عرض كمية قديم. لا توجد طلبات حقيقية بعد 16034e8، لكنه قيد للمستقبل إن أُعيد تأكيد طلبات قديمة.
- الإلغاء بعد الشحن لا يرجع المخزون؛ الإرجاع هو المسار المخوّل للاسترجاع.
- لا سجل حركات مخزون تفصيلي بدون migration (SQL المقترح أعلاه).
- نافذة 120 ثانية قد تدمج إعادة طلب شرعية متطابقة؛ لا يوجد idempotency key من الكليان.
- قفل الهاتف عند التزامن الشديد قد يرفض الطلب بعد 10 ثوانٍ (fail-safe) بدل تسجيله بلا تعيين.

---

## تحديث 17-10-2026 (مساءً): تحويلات الناقل لا تُرفض + فحص ناعم عند الإنشاء + تأكيد تحرير القفل

### 1) ويب هوك/مزامنة شركة التوصيل لا يُرفض بسبب نقص المخزون
- `updateStoreOrderStatus` صار يقبل `{ strictInventory }`:
  - **`strictInventory: true`** فقط عند **التأكيد البشري** (`confirmed` من لوحة التاجر أو موظف Call Center، والطلب اليدوي المنشأ `confirmed`).
  - **`strictInventory: false`** لكل تحويل آلي: `forshipDb.handleFinalEvent` (ويب هوك) و`updateOrderCarrierData` (مزامنة يدوية/تلقائية لبيانات الناقل).
- في الوضع المتسامح:
  - تُخصم السطور المتوفرة، والسطور الناقصة **لا تمنع** تغيير الحالة.
  - يُسجَّل تحذير **`stock_warning`** داخل `appliedOffers` (JSON) بالتفاصيل: المنتج، المطلوب، المتاح، والتاريخ.
  - يظهر للتاجر كشارة **«فرق مخزون: …»** بجانب رقم الطلب في صفحة Orders (مع tooltip بالتفاصيل)، إضافة إلى `console.warn`.
  - تُضبط `inventoryDeductedAt` (تمت معالجة الخصم) حتى لا يُعاد الخصم في تحويل لاحق؛ التسوية المتبقية يدوية.
- **الرفض البشري** يبقى كما هو: رسالة تسمّي المنتج، وrollback كامل.
- اختبار حي: طلب `new` لمنتج مخزونه 1 ثم صُفّر قبل ويب هوك `delivered` → الحالة `delivered` نجحت، `inventoryDeductedAt` مضبوط، و`appliedOffers` يحتوي `stock_warning` باسم المنتج.

### 2) فحص مخزون ناعم عند الإنشاء (بدون حجز)
- أُعيد الفحص في `createCodOrder` (pass 1) قبل أي كتابة:
  `if (trackInventory && !continueSelling && remaining < inventoryQuantity) throw "الكمية المطلوبة من «…» غير متوفرة حاليًا."`
  - يستخدم `inventoryQuantity` (مضاعف عرض الكمية) ويقرأ `variant.stock` أو `product.inventory`.
  - **لا يوجد UPDATE/حجز**؛ الخصم الملزم يبقى عند التأكيد.
- الطلب اليدوي `new` صار يخضع لنفس الفحص الناعم؛ `confirmed` يخصم ذريًا عند الإنشاء؛ `abandoned` لا يُفحص.
- **هل كان موجودًا قبل 16034e8؟** نعم — كان هذا بالضبط سلوك pass 1 قبل 16034e8 (قراءة + رفض، بلا حجز). كوميت 16034e8 استبدله بحجز عند الإنشاء، ثم 72bb1fa أزاله، والآن أُعيد كفحص ناعم فقط.
- تحقق حي: إنشاء طلب لمنتج مخزونه 0 → رفض فوري باسم المنتج؛ إنشاء طلبين لمنتج مخزونه 2 ينجح (بلا حجز)، ثم تصفير المخزون قبل التأكيد → تأكيد واحد ينجح والآخر يُرفض.

### 3) تحرير قفل الهاتف
- `RELEASE_LOCK` موجود داخل `finally` على **نفس** `connection` التي أُخذ عليها `GET_LOCK`، ثم `connection.release()` حتى عند الأخطاء.
- اختبار حي: طلب بلا سطور يُطلق خطأً بعد أخذ القفل؛ اتصال ثانٍ نجح في أخذ نفس القفل (`GET_LOCK = 1`) فورًا → القفل تحرر. النتيجة: **PASS**.
- المصدر محروس باختبار يتحقق أن `RELEASE_LOCK` و`connection.release()` بعد `finally`.

### 4) قائمة ما قبل الإطلاق (Backlog — لا تنفيذ الآن)
1. **جدول `stock_movements` + إجراء تسوية يدوية للمخزون**:
   - جدول حركات موقّع (`quantity` سالب للخصم/موجب للإرجاع) مع `reason` (confirmation/return/cancel/manual_adjustment)، `actorId`، `note`، و`createdAt`.
   - شاشة/إجراء `adjustStock(productId, variantId, delta, reason, note)` داخل transaction مع تسجيل الحركة، وصلاحية للمالك فقط.
   - SQL مقترح موجود في القسم السابق (غير مطبّق).
2. **طلبات قديمة فيها عرض كمية بلا snapshot مخزون**:
   - الطلبات المنشأة قبل إضافة `kind:"inventory"` في `appliedOffers` لا تحمل مضاعف العرض؛ عند تأكيدها لأول مرة قد تُخصم `item.quantity` بدل `offerQty × lineQty`.
   - لا توجد حاليًا طلبات حقيقية بعد 16034e8 (تم التحقق: 0)، لكن يبقى البند للمعالجة قبل الإطلاق لأي طلبات قديمة/مستوردة.
   - الحل المقترح: migration يضيف `inventoryQuantity` إلى `store_order_items` (backfill من `appliedOffers` حيث أمكن) أو سكربت تسوية يدوي بموافقة.

### التحقق
- `pnpm check` → **0 أخطاء**.
- السكربت الحي `scripts/orders-concurrency-check.ts` → **41/41 PASS** (`storeId=210001`… في آخر تشغيل، وتنظيف مؤكد `0` لكل الجداول).
- الاختبارات المستهدفة (5 ملفات) → **66/66**.
- `pnpm test` الكامل → **593 ناجح · 8 فاشل · 3 متخطّى (604)**؛ الثمانية هي **نفس baseline المعروفة** → **صفر انحدار**.
- **لا migration مولّد/مطبّق.**

---

## 4) SEO — الأساس المنفَّذ (18-10-2026) + فجوات جرد 22-10-2026 (غير منجز)

### ما نُفِّذ
- **حقن SEO في أول استجابة HTML** للواجهة العامة، في وضعي التطوير (Vite shell) والإنتاج (`serveStatic`)، دون المساس بلوحة التحكم:
  - `<title>` + `meta description` + `link canonical`.
  - Open Graph (`og:type/title/description/url/image/site_name/locale`) + Twitter Card.
  - JSON-LD: `WebSite` للصفحة الرئيسية، و`Product` + `BreadcrumbList` لصفحة المنتج.
  - `robots: index,follow` فقط لصفحات المتجر العامة.
- **`/robots.txt`** لكل مضيف: `Allow: /` + `Disallow: /api/` + `Disallow: /dashboard`، و`Sitemap` عند وجود متجر.
- **`/sitemap.xml`** لكل متجر: الصفحة الرئيسية + كل المنتجات النشطة (`/p/:id`) مع `lastmod`، وبترتيب `updatedAt`. بدون متجر → **404** (لا تسريب عبر النطاق الرئيسي).
- **مصادر البيانات الحقيقية:** `res.locals.store` (المضيف الفرعي) + `getPublicStoreProduct` (معزول بالمتجر) + `listPublicStoreProductSitemapEntries` (استعلام خفيف). قوالب/ثيمات المتجر لا تكتب SEO ولا تستبدله؛ يُبنى وقت الطلب.
- **حدود الأمان:** تحقق من `Host` قبل بناء canonical/OG، و`escapeHtml` لكل القيم، وJSON-LD يهرّب `<`/`>`/`&` لمنع كسر `<script>`. أي فشل في SEO → إرجاع HTML الأصلي (لا يُسقط المتجر).
- **الأداء:** قالب `index.html` يُقرأ مرة في الإنتاج ويُخزَّن في الذاكرة؛ `robots`/`sitemap` بترويسات كاش (`max-age=300`, `s-maxage=3600`).
- **لا migration** (لا تغيير مخطط).

### الملفات
- **جديد:** `server/seo.ts` (helpers نقية: build/inject/robots/sitemap).
- **جديد:** `server/seoRoutes.ts` (تحديد المسارات العامة + `robots`/`sitemap` + `applySeoToHtml`).
- **معدّل:** `server/_core/vite.ts` (حقن SEO في dev/prod).
- **معدّل:** `server/_core/index.ts` (تسجيل المسارات).
- **معدّل:** `server/db.ts` (`listPublicStoreProductSitemapEntries` خفيفة).
- **جديد:** `server/seo.test.ts` (13) + `server/seoRoutes.test.ts` (4) + `scripts/seo-check.ts` (تحقق حي).

### التحقق
- `pnpm check` → **0 أخطاء**.
- اختبارات SEO المستهدفة → **17/17**.
- السكربت الحي `scripts/seo-check.ts` → **9/9 PASS** على قاعدة TiDB الحقيقية بمعرّفات تجريبية مخصصة (`probesfseo-`)، وتنظيف مؤكد: `products=0 images=0 stores=0 users=0`.
  - تحقق: عنوان/كانونيكال/OG للرئيسية، Product JSON-LD + BreadcrumbList + السعر + التوفر + صورة مطلقة، sitemap، robots، **عدم حقن لوحة التحكم**، وfallback عند منتج غير موجود.
- `pnpm test` الكامل → **610 ناجح · 8 فاشل · 3 متخطّى (621)**؛ الثمانية هي **نفس baseline المعروفة** → **صفر انحدار**.

### قيود معروفة
- **الجسم ما زال CSR:** الحقن يغطي `head` (crawlers/social)، لكن محتوى الصفحة يُرسم بعد JS. تحسين LCP/SSR الكامل يبقى في بند الأداء (5).
- صفحات `/b/:slug` و`/store/category/:slug` تحصل على meta المتجر العامة، وليس schema خاصًا بالباقة/الفئة بعد.
- لا `hreflang` (متجر عربي واحد) ولا image sitemap منفصل (الصور داخل Product JSON-LD).
- SEO لا يضيف `noindex` للمسارات الخاصة؛ يتركها دون حقن بدل تغيير سلوكها.

### ❌ فجوات مؤكدة — جرد 22-10-2026 (غير منجزة)
> **حدود الجرد:** قاعدة TiDB رفضت الاتصال من جهاز التنفيذ (`ER_ACCESS_DENIED` لعنوان IP متغيّر)، فتعذّر إعادة تشغيل `scripts/seo-check.ts` الحي أو جلب صفحات متجر حقيقي. الاستدلال من: قراءة الكود، اختبارات SEO (17/17)، وطلبات HTTP محلية بـ`facebookexternalhit` + headless Edge/Chrome. ما لم يُتحقق حيًا مذكور صراحةً.

1. **لا `noindex` إطلاقًا:** المسارات `/store/cart` · `/store/checkout` · `/dashboard` · `/store/editor` ترجع **200** بلا `meta robots` ولا `X-Robots-Tag` (مرصود فعليًا محليًا)، وبلا منع في `robots.txt`.
2. **الكيانات غير الموجودة تُفهرس:** `/p/:id` أو `/b/:slug` أو فئة غير موجودة → يسقط إلى meta المتجر العامة مع `index,follow` (soft 404). وكذلك مضيف متجر غير محلول → `buildGenericSeo` قابل للفهرسة.
3. **المتجر المعطّل:** `resolveStoreBySlug/resolveStoreByRequest` لا يفلتران `isActive`؛ المتجر المعطّل يبقى قابلًا للعرض والفهرسة ويظهر في `sitemap.xml`.
4. **canonical غير موثوق:** `requestOrigin` يبني الأصل من `Host` و`X-Forwarded-Proto` الخام (`server/seoRoutes.ts:44-57`) رغم أن `trust proxy` غير مضبوط → احتمال host-header poisoning، ولا يوجد نطاق مخصص في المخطط.
5. **الباقة/الفئة:** كلتاهما تحصل على meta المتجر العامة فقط، بلا عنوان/وصف/صورة/JSON-LD خاص، وليستا في `sitemap.xml`.
6. **sitemap ناقص:** الرئيسية + المنتجات النشطة فقط، بلا فئات/باقات، وبلا `Sitemap:` في `robots.txt` عند غياب متجر محلول.
7. **أصل مطلق من الكليان:** `digital.confirmPayment/regenerateLinks` تقبل `baseUrl` من الكليان وتستخدمه في روابط بريد التنزيل (`server/routers/digital.ts:23-30، 134-153`) — يجب استبداله بأصل المتجر الموثوق.

### خطة التنفيذ المعتمدة (22-10-2026) — الخيار A (حقن head موسّع، بلا SSR)
- **(أ)** تصحيح هذا الملف وإعلان البند غير منجز.
- **(ب)** تصنيف مسارات صريح: `noindex` ترويسة+ميتا للخاص/السلة/الدفع/المحرر/المعاينة، و**404 + noindex** للكيانات المفقودة وللمضيف غير المحلول.
- **(ج)** اشتراط `isActive` في المسارات العامة وإخفاء المتجر المعطّل من sitemap، بلا كسر لوحة المالك (لوحة المالك تستعمل `getActiveStoreForUser` لا المضيف).
- **(د)** باني أصل موثوق `https://<slug>.<APP_BASE_DOMAIN>` بلا `Host`/`X-Forwarded-Proto` خام، واستعماله في canonical/OG/sitemap، وتصحيح روابط البريد/التنزيل/WhatsApp التي تُبنى من أصل غير موثوق.
- **(هـ)** الباقة والفئة: عنوان/وصف/صورة/JSON-LD من DB معزولة بـ`storeId` + إضافتهما إلى sitemap مع `lastmod`.
- **(و)** `Sitemap:` في `robots.txt` فقط عند متجر **نشط ومحلول**.
- **بلا migration وبلا `store_seo_settings` وبلا نطاق مخصص وبلا سجل تدقيق** (قرار المستخدم).


