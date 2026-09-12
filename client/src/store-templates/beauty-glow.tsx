import { Star, Play } from "lucide-react";
interface Props {
  customization: any;
}
export default function BeautyGlow({ customization }: Props) {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#fff7f9]"
      style={{ fontFamily: customization.fontFamily }}
    >
      <div className="bg-black text-white text-center text-[11px] py-2">
        ✨ توصيل مجاني + هدية مع كل طلبية فوق 5000 دج
      </div>
      <header className="bg-white/80 backdrop-blur sticky top-0 p-4 flex justify-between items-center border-b border-pink-100">
        <span className="font-black tracking-widest">GLOW</span>
        <span className="text-xs">السلة • الحساب</span>
      </header>
      <div
        className="relative h-[60vh] rounded-b-[2.5rem] overflow-hidden m-3"
        style={{
          background: `linear-gradient(135deg, ${customization.primaryColor}, #ff99bb)`,
        }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute bottom-0 p-7 text-white">
          <p className="text-xs bg-white/20 inline px-3 py-1 rounded-full backdrop-blur">
            NEW • CLEAN BEAUTY
          </p>
          <h1 className="text-3xl font-black mt-4 leading-tight">
            جمالك
            <br />
            الطبيعي يبدأ هنا
          </h1>
          <button className="mt-4 bg-white text-black px-6 py-2.5 rounded-full text-xs font-black flex items-center gap-2">
            <Play className="size-3" /> شاهد الفيديو
          </button>
        </div>
      </div>
      <div className="p-4 max-w-6xl mx-auto">
        <h2 className="font-black text-center">قبل / بعد - نتائج حقيقية</h2>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white rounded-[1.5rem] p-3 border">
            <div className="grid grid-cols-2 gap-2">
              <div className="h-20 bg-zinc-100 rounded-xl" />
              <div className="h-20 bg-pink-50 rounded-xl" />
            </div>
            <p className="text-[11px] font-bold mt-2 text-center">بعد 7 أيام</p>
          </div>
          <div className="bg-white rounded-[1.5rem] p-3 border">
            <div className="flex gap-1 justify-center">
              <Star className="size-3 fill-yellow-400 text-yellow-400" />
              <Star className="size-3 fill-yellow-400 text-yellow-400" />
              <Star className="size-3 fill-yellow-400 text-yellow-400" />
              <Star className="size-3 fill-yellow-400 text-yellow-400" />
              <Star className="size-3 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-[11px] mt-2 leading-5">
              "بشرتي تغيرت تماما، ننصح بيه"
            </p>
            <p className="text-[10px] text-zinc-400 mt-1">سارة • وهران</p>
          </div>
        </div>
      </div>
      <div className="mt-6 px-4 max-w-6xl mx-auto pb-10">
        <h3 className="font-black">الأكثر طلبا</h3>
        <div className="flex gap-3 overflow-x-auto mt-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="min-w-[150px] bg-white rounded-[1.3rem] p-3 border"
            >
              <div className="h-24 bg-gradient-to-br from-pink-50 to-white rounded-xl" />
              <p className="text-xs font-bold mt-2">سيروم فيتامين C</p>
              <p className="text-[10px] text-zinc-500">30ml • طبيعي 100%</p>
              <p
                className="font-black mt-1"
                style={{ color: customization.primaryColor }}
              >
                3200 دج
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
