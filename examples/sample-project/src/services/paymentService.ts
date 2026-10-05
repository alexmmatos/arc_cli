import Stripe from 'stripe';
import { Payment } from '../domain/payment';
import { PaymentRepository } from '../repositories/paymentRepository';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });

export class PaymentService {
  constructor(private repository: PaymentRepository) {}

  async createPayment(data: { customerId: string; amount: number; currency: string }): Promise<Payment> {
    const intent = await stripe.paymentIntents.create({
      amount: data.amount,
      currency: data.currency,
    });

    const payment: Payment = {
      id: String(Date.now()),
      customerId: data.customerId,
      amount: data.amount,
      currency: data.currency,
      stripePaymentIntentId: intent.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    return this.repository.save(payment);
  }

  history(customerId: string): Payment[] {
    return this.repository.findByCustomerId(customerId);
  }
}
