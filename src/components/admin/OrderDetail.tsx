import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Package, Truck, CheckCircle, XCircle } from "lucide-react";

interface OrderDetailProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetail = ({ orderId, isOpen, onClose }: OrderDetailProps) => {
  const [trackingNumber, setTrackingNumber] = useState("");
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('orders')
        .select(`
          *,
          order_items (
            *,
            products (name, image_url)
          )
        `)
        .eq('id', orderId)
        .single();
      
      if (error) throw error;
      return data as any;
    },
    enabled: isOpen && !!orderId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error} = await (supabase.from as any)('orders')
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      toast.success("อัปเดตสถานะสำเร็จ");
    },
  });

  const updateTrackingMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from as any)('orders')
        .update({ tracking_number: trackingNumber })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      toast.success("อัปเดต Tracking Number สำเร็จ");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Package className="w-3 h-3 mr-1" />รอชำระเงิน</Badge>;
      case 'confirmed':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />ชำระเงินแล้ว</Badge>;
      case 'shipped':
        return <Badge><Truck className="w-3 h-3 mr-1" />จัดส่งแล้ว</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />ยกเลิก</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading || !order) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <div>กำลังโหลด...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>รายละเอียดคำสั่งซื้อ #{order.id.substring(0, 8)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">สถานะคำสั่งซื้อ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {getStatusBadge(order.status)}
                <span className="text-sm text-muted-foreground">
                  {new Date(order.created_at).toLocaleString('th-TH')}
                </span>
              </div>

              {/* Status Update Buttons */}
              <div className="flex flex-wrap gap-2">
                {order.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => updateStatusMutation.mutate('confirmed')}
                  >
                    ยืนยันชำระเงิน
                  </Button>
                )}
                {order.status === 'confirmed' && (
                  <Button
                    size="sm"
                    onClick={() => updateStatusMutation.mutate('shipped')}
                  >
                    จัดส่งแล้ว
                  </Button>
                )}
                {(order.status === 'pending' || order.status === 'confirmed') && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => updateStatusMutation.mutate('cancelled')}
                  >
                    ยกเลิกคำสั่งซื้อ
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tracking Number */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">หมายเลขพัสดุ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.tracking_number ? (
                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <span className="font-mono font-semibold">{order.tracking_number}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">ยังไม่ได้ระบุหมายเลขพัสดุ</p>
              )}
              
              <div className="flex gap-2">
                <Input
                  placeholder="ใส่หมายเลขพัสดุ"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
                <Button onClick={() => updateTrackingMutation.mutate()}>
                  บันทึก
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ข้อมูลลูกค้า</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">ชื่อ:</span> {order.customer_name}
              </div>
              <div>
                <span className="text-muted-foreground">อีเมล:</span> {order.customer_email}
              </div>
              <div>
                <span className="text-muted-foreground">โทร:</span> {order.customer_phone}
              </div>
              <div>
                <span className="text-muted-foreground">ที่อยู่จัดส่ง:</span>
                <p className="mt-1 whitespace-pre-wrap">{order.customer_address}</p>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">รายการสินค้า</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.order_items.map((item: any) => (
                  <div key={item.id} className="flex gap-3 pb-3 border-b last:border-0">
                    <div className="w-16 h-16 bg-secondary rounded overflow-hidden flex-shrink-0">
                      {(item.option_image || item.products?.image_url) && (
                        <img
                          src={item.option_image || item.products.image_url}
                          alt={item.products?.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{item.products?.name}</div>
                      {item.option_label && (
                        <div className="text-sm text-muted-foreground">
                          ตัวเลือก: {item.option_label}
                        </div>
                      )}
                      {item.option_sku && (
                        <div className="text-xs text-muted-foreground">
                          SKU: {item.option_sku}
                        </div>
                      )}
                      <div className="text-sm mt-1">
                        ฿{item.price.toFixed(2)} x {item.quantity}
                      </div>
                    </div>
                    <div className="text-right font-semibold">
                      ฿{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>ยอดรวมทั้งสิ้น</span>
                  <span>฿{order.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};