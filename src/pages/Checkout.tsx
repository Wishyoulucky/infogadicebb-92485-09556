import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/lib/cart-store";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const checkoutSchema = z.object({
  name: z.string().min(2, "กรุณากรอกชื่อ-นามสกุล"),
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง"),
  phone: z.string().min(10, "กรุณากรอกเบอร์โทรศัพท์"),
  address: z.string().min(10, "กรุณากรอกที่อยู่จัดส่ง"),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

const Checkout = () => {
  const { items, getTotalPrice, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
    },
  });

  const onSubmit = async (values: CheckoutForm) => {
    setIsSubmitting(true);

    try {
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อ");
        navigate("/auth");
        return;
      }

      // Create order with user_id
      const { data: order, error: orderError } = await (supabase.from as any)('orders')
        .insert({
          user_id: session.user.id,
          customer_name: values.name,
          customer_email: values.email,
          customer_phone: values.phone,
          customer_address: values.address,
          total_amount: getTotalPrice(),
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        option_id: item.option_id || null,
        option_label: item.option_label || null,
        option_sku: item.option_sku || null,
        option_image: item.option_image || null,
      }));

      const { error: itemsError } = await (supabase.from as any)('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Update product stock (use RPC for atomic operation to prevent oversell)
      for (const item of items) {
        if (item.option_id) {
          // Deduct stock from option with validation
          const { data: currentOption } = await (supabase.from as any)('product_options')
            .select('stock_quantity')
            .eq('id', item.option_id)
            .single();

          if (!currentOption || currentOption.stock_quantity < item.quantity) {
            throw new Error(`สต็อก ${item.name} ไม่เพียงพอ`);
          }

          const { error: stockError } = await (supabase.from as any)('product_options')
            .update({ stock_quantity: currentOption.stock_quantity - item.quantity })
            .eq('id', item.option_id);

          if (stockError) throw stockError;
        } else {
          // Deduct stock from main product (no options)
          const { data: currentProduct } = await (supabase.from as any)('products')
            .select('stock_quantity')
            .eq('id', item.id)
            .single();

          if (!currentProduct || currentProduct.stock_quantity < item.quantity) {
            throw new Error(`สต็อก ${item.name} ไม่เพียงพอ`);
          }

          const { error: stockError } = await (supabase.from as any)('products')
            .update({ stock_quantity: currentProduct.stock_quantity - item.quantity })
            .eq('id', item.id);

          if (stockError) throw stockError;
        }
      }

      clearCart();
      toast.success("สั่งซื้อสำเร็จ! เลขที่คำสั่งซื้อ: " + order.id.substring(0, 8));
      navigate('/');
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error("เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">ชำระเงิน</h1>
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ชื่อ-นามสกุล</FormLabel>
                          <FormControl>
                            <Input placeholder="กรอกชื่อ-นามสกุล" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>อีเมล</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="example@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>เบอร์โทรศัพท์</FormLabel>
                          <FormControl>
                            <Input placeholder="0xx-xxx-xxxx" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ที่อยู่จัดส่ง</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="กรอกที่อยู่จัดส่งแบบละเอียด" 
                              rows={4}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? "กำลังดำเนินการ..." : "ยืนยันคำสั่งซื้อ"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-20">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">สรุปคำสั่งซื้อ</h2>
                
                <div className="space-y-3 mb-4">
                  {items.map((item) => {
                    const itemKey = item.option_id ? `${item.id}-${item.option_id}` : item.id;
                    return (
                      <div key={itemKey} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.name}
                          {item.option_label && ` (${item.option_label})`} x {item.quantity}
                        </span>
                        <span>฿{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>ยอดรวมทั้งสิ้น</span>
                    <span>฿{getTotalPrice().toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
