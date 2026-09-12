# Meta Ads integration research

اعتمد التصميم على توثيق Meta الرسمي الذي تم فتحه في 27 أغسطس 2026.

توضح صفحة Marketing API أن الواجهة مبنية على Graph API وتعمل على كيانات مترابطة تشمل الحساب الإعلاني، الحملة، مجموعة الإعلانات، والإعلان. كما تعرض صفحة Ads Insights API موارد منفصلة لكل مستوى: `/{ad-account-id}/insights` و`/{campaign-id}/insights` و`/{ad-set-id}/insights` و`/{ad-id}/insights`.

تسمح Insights API بتخصيص الفترة الزمنية، الحقول، وتقسيمات التقارير. سيُحفظ الإنفاق كما تعيده Meta مع عملة الحساب، ثم يُحوّل إلى DZD فقط داخل طبقة الحساب باستخدام سعر الصرف الذي يحدده صاحب المتجر. إذا شملت الفترة تاريخ اليوم، يجب وسم النتائج بأنها جزئية وقابلة للتغير.

مصدر المعلومات: [Meta Marketing API](https://developers.facebook.com/documentation/ads-commerce/marketing-api) و[Ads Insights API](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights).
