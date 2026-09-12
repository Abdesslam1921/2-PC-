import { BrandLockup } from "@/components/BrandLockup";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح."),
  password: z.string().min(1, "كلمة المرور مطلوبة."),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب.").max(160, "الاسم طويل جدًا."),
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح."),
  password: z
    .string()
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل.")
    .max(128, "كلمة المرور طويلة جدًا."),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

const inputClass =
  "h-12 w-full rounded-2xl border border-[#E3E1D8] bg-white px-4 pl-11 text-sm font-bold text-[#1F2A25] outline-none transition placeholder:font-medium placeholder:text-[#9AA39C] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-bold text-[#A63D28]">{message}</p>;
}

function FormError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[#F3D2CB] bg-[#FCE8E4] px-3.5 py-2.5 text-xs font-bold text-[#A63D28]">
      <AlertCircle className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [googleError] = useState(
    () =>
      typeof window !== "undefined" &&
      window.location.search.includes("google=error")
  );
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", name: "" },
  });

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.href = "/dashboard";
    },
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.href = "/dashboard";
    },
  });

  if (meQuery.data) {
    if (typeof window !== "undefined") window.location.href = "/dashboard";
    return null;
  }

  const submitLogin = loginForm.handleSubmit(values => login.mutate(values));
  const submitRegister = registerForm.handleSubmit(values =>
    register.mutate(values)
  );

  return (
    <div
      dir="rtl"
      className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--paper)] px-4 py-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-1/2 size-[420px] translate-x-1/2 rounded-full bg-[var(--brand-soft)] blur-3xl"
      />
      <div className="relative w-full max-w-[420px] animate-fade-up">
        <div className="mb-8 flex justify-center">
          <BrandLockup />
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[#E7E9E2] bg-white shadow-lift">
          <div className="border-b border-[#EEF0E8] bg-[#FBFBF7] px-6 py-6">
            <p className="text-xs font-extrabold tracking-[0.08em] text-[var(--brand)]">
              منصة عبدو ستور
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#1F2A25]">
              {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#79837D]">
              {mode === "login"
                ? "أدخل بريدك وكلمة المرور للوصول إلى لوحة التحكم."
                : "أنشئ حسابًا جديدًا للبدء في إدارة متجرك."}
            </p>
          </div>

          <div className="p-6">
            {mode === "login" ? (
              <form onSubmit={submitLogin} noValidate className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold text-[#46524C]">
                    البريد الإلكتروني
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9AA39C]" />
                    <input
                      type="email"
                      dir="ltr"
                      placeholder="name@example.com"
                      className={inputClass}
                      {...loginForm.register("email")}
                    />
                  </div>
                  <FieldError
                    message={loginForm.formState.errors.email?.message}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold text-[#46524C]">
                    كلمة المرور
                  </span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9AA39C]" />
                    <input
                      type="password"
                      dir="ltr"
                      placeholder="••••••••"
                      className={inputClass}
                      {...loginForm.register("password")}
                    />
                  </div>
                  <FieldError
                    message={loginForm.formState.errors.password?.message}
                  />
                </label>

                {login.error && <FormError message={login.error.message} />}

                <Button
                  type="submit"
                  disabled={login.isPending}
                  className="btn-press h-12 w-full rounded-2xl bg-[var(--brand)] font-extrabold shadow-cta transition duration-200 hover:bg-[var(--brand-strong)]"
                >
                  {login.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogIn className="size-4" />
                  )}
                  تسجيل الدخول
                </Button>
              </form>
            ) : (
              <form onSubmit={submitRegister} noValidate className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold text-[#46524C]">
                    الاسم الكامل
                  </span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9AA39C]" />
                    <input
                      type="text"
                      placeholder="اسم المتجر أو اسمك"
                      className={inputClass}
                      {...registerForm.register("name")}
                    />
                  </div>
                  <FieldError
                    message={registerForm.formState.errors.name?.message}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold text-[#46524C]">
                    البريد الإلكتروني
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9AA39C]" />
                    <input
                      type="email"
                      dir="ltr"
                      placeholder="name@example.com"
                      className={inputClass}
                      {...registerForm.register("email")}
                    />
                  </div>
                  <FieldError
                    message={registerForm.formState.errors.email?.message}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold text-[#46524C]">
                    كلمة المرور
                  </span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9AA39C]" />
                    <input
                      type="password"
                      dir="ltr"
                      placeholder="8 أحرف على الأقل"
                      className={inputClass}
                      {...registerForm.register("password")}
                    />
                  </div>
                  <FieldError
                    message={registerForm.formState.errors.password?.message}
                  />
                </label>

                {register.error && (
                  <FormError message={register.error.message} />
                )}

                <Button
                  type="submit"
                  disabled={register.isPending}
                  className="btn-press h-12 w-full rounded-2xl bg-[var(--brand)] font-extrabold shadow-cta transition duration-200 hover:bg-[var(--brand-strong)]"
                >
                  {register.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserRound className="size-4" />
                  )}
                  إنشاء الحساب
                </Button>
              </form>
            )}

            <div className="relative my-5 text-center">
              <span className="absolute inset-x-0 top-1/2 h-px bg-[#EDEEE6]" />
              <span className="relative z-10 bg-white px-3 text-xs font-bold text-[#8A938D]">
                أو
              </span>
            </div>

            {googleError && (
              <div className="mb-4">
                <FormError message="تعذر تسجيل الدخول عبر Google. حاول مرة أخرى." />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/google/auth/start";
              }}
              className="btn-press flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#E3E1D8] bg-white font-extrabold text-[#3D4A43] transition duration-200 hover:bg-[#F6F7F2]"
            >
              <GoogleIcon />
              {mode === "login"
                ? "تسجيل الدخول عبر Google"
                : "التسجيل عبر Google"}
            </button>

            <div className="mt-5 border-t border-[#EEF0E8] pt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(current =>
                    current === "login" ? "register" : "login"
                  );
                  loginForm.clearErrors();
                  registerForm.clearErrors();
                }}
                className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--brand)] transition duration-200 hover:gap-2.5 hover:text-[var(--brand-strong)]"
              >
                {mode === "login" ? "حساب جديد" : "لدي حساب بالفعل"}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#8A938D]">
          بالدخول أنت توافق على شروط الاستخدام وسياسة الخصوصية.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.29a12 12 0 0 0 0 10.78l3.99-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.61l3.99 3.1C6.23 6.87 8.88 4.76 12 4.76z"
      />
    </svg>
  );
}
