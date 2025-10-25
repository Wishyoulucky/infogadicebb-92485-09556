import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductOptionsManager } from "./ProductOptionsManager";

export const ProductManagement = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showOptionsManager, setShowOptionsManager] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    base_price: "",
    price: "",
    description: "",
    box_set_info: "",
    stock_quantity: "",
    image_url: "",
    product_flag: "in-stock",
    eta_date: "",
  });

  const { data: products } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await (supabase.from as any)('products').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success("เพิ่มสินค้าสำเร็จ");
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      const { error } = await (supabase.from as any)('products').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success("แก้ไขสินค้าสำเร็จ");
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success("ลบสินค้าสำเร็จ");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      name: formData.name,
      base_price: parseFloat(formData.base_price || formData.price),
      price: parseFloat(formData.price),
      description: formData.description || null,
      box_set_info: formData.box_set_info || null,
      stock_quantity: parseInt(formData.stock_quantity),
      image_url: formData.image_url || null,
      product_flag: formData.product_flag,
      eta_date: formData.eta_date || null,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      base_price: product.base_price?.toString() || product.price.toString(),
      price: product.price.toString(),
      description: product.description || "",
      box_set_info: product.box_set_info || "",
      stock_quantity: product.stock_quantity.toString(),
      image_url: product.image_url || "",
      product_flag: product.product_flag || "in-stock",
      eta_date: product.eta_date ? new Date(product.eta_date).toISOString().split('T')[0] : "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setFormData({
      name: "",
      base_price: "",
      price: "",
      description: "",
      box_set_info: "",
      stock_quantity: "",
      image_url: "",
      product_flag: "in-stock",
      eta_date: "",
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">สินค้าทั้งหมด</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingProduct(null)}>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มสินค้าใหม่
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">ชื่อสินค้า</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="base_price">ราคาฐาน</Label>
                  <Input
                    id="base_price"
                    type="number"
                    step="0.01"
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                    placeholder="สำหรับสินค้าที่มีตัวเลือก"
                  />
                </div>
                <div>
                  <Label htmlFor="price">ราคาแสดง</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="product_flag">สถานะสินค้า</Label>
                <Select
                  value={formData.product_flag}
                  onValueChange={(value) => setFormData({ ...formData, product_flag: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in-stock">พร้อมส่ง</SelectItem>
                    <SelectItem value="preorder">พรีออเดอร์</SelectItem>
                    <SelectItem value="presale">ขายล่วงหน้า</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.product_flag !== 'in-stock' && (
                <div>
                  <Label htmlFor="eta_date">วันที่คาดว่าจะได้รับ (ETA)</Label>
                  <Input
                    id="eta_date"
                    type="date"
                    value={formData.eta_date}
                    onChange={(e) => setFormData({ ...formData, eta_date: e.target.value })}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="description">รายละเอียด</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="box_set_info">ข้อมูล Box Set</Label>
                <Input
                  id="box_set_info"
                  value={formData.box_set_info}
                  onChange={(e) => setFormData({ ...formData, box_set_info: e.target.value })}
                  placeholder="เช่น: 1 box มี 12 แบบ สุ่มได้ 1 จาก 12"
                />
              </div>
              <div>
                <Label htmlFor="stock">จำนวนสินค้า</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="image">URL รูปภาพ</Label>
                <Input
                  id="image"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <Button type="submit" className="w-full">
                {editingProduct ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {products?.map((product) => (
          <Card key={product.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-secondary rounded-md overflow-hidden flex-shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                      </svg>
                    </div>
                  )}
                </div>
                 <div className="flex-1">
                   <h3 className="font-semibold text-lg">{product.name}</h3>
                   <p className="text-muted-foreground text-sm mb-2">{product.description}</p>
                   <div className="flex gap-4 text-sm mb-2">
                     <span>ราคา: ฿{product.price}</span>
                     {product.has_options ? (
                       <span>สต็อกรวม: {product.options_stock_total}</span>
                     ) : (
                       <span>คงเหลือ: {product.stock_quantity}</span>
                     )}
                   </div>
                   {product.has_options && (
                     <Button
                       variant="link"
                       size="sm"
                       className="px-0 h-auto"
                       onClick={() => setShowOptionsManager(product.id)}
                     >
                       จัดการตัวเลือกสินค้า ({product.options_stock_total > 0 ? `${product.options_stock_total} ชิ้น` : 'ไม่มีสต็อก'})
                     </Button>
                   )}
                 </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(product)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      if (confirm("ต้องการลบสินค้านี้?")) {
                        deleteMutation.mutate(product.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
             </CardContent>
           </Card>
         ))}
       </div>

      {/* Product Options Manager Dialog */}
      {showOptionsManager && (
        <Dialog open={!!showOptionsManager} onOpenChange={() => setShowOptionsManager(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>จัดการตัวเลือกสินค้า</DialogTitle>
            </DialogHeader>
            <ProductOptionsManager
              productId={showOptionsManager}
              basePrice={products?.find(p => p.id === showOptionsManager)?.base_price || products?.find(p => p.id === showOptionsManager)?.price || 0}
            />
          </DialogContent>
        </Dialog>
      )}
     </div>
   );
 };
