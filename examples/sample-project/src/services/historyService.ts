import { DealRepository } from '../repositories/dealRepository';
import { PaymentRepository } from '../repositories/paymentRepository';

export interface HistoryEntry {
  type: 'deal' | 'payment';
  date: string;
  description: string;
}

export class HistoryService {
  constructor(private deals: DealRepository, private payments: PaymentRepository) {}

  getHistory(customerId: string): HistoryEntry[] {
    const deals = this.deals.findByCustomerId(customerId);
    const payments = this.payments.findByCustomerId(customerId);

    const entries: HistoryEntry[] = [];
    for (const deal of deals) {
      entries.push({ type: 'deal', date: deal.createdAt, description: deal.title });
    }
    for (const payment of payments) {
      entries.push({ type: 'payment', date: payment.createdAt, description: `${payment.amount} ${payment.currency}` });
    }

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }
}
