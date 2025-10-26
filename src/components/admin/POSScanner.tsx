import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRScanner } from "./QRScanner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, Trash2, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface POSScannerProps {
  open: boolean;
  onClose: () => void;
}

interface CartItem {
  // qrHash ถูกใช้เป็น Key ID สำหรับ Barcode/QR เพื่อความเข้ากันได้กับโค้ดเดิม
  qrHash: string; 
  product: any;
  option?: any;
  quantity: number;
  isBarcode?: boolean; // เพิ่ม field ระบุว่าเป็น Barcode เพื่อการจัดการที่ไม่ต้อง Hash
}

export function POSScanner({ open, onClose }: POSScannerProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleScan = async (rawCode: string) => {
    
    // กำหนดตัวแปรสำหรับผลลัพธ์การค้นหา
    let productData: any = null;
    let optionData: any = null;
    let scanKey: string = rawCode; // Key ที่ใช้ระบุรายการในตะกร้า
    let isBarcodeScan = false;
    
    try {
        // 1. ตรวจสอบว่าเป็น BARCODE (EAN-13/UPC-A: ตัวเลข 12 หรือ 13 หลัก)
        if (/^\d{12,13}$/.test(rawCode)) {
            isBarcodeScan = true;
            scanKey = `BARCODE-${rawCode}`;
            
            // 1.1 ค้นหาจาก Product Option ก่อน
            const { data: optionMapping, error: optionError } = await (supabase as any)
                .from('product_options')
                .select('*, product:products(*)')
                .eq('ean_code', rawCode) // สมมติว่ามีฟิลด์ ean_code
                .maybeSingle();

            if (optionMapping) {
                productData = optionMapping.product;
                optionData = optionMapping;
            } else {
                // 1.2 ถ้าไม่เจอใน Option ให้ค้นหาจาก Product หลัก
                const { data: productMapping, error: productError } = await (supabase as any)
                    .from('products')
                    .select('*')
                    .eq('ean_code', rawCode) // สมมติว่ามีฟิลด์ ean_code
                    .maybeSingle();
                
                if (productMapping) {
                    productData = productMapping;
                }
            }

            if (!productData) {
                toast.error("ไม่พบสินค้าจากรหัสบาร์โค้ดนี้");
                return;
            }

        } else {
            // 2. ถ้าไม่ใช่ Barcode ให้ถือว่าเป็น QR CODE (ใช้ Hash เหมือนเดิม)
            const qrHash = await hashQR(rawCode);
            scanKey = qrHash;
            
            // Find QR mapping
            const { data: mapping, error } = await (supabase as any)
                .from('qr_map')
                .select('*, product:products(*), option:product_options(*)')
                .eq('qr_hash', qrHash)
                .maybeSingle();

            if (error || !mapping) {
                toast.error("ไม่พบสินค้า QR นี้ยังไม่ได้ผูกกับสินค้า");
                return;
            }
            
            productData = mapping.product;
            optionData = mapping.option;
        }

    } catch (e: any) {
        console.error("Scan/Search Error:", e);
        toast.error("เกิดข้อผิดพลาดในการค้นหาสินค้า");
        return;
    }


    // 3. ตรวจสอบและเพิ่มสินค้าลงในตะกร้า
    
    // Check stock
    const currentStock = optionData
      ? optionData.stock_quantity
      : productData.stock_quantity;

    // Check if already in cart
    const existingItem = cart.find(item => item.qrHash === scanKey);
    const currentQty = existingItem ? existingItem.quantity : 0;

    if (currentQty >= currentStock) {
      toast.error("สต็อกไม่พอ");
      return;
    }

    // Add to cart
    if (existingItem) {
      setCart(cart.map(item =>
        item.qrHash === scanKey
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        qrHash: scanKey,
        product: productData,
        option: optionData || undefined,
        quantity: 1,
        isBarcode: isBarcodeScan,
      }]);
    }

    toast.success(`เพิ่ม ${productData.name} ${optionData?.label || ''} ลงตะกร้าแล้ว`);
    setShowScanner(false);

    // Auto-open scanner again for continuous scanning
    setTimeout(() => setShowScanner(true), 500);
  };

  const updateQuantity = (qrHash: string, newQty: number) => {
    const item = cart.find(i => i.qrHash === qrHash);
    if (!item) return;

    const maxStock = item.option
      ? item.option.stock_quantity
      : item.product.stock_quantity;

    if (newQty > maxStock) {
      toast.error("สต็อกไม่พอ");
      return;
    }

    if (newQty <= 0) {
      setCart(cart.filter(i => i.qrHash !== qrHash));
      return;
    }

    setCart(cart.map(i =>
      i.qrHash === qrHash ? { ...i, quantity: newQty } : i
    ));
  };

  const removeItem = (qrHash: string) => {
    setCart(cart.filter(i => i.qrHash !== qrHash));
  };

  const getItemPrice = (item: CartItem) => {
    return item.option
      ? item.product.base_price + item.option.price_delta
      : item.product.price;
  };

  const total = cart.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error("ตะกร้าว่าง");
      return;
    }

    // Navigate to checkout with cart items
    // This is a simplified version - you may want to integrate with your existing checkout flow
    toast.success(`รวม ${cart.length} รายการ ยอดชำระ ฿${total.toFixed(2)}`);
    
    // TODO: Implement actual checkout flow
    // For now, just clear cart
    setCart([]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              โหมดขาย (POS)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Button
              onClick={() => setShowScanner(true)}
              className="w-full"
              size="lg"
            >
              สแกน Barcode / QR เพิ่มสินค้า
            </Button>

            {cart.length > 0 && (
              <>
                <ScrollArea className="h-[300px] border rounded-lg p-4">
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <Card key={item.qrHash} className="p-3">
                        <div className="flex items-center gap-3">
                          {(item.option?.image_url || item.product.image_url) && (
                            <img
                              src={item.option?.image_url || item.product.image_url}
                              alt=""
                              className="h-12 w-12 rounded object-cover"
                            />
                          )}
                          
                          <div className="flex-1">
                            <p className="font-medium">
                              {item.product.name}
                              {item.isBarcode && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                    BARCODE
                                </Badge>
                              )}
                            </p>
                            {item.option && (
                              <p className="text-sm text-muted-foreground">{item.option.label}</p>
                            )}
                            <p className="text-sm font-semibold">฿{getItemPrice(item)}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.qrHash, parseInt(e.target.value) || 0)}
                              className="w-16 text-center"
                              min={1}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.qrHash)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="text-right min-w-[80px]">
                            <p className="font-semibold">
                              ฿{(getItemPrice(item) * item.quantity).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-lg font-semibold">ยอดรวม</p>
                    <p className="text-2xl font-bold">฿{total.toFixed(2)}</p>
                  </div>

                  <Button
                    onClick={handleCheckout}
                    className="w-full"
                    size="lg"
                  >
                    <Check className="mr-2 h-5 w-5" />
                    ชำระเงิน
                  </Button>
                </div>
              </>
            )}

            {cart.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>ตะกร้าว่าง</p>
                <p className="text-sm">สแกน Barcode หรือ QR เพื่อเพิ่มสินค้า</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <QRScanner
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScan}
        title="สแกน Barcode / QR สินค้า"
        description="สแกนต่อเนื่องเพื่อเพิ่มหลายรายการ"
      />
    </>
  );
}

// Hash function
async function hashQR(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
