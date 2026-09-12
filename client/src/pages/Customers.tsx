import { EmptyState } from "@/components/EmptyState";
import { PageIntro, PresentationNotice } from "@/components/PageIntro";
import { Button } from "@/components/ui/button";
import { Download, Search, UserRoundPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";

export default function Customers() {
  return (
    <div>
      <PageIntro
        eyebrow="العلاقات"
        title="العملاء"
        description="سيجمع هذا القسم جهات اتصال العملاء وسجل الطلبات ومؤشرات عودتهم إلى المتجر."
        action={
          <Button
            variant="outline"
            onClick={() => toast.info("لا توجد قائمة عملاء قابلة للتصدير بعد.")}
            className="btn-press h-11 rounded-xl border-[#E3E1D8] bg-white px-5 font-bold text-[#41564B] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
          >
            <Download className="ml-2 size-4" />
            تصدير العملاء
          </Button>
        }
      />
      <PresentationNotice />
      <div className="mb-5 rounded-[20px] border border-[#E7E9E2] bg-white p-3 shadow-soft">
        <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-transparent bg-[#F5F6F2] px-3 text-[#8A938D] transition duration-200 focus-within:border-[var(--brand)] focus-within:bg-white focus-within:ring-4 focus-within:ring-[var(--brand)]/10 sm:max-w-sm">
          <Search className="size-4 shrink-0" />
          <input
            className="w-full bg-transparent text-sm text-[#1F2A25] outline-none placeholder:text-[#9AA39C]"
            placeholder="ابحث باسم العميل أو بريده"
            aria-label="ابحث باسم العميل أو بريده"
          />
        </label>
      </div>
      <EmptyState
        icon={UsersRound}
        title="لا يوجد عملاء مسجّلون حتى الآن"
        description="سيُحدَّث هذا القسم تلقائيًا عند بدء استقبال الطلبات، وستتمكن من متابعة العملاء من دون إدخال بياناتهم يدويًا."
        action={
          <Button
            onClick={() =>
              toast.info(
                "ستُنشأ ملفات العملاء من الطلبات الحقيقية عند بدء المبيعات."
              )
            }
            className="btn-press h-11 rounded-xl bg-[var(--brand)] px-5 font-bold text-white shadow-cta hover:bg-[var(--brand-strong)]"
          >
            <UserRoundPlus className="ml-2 size-4" />
            حول ملفات العملاء
          </Button>
        }
      />
    </div>
  );
}
