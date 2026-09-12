# Ecotrack status integration findings

تاريخ التحقق: 2026-08-27.

التوثيق العام الذي قدمه المستخدم يذكر أن API العامة تدعم إضافة الطلب وتعديله، إضافة واسترجاع تحديثات حالة التسليم، طلب إرجاع الطرد، وتتبع تقدم التسليم. كما يذكر أن المصادقة تتم عبر Bearer API token وأن مسارات API تبدأ من `/api/v1/`. يجب اعتماد رقم التتبع المرتجع من إنشاء الشحنة كالمعرف الأساسي لمزامنة الحالة.

المصدر: https://documenter.getpostman.com/view/14517169/Tz5je15g

ملاحظة تنفيذية: التوثيق الذي تم تحميله يثبت وجود وظائف التتبع وتحديثات الحالة وطلب الروتور، لكنه لا يثبت وجود webhook محدد في الصفحة الحالية. لذلك تكون البداية الآمنة عبر زر مزامنة حالة الطلب من لوحة الإدارة باستخدام رقم التتبع، مع ترك إضافة webhook لمرحلة لاحقة بعد توفر endpoint وتوقيع التحقق رسميًا.

مصدر مساعد يشرح أن EcoTrack يجمع شركات توصيل متعددة وأن لكل شحنة رقم تتبع: https://dzbuild.com/docs/couriers/ecotrack

تحديث من قسم «Suivi des commandes»: التوثيق يعرض عمليات تتبع تشمل إضافة معلومة تتبع، قائمة تحديثات طرد، طلب إرجاع، وتتبع وتاريخ العمليات لطلب واحد أو عدة طلبات، إضافة إلى قائمة الطلبات حسب الحالة وفلترة الحالة. كما يثبت endpoint `POST /api/v1/valid/returns` لتأكيد الاستلام الفعلي للمرتجعات عبر `{ "trackings": ["..."] }`. تفاصيل endpoint قراءة الحالة يجب استخراجها قبل تنفيذ عميل المزامنة، ولا ينبغي تخمين اسم المسار أو أسماء الحالات من خارج التوثيق.

المصدر: https://documenter.getpostman.com/view/14517169/Tz5je15g

استخراج مباشر من قسم تتبع الطلبات: قراءة تاريخ العمليات تتم عبر `GET /api/v1/get/tracking/info?tracking={{tracking}}`. الحالات المذكورة تشمل `order_information_received_by_carrier`, `picked`, `accepted_by_carrier`, `dispatched_to_driver`, `attempt_delivery`, `return_asked`, `return_in_transit`, `return_received`, `livred`, `encassed`, و`payed`. لذلك ستُترجم `livred` إلى «كوموند ليفري»، و`return_asked` و`return_in_transit` إلى «في طريق الروتور»، و`return_received` إلى «كوموند روتور» بعد استلامها فعليًا.

المصدر: https://documenter.getpostman.com/view/14517169/Tz5je15g
