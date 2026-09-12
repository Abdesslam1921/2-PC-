import { Star, Truck, Shield, Clock, ShoppingBag } from "lucide-react";

interface Props {
  customization: {
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
    showCountdown: boolean;
    showTrustBadges: boolean;
  };
  products?: any[];
  storeName?: string;
}

export default function MarketPro({
  customization,
  storeName = "Abdou Store",
}: Props) {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-white"
      style={{ fontFamily: customization.fontFamily }}
    >
      {/* Top Announcement - كيما فالفيديو */}
      <div className="bg-[#111] text-white text-center text-[11px] py-2.5 px-4">
        <span className="inline-flex items-center gap-2">
          🔥 توصيل مجاني للـ 58 ولاية{" "}
          <span className="bg-white text-black px-2 py-0.5 rounded-full text-[10px] font-black">
            اليوم فقط
          </span>
        </span>
      </div>

      {/* Header Sticky */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-zinc-100">
        <div className="flex items-center justify-between p-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div
              className="size-9 rounded-xl flex items-center justify-center text-white font-black"
              style={{ background: customization.primaryColor }}
            >
              A
            </div>
            <span className="font-black text-[15px]">{storeName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-9 rounded-full bg-zinc-50 flex items-center justify-center">
              🔍
            </span>
            <span className="size-9 rounded-full bg-zinc-900 text-white flex items-center justify-center relative">
              <ShoppingBag className="size-4" />
              <span className="absolute -top-1 -right-1 size-4 bg-red-500 text-[10px] rounded-full flex items-center justify-center">
                2
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Featured Vendor - كيما فالفيديو */}
      <div className="p-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 bg-[#FFF8E8] rounded-2xl p-3 border border-orange-100">
          <div className="size-12 rounded-full bg-white shadow-sm flex items-center justify-center">
            ⭐
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-black">مورد متميز ومعتمد</p>
            <p className="text-[11px] text-zinc-500">
              تقييم 4.9 • 1240 طلب • توصيل سريع
            </p>
          </div>
          <span className="text-[10px] bg-green-500 text-white px-2.5 py-1 rounded-full">
            موثوق
          </span>
        </div>
      </div>

      {/* Hero Banner - This is a simple banner */}
      <div className="px-4 max-w-6xl mx-auto">
        <div
          className="rounded-[1.8rem] p-6 md:p-8 text-white relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${customization.primaryColor} 0%, #9f96ff 100%)`,
          }}
        >
          <div className="relative z-10 max-w-[70%]">
            <p className="text-xs opacity-80 font-bold tracking-widest">
              تشكيلة الموسم
            </p>
            <h1 className="text-2xl md:text-3xl font-black mt-2 leading-tight">
              هذا بانر بسيط
              <br />
              يمكنك تغييره
            </h1>
            <p className="text-[13px] opacity-80 mt-2">
              ADD ANYTHING HERE OR JUST REMOVE IT
            </p>
            <button
              className="mt-5 bg-white text-black px-6 py-2.5 rounded-full text-sm font-black"
              style={{ color: customization.primaryColor }}
            >
              SHOP NOW
            </button>
          </div>
          <div className="absolute -right-10 -bottom-10 size-48 bg-white/10 rounded-full blur-2xl" />
        </div>
      </div>

      {customization.showCountdown && (
        <div className="px-4 mt-4 max-w-6xl mx-auto">
          <div className="bg-[#FFF3CD] border border-[#FFD24D] rounded-2xl p-3 flex items-center justify-between">
            <span className="text-[12px] font-bold flex items-center gap-2">
              <Clock className="size-4" /> عرض ينتهي بعد
            </span>
            <span className="flex gap-1">
              <span className="bg-black text-white px-2 py-1 rounded-lg text-xs font-mono">
                02
              </span>
              <span className="bg-black text-white px-2 py-1 rounded-lg text-xs font-mono">
                14
              </span>
              <span className="bg-black text-white px-2 py-1 rounded-lg text-xs font-mono">
                35
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Categories Slider - أفقي */}
      <div className="mt-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between px-4 mb-3">
          <h2 className="font-black">الفئات</h2>
          <span className="text-xs text-zinc-500">عرض الكل</span>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {["هواتف", "ملابس", "أحذية", "إلكترونيات", "تجميل", "منزل"].map(c => (
            <div
              key={c}
              className="min-w-[72px] flex flex-col items-center gap-2"
            >
              <div className="size-[64px] rounded-[1.2rem] bg-zinc-50 border flex items-center justify-center text-xl">
                📦
              </div>
              <span className="text-[11px] font-bold">{c}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Products Slider - كيما فالفيديو */}
      <div className="mt-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between px-4 mb-3">
          <h2 className="font-black">منتجات مميزة</h2>
          <span className="text-xs px-3 py-1 bg-zinc-100 rounded-full">
            الأكثر مبيعا
          </span>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-4">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="min-w-[160px] bg-white border border-zinc-100 rounded-[1.4rem] p-2.5 shadow-sm"
            >
              <div className="h-[120px] bg-zinc-50 rounded-xl relative">
                <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] px-2 py-1 rounded-full font-bold">
                  -30%
                </span>
                <span className="absolute top-2 left-2 bg-white shadow text-[9px] px-2 py-1 rounded-full">
                  ⭐ 4.8
                </span>
              </div>
              <p className="text-[12px] font-bold mt-2.5">منتج رائع {i}</p>
              <p className="text-[11px] text-zinc-500">توصيل مجاني</p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="font-black text-sm"
                  style={{ color: customization.primaryColor }}
                >
                  2900 دج
                </span>
                <span className="text-[11px] line-through text-zinc-400">
                  3900
                </span>
              </div>
              <button
                className="w-full mt-2.5 h-8 rounded-full text-xs font-black text-white"
                style={{ background: customization.primaryColor }}
              >
                أضف للسلة
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* How it Works */}
      <div className="mt-8 px-4 max-w-6xl mx-auto">
        <h2 className="font-black text-center mb-4">كيف يعمل؟</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { n: "1", t: "اختر المنتج" },
            { n: "2", t: "اطلب الآن" },
            { n: "3", t: "استلم" },
          ].map(s => (
            <div key={s.n} className="bg-zinc-50 rounded-2xl p-3 text-center">
              <div className="size-8 mx-auto rounded-full bg-white shadow flex items-center justify-center font-black text-sm">
                {s.n}
              </div>
              <p className="text-[11px] font-bold mt-2">{s.t}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews Slider */}
      <div className="mt-8 max-w-6xl mx-auto pb-10">
        <h2 className="font-black px-4 mb-3">آراء الزبائن</h2>
        <div className="flex gap-3 overflow-x-auto px-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="min-w-[260px] bg-white border rounded-2xl p-4 shadow-sm"
            >
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    className="size-3 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>
              <p className="text-[12px] mt-2 leading-6">
                "وصلني في يومين، الجودة ممتازة والتغليف روعة"
              </p>
              <p className="text-[10px] text-zinc-500 mt-2">— أحمد • الجزائر</p>
            </div>
          ))}
        </div>
      </div>

      {customization.showTrustBadges && (
        <div className="border-t bg-zinc-50/50 p-4 flex justify-center gap-6 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <Truck className="size-3" /> توصيل 58 ولاية
          </span>
          <span className="flex items-center gap-1">
            <Shield className="size-3" /> دفع عند الاستلام
          </span>
        </div>
      )}
    </div>
  );
}
