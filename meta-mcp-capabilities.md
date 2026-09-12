# Meta MCP capability review

تاريخ المراجعة: 2026-08-27.

الموصل المدمج **Meta Ads Manager** موجود ومفعّل، والحساب المصرح به حاليًا هو «رحيق الازهار» عبر معرف داخلي محفوظ في إعدادات الجلسة. يجب عدم التبديل إلى حساب آخر دون توجيه صريح.

الأدوات المتاحة في MCP الحالي تشمل القراءة والتحليل والكتابة المرحلية: جلب الحسابات الإعلانية، الحملات، Ad Sets، Ads، تفاصيل الكيانات وInsights، إضافة إلى `ads_create_campaign` و`ads_create_ad_set` و`ads_create_creative` و`ads_create_ad` و`ads_update_entity` و`ads_activate_entity`. أدوات الكتابة لا تُستدعى من المساعد مباشرة؛ تمر عبر مسودة ومعاينة وموافقة صريحة. كل استدعاء Meta Ads يجب أن يحمل `client_conversation_id` ثابتًا من 20 محرفًا للمحادثة نفسها. إنشاء الحملة يستخدم أهداف ODAX الحديثة، والميزانية تُرسل بالسنتات عند التنفيذ.

بناءً على ذلك، يمكن تنفيذ واجهة AI Media Buying لإعداد brief وخطة حملة ومعاينة وموافقة وتدقيق، ثم تنفيذ الإنشاء المرحلي على الحساب المفعّل فقط بعد تأكيد المالك. يبقى زر التنفيذ محجوبًا إذا كانت المدخلات الناقصة مثل Page ID أو رابط الوجهة أو مادة الإعلان أو صلاحية الحساب غير مكتملة. لا يوجد نشر تلقائي ولا إجراءات حذف ضمن هذا المسار.

سيستخدم المساعد مصطلحات Meta الرسمية، ويميز Reach وClicks (all) وLink clicks، ويتعامل مع null كـ N/A، ويذكر أن نطاق التاريخ الذي يتضمن اليوم جزئي وقابل للتغير. التحليل التجاري يجب أن يربط النتائج ببيانات Profitability Engine، لا بعدد الطلبات أو ROAS وحده.

## مصادر رسمية

توضح وثائق Meta أن Marketing API يعمل عبر Graph API ويغطي إنشاء وإدارة الحملات وAd Sets وAd Creatives وInsights. كما يوضح توثيق Authorization المحدّث في 5 مايو 2026 أن إدارة إعلانات حسابات الغير تتطلب عادةً صلاحيات ads_read و/أو ads_management مع متطلبات App Review وMarketing API Access Tier. لذلك ستكون واجهة المساعد صريحة في التفريق بين «اقتراح خطة» و«تنفيذ فعلي».

المصادر: [Meta Marketing API](https://developers.facebook.com/documentation/ads-commerce/marketing-api)، [Meta Authorization](https://developers.facebook.com/docs/marketing-api/overview/authorization/)، [Official Meta Postman collection](https://www.postman.com/meta/facebook-marketing-api/overview).

## فحص الرابط المرسل

فتح https://mcp.facebook.com/ads بتاريخ 2026-08-27 أعاد HTTP 405 برسالة: "MCP endpoints accept POST for JSON-RPC; GET is not supported." هذا يؤكد أن الرابط endpoint MCP وليس صفحة إعداد مرئية. لا يمكن استنتاج الأدوات أو مخطط JSON-RPC من GET وحده؛ يجب ربطه كـ MCP server في إعدادات الموصل ثم تنفيذ discovery عبر MCP، أو توفير طريقة المصادقة المطلوبة من Meta. لم يتم إرسال أي POST أو إجراء إعلاني.

فحص https://mcp.facebook.com/.well-known/oauth-authorization-server أعاد 404 برسالة MCP server not found for path. هذا لا يثبت غياب OAuth بالكامل لأن metadata قد تكون تحت مسار الخادم أو تُدار عبر بوابة MCP، لكنه يعني أن المسار العام القياسي لم يعطِ تفاصيل redirect أو registration. رسالة discovery الحالية ما تزال: Dynamic registration is not available for this client.

## توثيق Ads MCP الرسمي

صفحة Meta الرسمية Ads MCP Get started بتاريخ 14 يوليو 2026 توضّح أن الخادم يدعم طريقتين للمصادقة: OAuth عبر Facebook Login for Business، ولا يحتاج إعداد token يدويًا؛ أو User access token عبر Graph API Explorer أو OAuth خاص. عند استخدام User access token، تذكر الصفحة الصلاحيات: ads_mcp_management وads_read وads_management وcatalog_management وbusiness_management وpages_show_list وinstagram_basic. كما تشترط OAuth أن يكون Redirect URL مضبوطًا بما يتوافق مع MCP client المختار.

المصدر: https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-mcp-server/ads-mcp-server-get-started

## أول استدعاء ناجح بعد User access token

بتاريخ 2026-08-27 نجح اكتشاف أدوات Ads MCP ثم استدعاء القراءة `ads_get_ad_accounts` باستخدام client_conversation_id داخلي. أعاد الخادم حسابين: الحساب «رحيق الازهار» بمعرّف 1338974431016420، حالته ACTIVE، العملة USD، Ads MCP مفعّل، قابل للاستعلام، ووسيلة الدفع موجودة؛ والحساب «rahi9» بمعرّف 1562273391513628، مرتبط بـBusiness Portfolio «الويزة مداح»، لكن Ads MCP غير مفعّل له حاليًا بسبب rollout تدريجي من Meta. لم تُنفذ أي عملية إنشاء أو تعديل أو نشر.

## أحدث تحقق رسمي من OAuth

توضح وثيقة Facebook Login for Business المحدثة في 30 يونيو 2026 أنه الحل المفضل لمزودي التقنية الذين يبنون تكاملات مع أدوات Meta التجارية. يتيح إعداد Configuration تحدد نوع التوكن والأصول والصلاحيات التي يطلبها التطبيق. ولخدمة عملاء لا يملكها مزود التقنية، يلزم عادةً الحصول على Advanced Access عبر Meta App Review. تدعم الصلاحيات ذات الصلة `ads_management` و`ads_read` و`business_management` و`catalog_management` و`pages_show_list` و`instagram_basic`، بينما `ads_mcp_management` مذكورة في إعداد User access token الخاص بخادم Ads MCP وليس ضمن جدول Facebook Login for Business العام.

توضح وثيقة Authorization المحدثة في 5 مايو 2026 أن إدارة حسابات إعلانية مملوكة لعملاء آخرين تحتاج عادةً إلى Advanced access للصلاحيات `ads_read` و/أو `ads_management`، وأن Marketing API Access Tier أصبح يحمل تسميتي Limited Access وFull Access. كما تعرض نمط OAuth باستخدام `https://www.facebook.com/v26.0/dialog/oauth` مع `client_id` و`redirect_uri` و`scope=ads_management`، مع ضرورة تسجيل Redirect URI المطابق في إعدادات التطبيق.

وتوضح وثيقة Ads MCP المحدثة في 14 يوليو 2026 أن استخدام Ads MCP لا يتطلب امتلاك تطبيق Meta عند استخدام المسار الجاهز، وأن OAuth يعيد توجيه MCP client إلى Facebook Login for Business دون إدخال توكن يدوي. أما عند بناء تكامل SaaS داخل Abdou Store، فالتدفق المنفذ يستخدم OAuth الخاص بالتطبيق لحفظ توكن كل متجر في الخادم، ثم يستعمل Meta Graph API للمسارات التشغيلية الخاصة بالمتجر. لا يتم كشف التوكن للواجهة، ولا يُنفّذ إنشاء حملة إلا بموافقة صريحة.

المصادر الرسمية: [Facebook Login for Business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business)، [Marketing API Authorization](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization)، [Ads MCP Get started](https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-mcp-server/ads-mcp-server-get-started).
