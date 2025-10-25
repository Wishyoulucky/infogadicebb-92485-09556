import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  stock_quantity: number;
  option_id?: string;
  option_label?: string;
  option_sku?: string;
  option_image?: string;
  sku?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (item) => set((state) => {
        // Create unique key based on product_id + option_id
        const itemKey = item.option_id ? `${item.id}-${item.option_id}` : item.id;
        const existingItem = state.items.find((i) => {
          const existingKey = i.option_id ? `${i.id}-${i.option_id}` : i.id;
          return existingKey === itemKey;
        });
        
        if (existingItem) {
          return {
            items: state.items.map((i) => {
              const existingKey = i.option_id ? `${i.id}-${i.option_id}` : i.id;
              return existingKey === itemKey
                ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.stock_quantity) }
                : i;
            }),
          };
        }
        
        return { items: [...state.items, item] };
      }),
      
      removeItem: (uniqueKey) => set((state) => {
        // uniqueKey format: "product_id" or "product_id-option_id"
        return {
          items: state.items.filter((i) => {
            const itemKey = i.option_id ? `${i.id}-${i.option_id}` : i.id;
            return itemKey !== uniqueKey;
          }),
        };
      }),
      
      updateQuantity: (uniqueKey, quantity) => set((state) => ({
        items: state.items.map((i) => {
          const itemKey = i.option_id ? `${i.id}-${i.option_id}` : i.id;
          return itemKey === uniqueKey
            ? { ...i, quantity: Math.min(Math.max(1, quantity), i.stock_quantity) }
            : i;
        }),
      })),
      
      clearCart: () => set({ items: [] }),
      
      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },
      
      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
