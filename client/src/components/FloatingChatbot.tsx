import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bot, MessageCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type ChatAudience = "owner" | "buyer";

const welcomeMessages: Record<ChatAudience, Message> = {
  owner: {
    role: "assistant",
    content:
      "مرحبًا! أنا مساعدك في عبدو ستور. أستطيع مساعدتك في المنتجات والطلبات والتوصيل والربحية والقوالب. ما الذي تريد إنجازه اليوم؟",
  },
  buyer: {
    role: "assistant",
    content:
      "مرحبًا بك! أساعدك في اختيار المنتج المناسب، معرفة السعر والتوفر، أو متابعة خطوات الطلب. كيف يمكنني مساعدتك؟",
  },
};

const prompts: Record<ChatAudience, string[]> = {
  owner: [
    "ما المنتجات التي تحتاج متابعة؟",
    "لخّص أداء الطلبات والربحية",
    "كيف أخصص قالب المتجر؟",
  ],
  buyer: [
    "ما المنتجات المتوفرة؟",
    "ساعدني في اختيار منتج",
    "كيف أطلب بالدفع عند الاستلام؟",
  ],
};

export default function FloatingChatbot({
  audience,
}: {
  audience: ChatAudience;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    welcomeMessages[audience],
  ]);
  const ownerChat = trpc.chatbot?.owner?.useMutation?.({
    onSuccess: content =>
      setMessages(current => [...current, { role: "assistant", content }]),
  }) ?? { mutate: () => undefined, isPending: false };
  const buyerChat = trpc.chatbot?.buyer?.useMutation?.({
    onSuccess: content =>
      setMessages(current => [...current, { role: "assistant", content }]),
  }) ?? { mutate: () => undefined, isPending: false };
  const mutation = audience === "owner" ? ownerChat : buyerChat;
  const handleSend = (content: string) => {
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    const safeMessages = nextMessages
      .filter(message => message.role !== "system")
      .map(message => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }));
    mutation.mutate({ messages: safeMessages });
  };
  return (
    <>
      {open && (
        <div
          className="fixed bottom-24 left-4 z-[70] w-[min(92vw,390px)] overflow-hidden rounded-[26px] border border-[#E3EDE7] bg-white shadow-lift sm:bottom-24 sm:left-6"
          dir="rtl"
        >
          <div className="flex items-center justify-between bg-[linear-gradient(135deg,var(--brand-strong),#16704F)] px-4 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-white/20">
                <Bot className="size-5" />
              </div>
              <div>
                <p className="text-sm font-extrabold">مساعد عبدو ستور</p>
                <p className="mt-0.5 text-[11px] text-white/75">
                  {audience === "owner" ? "مساعد صاحب المتجر" : "مساعد التسوق"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="rounded-xl text-white hover:bg-white/15 hover:text-white"
              aria-label="إغلاق الشاتبوت"
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 border-b border-[#EAE8E0] bg-[#F7F6F1] px-4 py-2 text-[11px] font-bold text-[#66716B]">
            <ShieldCheck className="size-3.5 text-[var(--brand)]" />
            {audience === "owner"
              ? "بيانات المتجر الداخلية تبقى ضمن حسابك"
              : "أجيب من بيانات الكتالوج المتاحة فقط"}
          </div>
          <AIChatBox
            messages={messages}
            onSendMessage={handleSend}
            isLoading={mutation.isPending}
            placeholder={
              audience === "owner"
                ? "اسأل عن إدارة متجرك..."
                : "اكتب سؤالك عن المنتجات..."
            }
            emptyStateMessage="ابدأ محادثة جديدة"
            suggestedPrompts={prompts[audience]}
            height={440}
            className="rounded-none border-0 shadow-none"
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={cn(
          "fixed bottom-5 left-4 z-[71] grid size-[60px] place-items-center rounded-full border-4 border-white bg-[var(--brand)] text-white shadow-cta transition duration-200 hover:-translate-y-1 hover:bg-[var(--brand-strong)] active:scale-95 sm:bottom-6 sm:left-6",
          open && "rotate-0 bg-[#1C2822]"
        )}
        aria-label={open ? "إغلاق الشاتبوت" : "فتح الشاتبوت"}
        aria-expanded={open}
      >
        <span className="absolute inset-1 rounded-full border border-white/20" />
        {open ? (
          <X className="relative size-6" />
        ) : (
          <span className="relative flex flex-col items-center">
            <Bot className="size-7" />
            <Sparkles className="absolute -right-2 -top-1 size-3.5 text-[#F2C063]" />
          </span>
        )}
        <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-[#F2C063] text-[9px] font-black text-[#4A3A1A]">
          <MessageCircle className="size-2.5" />
        </span>
      </button>
    </>
  );
}
