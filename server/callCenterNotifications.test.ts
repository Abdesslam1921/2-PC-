import { describe, expect, it } from "vitest";
import { buildCallCenterEmail } from "./callCenterNotifications";

describe("Call Center Gmail notifications", () => {
  it("formats a new-order message with the order identity and delivery details", () => {
    const email = buildCallCenterEmail("new_order", {
      orderNumber: "ABD-000123",
      customerName: "محمد أمين",
      customerPhone: "0550000000",
      total: "8400.00",
      wilaya: "الجزائر",
      deliveryMethod: "home",
      fulfillmentStatus: "new",
    });

    expect(email.subject).toContain("ABD-000123");
    expect(email.body).toContain("محمد أمين");
    expect(email.body).toContain("الجزائر");
    expect(email.body).toContain("التوصيل: منزل");
    expect(email.body).toContain("الحالة: جديد");
  });

  it("labels status-change notifications in Arabic", () => {
    const email = buildCallCenterEmail("status_change", {
      orderNumber: "ABD-000124",
      customerName: "سارة",
      customerPhone: "0660000000",
      total: "2500.00",
      wilaya: "وهران",
      fulfillmentStatus: "confirmed",
    });

    expect(email.subject).toContain("تحديث حالة طلب");
    expect(email.body).toContain("الحالة: مؤكد");
  });
});
