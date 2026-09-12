import { Star } from "lucide-react";
interface Props {
  customization: any;
  storeName?: string;
}
export default function FashionLuxe({
  customization,
  storeName = "ABDOU",
}: Props) {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-white"
      style={{ fontFamily: customization.fontFamily }}
    >
      <div className="bg-black text-white text-center text-[10px] py-2 tracking-widest">
        FREE SHIPPING OVER 10000 DA • NEW COLLECTION
      </div>
      <header className="flex items-center justify-between p-5 border-b border-black/5">
        <span className="font-black tracking-[0.2em] text-lg">{storeName}</span>
        <div className="flex gap-4 text-xs">SHOP • COLLECTION • CART(0)</div>
      </header>
      <div className="relative h-[68vh] bg-zinc-100 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 p-8 text-white">
          <p className="text-xs tracking-widest opacity-80">EDITORIAL 2025</p>
          <h1 className="text-5xl font-black mt-2 leading-none">
            LUXE
            <br />
            MINIMAL
          </h1>
          <button className="mt-6 bg-white text-black px-8 py-3 rounded-full text-xs font-black">
            استكشف المجموعة
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-black/5 mt-px">
        <div className="bg-white p-6">
          <div className="h-64 bg-zinc-100" />
          <p className="text-xs font-bold mt-3">قميص اوفرسايز</p>
          <p className="text-xs text-zinc-500">4500 دج</p>
        </div>
        <div className="bg-white p-6">
          <div className="h-64 bg-zinc-100" />
          <p className="text-xs font-bold mt-3">بنطلون واسع</p>
          <p className="text-xs text-zinc-500">6200 دج</p>
        </div>
      </div>
      <div className="p-8 text-center border-y">
        <h2 className="text-2xl font-black">
          الموضة ليست ما ترتديه، بل كيف ترتديه
        </h2>
        <p className="text-xs text-zinc-500 mt-3 max-w-md mx-auto">
          قالب مستوحى من Zara و Editorial Boutique - يركز على الصورة والهوية
        </p>
      </div>
    </div>
  );
}
