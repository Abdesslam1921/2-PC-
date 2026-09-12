import { Zap, Shield, Truck } from "lucide-react";
interface Props {
  customization: any;
}
export default function ElectroHub({ customization }: Props) {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#f6f7fb]"
      style={{ fontFamily: customization.fontFamily }}
    >
      <div className="bg-yellow-400 text-black text-center text-xs py-2 font-black">
        ⚡ عروض فلاش - خصم حتى 60% - ينتهي اليوم
      </div>
      <header className="bg-white border-b p-3">
        <div className="flex items-center gap-3 max-w-6xl mx-auto">
          <div
            className="size-10 rounded-xl text-white font-black flex items-center justify-center"
            style={{ background: customization.primaryColor }}
          >
            E
          </div>
          <input
            placeholder="ابحث عن هاتف، لابتوب..."
            className="flex-1 bg-zinc-100 rounded-full px-4 py-2.5 text-xs"
          />
          <span className="bg-black text-white px-4 py-2.5 rounded-full text-xs">
            بحث
          </span>
        </div>
      </header>
      <div className="bg-white border-b">
        <div className="flex gap-6 overflow-x-auto p-3 text-xs font-bold max-w-6xl mx-auto">
          <span>هواتف</span>
          <span>لابتوب</span>
          <span>ساعات</span>
          <span>سماعات</span>
          <span>ألعاب</span>
        </div>
      </div>
      <div className="max-w-6xl mx-auto p-3 grid md:grid-cols-[200px_1fr] gap-3">
        <div className="hidden md:block bg-white rounded-2xl p-4 border">
          <p className="font-black text-sm mb-3">الفئات</p>
          {["iPhone", "Samsung", "Xiaomi", "Accessories"].map(c => (
            <div key={c} className="py-2 text-xs border-b last:border-0">
              {c}
            </div>
          ))}
        </div>
        <div>
          <div
            className="rounded-[1.5rem] p-6 text-white flex justify-between items-center"
            style={{
              background: `linear-gradient(135deg, ${customization.primaryColor}, #000)`,
            }}
          >
            <div>
              <p className="text-xs bg-white/20 inline px-2 py-1 rounded-full">
                TOP DEAL
              </p>
              <h2 className="text-2xl font-black mt-3">
                iPhone 15 Pro
                <br />
                بأفضل سعر
              </h2>
              <p className="text-xs mt-2 opacity-80">
                مع ضمان سنتين + توصيل مجاني
              </p>
            </div>
            <div className="size-24 bg-white/10 rounded-2xl" />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="bg-white border rounded-2xl p-2 text-center"
              >
                <div className="size-10 mx-auto bg-zinc-50 rounded-xl" />
                <p className="text-[10px] mt-2 font-bold">هاتف</p>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-white rounded-2xl border p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black">الأكثر مبيعا</h3>
              <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full animate-pulse">
                مباشر
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="border rounded-xl p-2">
                  <div className="h-20 bg-zinc-50 rounded-lg" />
                  <p className="text-[11px] font-bold mt-2">Galaxy S24</p>
                  <p className="text-[10px] text-green-600">متوفر • ضمان</p>
                  <p
                    className="font-black text-sm mt-1"
                    style={{ color: customization.primaryColor }}
                  >
                    125,000 دج
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white border-t mt-6 p-3 flex justify-center gap-6 text-[11px]">
        <span className="flex items-center gap-1">
          <Shield className="size-3" /> ضمان حقيقي
        </span>
        <span className="flex items-center gap-1">
          <Truck className="size-3" /> توصيل 24سا
        </span>
        <span className="flex items-center gap-1">
          <Zap className="size-3" /> دفع آمن
        </span>
      </div>
    </div>
  );
}
