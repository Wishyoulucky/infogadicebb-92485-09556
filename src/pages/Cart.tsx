import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCartStore } from "@/lib/cart-store";
import { Trash2, Minus, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Cart = () => {
  const { items, removeItem, updateQuantity, getTotalPrice } = useCartStore();
  const navigate = useNavigate();
  const [shipping, setShipping] = useState<number>(0);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl font-bold mb-4">ตะกร้าสินค้าว่างเปล่า</h1>
          <p className="text-muted-foreground mb-8">เพิ่มสินค้าเข้าตะกร้าเพื่อดำเนินการต่อ</p>
          <Link to="/">
            <Button size="lg">เลือกซื้อสินค้า</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">ตะกร้าสินค้า</h1>
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const itemKey = item.option_id ? `${item.id}-${item.option_id}` : item.id;
              return (
              <Card key={itemKey}>
                <CardContent className="p-6">
                   <div className="flex gap-4">
                     <div className="w-24 h-24 bg-secondary rounded-md overflow-hidden flex-shrink-0">
                       {(item.option_image || item.image_url) ? (
                         <img 
                           src={item.option_image || item.image_url} 
                           alt={item.name}
                           className="w-full h-full object-cover"
                         />
                       ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                            <circle cx="9" cy="9" r="2"/>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                          </svg>
                        </div>
                      )}
                    </div>
                     
                     <div className="flex-1">
                       <h3 className="font-semibold mb-2">{item.name}</h3>
                       {item.option_label && (
                         <p className="text-sm text-muted-foreground mb-1">
                           ตัวเลือก: {item.option_label}
                         </p>
                       )}
                       {item.option_sku && (
                         <p className="text-xs text-muted-foreground mb-2">
                           SKU: {item.option_sku}
                         </p>
                       )}
                       <p className="text-lg font-semibold mb-3">฿{item.price.toFixed(2)}</p>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center border rounded-md">
                           <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-10 text-center text-sm">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                            disabled={item.quantity >= item.stock_quantity}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeItem(itemKey)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-semibold">฿{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
            })}
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-20">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">สรุปคำสั่งซื้อ</h2>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ยอดรวม</span>
                    <span className="font-semibold">฿{getTotalPrice().toFixed(2)}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <Label>ค่าส่ง (฿)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={shipping}
                    onChange={(e) => setShipping(parseFloat(e.target.value || '0'))}
                  />
                </div>

                <div className="border-t pt-4 mb-4">
                  <div className="flex justify-between font-semibold">
                    <span>ค่าส่ง</span>
                    <span>฿{Number(shipping || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg mt-2">
                    <span>ยอดรวมทั้งสิ้น</span>
                    <span>฿{(getTotalPrice() + Number(shipping || 0)).toFixed(2)}</span>
                  </div>
                </div>

                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => navigate('/checkout', { state: { shipping: Number(shipping || 0) } })}
                >
                  ดำเนินการชำระเงิน
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
