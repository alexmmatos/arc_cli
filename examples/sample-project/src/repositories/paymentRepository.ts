import { Payment } from '../domain/payment';

export class PaymentRepository {
  private payments: Payment[] = [];

  save(payment: Payment): Payment {
    this.payments.push(payment);
    return payment;
  }

  findByCustomerId(customerId: string): Payment[] {
    return this.payments.filter((p) => p.customerId === customerId);
  }
}
