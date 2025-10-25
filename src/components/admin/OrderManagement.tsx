import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { OrderDetail } from "./OrderDetail";
import { Eye } from "lucide-react";

export const OrderManagement = () => {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: orders } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('orders')
        .select(`
          *,
          order_items (
            *,
            products (name)
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from as any)('orders')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success("อัพเดทสถานะสำเร็จ");
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      confirmed: "default",
      shipped: "default",
      cancelled: "destructive",
    };

    const labels: Record<string, string> = {
      pending: "รอชำระเงิน",
      confirmed: "ชำระเงินแล้ว",
      shipped: "จัดส่งแล้ว",
      cancelled: "ยกเลิก",
    };

    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">คำสั่งซื้อทั้งหมด</h2>

      <div className="space-y-4">
        {orders?.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">เลขที่: {order.id.substring(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at), 'PPP HH:mm', { locale: th })}
                    </p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold mb-1">ข้อมูลลูกค้า</p>
                    <p>{order.customer_name}</p>
                    <p className="text-muted-foreground">{order.customer_email}</p>
                    <p className="text-muted-foreground">{order.customer_phone}</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">ที่อยู่จัดส่ง</p>
                    <p className="text-muted-foreground">{order.customer_address}</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold mb-2">รายการสินค้า</p>
                  <div className="space-y-1">
                    {order.order_items?.map((item: any) => (
                      <div key={item.id} className="text-sm text-muted-foreground flex justify-between">
                        <span>
                          {item.products?.name}
                          {item.option_label && <span className="ml-1">({item.option_label})</span>}
                          {item.option_sku && <span className="ml-1 text-xs">SKU: {item.option_sku}</span>}
                          {" x "}{item.quantity}
                        </span>
                        <span>฿{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {
                    (() => {
                      const itemsTotal = (order.order_items || []).reduce((s: number, it: any) => s + (it.price * it.quantity), 0);
                      const shipping = typeof order.shipping_amount === 'number' ? order.shipping_amount : Math.max(0, (order.total_amount || 0) - itemsTotal);
                      return (
                        <>
                          <p className="font-semibold mt-2">ค่าจัดส่ง: ฿{Number(shipping || 0).toFixed(2)}</p>
                          <p className="font-semibold mt-2">ยอดรวม: ฿{Number(order.total_amount || 0).toFixed(2)}</p>
                        </>
                      );
                    })()
                  }
                </div>

                {order.tracking_number && (
                  <div className="bg-secondary/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">หมายเลขพัสดุ</p>
                    <p className="font-mono text-sm">{order.tracking_number}</p>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    ดูรายละเอียด
                  </Button>
                  
                  {order.status === 'pending' && (
                    <>
                      <Button 
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'confirmed' })}
                      >
                        ยืนยันชำระเงิน
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'cancelled' })}
                      >
                        ยกเลิก
                      </Button>
                    </>
                  )}
                  {order.status === 'confirmed' && (
                    <Button 
                      size="sm"
                      onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'shipped' })}
                    >
                      จัดส่งแล้ว
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedOrderId && (
        <OrderDetail
          orderId={selectedOrderId}
          isOpen={!!selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
};
