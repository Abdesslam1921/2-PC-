## تشخيص عطل الصفحة البيضاء

في اختبار المتصفح على `/media-buying`، زر «ربط حساب Meta عبر Facebook» لم يصل إلى Facebook. بعد الضغط تغيّر العنوان إلى `https://manus.im/app-auth?...type=signIn` مع `redirectUri=/api/oauth/callback`. هذا يعني أن طلب tRPC المحمي `mediaBuying.startOAuth` واجه جلسة Manus غير مصادق عليها/منتهية، فتم تحويله إلى بوابة تسجيل الدخول العامة. صفحة بوابة تسجيل الدخول أعادت 403 من CloudFront داخل WebView، فظهر للمستخدم كأنه صفحة بيضاء. الحل المطلوب هو منع التنقل غير المقصود، إظهار حالة تسجيل الدخول/خطأ واضحة، والتأكد من أن المستخدم مصادق قبل بدء Meta OAuth.

## مطابقة تطبيق Meta

بعد تسجيل الدخول إلى Meta Developers ظهرت تطبيقات Login وAbdoustoreads. تمت مطابقة `META_OAUTH_CLIENT_ID` داخل بيئة المشروع، وهو يساوي تطبيق **Login** ذي App ID `4478875785719973`. يجب تعديل هذا التطبيق تحديدًا، وليس Abdoustoreads.

## ملاحظة أثناء إعداد Meta

في لوحة تطبيق Login، زر Configure الذي تم اختباره فتح مسار Messenger بالخطأ. لم يتم تعديل أي إعداد. يجب العودة إلى Dashboard واختيار Configure المقابل مباشرةً لبطاقة Facebook Login، ثم طلب تأكيد المستخدم قبل حفظ Redirect URI.

## نتيجة إضافة Redirect URI

تم فتح Facebook Login → Paramètres في تطبيق Login الصحيح. أُضيف الرابط المطابق للمعاينة:
`https://3000-i20n6kpm2hxlhq2x70dja-c8a94361.us4.manus.computer/api/meta/oauth/callback`
وأظهرت Meta رسالة **Changes saved**. التطبيق ما يزال في Development، ويعرض تنبيهًا بأن public_profile يحتاج Advanced Access لاستخدام Facebook Login مع مستخدمين خارج أدوار التطبيق.

## نتيجة تسجيل الشاشة ولقطات الصلاحيات

وصل التدفق إلى شاشة Facebook Login بنجاح. ظهرت رسالة فرنسية تفيد بأن بعض الصلاحيات لم تتم الموافقة عليها، ثم ظهرت شاشة تطلب صلاحيات إدارة الكتالوجات والإعلانات وحسابات الإعلانات وBusiness وInstagram وPages. بعد المتابعة ظهر من Meta: **This page is currently unavailable**. هذا يعني أن الفشل بعد الوصول إلى Facebook، ويرتبط بإعداد/وضع تطبيق Login والصلاحيات المطلوبة أو عدم جاهزية المنتج للمراجعة، وليس Redirect URI وحده.
