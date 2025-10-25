import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Edit, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductOption {
  id: string;
  product_id: string;
  label: string;
  sku: string;
  image_url: string | null;
  stock_quantity: number;
  price_delta: number;
  discount_price: number | null;
  display_order: number;
}

interface ProductOptionsManagerProps {
  productId: string;
  basePrice: number;
}

export const ProductOptionsManager = ({ productId, basePrice }: ProductOptionsManagerProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ProductOption | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    sku: "",
    image_url: "",
    stock_quantity: 0,
    price_delta: 0,
    discount_price: null as number | null,
    display_order: 0,
  });

  const queryClient = useQueryClient();

  const { data: options, isLoading } = useQuery({
    queryKey: ['product-options', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .eq('product_id', productId)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as ProductOption[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('product_options')
        .insert({ ...data, product_id: productId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-options', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success("เพิ่มตัวเลือกสำเร็จ");
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('product_options')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-options', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success("แก้ไขตัวเลือกสำเร็จ");
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_options')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-options', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success("ลบตัวเลือกสำเร็จ");
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOption) {
      updateMutation.mutate({ id: editingOption.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (option: ProductOption) => {
    setEditingOption(option);
    setFormData({
      label: option.label,
      sku: option.sku,
      image_url: option.image_url || "",
      stock_quantity: option.stock_quantity,
      price_delta: option.price_delta,
      discount_price: option.discount_price,
      display_order: option.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingOption(null);
    setFormData({
      label: "",
      sku: "",
      image_url: "",
      stock_quantity: 0,
      price_delta: 0,
      discount_price: null,
      display_order: 0,
    });
  };

  const calculatePrice = (priceDelta: number, discountPrice: number | null) => {
    const finalPrice = basePrice + priceDelta;
    return discountPrice || finalPrice;
  };

  if (isLoading) {
    return <div>กำลังโหลด...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>ตัวเลือกสินค้า</CardTitle>
          <Button onClick={() => setIsDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มตัวเลือก
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {options?.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีตัวเลือก</p>
          ) : (
            options?.map((option) => (
              <Card key={option.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {option.image_url && (
                      <img 
                        src={option.image_url} 
                        alt={option.label}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{option.label}</h4>
                        {option.stock_quantity === 0 && (
                          <Badge variant="destructive">หมด</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">SKU: {option.sku}</p>
                      <p className="text-sm">
                        ราคา: ฿{calculatePrice(option.price_delta, option.discount_price).toFixed(2)}
                        {option.price_delta !== 0 && (
                          <span className="text-muted-foreground ml-1">
                            ({option.price_delta > 0 ? '+' : ''}{option.price_delta})
                          </span>
                        )}
                      </p>
                      <p className="text-sm">สต็อก: {option.stock_quantity}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(option)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("ต้องการลบตัวเลือกนี้?")) {
                            deleteMutation.mutate(option.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingOption ? "แก้ไขตัวเลือก" : "เพิ่มตัวเลือกใหม่"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="label">ชื่อตัวเลือก</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="sku">SKU (ไม่ซ้ำ)</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="image_url">URL รูปภาพ</Label>
                <Input
                  id="image_url"
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="stock_quantity">สต็อก</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="price_delta">ส่วนต่างราคา (+ หรือ -)</Label>
                <Input
                  id="price_delta"
                  type="number"
                  step="0.01"
                  value={formData.price_delta}
                  onChange={(e) => setFormData({ ...formData, price_delta: parseFloat(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  ราคาสุดท้าย: ฿{(basePrice + formData.price_delta).toFixed(2)}
                </p>
              </div>

              <div>
                <Label htmlFor="discount_price">ราคาลดพิเศษ (ถ้ามี)</Label>
                <Input
                  id="discount_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount_price || ""}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    discount_price: e.target.value ? parseFloat(e.target.value) : null 
                  })}
                />
              </div>

              <div>
                <Label htmlFor="display_order">ลำดับการแสดง</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingOption ? "บันทึก" : "เพิ่มตัวเลือก"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  ยกเลิก
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};