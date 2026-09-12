import { trpc } from "@/lib/trpc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  ChevronDown,
  Plus,
  Store as StoreIcon,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export function StoreSwitcher() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const activeQuery = trpc.stores.active.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const listQuery = trpc.stores.listMine.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const setActive = trpc.stores.setActive.useMutation({
    onSuccess: () => {
      setOpen(false);
      window.location.reload();
    },
    onError: error => toast.error(error.message),
  });

  const deleteStore = trpc.stores.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المتجر.");
      void utils.stores.listMine.invalidate();
      void utils.stores.active.invalidate();
      setOpen(false);
    },
    onError: error => toast.error(error.message),
  });

  const handleDelete = (storeId: number, storeName: string) => {
    const password = window.prompt(
      `أدخل كلمة مرور حسابك لتأكيد حذف المتجر «${storeName}»:`
    );
    if (!password) return;
    deleteStore.mutate({ id: storeId, password });
  };

  const active = activeQuery.data;
  const stores = listQuery.data ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="hidden items-center gap-2 rounded-xl border border-[#E5E6DE] bg-white px-3 py-2 text-right shadow-soft transition hover:border-[#C6D8CC] sm:flex">
          <StoreIcon className="size-4 shrink-0 text-[var(--brand)]" />
          <span className="max-w-[140px] truncate text-sm font-extrabold text-[#2E3833]">
            {active?.name ?? "متجري"}
          </span>
          <ChevronDown className="size-4 shrink-0 text-[#A7AFA9]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-68 rounded-2xl border-[#E7E9E2] p-2 shadow-lift"
      >
        <DropdownMenuLabel className="px-2 py-2 text-xs font-bold text-[#8A938D]">
          المتاجر
        </DropdownMenuLabel>
        {stores.length === 0 && (
          <p className="px-2 py-2 text-xs text-[#9AA49E]">لا توجد متاجر بعد.</p>
        )}
        {stores.map(store => (
          <div
            key={store.id}
            className="group flex items-center gap-1 rounded-xl px-1 py-1 hover:bg-[#F2F4EF]"
          >
            <button
              type="button"
              onClick={() => {
                if (store.id !== active?.id) setActive.mutate({ id: store.id });
              }}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pl-2 pr-2 text-right text-sm font-medium"
              title="انتقل إلى هذا المتجر"
            >
              <span className="min-w-0 flex-1 truncate">{store.name}</span>
              {store.id === active?.id && (
                <Check className="size-4 shrink-0 text-[var(--brand)]" />
              )}
            </button>
            <button
              type="button"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                handleDelete(store.id, store.name);
              }}
              className="grid size-7 shrink-0 place-items-center rounded-lg text-[#C0492F] transition hover:bg-[#FCE8E4]"
              title="حذف المتجر"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setLocation("/stores/new")}
          className="cursor-pointer rounded-xl py-2.5 text-sm font-bold text-[var(--brand)]"
        >
          <Plus className="ml-2 size-4" />
          متجر جديد
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
