import { Deal } from '../domain/deal';

export class DealRepository {
  private deals: Deal[] = [];

  save(deal: Deal): Deal {
    this.deals.push(deal);
    return deal;
  }

  findByCustomerId(customerId: string): Deal[] {
    return this.deals.filter((d) => d.customerId === customerId);
  }
}
