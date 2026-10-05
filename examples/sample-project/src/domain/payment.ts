export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  stripePaymentIntentId: string;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: string;
}
