import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartStore } from "@/lib/cart-store";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Minus, Plus, ShoppingCart, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [selectedMain, setSelectedMain] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('products')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: options } = useQuery({
    queryKey: ['product-options', id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('product_options')
        .select('*')
        .eq('product_id', id)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Handle URL param for pre-selected option
  useEffect(() => {
    const optParam = searchParams.get('opt');
    if (optParam && options) {
      const option = options.find(o => o.sku === optParam || o.label === optParam);
      if (option) {
        setSelectedOption(option);
        if (option.image_url) setSelectedImage(option.image_url);
        setSelectedMain(false);
      } else if (optParam === 'product') {
        // opt=product selects the main product explicitly
        setSelectedOption(null);
        setSelectedMain(true);
      }
    }
  }, [searchParams, options]);

  // Update image when option selected
  useEffect(() => {
    if (selectedOption?.image_url) {
      setSelectedImage(selectedOption.image_url);
      setSelectedMain(false);
    } else if (selectedMain) {
      setSelectedImage(product?.image_url ?? null);
    } else if (product?.image_url) {
      setSelectedImage(product.image_url);
    }
  }, [selectedOption, product, selectedMain]);

  const handleAddToCart = async () => {
    if (!product) return;

    // If product has options, user must select an option OR explicitly choose the main product
    if (options && options.length > 0 && !selectedOption && !selectedMain) {
      toast.error("กรุณาเลือกตัวเลือกสินค้า");
      return;
    }

    let stockToCheck, priceToUse, imageToUse, skuToUse;
    let optionData = {};

  if (selectedOption) {
      // Validate stock in real-time from database
      const { data: optionCheck } = await (supabase.from as any)('product_options')
        .select('stock_quantity')
        .eq('id', selectedOption.id)
        .single();

      if (!optionCheck || optionCheck.stock_quantity < quantity) {
        toast.error("สต็อกไม่เพียงพอ");
        return;
      }

      stockToCheck = optionCheck.stock_quantity;
      priceToUse = selectedOption.discount_price || (product.base_price + selectedOption.price_delta);
      imageToUse = selectedOption.image_url || product.image_url;
      skuToUse = selectedOption.sku;
      
      optionData = {
        option_id: selectedOption.id,
        option_label: selectedOption.label,
        option_sku: selectedOption.sku,
        option_image: selectedOption.image_url,
      };
    } else {
      // Main product selected (or no options exist) - use base product
      if (product.stock_quantity < quantity) {
        toast.error("สต็อกไม่เพียงพอ");
        return;
      }
      
      stockToCheck = product.stock_quantity;
      priceToUse = product.price;
      imageToUse = product.image_url;
      skuToUse = undefined;
    }

    if (stockToCheck === 0) {
      toast.error("สินค้าหมดแล้ว");
      return;
    }

    addItem({
      id: product.id,
      name: product.name,
      price: priceToUse,
      quantity,
      image_url: imageToUse || undefined,
      stock_quantity: stockToCheck,
      sku: skuToUse,
      ...optionData,
    });

    toast.success("เพิ่มสินค้าในตะกร้าแล้ว");
  };

  const getProductFlag = (flag: string) => {
    switch (flag) {
      case 'preorder': return 'พรีออเดอร์';
      case 'presale': return 'ขายล่วงหน้า';
      default: return 'พร้อมส่ง';
    }
  };

  const getCurrentPrice = () => {
    if (!product) return 0;
    if (selectedOption) {
      return selectedOption.discount_price || (product.base_price + selectedOption.price_delta);
    }
    if (selectedMain) return product.price;
    return product.price;
  };

  const getCurrentStock = () => {
    if (selectedOption) return selectedOption.stock_quantity;
    if (selectedMain) return product?.stock_quantity || 0;
    if (options && options.length > 0) return product?.options_stock_total || 0;
    return product?.stock_quantity || 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-2 gap-12">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">ไม่พบสินค้า</h1>
          <Button onClick={() => navigate('/')}>กลับหน้าแรก</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="aspect-square bg-secondary rounded-lg overflow-hidden relative">
            {selectedImage || product.image_url ? (
              <img 
                src={selectedImage || product.image_url!} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Package className="w-32 h-32" strokeWidth={1} />
              </div>
            )}
            {product.product_flag && product.product_flag !== 'in-stock' && (
              <Badge className="absolute top-4 right-4">
                {getProductFlag(product.product_flag)}
              </Badge>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-semibold">฿{getCurrentPrice().toFixed(2)}</p>
                {selectedOption?.discount_price && (
                  <p className="text-xl text-muted-foreground line-through">
                    ฿{(product.base_price + selectedOption.price_delta).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* Product Options */}
            {options && options.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">เลือกตัวเลือก</Label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Main product selectable card */}
                  <button
                    key="__main"
                    onClick={() => {
                      if ((product.stock_quantity || 0) > 0) {
                        setSelectedOption(null);
                        setSelectedMain(true);
                        setQuantity(1);
                      }
                    }}
                    disabled={(product.stock_quantity || 0) === 0}
                    className={cn(
                      "relative p-4 border-2 rounded-lg text-left transition-all",
                      selectedMain
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                      (product.stock_quantity || 0) === 0 && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="font-semibold mb-1">{product.name} (ตัวสินค้า)</div>
                    <div className="text-sm">฿{product.price?.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {product.stock_quantity > 0 ? `คงเหลือ ${product.stock_quantity}` : 'หมดแล้ว'}
                    </div>
                    {product.stock_quantity === 0 && (
                      <Badge variant="destructive" className="absolute top-2 right-2 text-xs">หมด</Badge>
                    )}
                  </button>

                  {options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (option.stock_quantity > 0) {
                          setSelectedOption(option);
                          setSelectedMain(false);
                          setQuantity(1);
                        }
                      }}
                      disabled={option.stock_quantity === 0}
                      className={cn(
                        "relative p-4 border-2 rounded-lg text-left transition-all",
                        selectedOption?.id === option.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                        option.stock_quantity === 0 && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="font-semibold mb-1">{option.label}</div>
                      <div className="text-sm">
                        ฿{(option.discount_price || (product.base_price + option.price_delta)).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {option.stock_quantity > 0 ? `คงเหลือ ${option.stock_quantity}` : 'หมดแล้ว'}
                      </div>
                      {option.stock_quantity === 0 && (
                        <Badge variant="destructive" className="absolute top-2 right-2 text-xs">หมด</Badge>
                      )}
                    </button>
                  ))}
                </div>
                {selectedOption && (
                  <p className="text-sm text-muted-foreground"> {selectedOption.sku}</p>
                )}
              </div>
            )}

            {product.description && (
              <div>
                <h2 className="text-lg font-semibold mb-2">รายละเอียด</h2>
                <p className="text-muted-foreground">{product.description}</p>
              </div>
            )}

            {product.box_set_info && (
              <div className="bg-secondary/50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-2">ข้อมูล Box Set</h2>
                <p className="text-muted-foreground">{product.box_set_info}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground mb-2">
                คงเหลือ: <span className="font-semibold">{getCurrentStock()}</span> ชิ้น
              </p>
              {product.product_flag !== 'in-stock' && product.eta_date && (
                <p className="text-sm text-muted-foreground">
                  ETA: {new Date(product.eta_date).toLocaleDateString('th-TH')}
                </p>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">จำนวน:</span>
              <div className="flex items-center border rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.min(getCurrentStock(), quantity + 1))}
                  disabled={quantity >= getCurrentStock()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <Button 
              size="lg" 
              className="w-full"
              onClick={handleAddToCart}
              disabled={getCurrentStock() === 0 || (options && options.length > 0 && !selectedOption && !selectedMain)}
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              {getCurrentStock() === 0 
                ? "สินค้าหมด" 
                : options && options.length > 0 && !selectedOption && !selectedMain
                ? "กรุณาเลือกตัวเลือก"
                : product.product_flag === 'preorder'
                ? "พรีออเดอร์"
                : product.product_flag === 'presale'
                ? "สั่งจองล่วงหน้า"
                : "เพิ่มลงตะกร้า"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
