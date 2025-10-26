import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onScanSuccess: (rawData: string) => void;
  title?: string;
  description?: string;
}

// Helper function to check if the raw code is a standard Barcode (EAN-13 or UPC-A length)
const isBarcode = (raw: string): boolean => {
    return /^\d{12,13}$/.test(raw); 
}

export function QRScanner({ open, onClose, onScanSuccess, title, description }: QRScannerProps) {
  const [mode, setMode] = useState<'select' | 'camera' | 'upload'>('select');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
    setIsScanning(false);
  };

  const startCameraScanning = async () => {
    setMode('camera');
    setIsScanning(true);

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          stopScanning();
          onScanSuccess(decodedText);
            // แจ้งเตือนสแกนสำเร็จ โดยตรวจสอบว่าเป็น Barcode หรือไม่
            const type = isBarcode(decodedText) ? 'Barcode' : 'QR Code';
          toast.success(`อ่าน ${type} สำเร็จ`);
        },
        (error) => {
          // Silent error handling for continuous scanning
        }
      );
    } catch (error: any) {
      console.error("Camera error:", error);
      toast.error("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง");
      setIsScanning(false);
      setMode('select');
    }
  };

  const handleFileUpload = async (file: File) => {
    setMode('upload');
    setIsScanning(true);

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      const result = await scanner.scanFile(file, false);
      
      stopScanning();
      onScanSuccess(result);
        
        // แจ้งเตือนสแกนสำเร็จ โดยตรวจสอบว่าเป็น Barcode หรือไม่
        const type = isBarcode(result) ? 'Barcode' : 'QR Code';
      toast.success(`อ่าน ${type} จากรูปสำเร็จ`);
        
    } catch (error: any) {
      console.error("File scan error:", error);
        // แก้ไขข้อความแจ้งเตือนให้ครอบคลุม Barcode ด้วย
      toast.error("ไม่พบ Barcode หรือ QR Code ในรูป กรุณาลองใหม่ด้วยรูปที่ชัดเจน"); 
      setIsScanning(false);
      setMode('select');
    }
  };

  const handleClose = () => {
    stopScanning();
    setMode('select');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title || "สแกนโค้ดสินค้า"}</DialogTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'select' && (
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-32 flex-col gap-2"
                onClick={startCameraScanning}
              >
                <Camera className="h-8 w-8" />
                <span>สแกนด้วยกล้อง</span>
              </Button>

              <Button
                variant="outline"
                className="h-32 flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8" />
                <span>อัปโหลดรูปภาพ</span>
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
          )}

          {mode === 'camera' && (
            <div className="space-y-4">
              <div id="qr-reader" className="rounded-lg overflow-hidden border" />
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  stopScanning();
                  setMode('select');
                }}
              >
                <X className="mr-2 h-4 w-4" />
                ยกเลิก
              </Button>
            </div>
          )}

          {mode === 'upload' && isScanning && (
            <div className="space-y-4">
              <div id="qr-reader" className="rounded-lg overflow-hidden border min-h-[200px] flex items-center justify-center">
                <p className="text-muted-foreground">กำลังประมวลผล...</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
