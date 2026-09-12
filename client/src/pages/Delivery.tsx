import {
  Building2,
  ChevronLeft,
  CircleDollarSign,
  Download,
  FileUp,
  Home,
  Loader2,
  Save,
  Settings2,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/EmptyState";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Location = { wilaya_code: string; wilaya_name: string };
type Wilaya = { code: string; name: string };
type RateDraft = {
  wilayaCode: string;
  wilayaName: string;
  officeEnabled: boolean;
  officeFee: string;
  homeEnabled: boolean;
  homeFee: string;
};
type SettingsDraft = {
  fixedOfficeEnabled: boolean;
  fixedOfficeFee: string;
  fixedHomeEnabled: boolean;
  fixedHomeFee: string;
  pricingMode: "fixed" | "carrier" | "manual";
  hiddenWilayaCodes: string[];
  customerCarrierChoiceEnabled: boolean;
  wilayaRates: RateDraft[];
};
type View = "chooser" | "configuration" | "carriers";
const locationsUrl = "/manus-storage/algeria_cities_ar_0980081c.json";
const carriers = [
  {
    id: "yalidine",
    name: "Yalidine",
    requirement: "User GUID وAPI Token من بوابة Yalidine",
  },
  {
    id: "zr_express",
    name: "ZR Express",
    requirement: "User GUID وAPI Token من حساب ZR Express",
  },
  {
    id: "noest",
    name: "Noest",
    requirement: "User GUID وAPI Token من حساب Noest",
  },
  {
    id: "ecotrack",
    name: "Ecotrack",
    requirement: "اسم الحساب وUser GUID وAPI Token ورابط منصة شركة التوصيل",
  },
];
const asString = (value: string | null | undefined) => value ?? "00.00";
const createRate = (wilaya: Wilaya): RateDraft => ({
  wilayaCode: wilaya.code,
  wilayaName: wilaya.name,
  officeEnabled: true,
  officeFee: "00.00",
  homeEnabled: true,
  homeFee: "00.00",
});
const parseBoolean = (value: string) =>
  ["true", "1", "yes", "نعم"].includes(value.trim().toLowerCase());

export default function Delivery() {
  const [view, setView] = useState<View>("chooser");
  const utils = trpc.useUtils();
  const settingsQuery = trpc.delivery.getSettings.useQuery();
  const carrierConnectionsQuery = trpc.delivery.carriers.useQuery();
  const [selectedRateCarrierId, setSelectedRateCarrierId] = useState<number>();
  const [carrierRatesDraft, setCarrierRatesDraft] = useState<RateDraft[]>([]);
  const saveCarrierRates = trpc.delivery?.saveCarrierRates?.useMutation?.({
    onSuccess: () => {
      carrierRatesQuery.refetch();
      toast.success("تم حفظ تعريفة شركة التوصيل.");
    },
    onError: error => toast.error(error.message),
  }) ?? { mutate: () => undefined, isPending: false };
  const save = trpc.delivery.saveSettings.useMutation({
    onSuccess: async () => {
      await utils.delivery.getSettings.invalidate();
      toast.success("تم حفظ أسعار التوصيل.");
    },
    onError: error => toast.error(error.message),
  });
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const carrierRatesQuery = trpc.delivery?.carrierRates?.useQuery?.(
    { connectionId: selectedRateCarrierId! },
    { enabled: Boolean(selectedRateCarrierId) }
  ) ?? { data: [], refetch: async () => undefined };
  const [restoreCode, setRestoreCode] = useState("");
  useEffect(() => {
    if (!selectedRateCarrierId || !wilayas.length) return;
    const stored = carrierRatesQuery.data ?? [];
    const map = new Map(stored.map(rate => [rate.wilayaCode, rate]));
    setCarrierRatesDraft(
      wilayas.map(wilaya => {
        const rate = map.get(wilaya.code);
        return rate
          ? {
              wilayaCode: rate.wilayaCode,
              wilayaName: rate.wilayaName,
              officeEnabled: rate.officeEnabled,
              officeFee: asString(rate.officeFee),
              homeEnabled: rate.homeEnabled,
              homeFee: asString(rate.homeFee),
            }
          : createRate(wilaya);
      })
    );
  }, [selectedRateCarrierId, carrierRatesQuery.data, wilayas]);
  const importRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    let active = true;
    fetch(locationsUrl)
      .then(response => (response.ok ? response.json() : Promise.reject()))
      .then((items: Location[]) => {
        if (!active) return;
        setWilayas(
          Array.from(
            new Map(
              items.map(item => [item.wilaya_code, item.wilaya_name])
            ).entries()
          )
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.code.localeCompare(b.code))
        );
      })
      .catch(() => toast.error("تعذر تحميل قائمة الولايات."));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!settingsQuery.data || !wilayas.length || initialized.current) return;
    const hidden = settingsQuery.data.settings.hiddenWilayaCodes ?? [];
    const rateMap = new Map(
      settingsQuery.data.wilayaRates.map(rate => [rate.wilayaCode, rate])
    );
    setDraft({
      fixedOfficeEnabled: settingsQuery.data.settings.fixedOfficeEnabled,
      fixedOfficeFee: asString(settingsQuery.data.settings.fixedOfficeFee),
      fixedHomeEnabled: settingsQuery.data.settings.fixedHomeEnabled,
      fixedHomeFee: asString(settingsQuery.data.settings.fixedHomeFee),
      pricingMode: settingsQuery.data.settings.pricingMode ?? "manual",
      hiddenWilayaCodes: hidden,
      customerCarrierChoiceEnabled:
        settingsQuery.data.settings.customerCarrierChoiceEnabled,
      wilayaRates: wilayas
        .filter(wilaya => !hidden.includes(wilaya.code))
        .map(wilaya => {
          const stored = rateMap.get(wilaya.code);
          return stored
            ? {
                wilayaCode: stored.wilayaCode,
                wilayaName: stored.wilayaName,
                officeEnabled: stored.officeEnabled,
                officeFee: asString(stored.officeFee),
                homeEnabled: stored.homeEnabled,
                homeFee: asString(stored.homeFee),
              }
            : createRate(wilaya);
        }),
    });
    initialized.current = true;
  }, [settingsQuery.data, wilayas]);

  const hiddenWilayas = useMemo(
    () =>
      wilayas.filter(wilaya => draft?.hiddenWilayaCodes.includes(wilaya.code)),
    [draft?.hiddenWilayaCodes, wilayas]
  );
  const update = (patch: Partial<SettingsDraft>) =>
    setDraft(current => (current ? { ...current, ...patch } : current));
  const updateRate = (code: string, patch: Partial<RateDraft>) =>
    setDraft(current =>
      current
        ? {
            ...current,
            wilayaRates: current.wilayaRates.map(rate =>
              rate.wilayaCode === code ? { ...rate, ...patch } : rate
            ),
          }
        : current
    );
  const removeWilaya = (code: string) =>
    setDraft(current =>
      current
        ? {
            ...current,
            hiddenWilayaCodes: [...current.hiddenWilayaCodes, code],
            wilayaRates: current.wilayaRates.filter(
              rate => rate.wilayaCode !== code
            ),
          }
        : current
    );
  const restoreWilaya = () => {
    const wilaya = hiddenWilayas.find(item => item.code === restoreCode);
    if (!wilaya) return;
    setDraft(current =>
      current
        ? {
            ...current,
            hiddenWilayaCodes: current.hiddenWilayaCodes.filter(
              code => code !== wilaya.code
            ),
            wilayaRates: [...current.wilayaRates, createRate(wilaya)].sort(
              (a, b) => a.wilayaCode.localeCompare(b.wilayaCode)
            ),
          }
        : current
    );
    setRestoreCode("");
  };
  const submit = () => {
    if (!draft) return;
    save.mutate({
      fixedOfficeEnabled: draft.fixedOfficeEnabled,
      fixedOfficeFee: draft.fixedOfficeEnabled ? draft.fixedOfficeFee : null,
      fixedHomeEnabled: draft.fixedHomeEnabled,
      fixedHomeFee: draft.fixedHomeEnabled ? draft.fixedHomeFee : null,
      pricingMode: draft.pricingMode,
      hiddenWilayaCodes: draft.hiddenWilayaCodes,
      customerCarrierChoiceEnabled: draft.customerCarrierChoiceEnabled,
      wilayaRates: draft.wilayaRates.map(rate => ({
        ...rate,
        officeFee: rate.officeEnabled ? rate.officeFee : null,
        homeFee: rate.homeEnabled ? rate.homeFee : null,
      })),
    });
  };
  const exportCsv = () => {
    if (!draft) return;
    const rates =
      draft.pricingMode === "carrier" ? carrierRatesDraft : draft.wilayaRates;
    const rows = [
      [
        "wilaya_code",
        "name",
        "price",
        "hide",
        "stopdesk",
        "hidestopdesk",
        "pricestopdesk",
      ],
      ...rates.map(rate => [
        rate.wilayaCode,
        rate.wilayaName,
        rate.homeFee,
        String(rate.homeEnabled),
        `مكتب ${rate.wilayaName}`,
        String(rate.officeEnabled),
        rate.officeFee,
      ]),
    ];
    const blob = new Blob(
      [
        "﻿" +
          rows
            .map(row =>
              row
                .map(cell => `\"${String(cell).replaceAll('"', '""')}\"`)
                .join(",")
            )
            .join("\n"),
      ],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      draft.pricingMode === "carrier"
        ? "carrier_delivery_prices.csv"
        : "manual_delivery_prices.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !draft) return;
    file
      .text()
      .then(text => {
        const rows = text
          .replace(/^﻿/, "")
          .trim()
          .split(/\r?\n/)
          .map(line =>
            line.split(",").map(cell =>
              cell
                .trim()
                .replace(/^\"|\"$/g, "")
                .replaceAll('""', '"')
            )
          );
        const header = rows.shift()?.map(value => value.toLowerCase()) ?? [];
        const index = (name: string) => header.indexOf(name);
        if (
          ![
            "wilaya_code",
            "name",
            "price",
            "hide",
            "hidestopdesk",
            "pricestopdesk",
          ].every(name => index(name) >= 0)
        )
          throw new Error("أعمدة الملف لا تطابق النموذج.");
        const imported = rows
          .filter(row => row[index("wilaya_code")])
          .map(row => ({
            wilayaCode: row[index("wilaya_code")].padStart(2, "0"),
            wilayaName: row[index("name")],
            homeFee: row[index("price")] || "00.00",
            homeEnabled: parseBoolean(row[index("hide")]),
            officeFee: row[index("pricestopdesk")] || "00.00",
            officeEnabled: parseBoolean(row[index("hidestopdesk")]),
          }));
        const importMap = new Map(
          imported.map(rate => [rate.wilayaCode, rate])
        );
        if (draft.pricingMode === "carrier")
          setCarrierRatesDraft(current =>
            current.map(rate =>
              importMap.get(rate.wilayaCode)
                ? { ...rate, ...importMap.get(rate.wilayaCode)! }
                : rate
            )
          );
        else
          update({
            wilayaRates: draft.wilayaRates.map(rate =>
              importMap.get(rate.wilayaCode)
                ? { ...rate, ...importMap.get(rate.wilayaCode)! }
                : rate
            ),
          });
        toast.success(`تم استيراد ${imported.length} ولاية من الملف.`);
      })
      .catch(error =>
        toast.error(
          error instanceof Error ? error.message : "تعذر قراءة ملف الأسعار."
        )
      );
    event.target.value = "";
  };

  if (settingsQuery.isLoading || !draft)
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--brand)]" />
      </div>
    );
  if (view === "chooser") return <DeliveryChooser onSelect={setView} />;
  if (view === "carriers")
    return <CarrierConnections onBack={() => setView("chooser")} />;
  return (
    <div
      className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden"
      dir="rtl"
    >
      <PageIntro
        eyebrow="إدارة الشحن"
        title="كونفيڤيراسيون التوصيل"
        description="58 ولاية جاهزة بأسعار 00.00. عدّل الأسعار يدويًا أو استورد ملف الأسعار دفعة واحدة."
        action={<SaveButton onClick={submit} pending={save.isPending} />}
      />
      <div className="mb-5 rounded-2xl border border-[#E7E9E2] bg-white p-3 shadow-soft">
        <button
          onClick={() => setView("chooser")}
          className="btn-press inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-extrabold text-[var(--brand)] transition-colors duration-200 hover:bg-[var(--brand-soft)]"
        >
          <ChevronLeft className="size-4" />
          أقسام التوصيل
        </button>
      </div>
      <section className="rounded-[24px] border border-[#E7E9E2] bg-white p-5 shadow-soft sm:p-7">
        <h2 className="text-lg font-extrabold text-[#1F2A25]">
          مصدر أسعار التوصيل
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#79837D]">
          اختر مصدرًا واحدًا فقط لرسوم التوصيل.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(
            [
              { value: "fixed", label: "السعر الثابت" },
              { value: "carrier", label: "أسعار شركة التوصيل" },
              { value: "manual", label: "الأسعار اليدوية / الملف" },
            ] as const
          ).map(option => (
            <button
              type="button"
              key={option.value}
              onClick={() => update({ pricingMode: option.value })}
              className={`btn-press rounded-2xl border p-3.5 text-right text-sm font-extrabold transition-colors duration-200 ${draft.pricingMode === option.value ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)] shadow-soft" : "border-[#E7E9E2] bg-white text-[#79837D] hover:border-[#C9CFC2] hover:text-[#1F2A25]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {draft.pricingMode === "fixed" && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FixedMethod
              title="التوصيل إلى المكتب"
              icon={<Building2 className="size-5" />}
              enabled={draft.fixedOfficeEnabled}
              fee={draft.fixedOfficeFee}
              onToggle={() =>
                update({ fixedOfficeEnabled: !draft.fixedOfficeEnabled })
              }
              onFeeChange={fixedOfficeFee => update({ fixedOfficeFee })}
            />
            <FixedMethod
              title="التوصيل إلى المنزل"
              icon={<Home className="size-5" />}
              enabled={draft.fixedHomeEnabled}
              fee={draft.fixedHomeFee}
              onToggle={() =>
                update({ fixedHomeEnabled: !draft.fixedHomeEnabled })
              }
              onFeeChange={fixedHomeFee => update({ fixedHomeFee })}
            />
          </div>
        )}
        {draft.pricingMode === "carrier" && (
          <div className="mt-5 rounded-2xl border border-[#E7E9E2] bg-[#F7F8F4] p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                ref={importRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={importCsv}
              />
              <Button
                variant="outline"
                onClick={() => importRef.current?.click()}
                className="btn-press h-10 rounded-xl border-[#E3E1D8] bg-white text-xs font-extrabold text-[#1F2A25] transition-colors duration-200 hover:bg-[#F5F6F2]"
              >
                <Upload className="ml-1.5 size-4" />
                استيراد تعريفة الشركة
              </Button>
              <Button
                variant="outline"
                onClick={exportCsv}
                className="btn-press h-10 rounded-xl border-[#E3E1D8] bg-white text-xs font-extrabold text-[#1F2A25] transition-colors duration-200 hover:bg-[#F5F6F2]"
              >
                <Download className="ml-1.5 size-4" />
                تصدير تعريفة الشركة
              </Button>
            </div>
            <label className="block text-xs font-extrabold text-[#1F2A25]">
              شركة التوصيل التي ستستعمل تعريفتها
              <select
                value={selectedRateCarrierId ?? ""}
                onChange={event =>
                  setSelectedRateCarrierId(Number(event.target.value))
                }
                className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-bold outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
              >
                <option value="" disabled>
                  اختر شركة مرتبطة
                </option>
                {(carrierConnectionsQuery.data ?? [])
                  .filter(item => item.status === "connected")
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.accountName}
                    </option>
                  ))}
              </select>
            </label>
            {selectedRateCarrierId && (
              <div className="mt-4 space-y-2">
                {carrierRatesDraft.map(rate => (
                  <div
                    key={rate.wilayaCode}
                    className="grid grid-cols-[1fr_1fr_1fr] gap-2 rounded-xl border border-[#EDEFE7] bg-white p-2"
                  >
                    <span className="self-center text-xs font-extrabold text-[#1F2A25]">
                      {rate.wilayaCode} · {rate.wilayaName}
                    </span>
                    <input
                      aria-label={`سعر منزل ${rate.wilayaName}`}
                      value={rate.homeFee}
                      onChange={event =>
                        setCarrierRatesDraft(current =>
                          current.map(item =>
                            item.wilayaCode === rate.wilayaCode
                              ? { ...item, homeFee: event.target.value }
                              : item
                          )
                        )
                      }
                      className="h-9 rounded-lg border border-[#E3E1D8] px-2 text-xs outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                    />
                    <input
                      aria-label={`سعر مكتب ${rate.wilayaName}`}
                      value={rate.officeFee}
                      onChange={event =>
                        setCarrierRatesDraft(current =>
                          current.map(item =>
                            item.wilayaCode === rate.wilayaCode
                              ? { ...item, officeFee: event.target.value }
                              : item
                          )
                        )
                      }
                      className="h-9 rounded-lg border border-[#E3E1D8] px-2 text-xs outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                    />
                  </div>
                ))}
                <Button
                  onClick={() =>
                    saveCarrierRates.mutate({
                      connectionId: selectedRateCarrierId,
                      rates: carrierRatesDraft.map(rate => ({
                        wilayaCode: rate.wilayaCode,
                        wilayaName: rate.wilayaName,
                        officeEnabled: rate.officeEnabled,
                        officeFee: rate.officeFee,
                        homeEnabled: rate.homeEnabled,
                        homeFee: rate.homeFee,
                      })),
                    })
                  }
                  className="btn-press mt-3 h-10 rounded-xl bg-[var(--brand)] px-5 font-extrabold shadow-cta transition-colors duration-200 hover:bg-[var(--brand-strong)]"
                >
                  حفظ تعريفة الشركة
                </Button>
              </div>
            )}
          </div>
        )}
        {draft.pricingMode === "manual" && (
          <div className="mt-5 rounded-2xl border border-[#E7E9E2] bg-[#F7F8F4] p-4">
            <p className="text-sm leading-6 text-[#79837D]">
              الأسعار اليدوية / الملف
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={importRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={importCsv}
              />
              <Button
                variant="outline"
                onClick={() => importRef.current?.click()}
                className="btn-press h-10 rounded-xl border-[#E3E1D8] bg-white text-xs font-extrabold text-[#1F2A25] transition-colors duration-200 hover:bg-[#F5F6F2]"
              >
                <Upload className="ml-1.5 size-4" />
                استيراد الأسعار اليدوية
              </Button>
              <Button
                variant="outline"
                onClick={exportCsv}
                className="btn-press h-10 rounded-xl border-[#E3E1D8] bg-white text-xs font-extrabold text-[#1F2A25] transition-colors duration-200 hover:bg-[#F5F6F2]"
              >
                <Download className="ml-1.5 size-4" />
                تصدير الأسعار اليدوية
              </Button>
            </div>
          </div>
        )}
        <CarrierChoiceSetting
          enabled={draft.customerCarrierChoiceEnabled}
          accountCount={
            new Set(
              (carrierConnectionsQuery.data ?? [])
                .filter(
                  item =>
                    item.provider === "ecotrack" && item.status === "connected"
                )
                .map(item => {
                  try {
                    return new URL(item.apiBaseUrl || "").hostname
                      .toLowerCase()
                      .replace(/^www\./, "");
                  } catch {
                    return item.apiBaseUrl || "";
                  }
                })
            ).size
          }
          onToggle={() =>
            update({
              customerCarrierChoiceEnabled: !draft.customerCarrierChoiceEnabled,
            })
          }
        />
      </section>
      {draft.pricingMode === "manual" && hiddenWilayas.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[#F0E3CF] bg-[var(--warm-soft)] p-3">
          <p className="mr-1 text-xs font-extrabold text-[#7A5B34]">
            ولايات محذوفة:
          </p>
          <select
            aria-label="إرجاع ولاية محذوفة"
            value={restoreCode}
            onChange={event => setRestoreCode(event.target.value)}
            className="h-10 min-w-45 rounded-xl border border-[#EAD9BC] bg-white px-3 text-xs font-bold outline-none transition-colors duration-200 focus:border-[var(--warm)] focus:ring-4 focus:ring-[#DE7C2A]/10"
          >
            <option value="">اختر ولاية لإرجاعها</option>
            {hiddenWilayas.map(wilaya => (
              <option key={wilaya.code} value={wilaya.code}>
                {wilaya.code} · {wilaya.name}
              </option>
            ))}
          </select>
          <Button
            onClick={restoreWilaya}
            disabled={!restoreCode}
            className="btn-press h-10 rounded-xl bg-[#F5E3C8] px-4 text-xs font-extrabold text-[#7A5B34] transition-colors duration-200 hover:bg-[#EFD6AE]"
          >
            إرجاع الولاية
          </Button>
        </div>
      )}
      {draft.pricingMode === "manual" && (
        <section className="mt-5 rounded-[24px] border border-[#E7E9E2] bg-white p-4 shadow-soft sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#1F2A25]">
                أسعار الولايات
              </h2>
              <p className="mt-1 text-sm text-[#79837D]">
                {draft.wilayaRates.length} ولاية مفعّلة.
              </p>
            </div>
            <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand)]">
              {draft.wilayaRates.length}/58
            </span>
          </div>
          {draft.wilayaRates.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="لا توجد ولايات مفعّلة بعد"
              description="أرجِع ولاية من قائمة الولايات المحذوفة أعلاه لضبط أسعارها، أو استورد ملف الأسعار لاستعادتها دفعة واحدة."
            />
          ) : (
            <div className="space-y-3">
              {draft.wilayaRates.map(rate => (
                <WilayaRateRow
                  key={rate.wilayaCode}
                  rate={rate}
                  onUpdate={patch => updateRate(rate.wilayaCode, patch)}
                  onDelete={() => removeWilaya(rate.wilayaCode)}
                />
              ))}
            </div>
          )}
        </section>
      )}
      <div className="mt-6 flex justify-center">
        <SaveButton onClick={submit} pending={save.isPending} />
      </div>
    </div>
  );
}

function DeliveryChooser({ onSelect }: { onSelect: (view: View) => void }) {
  return (
    <div
      className="mx-auto w-full min-w-0 max-w-4xl overflow-x-hidden"
      dir="rtl"
    >
      <PageIntro
        eyebrow="إدارة الشحن"
        title="التوصيل"
        description="اختر ما تريد إدارته: أسعار التوصيل أو ربط شركة الشحن."
      />
      <div className="grid w-full min-w-0 gap-5 md:grid-cols-2">
        <button
          onClick={() => onSelect("configuration")}
          className="btn-press group min-w-0 rounded-[24px] border border-[#E7E9E2] bg-white p-7 text-right shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-[var(--brand)]/30 hover:shadow-lift"
        >
          <div className="grid size-13 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <Settings2 className="size-6" />
          </div>
          <h2 className="mt-6 text-xl font-extrabold text-[#1F2A25]">
            كونفيڤيراسيون التوصيل
          </h2>
          <p className="mt-2 text-sm leading-7 text-[#79837D]">
            عدّل أسعار المكتب والمنزل لكل الولايات، أو استورد ملف الأسعار
            الجاهز.
          </p>
          <span className="mt-6 inline-flex items-center text-sm font-extrabold text-[var(--brand)]">
            فتح الإعدادات
            <ChevronLeft className="mr-1 size-4 transition-transform duration-200 group-hover:-translate-x-1" />
          </span>
        </button>
        <button
          onClick={() => onSelect("carriers")}
          className="btn-press group min-w-0 rounded-[24px] border border-[#E7E9E2] bg-white p-7 text-right shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-[#DE7C2A]/30 hover:shadow-lift"
        >
          <div className="grid size-13 place-items-center rounded-2xl bg-[var(--warm-soft)] text-[var(--warm)]">
            <Truck className="size-6" />
          </div>
          <h2 className="mt-6 text-xl font-extrabold text-[#1F2A25]">
            ربط شركات التوصيل
          </h2>
          <p className="mt-2 text-sm leading-7 text-[#79837D]">
            جهّز بيانات حسابك لربط Yalidine وZR Express وNoest أو Ecotrack.
          </p>
          <span className="mt-6 inline-flex items-center text-sm font-extrabold text-[var(--warm)]">
            فتح الربط
            <ChevronLeft className="mr-1 size-4 transition-transform duration-200 group-hover:-translate-x-1" />
          </span>
        </button>
      </div>
    </div>
  );
}

function CarrierConnections({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [userGuid, setUserGuid] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editToken, setEditToken] = useState("");
  const connectionsQuery = trpc.delivery.carriers.useQuery();
  const connect = trpc.delivery.connectCarrier.useMutation({
    onSuccess: async () => {
      await connectionsQuery.refetch();
      setOpen(null);
      setAccountName("");
      setUserGuid("");
      setApiBaseUrl("");
      setToken("");
      toast.success("تم حفظ بيانات الربط مشفرة وتفعيل الشركة.");
    },
    onError: error => toast.error(error.message),
  });
  const updateAccount = trpc.delivery.updateEcotrackAccount.useMutation({
    onSuccess: async () => {
      await connectionsQuery.refetch();
      setEditingId(null);
      setEditToken("");
      toast.success("تم حفظ تعديلات حساب Ecotrack.");
    },
    onError: error => toast.error(error.message),
  });
  const deleteAccount = trpc.delivery.deleteEcotrackAccount.useMutation({
    onSuccess: async () => {
      await connectionsQuery.refetch();
      toast.success("تم حذف حساب Ecotrack.");
    },
    onError: error => toast.error(error.message),
  });
  const activate = (carrier: (typeof carriers)[number]) => {
    if (
      (carrier.id === "ecotrack" &&
        (!accountName.trim() || !apiBaseUrl.trim())) ||
      (carrier.id !== "ecotrack" && !userGuid.trim()) ||
      !token.trim()
    )
      return toast.error(
        carrier.id === "ecotrack"
          ? "أدخل اسم الحساب ورابط منصة Ecotrack والتوكن أولًا."
          : "أدخل User GUID وAPI Token أولًا."
      );
    connect.mutate({
      provider: carrier.id as "yalidine" | "zr_express" | "noest" | "ecotrack",
      accountName: accountName.trim() || "الحساب الرئيسي",
      userGuid: carrier.id === "ecotrack" ? undefined : userGuid,
      apiBaseUrl: carrier.id === "ecotrack" ? apiBaseUrl : undefined,
      apiToken: token,
    });
  };
  const connectionFor = (id: string) =>
    connectionsQuery.data?.find(item => item.provider === id);
  const ecotrackConnections =
    connectionsQuery.data?.filter(item => item.provider === "ecotrack") ?? [];
  const reset = () => {
    setOpen(null);
    setAccountName("");
    setUserGuid("");
    setApiBaseUrl("");
    setToken("");
  };
  return (
    <div className="mx-auto max-w-5xl" dir="rtl">
      <PageIntro
        eyebrow="إدارة الشحن"
        title="ربط شركات التوصيل"
        description="أدخل بيانات الشركة فقط عبر التخزين الآمن عند طلب التفعيل. لا تحفظ رموز API في متصفحك."
        action={
          <button
            onClick={onBack}
            className="btn-press inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-extrabold text-[var(--brand)] transition-colors duration-200 hover:bg-[var(--brand-soft)]"
          >
            <ChevronLeft className="size-4" />
            أقسام التوصيل
          </button>
        }
      />
      <div className="grid gap-5 md:grid-cols-2">
        {carriers.map(carrier => {
          const linked =
            carrier.id === "ecotrack"
              ? ecotrackConnections.some(item => item.status === "connected")
              : connectionFor(carrier.id)?.status === "connected";
          return (
            <div
              key={carrier.name}
              className="rounded-[24px] border border-[#E7E9E2] bg-white p-6 shadow-soft transition-shadow duration-200 hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1F2A25]">
                    {carrier.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#79837D]">
                    {carrier.id === "ecotrack"
                      ? "أضف اسم الحساب ورابط منصة API Standard وAPI Token من زر Voir Token"
                      : carrier.requirement}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${linked ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[#F1F3EE] text-[#8A938D]"}`}
                >
                  {linked ? "مربوط" : "غير مربوط"}
                </span>
              </div>
              {carrier.id === "ecotrack" && ecotrackConnections.length > 0 && (
                <div className="mt-4 space-y-2 rounded-2xl bg-[#F7F8F4] p-3">
                  <p className="text-xs font-extrabold text-[#1F2A25]">
                    حسابات Ecotrack المضافة ({ecotrackConnections.length}/10)
                  </p>
                  {ecotrackConnections.map(item =>
                    editingId === item.id ? (
                      <div
                        key={item.id}
                        className="space-y-2 rounded-xl border border-[#EDEFE7] bg-white p-3"
                      >
                        <input
                          aria-label="تعديل اسم حساب Ecotrack"
                          value={editName}
                          onChange={event => setEditName(event.target.value)}
                          className="h-9 w-full rounded-lg border border-[#E3E1D8] px-2 text-xs outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                        />
                        <input
                          aria-label="تعديل رابط منصة Ecotrack"
                          value={editUrl}
                          onChange={event => setEditUrl(event.target.value)}
                          className="h-9 w-full rounded-lg border border-[#E3E1D8] px-2 text-xs outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                        />
                        <input
                          aria-label="تغيير API Token"
                          type="password"
                          value={editToken}
                          onChange={event => setEditToken(event.target.value)}
                          placeholder="اتركه فارغًا للإبقاء على التوكن الحالي"
                          className="h-9 w-full rounded-lg border border-[#E3E1D8] px-2 text-xs outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={updateAccount.isPending}
                            onClick={() =>
                              updateAccount.mutate({
                                connectionId: item.id,
                                accountName: editName,
                                apiBaseUrl: editUrl,
                                ...(editToken.trim()
                                  ? { apiToken: editToken }
                                  : {}),
                              })
                            }
                            className="btn-press rounded-lg bg-[var(--brand)] font-extrabold hover:bg-[var(--brand-strong)]"
                          >
                            حفظ التعديلات
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                            className="btn-press rounded-lg border-[#E3E1D8] font-extrabold"
                          >
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#EDEFE7] bg-white px-3 py-2 text-xs"
                      >
                        <span className="font-extrabold text-[#1F2A25]">
                          {item.accountName}
                        </span>
                        <span
                          className={`mr-auto font-extrabold ${item.status === "connected" ? "text-[var(--brand)]" : "text-[#8A938D]"}`}
                        >
                          {item.status === "connected" ? "مفعّل" : "غير مفعّل"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditName(item.accountName);
                            setEditUrl(item.apiBaseUrl ?? "");
                            setEditToken("");
                          }}
                          className="btn-press font-extrabold text-[var(--brand)] underline underline-offset-2"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`حذف حساب ${item.accountName}؟`))
                              deleteAccount.mutate({ connectionId: item.id });
                          }}
                          className="btn-press font-extrabold text-[#A63D28] underline underline-offset-2"
                        >
                          حذف
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
              {open === carrier.name ? (
                <div className="mt-5 space-y-3 rounded-2xl bg-[#F7F8F4] p-4">
                  {carrier.id === "ecotrack" && (
                    <label className="block text-xs font-extrabold text-[#1F2A25]">
                      اسم الحساب (إجباري)
                      <input
                        value={accountName}
                        onChange={event => setAccountName(event.target.value)}
                        placeholder="مثال: HHD EXPRESS"
                        className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-semibold outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                      />
                    </label>
                  )}
                  {carrier.id === "ecotrack" && (
                    <label className="block text-xs font-extrabold text-[#1F2A25]">
                      رابط منصة Ecotrack
                      <input
                        type="url"
                        value={apiBaseUrl}
                        onChange={event => setApiBaseUrl(event.target.value)}
                        placeholder="https://hhdexpress.ecotrack.dz"
                        className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-semibold outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                      />
                    </label>
                  )}
                  {carrier.id !== "ecotrack" && (
                    <label className="block text-xs font-extrabold text-[#1F2A25]">
                      User GUID
                      <input
                        value={userGuid}
                        onChange={event => setUserGuid(event.target.value)}
                        placeholder="من حساب شركة التوصيل"
                        className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-semibold outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                      />
                    </label>
                  )}
                  <label className="block text-xs font-extrabold text-[#1F2A25]">
                    API Token من{" "}
                    {carrier.id === "ecotrack" ? "Voir Token" : "حساب الشركة"}
                    <input
                      type="password"
                      value={token}
                      onChange={event => setToken(event.target.value)}
                      placeholder="لا يظهر بعد الحفظ"
                      className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-semibold outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      disabled={connect.isPending}
                      onClick={() => activate(carrier)}
                      className="btn-press h-10 flex-1 rounded-xl bg-[var(--brand)] text-xs font-extrabold shadow-cta transition-colors duration-200 hover:bg-[var(--brand-strong)]"
                    >
                      {connect.isPending
                        ? "جارٍ الحفظ…"
                        : carrier.id === "ecotrack"
                          ? "حفظ الحساب"
                          : "تفعيل الربط"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={reset}
                      className="btn-press h-10 rounded-xl border-[#E3E1D8] text-xs font-extrabold transition-colors duration-200 hover:bg-white"
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  disabled={
                    carrier.id === "ecotrack" &&
                    ecotrackConnections.length >= 10
                  }
                  onClick={() => {
                    reset();
                    setOpen(carrier.name);
                  }}
                  className="btn-press mt-5 h-11 w-full rounded-xl bg-[var(--brand-soft)] text-sm font-extrabold text-[var(--brand)] transition-colors duration-200 hover:bg-[#DFEDE4]"
                >
                  <FileUp className="ml-2 size-4" />
                  {carrier.id === "ecotrack"
                    ? ecotrackConnections.length
                      ? "إضافة حساب آخر"
                      : "ربط مع شركة التوصيل"
                    : linked
                      ? "تعديل بيانات الربط"
                      : "ربط الشركة"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6 rounded-2xl border border-[#F0E3CF] bg-[var(--warm-soft)] p-4 text-sm leading-7 text-[#7A5B34]">
        <CircleDollarSign className="ml-2 inline size-4 text-[var(--warm)]" />
        بعد حفظ الربط، لن تُعرض قيمة التوكن. الرفع الجماعي والبوليصة يُفعّلان
        فقط بعد اختبار API الرسمي للشركة.
      </div>
    </div>
  );
}

function CarrierChoiceSetting({
  enabled,
  accountCount,
  onToggle,
}: {
  enabled: boolean;
  accountCount: number;
  onToggle: () => void;
}) {
  const available = accountCount > 1;
  return (
    <div
      className={`mt-5 rounded-2xl border p-4 transition-colors duration-200 ${available ? "border-[var(--brand)]/20 bg-[var(--brand-soft)]" : "border-[#E7E9E2] bg-[#F7F8F4]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[#1F2A25]">
            السماح للزبون باختيار شركة التوصيل
          </p>
          <p className="mt-1 text-xs leading-5 text-[#79837D]">
            {available
              ? "عند التفعيل يختار الزبون شركة التوصيل، ثم المكتب عند اختيار Stop Desk."
              : "يتفعّل هذا الخيار تلقائيًا بعد ربط حسابي Ecotrack أو أكثر."}
          </p>
        </div>
        <button
          type="button"
          disabled={!available}
          onClick={onToggle}
          aria-label="السماح للزبون باختيار شركة التوصيل"
          aria-pressed={enabled}
          className={`btn-press relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${enabled && available ? "bg-[var(--brand)]" : "bg-[#D9DDD6]"}`}
        >
          <span
            className={`absolute top-1 size-4 rounded-full bg-white shadow transition-all duration-200 ${enabled && available ? "right-6" : "right-1"}`}
          />
        </button>
      </div>
    </div>
  );
}

function SaveButton({
  onClick,
  pending,
}: {
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={pending}
      className="btn-press h-11 rounded-xl bg-[var(--brand)] px-5 font-extrabold text-white shadow-cta transition-colors duration-200 hover:bg-[var(--brand-strong)]"
    >
      {pending ? (
        <Loader2 className="ml-2 size-4 animate-spin" />
      ) : (
        <Save className="ml-2 size-4" />
      )}
      {pending ? "جارٍ الحفظ…" : "حفظ الأسعار"}
    </Button>
  );
}
function FixedMethod({
  title,
  icon,
  enabled,
  fee,
  onToggle,
  onFeeChange,
}: {
  title: string;
  icon: React.ReactNode;
  enabled: boolean;
  fee: string;
  onToggle: () => void;
  onFeeChange: (value: string) => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition-colors duration-200 ${enabled ? "border-[var(--brand)]/20 bg-[var(--brand-soft)]" : "border-[#E7E9E2] bg-[#F7F8F4]"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-[#1F2A25]">
          {icon}
          {title}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={enabled}
          className={`btn-press relative h-6 w-11 rounded-full transition-colors duration-200 ${enabled ? "bg-[var(--brand)]" : "bg-[#D9DDD6]"}`}
        >
          <span
            className={`absolute top-1 size-4 rounded-full bg-white shadow transition-all duration-200 ${enabled ? "right-6" : "right-1"}`}
          />
        </button>
      </div>
      {enabled && (
        <label className="mt-4 block text-xs font-bold text-[#79837D]">
          السعر بالدينار
          <input
            inputMode="decimal"
            value={fee}
            onChange={event => onFeeChange(event.target.value)}
            placeholder="00.00"
            className="mt-2 h-11 w-full rounded-xl border border-[#E3E1D8] bg-white px-3 text-sm font-extrabold outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
          />
        </label>
      )}
    </div>
  );
}
function WilayaRateRow({
  rate,
  onUpdate,
  onDelete,
}: {
  rate: RateDraft;
  onUpdate: (patch: Partial<RateDraft>) => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-2xl border border-[#E7E9E2] bg-[#FBFBF8] p-4 transition-shadow duration-200 hover:shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#1F2A25]">
            {rate.wilayaCode} · {rate.wilayaName}
          </h3>
          <p className="mt-1 text-xs text-[#8A938D]">أسعار خاصة بهذه الولاية</p>
        </div>
        <button
          aria-label={`حذف ${rate.wilayaName}`}
          onClick={onDelete}
          className="btn-press grid size-9 place-items-center rounded-xl text-[#A63D28] transition-colors duration-200 hover:bg-[#FCE8E4]"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <RateInput
          title="التوصيل إلى المكتب"
          enabled={rate.officeEnabled}
          fee={rate.officeFee}
          onToggle={() => onUpdate({ officeEnabled: !rate.officeEnabled })}
          onFeeChange={officeFee => onUpdate({ officeFee })}
        />
        <RateInput
          title="التوصيل إلى المنزل"
          enabled={rate.homeEnabled}
          fee={rate.homeFee}
          onToggle={() => onUpdate({ homeEnabled: !rate.homeEnabled })}
          onFeeChange={homeFee => onUpdate({ homeFee })}
        />
      </div>
    </article>
  );
}
function RateInput({
  title,
  enabled,
  fee,
  onToggle,
  onFeeChange,
}: {
  title: string;
  enabled: boolean;
  fee: string;
  onToggle: () => void;
  onFeeChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[#E7E9E2] bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold text-[#1F2A25]">{title}</p>
        <button
          type="button"
          onClick={onToggle}
          className={`btn-press rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-colors duration-200 ${enabled ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[#F1F3EE] text-[#8A938D]"}`}
        >
          {enabled ? "مفعّل" : "غير مفعّل"}
        </button>
      </div>
      {enabled && (
        <label className="mt-3 block text-[11px] font-bold text-[#8A938D]">
          السعر
          <input
            inputMode="decimal"
            value={fee}
            onChange={event => onFeeChange(event.target.value)}
            placeholder="00.00"
            className="mt-1.5 h-10 w-full rounded-lg border border-[#E3E1D8] px-3 text-sm font-extrabold outline-none transition-colors duration-200 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
          />
        </label>
      )}
    </div>
  );
}
