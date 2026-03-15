export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

export interface CreatePaymentIntentDto {
  orderId: string;
  currency?: string;
}

export interface PaymentMethodResponse {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}
