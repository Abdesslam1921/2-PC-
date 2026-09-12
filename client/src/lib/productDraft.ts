export type ProductVariantDraft = {
  id: string;
  color: string;
  size: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  lowStockThreshold: string;
  showStockThreshold: string;
  mediaId: string;
  available: boolean;
};

const cleanValues = (values: string[]) =>
  values.map(value => value.trim()).filter(Boolean);

export function buildVariantDrafts(
  colors: string[],
  sizes: string[],
  basePrice = ""
) {
  const normalizedColors = cleanValues(colors);
  const normalizedSizes = cleanValues(sizes);
  const selectedColors = normalizedColors.length
    ? normalizedColors
    : ["الخيار الافتراضي"];
  const selectedSizes = normalizedSizes.length
    ? normalizedSizes
    : ["الخيار الافتراضي"];

    return selectedColors.flatMap((color, colorIndex) =>
      selectedSizes.map((size, sizeIndex): ProductVariantDraft => ({
        id: `variant-${colorIndex}-${sizeIndex}-${color}-${size}`,
        color,
        size,
        sku: "",
        price: basePrice,
        compareAtPrice: "",
        stock: "0",
        lowStockThreshold: "5",
        showStockThreshold: "50",
        mediaId: "",
        available: true,
      }))
    );
}

export function formatVariantLabel(
  variant: Pick<ProductVariantDraft, "color" | "size">
) {
  return (
    [variant.color, variant.size]
      .filter(value => value !== "الخيار الافتراضي")
      .join(" · ") || "الخيار الافتراضي"
  );
}

export function addOptionValue(values: string[], value: string) {
  const normalized = value.trim();
  return normalized && !values.includes(normalized)
    ? [...values, normalized]
    : values;
}

export function removeOptionValue(values: string[], value: string) {
  return values.filter(item => item !== value);
}
