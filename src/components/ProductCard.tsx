import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  stock_quantity: number;
  product_flag?: 'in-stock' | 'preorder' | 'presale';
  has_options?: boolean;
  base_price?: number;
  options_stock_total?: number;
}

export const ProductCard = ({ 
  id, 
  name, 
  price, 
  image_url, 
  stock_quantity,
  product_flag = 'in-stock',
  has_options = false,
  base_price,
  options_stock_total
}: ProductCardProps) => {
  const displayStock = has_options ? (options_stock_total || 0) : stock_quantity;
  const displayPrice = has_options && base_price ? base_price : price;
  
  const getFlagLabel = (flag: string) => {
    switch (flag) {
      case 'preorder': return 'พรีออเดอร์';
      case 'presale': return 'พรีเซล';
      default: return null;
    }
  };
  
  const flagLabel = getFlagLabel(product_flag);
  
  return (
    <Link to={`/product/${id}`}>
      <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <CardContent className="p-0">
          <div className="aspect-square bg-secondary relative overflow-hidden">
            {image_url ? (
              <img 
                src={image_url} 
                alt={name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              </div>
            )}
            {flagLabel && (
              <Badge className="absolute top-2 left-2 bg-primary">
                {flagLabel}
              </Badge>
            )}
            {displayStock < 10 && displayStock > 0 && (
              <Badge variant="destructive" className="absolute top-2 right-2">
                เหลือ {displayStock}
              </Badge>
            )}
            {displayStock === 0 && (
              <Badge variant="secondary" className="absolute top-2 right-2">
                หมด
              </Badge>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-medium text-base mb-2 line-clamp-1">{name}</h3>
            <p className="text-lg font-semibold">
              {has_options ? 'เริ่มต้น ' : ''}฿{displayPrice.toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
