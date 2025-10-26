import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, QrCode, ShoppingCart, Link as LinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductOptionsManager } from "./ProductOptionsManager";
import { QRScanner } from "./QRScanner";
import { QRLinkDialog } from "./QRLinkDialog";
import { QuickStockDialog } from "./QuickStockDialog";
import { POSScanner } from "./POSScanner";

// Helper function to check if the raw code is a standard Barcode (EAN-13 or UPC-A length)
const isBarcode = (raw: string): boolean => {
    return /^\d{12,13}$/.test(raw); 
}

// Hash function for QR
async function hashQR(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


export const ProductManagement = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showOptionsManager, setShowOptionsManager] = useState<string | null>(null);
  
  // QR Scanner states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRLinkDialog, setShowQRLinkDialog] = useState(false);
  const [showQuickStockDialog, setShowQuickStockDialog] = useState(false);
  const [showPOSScanner, setShowPOSScanner] = useState(false);
  const [scannedQR, setScannedQR] = useState<string>("");
  const [foundProduct, setFoundProduct] = useState<any>(null);
  const [foundOption, setFoundOption] = useState<any>(null);
  const [qrScanMode, setQrScanMode] = useState<'link' | 'stock'>('stock');
  
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
    has_options: false,
    options: [] as Array<{
      id?: string;
      label: string;
      sku: string;
      image_url: string;
      stock_quantity: number;
      price_delta: number;
      discount_price: number | null;
      display_order: number;
    }>,
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
    mutationFn: async ({ productData, options }: { productData: any; options?: any[] }) => {
      // Insert product first and then insert options linked to the created product id (if any)
      const { data: inserted, error: insertError } = await (supabase.from as any)('products')
        .insert(productData)
        .select('id')
        .maybeSingle();

      if (insertError) throw insertError;

      const createdId = (inserted as any)?.id;

      if (options && options.length > 0 && createdId) {
        // attach product_id to each option
        const optionsToInsert = options.map((o) => ({ ...o, product_id: createdId }));
        const { error: optErr } = await (supabase.from as any)('product_options').insert(optionsToInsert);
        if (optErr) throw optErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success("เพิ่มสินค้าสำเร็จ");
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, options }: any) => {
      // Update product row
      const { error: prodErr } = await (supabase.from as any)('products').update(data).eq('id', id);
      if (prodErr) throw prodErr;

      // If options provided, replace existing options for this product
      if (options && Array.isArray(options)) {
        // delete existing options
        const { error: delErr } = await (supabase.from as any)('product_options').delete().eq('product_id', id);
        if (delErr) throw delErr;

        if (options.length > 0) {
          const optsToInsert = options.map((o: any) => ({
            label: o.label,
            sku: o.sku,
            image_url: o.image_url || null,
            stock_quantity: o.stock_quantity || 0,
            price_delta: o.price_delta || 0,
            discount_price: o.discount_price ?? null,
            display_order: o.display_order || 0,
            product_id: id,
          }));

          const { error: insErr } = await (supabase.from as any)('product_options').insert(optsToInsert);
          if (insErr) throw insErr;
        }
      }
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
      has_options: formData.has_options,
      options_stock_total: formData.has_options ? formData.options.reduce((s, o) => s + (o.stock_quantity || 0), 0) : 0,
      image_url: formData.image_url || null,
      product_flag: formData.product_flag,
      eta_date: formData.eta_date || null,
    };

    if (editingProduct) {
      const payload: any = { id: editingProduct.id, data };
      if (formData.has_options) payload.options = formData.options;
      updateMutation.mutate(payload);
    } else {
      // pass options if has_options
      const payload: { productData: any; options?: any[] } = { productData: data };
      if (formData.has_options && formData.options.length > 0) {
        payload.options = formData.options;
      }
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    // fetch product options and populate form
    (async () => {
      try {
        const { data: optsData, error: optsErr } = await (supabase.from as any)('product_options')
          .select('*')
          .eq('product_id', product.id)
          .order('display_order', { ascending: true });
        if (optsErr) throw optsErr;

        const mappedOpts = (optsData || []).map((o: any) => ({
          id: o.id,
          label: o.label,
          sku: o.sku,
          image_url: o.image_url || "",
          stock_quantity: o.stock_quantity || 0,
          price_delta: Number(o.price_delta || 0),
          discount_price: o.discount_price != null ? Number(o.discount_price) : null,
          display_order: o.display_order || 0,
        }));

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
          has_options: product.has_options || false,
          options: mappedOpts,
        });
      } catch (err) {
        console.error('failed load product options', err);
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
          has_options: product.has_options || false,
          options: [],
        });
      } finally {
        setIsDialogOpen(true);
      }
    })();
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
      has_options: false,
      options: [],
    });
  };

  // QR Scanner handlers
  const handleQRScan = async (rawCode: string) => {
    setScannedQR(rawCode);
    setShowQRScanner(false);

    const isBarcodeScan = isBarcode(rawCode);
    const codeType = isBarcodeScan ? 'Barcode' : 'QR Code';
    
    let mappingResult: any = null;
    let mappingError: any = null;

    if (isBarcodeScan) {
        // --- BARCODE LOGIC (ค้นหาจาก ean_code) ---
        // 1. ลองค้นหาจาก Product Option ก่อน
        const { data: optionMapping, error: optErr } = await (supabase as any)
            .from('product_options')
            .select('*, product:products(*)')
            .eq('ean_code', rawCode)
            .maybeSingle();
            
        if (optionMapping) {
             // จัดรูปแบบผลลัพธ์ให้คล้ายกับ qr_map เพื่อความง่ายในการจัดการด้านล่าง
            mappingResult = { product: optionMapping.product, option: optionMapping };
        } else {
            // 2. ถ้าไม่เจอใน Option ลองค้นหาจาก Product หลัก
            const { data: productMapping, error: prodErr } = await (supabase as any)
                .from('products')
                .select('*')
                .eq('ean_code', rawCode)
                .maybeSingle();

            if (productMapping) {
                // จัดรูปแบบผลลัพธ์
                mappingResult = { product: productMapping, option: null };
            } else {
                // ในกรณีที่ค้นหาไม่พบเลย
                mappingError = prodErr; 
            }
        }
    } else {
        // --- QR CODE LOGIC (ค้นหาจาก qr_map เดิม) ---
        const qrHash = await hashQR(rawCode);
        
        const { data, error } = await (supabase as any)
            .from('qr_map')
            .select('*, product:products(*), option:product_options(*)')
            .eq('qr_hash', qrHash)
            .maybeSingle();
        
        mappingResult = data;
        mappingError = error;
    }

    // Check for general errors
    if (mappingError) {
      toast.error("เกิดข้อผิดพลาดในการตรวจสอบโค้ด");
      return;
    }

    if (!mappingResult || !mappingResult.product) {
      // โค้ดยังไม่ผูก → ไปหน้าผูก
      if (qrScanMode === 'link') {
        setShowQRLinkDialog(true);
      } else {
        toast.error(`${codeType} นี้ยังไม่ได้ผูกกับสินค้า กรุณาใช้โหมด 'สร้าง/ผูกสินค้า' ก่อน`);
      }
      return;
    }

    // โค้ดผูกแล้ว
    if (qrScanMode === 'link') {
      toast.info(`${codeType} นี้ผูกกับสินค้าแล้ว`);
      return;
    }

    // โหมดสต็อก → เปิด Quick Stock
    setFoundProduct(mappingResult.product);
    setFoundOption(mappingResult.option || null);
    setShowQuickStockDialog(true);
  };

  const handleQRLinkSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    setShowQRLinkDialog(false);
    setScannedQR("");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold">สินค้าทั้งหมด</h2>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPOSScanner(true)}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            POS
          </Button>

          <div className="flex items-center gap-0 border rounded-md">
            <Select
              value={qrScanMode}
              onValueChange={(v: any) => setQrScanMode(v)}
            >
              <SelectTrigger className="w-[180px] border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="link">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    สร้าง/ผูกสินค้า
                  </div>
                </SelectItem>
                <SelectItem value="stock">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    เช็ค/อัปเดตสต็อก
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQRScanner(true)}
            >
              <QrCode className="h-4 w-4" />
            </Button>
          </div>

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

              <div className="mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.has_options}
                    onChange={(e) => setFormData({ ...formData, has_options: e.target.checked })}
                  />
                  <span className="text-sm">มีตัวเลือกสินค้า (เช่น ขนาด/สี)</span>
                </label>
                {formData.has_options && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">ตัวเลือกสินค้า</h4>
                      <Button size="sm" onClick={() => {
                        setFormData({
                          ...formData,
                          options: [
                            ...formData.options,
                            { label: '', sku: '', image_url: '', stock_quantity: 0, price_delta: 0, discount_price: null, display_order: formData.options.length }
                          ]
                        });
                      }}>
                        <Plus className="h-4 w-4 mr-2" /> เพิ่มตัวเลือก
                      </Button>
                    </div>

                    {formData.options.map((opt, idx) => (
                      <div key={idx} className="border rounded p-3 bg-surface">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>ชื่อตัวเลือก</Label>
                            <Input value={opt.label} onChange={(e) => {
                              const newOpts = [...formData.options]; newOpts[idx].label = e.target.value; setFormData({ ...formData, options: newOpts });
                            }} />
                          </div>
                          <div>
                            <Label>SKU</Label>
                            <Input value={opt.sku} onChange={(e) => {
                              const newOpts = [...formData.options]; newOpts[idx].sku = e.target.value; setFormData({ ...formData, options: newOpts });
                            }} />
                          </div>
                          <div>
                            <Label>ส่วนต่างราคา</Label>
                            <Input type="number" step="0.01" value={opt.price_delta} onChange={(e) => {
                              const newOpts = [...formData.options]; newOpts[idx].price_delta = parseFloat(e.target.value || '0'); setFormData({ ...formData, options: newOpts });
                            }} />
                          </div>
                          <div>
                            <Label>ราคาลดพิเศษ</Label>
                            <Input type="number" step="0.01" value={opt.discount_price ?? ''} onChange={(e) => {
                              const newOpts = [...formData.options]; newOpts[idx].discount_price = e.target.value ? parseFloat(e.target.value) : null; setFormData({ ...formData, options: newOpts });
                            }} />
                          </div>
                          <div>
                            <Label>สต็อก</Label>
                            <Input type="number" value={opt.stock_quantity} onChange={(e) => {
                              const newOpts = [...formData.options]; newOpts[idx].stock_quantity = parseInt(e.target.value || '0'); setFormData({ ...formData, options: newOpts });
                            }} />
                          </div>
                          <div>
                            <Label>ลำดับการแสดง</Label>
                            <Input type="number" value={opt.display_order} onChange={(e) => {
                              const newOpts = [...formData.options]; newOpts[idx].display_order = parseInt(e.target.value || '0'); setFormData({ ...formData, options: newOpts });
                            }} />
                          </div>
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            const newOpts = [...formData.options]; newOpts.splice(idx, 1); setFormData({ ...formData, options: newOpts });
                          }}>ลบ</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full">
                {editingProduct ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
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

      {/* QR Scanner */}
      <QRScanner
        open={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanSuccess={handleQRScan}
        title={qrScanMode === 'link' ? 'สแกน Barcode/QR เพื่อผูกสินค้า' : 'สแกน Barcode/QR เพื่อเช็คสต็อก'}
      />

      {/* QR Link Dialog */}
      {showQRLinkDialog && (
        <QRLinkDialog
          open={showQRLinkDialog}
          onClose={() => {
            setShowQRLinkDialog(false);
            setScannedQR("");
          }}
          qrRaw={scannedQR}
          onSuccess={handleQRLinkSuccess}
        />
      )}

      {/* Quick Stock Dialog */}
      {showQuickStockDialog && foundProduct && (
        <QuickStockDialog
          open={showQuickStockDialog}
          onClose={() => {
            setShowQuickStockDialog(false);
            setFoundProduct(null);
            setFoundOption(null);
          }}
          product={foundProduct}
          option={foundOption}
        />
      )}

      {/* POS Scanner */}
      <POSScanner
        open={showPOSScanner}
        onClose={() => setShowPOSScanner(false)}
      />
     </div>
   );
 };
