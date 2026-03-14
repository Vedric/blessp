export interface OverviewStats {
  totalRevenueCents: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValueCents: number;
}

export interface RevenueDataPoint {
  date: string;
  revenueCents: number;
  orderCount: number;
}

export interface TopProduct {
  productId: string | null;
  productName: string;
  totalQuantity: number;
  totalRevenueCents: number;
}

export interface RecentOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  discountCents: number;
  status: string;
  itemCount: number;
  createdAt: string;
}

export type RevenuePeriod = '7d' | '30d' | '90d';
