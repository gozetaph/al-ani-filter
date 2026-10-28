export interface Product {
  id: string;
  title: string;
  slug?: string;
  description: string;
  category?: string;
  type?: string;
  badge?: string;
  price: number;
  stock_quantity: number;
  image_url: string;
  is_active?: boolean;
  created_at?: string;
}

export interface ShippingZone {
  id: number;
  governorate: string;
  governorate_ar: string;
  delivery_fee: number;
}

export interface OrderItem {
  id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: Product;
}

export interface Order {
  id: string;
  customer_name: string;
  phone: string;
  governorate: string;
  detailed_address: string;
  payment_method: "COD" | "ONLINE";
  subtotal: number;
  shipping_fee: number;
  total_amount: number;
  status: "pending" | "confirmed" | "dispatched" | "delivered" | "cancelled";
  notes?: string;
  created_at?: string;
  items?: OrderItem[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}
