import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Minus, Plus, Save } from "lucide-react";

interface QuickStockDialogProps {
  open: boolean;
  onClose: () => void;
  product: any;
  option?: any;
}

export function QuickStockDialog({ open, onClose, product, option }: QuickStockDialogProps) {
  const queryClient = useQueryClient();
  
  const currentStock = option ? option.stock_quantity : product.stock_quantity;
  const [newStock, setNewStock] = useState(currentStock);
  const [notes, setNotes] = useState("");

  const delta = newStock - currentStock;

  const updateStockMutation = useMutation({
    mutationFn: async () => {
      const { data: authData } = await supabase.auth.getUser();

      if (newStock < 0) {
        throw new Error("สต็อกห้ามติดลบ");
      }

      // 1. Update stock
      if (option) {
        const { error } = await (supabase as any)
          .from('product_options')
          .update({ stock_quantity: newStock })
          .eq('id', option.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', product.id);

        if (error) throw error;
      }

      // 2. Log stock movement
      const reason = delta > 0 ? 'scan-in' : delta < 0 ? 'scan-out' : 'adjust';
      
      const { error: movementError } = await (supabase as any)
        .from('stock_movements')
        .insert({
          product_id: product.id,
          option_id: option?.id || null,
          delta: delta,
          before_qty: currentStock,
          after_qty: newStock,
          reason: reason,
          notes: notes || null,
          admin_user_id: authData.user?.id,
        });

      if (movementError) throw movementError;
    },
    onSuccess: () => {
      toast.success("อัปเดตสต็อกสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-for-qr-link'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "ไม่สามารถอัปเดตสต็อกได้");
    },
  });

  const handleSave = () => {
    if (delta === 0) {
      toast.info("ไม่มีการเปลี่ยนแปลง");
      return;
    }
    updateStockMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>เช็คสต็อกเร็ว</DialogTitle>
        </DialogHeader>

        <Card className="p-4">
          <div className="flex items-start gap-4">
            {(option?.image_url || product.image_url) && (
              <img
                src={option?.image_url || product.image_url}
                alt=""
                className="h-20 w-20 rounded object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold">{product.name}</h3>
              {option && (
                <p className="text-sm text-muted-foreground">{option.label}</p>
              )}
              <p className="text-sm text-muted-foreground">
                SKU: {option?.sku || product.sku || '-'}
              </p>
              <p className="text-sm font-medium mt-1">
                ราคา: ฿{option ? (product.base_price + option.price_delta) : product.price}
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setNewStock(Math.max(0, newStock - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>

            <div className="text-center min-w-[120px]">
              <p className="text-sm text-muted-foreground">สต็อกปัจจุบัน</p>
              <p className="text-2xl font-bold">{currentStock}</p>
            </div>

            <div className="text-center min-w-[80px]">
              <p className="text-sm text-muted-foreground">→</p>
              <Input
                type="number"
                value={newStock}
                onChange={(e) => setNewStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="text-center text-2xl font-bold h-12"
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setNewStock(newStock + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {delta !== 0 && (
            <div className="text-center">
              <p className={`text-lg font-semibold ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {delta > 0 ? '+' : ''}{delta} ชิ้น
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>หมายเหตุ (ถ้ามี)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น: รับสินค้าเข้าจากซัพพลายเออร์"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setNewStock(currentStock + 1)}
            >
              +1
            </Button>
            <Button
              variant="outline"
              onClick={() => setNewStock(Math.max(0, currentStock - 1))}
            >
              -1
            </Button>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateStockMutation.isPending || delta === 0}
            className="w-full"
          >
            <Save className="mr-2 h-4 w-4" />
            บันทึก
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
