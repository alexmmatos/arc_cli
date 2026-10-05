import { Customer } from '../domain/customer';

export class CustomerRepository {
  private customers: Customer[] = [];

  save(customer: Customer): Customer {
    this.customers.push(customer);
    return customer;
  }

  findById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  findAll(): Customer[] {
    return this.customers;
  }
}
