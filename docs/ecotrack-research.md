# تحقق Ecotrack

## ما أكدته صورة المستخدم والمنصة

الرابط الذي أدخله المستخدم هو `https://hhdexpress.ecotrack.dz`. الصفحة العامة تعرض مسارين: Expéditeur (مرسِل) وLivreur (سائق). الصورة تعرض داخل الحساب قسم `API et Synchronisation`، وبطاقة `API STANDARD` بحالة `Déjà activé`، ورابط منصة الشركة، وزري `Documentation` و`Voir Token`. هذا يؤكد أن المتجر يحتاج حفظ رابط المنصة الخاص بالحساب وتوكن API Standard، وليس Client ID/Client Secret في هذه الحالة.

## ما وجدته في التوثيق العام

التوثيق العام المتاح على `https://api-docs.ecotrak.com/` هو مجموعة Postman بعنوان `Ecotrak External API`، منشورة في 2025-07-08. المجموعة العامة تستخدم OAuth 2.0 Client Credentials عبر `https://auth.ecotrak.com/oauth2/token` ومساراتًا على `https://api.ecotrak.com/v1/`. هذا يختلف عن API Standard الظاهر في حساب المستخدم ذي النطاق الخاص `*.ecotrack.dz`؛ لذلك لا يجوز استخدام مسارات api.ecotrak.com أو افتراض أنها صالحة لحساب المستخدم.

## قرار التنفيذ

تمت إضافة `apiBaseUrl` إلى جدول اتصالات شركات الشحن، مع إبقاء التوكن مشفرًا، وتحديث واجهة Ecotrack لقبول رابط المنصة والتوكن. لن تُنفذ عمليات إنشاء الطرود أو التسعير أو التتبع حتى يتم الوصول إلى رابط Documentation داخل حساب المستخدم أو الحصول على مسارات API المطلوبة؛ لأن استخدام endpoint مُخمن قد ينشئ شحنات خاطئة أو يفشل بسبب اختلاف المنتج والمصادقة.

## المصادر

- منصة الحساب الظاهرة: https://hhdexpress.ecotrack.dz/
- التوثيق العام: https://api-docs.ecotrak.com/
- بيانات مجموعة Postman العامة: https://api-docs.ecotrak.com/view/metadata/2sAYk8u3FF
- مجموعة API العامة: https://api-docs.ecotrak.com/api/collections/19394488/2sAYk8u3FF?environment=19394488-045c2693-443d-4761-9650-b75bede88a75&segregateAuth=true&versionTag=latest

## توثيق الرابط الذي أرسله المستخدم

الرابط `https://documenter.getpostman.com/view/14517169/Tz5je15g` يعرض توثيقًا بعنوان `ECOTRACK API`. يؤكد أن التوكن يرسل كـ Bearer في Authorization، كما يظهر endpoint للتحقق من التوكن: `GET {{url}}/api/v1/validate/token?api_token={{api_token}}`. قسم Commandes يحتوي على:

| العملية         | الطريقة والمسار                            |
| --------------- | ------------------------------------------ |
| إضافة طلب       | `POST {{url}}/api/v1/create/order`         |
| إضافة عدة طلبات | موثقة في قسم `Ajouter plusieurs commandes` |
| تعديل طلب       | موثق في `Modifier une commande`            |
| حذف طلب         | موثق في `Supprimer une commande`           |
| شحن طلب         | موثق في `Expedier une commande`            |
| تنزيل البوليصة  | موثق في `Télécharger l'étiquette`          |

حقول إنشاء الطلب التي ظهرت في التوثيق تشمل `reference`, `nom_client`, `telephone`, `telephone_2`, `adresse`, `code_postal`, `commune`, `code_wilaya`, `montant`, `remarque`, `produit`, `stock`, `quantite`, `produit_a_recuperer`, `boutique`, `type`, `stop_desk`, `weight`, `fragile`, و`gps_link`. التوثيق يذكر أن `nom_client`, `telephone`, `adresse`, `commune`, `code_wilaya`, و`montant` مطلوبة. الحد المعلن للطلب هو 50 طلبًا في الدقيقة، مع 1,500 في الساعة و15,000 في اليوم.

هذا يكفي لبناء مهايئ Ecotrack API Standard، لكن يجب قراءة body الكامل لمساري الطلبات المتعددة والتنزيل والتعديل قبل إرسال طلب إنتاجي؛ لن يتم إرسال طلب حقيقي تلقائيًا أثناء التطوير.

## فحص Webhook المباشر

في 2026-08-26 أُعيد فتح الرابط الذي أرسله المستخدم، وانتظرنا تحميل المجموعة، ثم فُحص نص الصفحة آليًا للكلمات `webhook`, `callback`, `notification`, `URL de retour`, `IPN`, `push`, و`event`. النتيجة كانت فارغة. قائمة المجموعة الظاهرة اقتصرت على Introduction، Authorisation، Taux limite، Commandes، Suivi des commandes، Configuration، وProduits. قسم Suivi يوثق الاستعلام `GET /api/v1/get/tracking/info?tracking=...` لتاريخ العمليات، ولا يذكر عنوان استقبال أو آلية دفع إشعارات إلى المتجر.

النتيجة: هذا الرابط لا يثبت دعم Webhook؛ المتاح الموثق هو polling عبر endpoint تاريخ التتبع. يلزم تأكيد منفصل من Ecotrack إذا كانت هناك ميزة Webhook داخل حساب خاص أو توثيق غير منشور.

## فحص اختيار المكتب

فحصت توثيق API Standard المرسل من المستخدم. نقطة إنشاء الطلب تستخدم `commune` و`code_wilaya` و`stop_desk` فقط؛ قيمة `stop_desk=1` تعني STOP DESK، لكن التوثيق لا يعرّف حقلًا مثل `bureau_id` أو `point_relais` ولا endpoint لجلب مكاتب الولاية. لذلك لا يمكن حذف البلدية أو بناء قائمة مكاتب صحيحة اعتمادًا على هذا التوثيق وحده. رسالة `Aucun bureau n'est disponible pour la commune` تؤكد أن Ecotrack يشتق توفر المكتب من البلدية المرسلة. يلزم endpoint إضافي من Ecotrack أو قائمة/معرّفات المكاتب من حساب المستخدم قبل تنفيذ اختيار مكتب حقيقي.
