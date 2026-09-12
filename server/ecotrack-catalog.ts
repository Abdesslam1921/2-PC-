export type EcotrackProviderCatalog = {
  providerKey: string;
  displayName: string;
  bureauAssetUrl: string;
  rateAssetUrl?: string;
};

const catalogs: Array<{ hosts: string[]; catalog: EcotrackProviderCatalog }> = [
  {
    hosts: ["hhdexpress.ecotrack.dz", "hhd.ecotrack.dz"],
    catalog: {
      providerKey: "hhd-express",
      displayName: "HHD EXPRESS",
      bureauAssetUrl: "/manus-storage/ecotrack_bureaux_a23a8ab0.json",
      rateAssetUrl: "/manus-storage/ecotrack_hhd_rates_b58dc660.json",
    },
  },
];

function hostnameOf(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
      .replace(/^www\./, "");
  }
}

export function getEcotrackProviderCatalog(
  apiBaseUrl?: string | null
): EcotrackProviderCatalog | null {
  const hostname = hostnameOf(apiBaseUrl);
  return (
    catalogs.find(entry => entry.hosts.includes(hostname))?.catalog ?? null
  );
}

export function normalizeEcotrackHostname(value?: string | null) {
  return hostnameOf(value);
}

export function listEcotrackCatalogs() {
  return catalogs.flatMap(entry => [entry.catalog]);
}

export const hhdDefaultRates = [
  {
    wilayaCode: "01",
    wilayaName: "Adrar",
    homeFee: "1150",
    officeFee: "550",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "02",
    wilayaName: "Chlef",
    homeFee: "700",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "03",
    wilayaName: "Laghouat",
    homeFee: "750",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "04",
    wilayaName: "Oum El Bouaghi",
    homeFee: "750",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "05",
    wilayaName: "Batna",
    homeFee: "700",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "06",
    wilayaName: "Béjaïa",
    homeFee: "600",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "07",
    wilayaName: "Biskra",
    homeFee: "700",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "08",
    wilayaName: "Béchar",
    homeFee: "1050",
    officeFee: "500",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "09",
    wilayaName: "Blida",
    homeFee: "600",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "10",
    wilayaName: "Bouira",
    homeFee: "550",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "11",
    wilayaName: "Tamanrasset",
    homeFee: "1200",
    officeFee: "600",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "12",
    wilayaName: "Tébessa",
    homeFee: "800",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "13",
    wilayaName: "Tlemcen",
    homeFee: "900",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "14",
    wilayaName: "Tiaret",
    homeFee: "750",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "15",
    wilayaName: "Tizi Ouzou",
    homeFee: "600",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "16",
    wilayaName: "Alger",
    homeFee: "600",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "17",
    wilayaName: "Djelfa",
    homeFee: "700",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "18",
    wilayaName: "Jijel",
    homeFee: "700",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "19",
    wilayaName: "Sétif",
    homeFee: "600",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "20",
    wilayaName: "Saïda",
    homeFee: "850",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "21",
    wilayaName: "Skikda",
    homeFee: "750",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "22",
    wilayaName: "Sidi Bel Abbès",
    homeFee: "850",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "23",
    wilayaName: "Annaba",
    homeFee: "800",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "24",
    wilayaName: "Guelma",
    homeFee: "750",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "25",
    wilayaName: "Constantine",
    homeFee: "700",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "26",
    wilayaName: "Médéa",
    homeFee: "600",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "27",
    wilayaName: "Mostaganem",
    homeFee: "800",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "28",
    wilayaName: "M'Sila",
    homeFee: "600",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "29",
    wilayaName: "Mascara",
    homeFee: "800",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "30",
    wilayaName: "Ouargla",
    homeFee: "900",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "31",
    wilayaName: "Oran",
    homeFee: "850",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "32",
    wilayaName: "El Bayadh",
    homeFee: "850",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "34",
    wilayaName: "Bordj Bou Arreridj",
    homeFee: "550",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "35",
    wilayaName: "Boumerdès",
    homeFee: "550",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "36",
    wilayaName: "El Tarf",
    homeFee: "800",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "38",
    wilayaName: "Tissemsilt",
    homeFee: "700",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "39",
    wilayaName: "El Oued",
    homeFee: "850",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "40",
    wilayaName: "Khenchela",
    homeFee: "750",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "41",
    wilayaName: "Souk Ahras",
    homeFee: "800",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "42",
    wilayaName: "Tipaza",
    homeFee: "600",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "43",
    wilayaName: "Mila",
    homeFee: "700",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "44",
    wilayaName: "Aïn Defla",
    homeFee: "700",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "45",
    wilayaName: "Naâma",
    homeFee: "950",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "46",
    wilayaName: "Aïn Témouchent",
    homeFee: "850",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "47",
    wilayaName: "Ghardaïa",
    homeFee: "850",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "48",
    wilayaName: "Relizane",
    homeFee: "750",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "49",
    wilayaName: "Timimoun",
    homeFee: "1150",
    officeFee: "550",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "51",
    wilayaName: "Ouled Djellal",
    homeFee: "750",
    officeFee: "400",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "52",
    wilayaName: "Beni Abbes",
    homeFee: "1150",
    officeFee: "550",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "53",
    wilayaName: "In Salah",
    homeFee: "1150",
    officeFee: "550",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "55",
    wilayaName: "Touggourt",
    homeFee: "850",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "57",
    wilayaName: "El M'Ghair",
    homeFee: "800",
    officeFee: "450",
    homeEnabled: true,
    officeEnabled: true,
  },
  {
    wilayaCode: "58",
    wilayaName: "El Meniaa",
    homeFee: "1000",
    officeFee: "500",
    homeEnabled: true,
    officeEnabled: true,
  },
] as const;

// أضف روابط الشركات الجديدة هنا عند توفر رابط منصة وصفحة مكاتب موثوقين لها.
export const ecotrackCatalogNote =
  "كل حساب يطابق كتالوج المكاتب بواسطة hostname رابط منصة Ecotrack، ولا تُحفظ التوكنات في هذا الكتالوج.";
