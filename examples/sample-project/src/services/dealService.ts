import { Deal } from '../domain/deal';
import { DealRepository } from '../repositories/dealRepository';

export class DealService {
  constructor(private repository: DealRepository) {}

  create(data: { customerId: string; title: string; value: number }): Deal {
    const deal: Deal = {
      id: String(Date.now()),
      customerId: data.customerId,
      title: data.title,
      value: data.value,
      createdAt: new Date().toISOString(),
    };
    return this.repository.save(deal);
  }

  totalValueForCustomer(customerId: string): number {
    const deals = this.repository.findByCustomerId(customerId);
    let total = 0;
    for (const deal of deals) {
      total += deal.value;
    }
    return total;
  }

  listSortedByValue(customerId: string): Deal[] {
    const deals = this.repository.findByCustomerId(customerId);
    return deals.sort((a, b) => b.value - a.value);
  }
}
