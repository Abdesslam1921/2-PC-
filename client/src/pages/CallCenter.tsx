import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Link2,
  LockKeyhole,
  LogIn,
  Mail,
  Package,
  PhoneCall,
  Plus,
  Search,
  Trash2,
  Truck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useLocation } from "wouter";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AgentForShip from "./AgentForShip";

const orderStatusLabels: Record<string, string> = {
  new: "جديد",
  review: "مراجعة",
  confirmed: "مؤكد",
  processing: "قيد التحضير",
  at_carrier: "عند شركة التوصيل",
  shipped: "تم الشحن",
  delivered: "كوموند ليفري · مكتملة",
  returned: "كوموند روتور · مرجعة",
  cancelled: "ملغاة",
  customer_unresponsive: "الزبون لا يرد",
  phone_cancelled: "الهاتف ملغى",
  fake: "مزيفة",
};
const finalStatuses = new Set([
  "delivered",
  "returned",
  "cancelled",
  "customer_unresponsive",
  "phone_cancelled",
  "fake",
]);
const carrierLabels: Record<string, string> = {
  order_information_received_by_carrier: "تم استلام معلومات الطلب",
  picked: "تم الاستلام",
  accepted_by_carrier: "مقبول لدى الشركة",
  dispatched_to_driver: "قيد التوصيل",
  attempt_delivery: "محاولة توصيل",
  return_asked: "طلب إرجاع",
  return_in_transit: "الإرجاع قيد النقل",
  return_received: "تم استلام المرتجع",
  livred: "تم التسليم",
  encassed: "تم التحصيل",
  payed: "تم الدفع",
  cancelled: "ملغى",
  failed: "تعذر التنفيذ",
  delivered: "تم التسليم",
  returned: "مرتجع",
  in_transit: "قيد التوصيل",
  processing: "قيد المعالجة لدى الشركة",
  pending: "في انتظار معالجة الشركة",
};
const carrierLabel = (status: string | null | undefined) =>
  status
    ? (carrierLabels[status.toLowerCase()] ?? status)
    : "في انتظار حالة شركة الشحن";

type AgentForm = {
  name: string;
  email: string;
  password: string;
  fullAccess: boolean;
  productIds: number[];
  notifyNewOrders: boolean;
  notifyStatusChanges: boolean;
  notifyCancelledOrders: boolean;
  notifyUnresponsiveOrders: boolean;
  notifyFollowUp: boolean;
  compensationMode: "all_orders" | "completed_orders";
  generalOrderRate: string;
  completedOrderRate: string;
};
const emptyForm: AgentForm = {
  name: "",
  email: "",
  password: "",
  fullAccess: false,
  productIds: [],
  notifyNewOrders: true,
  notifyStatusChanges: true,
  notifyCancelledOrders: true,
  notifyUnresponsiveOrders: true,
  notifyFollowUp: true,
  compensationMode: "all_orders",
  generalOrderRate: "0.00",
  completedOrderRate: "0.00",
};

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm text-[#1F2A25] outline-none transition-shadow placeholder:text-[#8A938D] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#E7E9E2] bg-white p-4 shadow-soft transition-shadow duration-200 hover:shadow-lift">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${tone}`} />
        <p className="text-xs font-bold text-[#79837D]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-[#1F2A25]">{value}</p>
    </div>
  );
}

function AgentLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.callCenter.login.useMutation({
    onSuccess: result => {
      localStorage.setItem("abdou_call_center_token", result.token);
      setLocation("/call-center/agent");
    },
    onError: error => toast.error(error.message),
  });
  return (
    <main
      dir="rtl"
      className="grid min-h-screen place-items-center bg-transparent px-4 py-10"
    >
      <section className="w-full max-w-md rounded-[24px] border border-[#E7E9E2] bg-white p-7 shadow-lift">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--brand)] text-white shadow-cta">
          <PhoneCall className="size-8" />
        </div>
        <h1 className="mt-6 text-center text-2xl font-extrabold text-[#1F2A25]">
          دخول عميل مركز الاتصال
        </h1>
        <p className="mt-2 text-center text-sm text-[#79837D]">
          أدخل بيانات الحساب التي أنشأها صاحب المتجر.
        </p>
        <label className="mt-7 block text-sm font-bold text-[#1F2A25]">
          البريد الإلكتروني
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[#E3E1D8] px-3 transition-shadow focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[var(--brand)]/10">
            <Mail className="size-4 text-[#8A938D]" />
            <input
              dir="ltr"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="h-12 w-full bg-transparent text-[#1F2A25] outline-none placeholder:text-[#8A938D]"
              placeholder="agent@example.com"
            />
          </div>
        </label>
        <label className="mt-4 block text-sm font-bold text-[#1F2A25]">
          كلمة المرور
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[#E3E1D8] px-3 transition-shadow focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[var(--brand)]/10">
            <LockKeyhole className="size-4 text-[#8A938D]" />
            <input
              dir="ltr"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="h-12 w-full bg-transparent text-[#1F2A25] outline-none placeholder:text-[#8A938D]"
              placeholder="••••••••"
            />
          </div>
        </label>
        <Button
          disabled={login.isPending || !email || !password}
          onClick={() => login.mutate({ email, password })}
          className="btn-press mt-6 h-12 w-full rounded-2xl bg-[var(--brand)] text-base font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)]"
        >
          <LogIn className="ml-2 size-5" />
          {login.isPending ? "جارٍ الدخول..." : "تسجيل الدخول"}
        </Button>
      </section>
    </main>
  );
}

const editableAgentStatuses = [
  { value: "review", label: "مراجعة" },
  { value: "confirmed", label: "مؤكد" },
  { value: "processing", label: "قيد التحضير" },
  { value: "at_carrier", label: "عند شركة التوصيل" },
  { value: "shipped", label: "تم الشحن" },
  { value: "returned", label: "كوموند روتور · مرجعة" },
  { value: "cancelled", label: "ملغاة" },
  { value: "customer_unresponsive", label: "الزبون لا يرد" },
  { value: "phone_cancelled", label: "الهاتف ملغى" },
  { value: "fake", label: "مزيفة" },
] as const;

function AgentDashboard() {
  const [location, setLocation] = useLocation();
  const [token, setToken] = useState(
    () => localStorage.getItem("abdou_call_center_token") ?? ""
  );
  useEffect(() => {
    const stored = localStorage.getItem("abdou_call_center_token") ?? "";
    setToken(previous => (previous === stored ? previous : stored));
  }, [location]);
  const dashboard = trpc.callCenter.dashboard.useQuery(
    { token },
    { enabled: Boolean(token), retry: false }
  );
  const [activeTab, setActiveTab] = useState<"orders" | "forship">("orders");
  const [orderSearch, setOrderSearch] = useState("");
  const utils = trpc.useUtils();
  const refetchDashboard = () => utils.callCenter.dashboard.invalidate({ token });
  const updateStatus = trpc.callCenter.updateOrderStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة الطلب.");
      void refetchDashboard();
    },
    onError: error => toast.error(error.message),
  });
  const data = dashboard.data;
  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLocaleLowerCase("ar");
    return (data?.orders ?? []).filter(order => {
      if (!term) return true;
      return (
        order.orderNumber.toLocaleLowerCase("ar").includes(term) ||
        order.customerName.toLocaleLowerCase("ar").includes(term) ||
        order.customerPhone.includes(term)
      );
    });
  }, [data?.orders, orderSearch]);
  if (!token) return <AgentLogin />;
  if (dashboard.isError)
    return (
      <main
        dir="rtl"
        className="grid min-h-screen place-items-center bg-transparent p-5"
      >
        <div className="w-full max-w-sm rounded-[24px] border border-[#E7E9E2] bg-white p-8 text-center shadow-soft">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-[#F3D2CB] bg-[#FCE8E4]">
            <AlertCircle className="size-7 text-[#A63D28]" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-[#1F2A25]">
            انتهت جلسة الدخول
          </h1>
          <p className="mt-2 text-sm text-[#79837D]">
            سجّل الدخول من جديد لمتابعة طلباتك.
          </p>
          <Button
            className="btn-press mt-5 rounded-xl bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
            onClick={() => {
              localStorage.removeItem("abdou_call_center_token");
              setToken("");
            }}
          >
            تسجيل الدخول من جديد
          </Button>
        </div>
      </main>
    );
  return (
    <main dir="rtl" className="min-h-screen bg-transparent px-4 py-7">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-[0.06em] text-[var(--brand)]">
              مركز الاتصال
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.02em] text-[#1F2A25]">
              مرحبًا، {data?.agent.name}
            </h1>
            <p className="mt-2 text-xs font-bold text-[#79837D]">
              {data?.agent.compensationMode === "completed_orders"
                ? "تعويض الطلبات المكتملة فقط"
                : "تعويض الطلبات العامة"}{" "}
              · {data?.agent.rate} دج لكل طلبية
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data?.agent.fullAccess && (
              <span className="rounded-full bg-[#4E8A6F]/15 px-3 py-1.5 text-xs font-extrabold text-[#2F6B4F]">
                صلاحيات كاملة
              </span>
            )}
            <Button
              variant="outline"
              onClick={() => {
                localStorage.removeItem("abdou_call_center_token");
                setLocation("/call-center/login");
              }}
              className="btn-press rounded-xl border-[#E3E1D8] bg-white text-[#1F2A25] hover:bg-[#FAF9F5]"
            >
              تسجيل الخروج
            </Button>
          </div>
        </header>
        <div className="mt-7 grid gap-4 sm:grid-cols-5">
          <Stat
            label="كل الطلبات"
            value={data?.stats.total ?? 0}
            tone="bg-[#1F2A25]"
          />
          <Stat
            label="جديدة"
            value={data?.stats.new ?? 0}
            tone="bg-[var(--warm)]"
          />
          <Stat
            label="مؤكدة"
            value={data?.stats.confirmed ?? 0}
            tone="bg-[var(--brand)]"
          />
          <Stat
            label="مشحونة"
            value={data?.stats.shipped ?? 0}
            tone="bg-[#4E8A6F]"
          />
          <Stat
            label="ملغاة"
            value={data?.stats.cancelled ?? 0}
            tone="bg-[#A63D28]"
          />
          <Stat
            label="مؤهلة للتعويض"
            value={data?.stats.eligibleOrders ?? 0}
            tone="bg-[var(--warm)]"
          />
          <Stat
            label="التعويض التقديري"
            value={Number(data?.stats.estimatedCompensation ?? 0)}
            tone="bg-[var(--brand)]"
          />
        </div>
        <section className="mt-6 rounded-[20px] border border-[#E7E9E2] bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Link2 className="size-5 text-[var(--brand)]" />
              <h2 className="font-extrabold text-[#1F2A25]">
                {data?.agent.fullAccess
                  ? "كل منتجات المتجر (صلاحيات كاملة)"
                  : "المنتجات المسموحة"}
              </h2>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data?.products.map(product => (
              <span
                key={product.id}
                className="rounded-full bg-[var(--brand-soft)] px-3 py-2 text-xs font-bold text-[var(--brand)]"
              >
                {product.title}
              </span>
            ))}
          </div>
        </section>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setActiveTab("orders")}
            className={`btn-press h-11 rounded-xl transition-colors duration-200 ${
              activeTab === "orders"
                ? "bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
                : "border border-[#E3E1D8] bg-white text-[#79837D] hover:text-[#1F2A25]"
            }`}
          >
            <Package className="ml-2 size-4" />
            الطلبات
          </Button>
          <Button
            onClick={() => setActiveTab("forship")}
            className={`btn-press h-11 rounded-xl transition-colors duration-200 ${
              activeTab === "forship"
                ? "bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
                : "border border-[#E3E1D8] bg-white text-[#79837D] hover:text-[#1F2A25]"
            }`}
          >
            <Truck className="ml-2 size-4" />
            فورشيب · تتبع الشحن
          </Button>
        </div>
        {activeTab === "orders" ? (
          <section className="mt-4 overflow-hidden rounded-[20px] border border-[#E7E9E2] bg-white shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0E9] p-5">
              <h2 className="font-extrabold text-[#1F2A25]">
                الطلبات ({filteredOrders.length})
              </h2>
              <label className="flex h-10 w-72 items-center gap-2 rounded-xl bg-[#F5F6F2] px-3 text-[#8A938D] transition-colors focus-within:bg-[var(--brand-soft)]">
                <Search className="size-4" />
                <input
                  value={orderSearch}
                  onChange={event => setOrderSearch(event.target.value)}
                  className="w-full bg-transparent text-sm text-[#1F2A25] outline-none placeholder:text-[#8A938D]"
                  placeholder="ابحث برقم الطلب أو العميل"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-right text-sm">
                <thead className="bg-[#FAF9F5] text-xs font-extrabold text-[#8A938D]">
                  <tr>
                    <th className="p-4">رقم الطلب</th>
                    <th className="p-4">الزبون</th>
                    <th className="p-4">الهاتف</th>
                    <th className="p-4">الإجمالي</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4">تغيير الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <tr
                      key={order.id}
                      className="border-t border-[#F1F2EC] transition-colors duration-200 hover:bg-[#FAF9F5]"
                    >
                      <td className="p-4 font-extrabold text-[var(--brand)]">
                        {order.orderNumber}
                      </td>
                      <td className="p-4 font-bold text-[#1F2A25]">
                        {order.customerName}
                      </td>
                      <td className="p-4 text-[#5C665F]" dir="ltr">
                        {order.customerPhone}
                      </td>
                      <td className="p-4 font-bold text-[#1F2A25]">
                        {order.total} دج
                      </td>
                      <td className="p-4 text-xs font-bold text-[#79837D]">
                        {orderStatusLabels[order.fulfillmentStatus] ??
                          order.fulfillmentStatus}
                      </td>
                      <td className="p-4">
                          <select
                            dir="rtl"
                            value={order.fulfillmentStatus}
                            disabled={
                              (updateStatus.isPending &&
                                updateStatus.variables?.orderId === order.id) ||
                              ["delivered", "returned"].includes(
                                order.fulfillmentStatus
                              )
                            }
                            onChange={event =>
                              updateStatus.mutate({
                                token,
                                orderId: order.id,
                                fulfillmentStatus: event
                                  .target
                                  .value as (typeof editableAgentStatuses)[number]["value"],
                              })
                            }
                            className="h-9 rounded-xl border border-[#E3E1D8] bg-white px-2 text-xs font-bold text-[#1F2A25] outline-none transition-shadow focus:border-[var(--brand)] disabled:cursor-not-allowed disabled:bg-[#F5F6F2]"
                          >
                          <option value={order.fulfillmentStatus} disabled>
                            {orderStatusLabels[order.fulfillmentStatus] ??
                              order.fulfillmentStatus}
                          </option>
                          {editableAgentStatuses
                            .filter(
                              status =>
                                status.value !== order.fulfillmentStatus
                            )
                            .map(status => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {!filteredOrders.length && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-[#8A938D]">
                        لا توجد طلبات مطابقة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="mt-4">
            <div className="mb-4 flex items-center gap-2">
              <Truck className="size-5 text-[var(--brand)]" />
              <h2 className="font-extrabold text-[#1F2A25]">
                فورشيب - تتبع الطلبات المشحونة
              </h2>
            </div>
            <AgentForShip
              token={token}
              orders={data?.orders ?? []}
              products={data?.products ?? []}
              fullAccess={Boolean(data?.agent.fullAccess)}
            />
          </section>
        )}
      </div>
    </main>
  );
}

function CallCenterAdmin() {
  const [, setLocation] = useLocation();
  const productsQuery = trpc.products.list.useQuery();
  const agentsQuery = trpc.callCenter.list.useQuery();
  const [form, setForm] = useState<AgentForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const create = trpc.callCenter.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء حساب عميل مركز الاتصال.");
      setForm(emptyForm);
      agentsQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.callCenter.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حساب العميل.");
      setForm(emptyForm);
      setEditingId(null);
      agentsQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.callCenter.remove.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الحساب.");
      agentsQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const impersonate = trpc.callCenter.impersonate.useMutation({
    onSuccess: result => {
      localStorage.setItem("abdou_call_center_token", result.token);
      toast.success(`تم الدخول إلى حساب ${result.agent.name}.`);
      setLocation("/call-center/agent");
    },
    onError: error => toast.error(error.message),
  });
  const products = useMemo(
    () =>
      (productsQuery.data ?? []).filter(
        (product): product is NonNullable<typeof product> => Boolean(product)
      ),
    [productsQuery.data]
  );
  const toggleProduct = (id: number) =>
    setForm(current => ({
      ...current,
      productIds: current.productIds.includes(id)
        ? current.productIds.filter(productId => productId !== id)
        : [...current.productIds, id],
    }));
  return (
    <main dir="rtl" className="min-h-full">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-[0.06em] text-[var(--brand)]">
              Connecteurs · عمليات المتجر
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.02em] text-[#1F2A25]">
              Call Center
            </h1>
            <p className="mt-2 text-sm text-[#79837D]">
              أنشئ حسابات لفريق تأكيد الطلبات، اختر لكل عميل «صلاحيات كاملة»
              على كل الطلبات وفورشيب، أو خصّص له منتجات مسموحة فقط.
            </p>
            <p className="mt-2 text-xs leading-6 text-[#8A938D]">
              تصله إشعارات الطلبات والحالات على بريده عند ربط Google ومنح صلاحية
              Gmail من Connecteurs.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={() => setLocation("/call-center/login")}
              className="btn-press rounded-xl border-[var(--brand)]/30 bg-white text-[var(--brand)] hover:bg-[var(--brand-soft)]"
            >
              <LogIn className="ml-2 size-4" />
              معاينة صفحة الدخول
            </Button>
            <Button
              onClick={() =>
                document
                  .getElementById("new-agent")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="btn-press rounded-xl bg-[var(--brand)] font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)]"
            >
              <Plus className="ml-2 size-4" />
              إضافة عميل
            </Button>
          </div>
        </header>
        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#1F2A25]">
                <UsersRound className="size-5 text-[var(--brand)]" />
                حسابات العملاء ({agentsQuery.data?.length ?? 0})
              </div>
              {agentsQuery.isLoading ? (
                <div className="rounded-[20px] border border-[#E7E9E2] bg-white p-8 text-center text-sm text-[#79837D] shadow-soft">
                  جارٍ تحميل الحسابات...
                </div>
              ) : agentsQuery.data?.length ? (
                agentsQuery.data.map(agent => (
                  <article
                    key={agent.id}
                    className="rounded-[20px] border border-[#E7E9E2] bg-white p-5 shadow-soft transition-shadow duration-200 hover:shadow-lift"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                          <UserRound className="size-6" />
                        </div>
                        <div>
                          <h2 className="font-extrabold text-[#1F2A25]">
                            {agent.name}
                          </h2>
                          <p dir="ltr" className="mt-1 text-xs text-[#8A938D]">
                            {agent.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          aria-label={`دخول مباشر إلى حساب ${agent.name}`}
                          onClick={() => impersonate.mutate({ agentId: agent.id })}
                          disabled={!agent.enabled || impersonate.isPending}
                          className="btn-press flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-3 py-1.5 text-xs font-extrabold text-white transition-colors duration-200 hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <LogIn className="size-3.5" />
                          دخول مباشر
                        </button>
                        <button
                          aria-label={`تعديل ${agent.name}`}
                          onClick={() => {
                            setEditingId(agent.id);
                            setForm({
                              name: agent.name,
                              email: agent.email,
                              password: "",
                              fullAccess: Boolean(agent.fullAccess),
                              productIds: agent.productIds,
                              notifyNewOrders: agent.notifyNewOrders,
                              notifyStatusChanges: agent.notifyStatusChanges,
                              notifyCancelledOrders: agent.notifyCancelledOrders,
                              notifyUnresponsiveOrders:
                                agent.notifyUnresponsiveOrders,
                              notifyFollowUp: agent.notifyFollowUp,
                              compensationMode: agent.compensationMode,
                              generalOrderRate: agent.generalOrderRate,
                              completedOrderRate: agent.completedOrderRate,
                            });
                            document
                              .getElementById("new-agent")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="btn-press rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--brand)] transition-colors duration-200 hover:bg-[var(--brand-soft)]"
                        >
                          تعديل
                        </button>
                        <button
                          aria-label={`حذف ${agent.name}`}
                          onClick={() => remove.mutate({ agentId: agent.id })}
                          className="btn-press rounded-xl p-2 text-[#A63D28] transition-colors duration-200 hover:bg-[#FCE8E4]"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${agent.enabled ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[#F1F2EC] text-[#8A938D]"}`}
                      >
                        {agent.enabled ? "مفعل" : "متوقف"}
                      </span>
                      <span className="rounded-full bg-[#F1F2EC] px-3 py-1 text-xs font-bold text-[#5C665F]">
                        {agent.productIds.length === 0
                          ? "كل الطلبات"
                          : `${agent.productIds.length} منتج`}
                      </span>
                      <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-bold text-[var(--brand)]">
                        تأكيد {agent.stats.confirmationRate}%
                      </span>
                      <span className="rounded-full bg-[var(--warm-soft)] px-3 py-1 text-xs font-bold text-[var(--warm)]">
                        شحن {agent.stats.shippingRate}%
                      </span>
                      <span className="rounded-full bg-[#F1F2EC] px-3 py-1 text-xs font-bold text-[#5C665F]">
                        {agent.stats.total} طلب
                      </span>
                      <span className="rounded-full bg-[var(--warm-soft)] px-3 py-1 text-xs font-bold text-[var(--warm)]">
                        {agent.compensation.mode === "completed_orders"
                          ? "المكتملة فقط"
                          : "الطلبات العامة"}{" "}
                        · {agent.compensation.rate} دج/طلب
                      </span>
                      <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-bold text-[var(--brand)]">
                        مستحق تقديري {agent.stats.estimatedCompensation} دج
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(
                            `${window.location.origin}/call-center/login`
                          );
                          toast.success("تم نسخ رابط الدخول.");
                        }}
                        className="btn-press rounded-full bg-[#F1F2EC] px-3 py-1 text-xs font-bold text-[#5C665F] transition-colors duration-200 hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                      >
                        نسخ رابط الدخول
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  icon={UsersRound}
                  title="لا توجد حسابات بعد"
                  description="ابدأ بإضافة أول عميل لمركز الاتصال واختر له «صلاحيات كاملة» أو المنتجات المسموحة."
                  action={
                    <Button
                      onClick={() =>
                        document
                          .getElementById("new-agent")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="btn-press rounded-xl bg-[var(--brand)] text-white shadow-cta hover:bg-[var(--brand-strong)]"
                    >
                      <Plus className="ml-2 size-4" />
                      إضافة عميل
                    </Button>
                  }
                />
              )}

              {editingId === null && (
                <button
                  onClick={() => setLocation("/call-center/login")}
                  className="btn-press mt-4 flex items-center gap-2 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-4 py-3 text-sm font-extrabold text-[var(--brand)] transition-colors duration-200 hover:bg-[var(--brand-soft)]/70"
                >
                  <LogIn className="size-4" />
                  فتح صفحة تسجيل الدخول كمعاينة ←
                </button>
              )}
            </div>
          </section>
          <section
            id="new-agent"
            className="h-fit rounded-[20px] border border-[#E7E9E2] bg-white p-5 shadow-soft lg:sticky lg:top-6"
          >
            <h2 className="flex items-center gap-2 font-extrabold text-[#1F2A25]">
              <Plus className="size-5 text-[var(--brand)]" />
              {editingId ? "تعديل حساب العميل" : "إنشاء حساب جديد"}
            </h2>
            <p className="mt-2 text-xs leading-6 text-[#79837D]">
              كلمة المرور تُخزّن كقيمة مشفرة ولا تظهر في قائمة الحسابات. اتركها
              فارغة عند التعديل للحفاظ على الحالية.
            </p>
            <label className="mt-5 block text-sm font-bold text-[#1F2A25]">
              اسم العميل
              <input
                value={form.name}
                onChange={event =>
                  setForm({ ...form, name: event.target.value })
                }
                className={inputClass}
                placeholder="مثال: فريق التأكيد"
              />
            </label>
            <label className="mt-4 block text-sm font-bold text-[#1F2A25]">
              البريد الإلكتروني
              <input
                dir="ltr"
                type="email"
                value={form.email}
                onChange={event =>
                  setForm({ ...form, email: event.target.value })
                }
                className={`${inputClass} text-left`}
                placeholder="agent@example.com"
              />
            </label>
            <label className="mt-4 block text-sm font-bold text-[#1F2A25]">
              كلمة المرور
              <input
                dir="ltr"
                type="password"
                value={form.password}
                onChange={event =>
                  setForm({ ...form, password: event.target.value })
                }
                className={`${inputClass} text-left`}
                placeholder="8 أحرف على الأقل"
              />
            </label>
            <div className="mt-5 rounded-2xl border border-[#E7E9E2] bg-[#FAF9F5] p-3">
              <p className="text-sm font-extrabold text-[#1F2A25]">
                طريقة احتساب التعويض
              </p>
              <p className="mt-1 text-xs leading-5 text-[#79837D]">
                اختر نوع الطلبات التي يستحق عليها العميل السعر المحدد.
              </p>
              <div className="mt-3 grid gap-2">
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs font-bold transition-colors duration-200 ${form.compensationMode === "all_orders" ? "border-[var(--brand)] bg-white shadow-soft" : "border-transparent hover:bg-white/60"}`}
                >
                  <input
                    type="radio"
                    name="compensationMode"
                    checked={form.compensationMode === "all_orders"}
                    onChange={() =>
                      setForm({ ...form, compensationMode: "all_orders" })
                    }
                    className="accent-[var(--brand)]"
                  />
                  <span>
                    <b className="text-[#1F2A25]">تأكيد الطلبات العامة</b>
                    <small className="mt-1 block font-normal text-[#79837D]">
                      يُحتسب السعر لكل طلب مرتبط بالمنتجات المسموحة.
                    </small>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs font-bold transition-colors duration-200 ${form.compensationMode === "completed_orders" ? "border-[var(--brand)] bg-white shadow-soft" : "border-transparent hover:bg-white/60"}`}
                >
                  <input
                    type="radio"
                    name="compensationMode"
                    checked={form.compensationMode === "completed_orders"}
                    onChange={() =>
                      setForm({ ...form, compensationMode: "completed_orders" })
                    }
                    className="accent-[var(--brand)]"
                  />
                  <span>
                    <b className="text-[#1F2A25]">تأكيد الطلبات المكتملة فقط</b>
                    <small className="mt-1 block font-normal text-[#79837D]">
                      يُحتسب السعر فقط عند وصول الطلب إلى «كوموند ليفري».
                    </small>
                  </span>
                </label>
              </div>
              <label className="mt-3 block text-xs font-bold text-[#1F2A25]">
                سعر الطلبات العامة
                <input
                  dir="ltr"
                  inputMode="decimal"
                  value={form.generalOrderRate}
                  onChange={event =>
                    setForm({ ...form, generalOrderRate: event.target.value })
                  }
                  className={`${inputClass} h-10 text-left`}
                  placeholder="0.00"
                />
              </label>
              <label className="mt-3 block text-xs font-bold text-[#1F2A25]">
                سعر الطلبات المكتملة
                <input
                  dir="ltr"
                  inputMode="decimal"
                  value={form.completedOrderRate}
                  onChange={event =>
                    setForm({ ...form, completedOrderRate: event.target.value })
                  }
                  className={`${inputClass} h-10 text-left`}
                  placeholder="0.00"
                />
              </label>
            </div>
            <div className="mt-5 rounded-2xl border border-[#E7E9E2] bg-[#FAF9F5] p-3">
              <p className="text-sm font-extrabold text-[#1F2A25]">
                إشعارات البريد
              </p>
              <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#1F2A25]">
                <input
                  type="checkbox"
                  checked={form.notifyNewOrders}
                  onChange={event =>
                    setForm({ ...form, notifyNewOrders: event.target.checked })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                طلبات جديدة
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs font-bold text-[#1F2A25]">
                <input
                  type="checkbox"
                  checked={form.notifyStatusChanges}
                  onChange={event =>
                    setForm({
                      ...form,
                      notifyStatusChanges: event.target.checked,
                    })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                تغيّر حالة الطلب
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs font-bold text-[#1F2A25]">
                <input
                  type="checkbox"
                  checked={form.notifyCancelledOrders}
                  onChange={event =>
                    setForm({
                      ...form,
                      notifyCancelledOrders: event.target.checked,
                    })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                الطلبات الملغاة
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs font-bold text-[#1F2A25]">
                <input
                  type="checkbox"
                  checked={form.notifyUnresponsiveOrders}
                  onChange={event =>
                    setForm({
                      ...form,
                      notifyUnresponsiveOrders: event.target.checked,
                    })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                الزبون لا يرد أو الهاتف ملغى
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs font-bold text-[#1F2A25]">
                <input
                  type="checkbox"
                  checked={form.notifyFollowUp}
                  onChange={event =>
                    setForm({ ...form, notifyFollowUp: event.target.checked })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                المتابعة والسويفي
              </label>
            </div>
            <div className="mt-5">
              <p className="text-sm font-extrabold text-[#1F2A25]">
                صلاحية الوصول للطلبات
              </p>
              <p className="mt-1 text-xs leading-5 text-[#79837D]">
                اختر صلاحية العميل: صلاحيات كاملة على كل طلبات المتجر (الطلبات،
                تغيير الحالات، تتبع فورشيب)، أو تقييده بمنتجات محددة فقط.
              </p>
              <div className="mt-3 grid gap-2">
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs font-bold transition-colors duration-200 ${form.fullAccess ? "border-[var(--brand)] bg-white shadow-soft" : "border-transparent hover:bg-white/60"}`}
                >
                  <input
                    type="radio"
                    name="accessMode"
                    checked={form.fullAccess}
                    onChange={() =>
                      setForm({ ...form, fullAccess: true, productIds: [] })
                    }
                    className="accent-[var(--brand)]"
                  />
                  <span>
                    <b className="text-[#1F2A25]">صلاحيات كاملة (كل الطلبات)</b>
                    <small className="mt-1 block font-normal text-[#79837D]">
                      يرى العميل كل طلبات المتجر ويغيّر حالاتها ويتتبع فورشيب
                      بدون تقييد بالمنتجات.
                    </small>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs font-bold transition-colors duration-200 ${!form.fullAccess ? "border-[var(--brand)] bg-white shadow-soft" : "border-transparent hover:bg-white/60"}`}
                >
                  <input
                    type="radio"
                    name="accessMode"
                    checked={!form.fullAccess}
                    onChange={() =>
                      setForm({ ...form, fullAccess: false, productIds: [] })
                    }
                    className="accent-[var(--brand)]"
                  />
                  <span>
                    <b className="text-[#1F2A25]">منتجات محددة فقط</b>
                    <small className="mt-1 block font-normal text-[#79837D]">
                      يرى العميل الطلبات المرتبطة بالمنتجات المختارة فقط.
                    </small>
                  </span>
                </label>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-[#1F2A25]">
                  المنتجات المسموحة
                </p>
                {form.fullAccess && (
                  <span className="rounded-full bg-[#4E8A6F]/15 px-2.5 py-1 text-[11px] font-extrabold text-[#2F6B4F]">
                    غير محددة · صلاحيات كاملة
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-[#79837D]">
                {form.fullAccess
                  ? "العميل يشوف كل طلبات المتجر. اختر «منتجات محددة فقط» إذا أردت تقييده."
                  : "اختر المنتجات التي يمكن للعميل تأكيد طلباتها وتتبعها."}
              </p>
              <div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-xl border border-[#E3E1D8] p-2">
                {products.map(product => (
                  <label
                    key={product.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-[#1F2A25] transition-colors duration-200 ${
                      form.fullAccess ? "opacity-55" : "hover:bg-[var(--brand-soft)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={form.fullAccess}
                      checked={
                        form.fullAccess || form.productIds.includes(product.id)
                      }
                      onChange={() => toggleProduct(product.id)}
                      className="size-4 accent-[var(--brand)]"
                    />
                    {product.title}
                  </label>
                ))}
                {!products.length && (
                  <p className="px-2 py-3 text-center text-xs text-[#8A938D]">
                    لا توجد منتجات في المتجر بعد.
                  </p>
                )}
              </div>
            </div>
            <Button
              disabled={
                create.isPending ||
                update.isPending ||
                !form.name ||
                !form.email ||
                (!editingId && form.password.length < 8) ||
                (!form.fullAccess && form.productIds.length === 0)
              }
              onClick={() =>
                editingId
                  ? update.mutate({
                      agentId: editingId,
                      name: form.name,
                      email: form.email,
                      password: form.password || undefined,
                      enabled: true,
                      notifyNewOrders: form.notifyNewOrders,
                      notifyStatusChanges: form.notifyStatusChanges,
                      notifyCancelledOrders: form.notifyCancelledOrders,
                      notifyUnresponsiveOrders: form.notifyUnresponsiveOrders,
                      notifyFollowUp: form.notifyFollowUp,
                      compensationMode: form.compensationMode,
                      generalOrderRate: form.generalOrderRate || "0.00",
                      completedOrderRate: form.completedOrderRate || "0.00",
                      productIds: form.productIds,
                    })
                  : create.mutate(form)
              }
              className="btn-press mt-5 h-11 w-full rounded-xl bg-[var(--brand)] font-extrabold text-white shadow-cta hover:bg-[var(--brand-strong)]"
            >
              {create.isPending || update.isPending
                ? "جارٍ الحفظ..."
                : editingId
                  ? "حفظ التعديلات"
                  : "إنشاء الحساب"}
            </Button>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="btn-press mt-2 w-full text-xs font-bold text-[#79837D] transition-colors duration-200 hover:text-[#1F2A25]"
              >
                إلغاء التعديل
              </button>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function CallCenter() {
  const [location] = useLocation();
  if (location === "/call-center/login" || location === "/call-center/agent")
    return <AgentDashboard />;
  return <CallCenterAdmin />;
}