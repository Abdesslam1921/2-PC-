import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div
      dir="rtl"
      className="relative grid min-h-screen w-full place-items-center overflow-hidden bg-[var(--paper)] px-4"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-1/2 size-[420px] translate-x-1/2 rounded-full bg-[var(--warm-soft)] blur-3xl"
      />
      <div className="relative w-full max-w-lg animate-fade-up rounded-[24px] border border-[#E7E9E2] bg-white px-6 py-10 text-center shadow-lift sm:px-10">
        <div className="mb-6 flex justify-center">
          <div className="grid size-16 place-items-center rounded-3xl bg-[var(--warm-soft)] text-[var(--warm)]">
            <AlertCircle className="size-8" />
          </div>
        </div>

        <p className="text-xs font-extrabold tracking-[0.08em] text-[var(--warm)]">
          خطأ 404
        </p>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#1F2A25] sm:text-3xl">
          الصفحة غير موجودة
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#79837D]">
          عذرًا، الصفحة التي تبحث عنها غير متوفرة. ربما تم نقلها أو حذفها.
        </p>

        <div
          id="not-found-button-group"
          className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"
        >
          <Button
            onClick={handleGoHome}
            className="btn-press h-11 rounded-2xl bg-[var(--brand)] px-6 font-extrabold text-white shadow-cta transition duration-200 hover:bg-[var(--brand-strong)]"
          >
            <Home className="ml-2 size-4" />
            العودة إلى الرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
}
