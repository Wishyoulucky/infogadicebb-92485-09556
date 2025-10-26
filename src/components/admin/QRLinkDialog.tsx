import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, Plus } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface QRLinkDialogProps {
  open: boolean;
  onClose: () => void;
  qrRaw: string;
  onSuccess: () => void;
}

export function QRLinkDialog({ open, onClose, qrRaw, onSuccess }: QRLinkDialogProps) {
  const [mode, setMode] = useState<'create' | 'link'>('link');
  const queryClient = useQueryClient();

  // Form states for creating new product
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock_quantity: "0",
    image_url: "",
    product_flag: "in-stock" as const,
    eta_date: "",
  });

  // States for linking existing product
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Fetch all products for linking
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-qr-link'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('products')
        .select('*, product_options(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch options for selected product
  const selectedProduct = products.find((p: any) => p.id === selectedProductId);
  const hasOptions = selectedProduct?.has_options && selectedProduct?.product_options?.length > 0;

  // Create QR mapping
  const createMappingMutation = useMutation({
    mutationFn: async ({ productId, optionId }: { productId: string; optionId: string | null }) => {
      const qrHash = await hashQR(qrRaw);
      const { data: authData } = await supabase.auth.getUser();

      const { data, error } = await (supabase as any)
        .from('qr_map')
        .insert({
          qr_raw: qrRaw,
          qr_hash: qrHash,
          product_id: productId,
          option_id: optionId,
          created_by: authData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("ผูก QR สำเร็จ");
      queryClient.invalidateQueries({ queryKey: ['qr-mappings'] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "ไม่สามารถผูก QR ได้");
    },
  });

  // Create new product with QR mapping
  const createProductMutation = useMutation({
    mutationFn: async () => {
      const { data: authData } = await supabase.auth.getUser();

      // 1. Create product
      const { data: product, error: productError } = await (supabase as any)
        .from('products')
        .insert({
          name: formData.name,
          price: parseFloat(formData.price),
          base_price: parseFloat(formData.price),
          stock_quantity: parseInt(formData.stock_quantity) || 0,
          image_url: formData.image_url || null,
          product_flag: formData.product_flag,
          eta_date: formData.eta_date || null,
          has_options: false,
          options_stock_total: 0,
        })
        .select()
        .single();

      if (productError) throw productError;

      // 2. Create QR mapping
      const qrHash = await hashQR(qrRaw);
      const { error: mapError } = await (supabase as any)
        .from('qr_map')
        .insert({
          qr_raw: qrRaw,
          qr_hash: qrHash,
          product_id: product.id,
          option_id: null,
          created_by: authData.user?.id,
        });

      if (mapError) throw mapError;

      // 3. Log stock movement if stock > 0
      if (parseInt(formData.stock_quantity) > 0) {
        await (supabase as any)
          .from('stock_movements')
          .insert({
            product_id: product.id,
            option_id: null,
            delta: parseInt(formData.stock_quantity),
            before_qty: 0,
            after_qty: parseInt(formData.stock_quantity),
            reason: 'create-by-qr',
            notes: 'Created via QR scan',
            admin_user_id: authData.user?.id,
          });
      }

      return product;
    },
    onSuccess: () => {
      toast.success("สร้างสินค้าและผูก QR สำเร็จ");
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['qr-mappings'] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "ไม่สามารถสร้างสินค้าได้");
    },
  });

  const handleLinkExisting = () => {
    if (!selectedProductId) {
      toast.error("กรุณาเลือกสินค้า");
      return;
    }

    if (hasOptions && !selectedOptionId) {
      toast.error("กรุณาเลือกตัวเลือก");
      return;
    }

    createMappingMutation.mutate({
      productId: selectedProductId,
      optionId: hasOptions ? selectedOptionId : null,
    });
  };

  const handleCreateNew = () => {
    if (!formData.name || !formData.price) {
      toast.error("กรุณากรอกชื่อและราคา");
      return;
    }

    if (formData.product_flag !== 'in-stock' && !formData.eta_date) {
      toast.error("กรุณาระบุวันที่โดยประมาณ (ETA)");
      return;
    }

    createProductMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ผูก QR กับสินค้า (ครั้งแรก)</DialogTitle>
          <p className="text-sm text-muted-foreground">QR: {qrRaw.substring(0, 50)}...</p>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link">
              <Link className="mr-2 h-4 w-4" />
              เลือกสินค้าที่มีอยู่
            </TabsTrigger>
            <TabsTrigger value="create">
              <Plus className="mr-2 h-4 w-4" />
              สร้างสินค้าใหม่
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4">
            <div className="space-y-2">
              <Label>เลือกสินค้า</Label>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {selectedProductId
                      ? products.find((p: any) => p.id === selectedProductId)?.name
                      : "ค้นหาสินค้า..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="ค้นหาชื่อหรือ SKU..." />
                    <CommandEmpty>ไม่พบสินค้า</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-auto">
                      {products.map((product: any) => (
                        <CommandItem
                          key={product.id}
                          value={`${product.name} ${product.sku || ''}`}
                          onSelect={() => {
                            setSelectedProductId(product.id);
                            setSelectedOptionId("");
                            setSearchOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {product.image_url && (
                              <img src={product.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                            )}
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.sku && `SKU: ${product.sku} · `}฿{product.price}
                              </p>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {hasOptions && (
              <div className="space-y-2">
                <Label>เลือกตัวเลือก</Label>
                <Select value={selectedOptionId} onValueChange={setSelectedOptionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกตัวเลือก" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProduct.product_options.map((opt: any) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label} - {opt.sku} (สต็อก: {opt.stock_quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleLinkExisting}
              disabled={createMappingMutation.isPending}
              className="w-full"
            >
              ผูก QR กับสินค้านี้
            </Button>
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อสินค้า *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ชื่อสินค้า"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ราคา *</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>สต็อก</Label>
                <Input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>สถานะสินค้า</Label>
              <Select
                value={formData.product_flag}
                onValueChange={(v: any) => setFormData({ ...formData, product_flag: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in-stock">พร้อมส่ง</SelectItem>
                  <SelectItem value="preorder">พรีออเดอร์</SelectItem>
                  <SelectItem value="presale">พรีเซล</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.product_flag !== 'in-stock' && (
              <div className="space-y-2">
                <Label>ETA (วันที่โดยประมาณ) *</Label>
                <Input
                  type="date"
                  value={formData.eta_date}
                  onChange={(e) => setFormData({ ...formData, eta_date: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>URL รูปภาพ</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <Button
              onClick={handleCreateNew}
              disabled={createProductMutation.isPending}
              className="w-full"
            >
              สร้างสินค้าและผูก QR
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Hash function for QR data
async function hashQR(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
