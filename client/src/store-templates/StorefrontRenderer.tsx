import MarketPro from "./market-pro";
import FashionLuxe from "./fashion-luxe";
import ElectroHub from "./electro-hub";
import BeautyGlow from "./beauty-glow";

interface Props {
  templateKey: string;
  customization: any;
  products?: any[];
  storeName?: string;
}

export default function StorefrontRenderer({
  templateKey,
  customization,
  products,
  storeName,
}: Props) {
  const props = { customization, products, storeName };

  switch (templateKey) {
    case "fashion-luxe":
    case "editorial-boutique":
      return <FashionLuxe {...props} />;
    case "electro-hub":
    case "clean-commerce":
      return <ElectroHub {...props} />;
    case "beauty-glow":
      return <BeautyGlow {...props} />;
    case "market-pro":
    case "nordic-market":
    default:
      return <MarketPro {...props} />;
  }
}
