import { Customer } from '../domain/customer';
import { CustomerRepository } from '../repositories/customerRepository';

export class CustomerService {
  constructor(private repository: CustomerRepository) {}

  create(data: { name: string; email: string }): Customer {
    const customer: Customer = { id: String(Date.now()), name: data.name, email: data.email };
    return this.repository.save(customer);
  }

  findById(id: string): Customer | undefined {
    return this.repository.findById(id);
  }

  list(): Customer[] {
    return this.repository.findAll();
  }
}
