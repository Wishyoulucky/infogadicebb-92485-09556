import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductManagement } from "@/components/admin/ProductManagement";
import { OrderManagement } from "@/components/admin/OrderManagement";
import { useAuth, useAdminAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Admin = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("กรุณาเข้าสู่ระบบ");
      navigate("/auth");
      return;
    }

    if (!adminLoading && user && !isAdmin) {
      toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
      navigate("/");
      return;
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg">กำลังโหลด...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="products">จัดการสินค้า</TabsTrigger>
            <TabsTrigger value="orders">จัดการคำสั่งซื้อ</TabsTrigger>
          </TabsList>
          
          <TabsContent value="products" className="mt-6">
            <ProductManagement />
          </TabsContent>
          
          <TabsContent value="orders" className="mt-6">
            <OrderManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
