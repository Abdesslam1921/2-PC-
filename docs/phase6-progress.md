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
1. عزل المستأجرين ← **تنفّذ الآن (البند 1 فقط)**
2. الإصدارات / التراجع / الاحتفاظ
3. التزامن
4. SEO
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
