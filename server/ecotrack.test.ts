import { describe, expect, it, vi } from "vitest";
import {
  createEcotrackOrders,
  extractEcotrackFailures,
  extractEcotrackTrackings,
  getEcotrackTrackingInfo,
  toEcotrackOrder,
} from "./ecotrack";

describe("Ecotrack adapter", () => {
  it("maps a COD order to the documented API fields", () => {
    const order = {
      orderNumber: "ABD-000123",
      customerName: "عميل تجريبي",
      customerPhone: "0555555555",
      address: "حي النخيل",
      municipality: "الدار البيضاء",
      carrierMunicipality: "Casablanca",
      wilaya: "16 · الجزائر",
      total: "2500.00",
      notes: "اتصل قبل الوصول",
      deliveryMethod: "office",
    } as never;
    const mapped = toEcotrackOrder(order, [
      { title: "منتج", quantity: 2 },
    ] as never);
    expect(mapped).toEqual(
      expect.objectContaining({
        reference: "ABD-000123",
        nom_client: "عميل تجريبي",
        telephone: "0555555555",
        commune: "Casablanca",
        code_wilaya: 16,
        montant: "2500.00",
        type: 1,
        stop_desk: 1,
        quantite: "2",
      })
    );
  });

  it("extracts tracking only from successful batch results", () => {
    expect(
      extractEcotrackTrackings({
        results: {
          "ABD-1": { success: true, tracking: "ECT123" },
          "ABD-2": { success: false },
        },
      })
    ).toEqual([{ reference: "ABD-1", tracking: "ECT123" }]);
  });

  it("extracts rejection details without including successful orders", () => {
    expect(
      extractEcotrackFailures({
        results: {
          "ABD-1": { telephone: ["Le champ téléphone est obligatoire."] },
          "ABD-2": { success: true, tracking: "ECT123" },
        },
      })
    ).toEqual([
      { reference: "ABD-1", message: "Le champ téléphone est obligatoire." },
    ]);
  });

  it("translates an unavailable office error for the operator", () => {
    expect(
      extractEcotrackFailures({
        results: {
          "ABD-1": {
            commune: [
              "Aucun bureau n'est disponible pour la commune: Rahmania",
            ],
          },
        },
      })
    ).toEqual([
      {
        reference: "ABD-1",
        message:
          "لا يوجد مكتب Ecotrack متاح لهذه البلدية. اختر التوصيل إلى المنزل أو اختر بلدية فيها مكتب متاح.",
      },
    ]);
  });

  it("rejects more than the documented batch limit before making a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(
      createEcotrackOrders(
        { baseUrl: "https://hhdexpress.ecotrack.dz", token: "secret-token" },
        Array.from({ length: 101 }, (_, index) => ({
          reference: String(index),
          nom_client: "عميل",
          telephone: "0555555555",
          adresse: "عنوان",
          commune: "بلدية",
          code_wilaya: 16,
          montant: "1.00",
          type: "Livraison",
          stop_desk: 0,
        }))
      )
    ).rejects.toThrow("100");
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("throws a not-found error when the tracking was deleted at the carrier", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: false,
            error: 10000,
            message: "Commande inexistante",
          }),
      } as never);
    await expect(
      getEcotrackTrackingInfo(
        { baseUrl: "https://hhdexpress.ecotrack.dz", token: "t" },
        "ECT_DELETED"
      )
    ).rejects.toThrow("not found");
    fetchMock.mockRestore();
  });
});
