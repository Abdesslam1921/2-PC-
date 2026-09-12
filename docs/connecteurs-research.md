# بحث تكاملات Connecteurs

## Cloudflare Turnstile

توضح وثائق Cloudflare الرسمية أن Turnstile يحتاج إلى مفتاح موقع (Sitekey) في الواجهة ومفتاح سري (Secret key) في الخادم، وأن التحقق الخادمّي من الرمز عبر Siteverify إلزامي قبل اعتبار الطلب موثوقًا. الرمز صالح لفترة محدودة ويجب إرساله إلى الخادم ضمن نافذة التحقق. المراجع: https://developers.cloudflare.com/turnstile/get-started/ و https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ و https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/

## ملاحظات تنفيذية

سيكون Turnstile إعدادًا لكل متجر، مع تخزين Site Key كقيمة تعريفية وSecret Key مشفرًا. يجب تطبيق التحقق على الخادم قبل إنشاء الطلب، مع إبقاء إمكانية تعطيل التكامل من لوحة Connecteurs.

## Google Sheets عبر OAuth

توضح وثائق Google أن تطبيق الويب يحتاج OAuth 2.0 Client ID، ثم يطلب موافقة صاحب المتجر ويستعمل access token للوصول إلى Google APIs ضمن scopes محددة. هذا يناسب SaaS لأن كل متجر يربط حسابه وSheet الخاص به بدل مشاركة ملف Service Account. المراجع: https://developers.google.com/identity/protocols/oauth2 و https://developers.google.com/identity/protocols/oauth2/web-server

## WhatsApp Cloud API

توثيق Meta يوضح أن WhatsApp Cloud API هو منصة WhatsApp Business المستضافة، ويتطلب هوية رقم الهاتف والتوثيق المناسب لإرسال الرسائل. الرسائل خارج نافذة خدمة العملاء تحتاج غالبًا إلى قوالب معتمدة؛ لذلك يجب تجهيز قوالب إشعارات الطلب قبل الإرسال الآلي. المراجع: https://developers.facebook.com/documentation/business-messaging/whatsapp/overview و https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages

## SMS الجزائري

لم يتم اعتماد مزود بعينه لأن أسماء شركات الاتصالات الثلاث لا تكفي لتحديد API تجاري متاح للتطبيقات. يلزم اسم بوابة SMS أو وثائق API وعناوين المصادقة والقوالب قبل تفعيل الإرسال الحقيقي.

## Service Account لـ Google Sheets

اعتمد المشروع الطريقة الأبسط للمزامنة: إنشاء Service Account، إنشاء مفتاح JSON، ثم مشاركة ملف Google Sheet مع بريد Service Account بصلاحية Editor. يستعمل الخادم JWT قصير المدة للحصول على تصريح Google ثم يضيف صفوف الطلبات إلى ورقة Orders. المراجع الرسمية: https://developers.google.com/workspace/guides/create-credentials و https://docs.cloud.google.com/iam/docs/service-accounts-create و https://developers.google.com/workspace/sheets/api/guides/concepts
