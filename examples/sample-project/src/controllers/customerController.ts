import { Request, Response } from 'express';
import { CustomerRepository } from '../repositories/customerRepository';
import { CustomerService } from '../services/customerService';

const customerService = new CustomerService(new CustomerRepository());

export const CustomerController = {
  create(req: Request, res: Response): void {
    const customer = customerService.create(req.body);
    res.json(customer);
  },

  get(req: Request, res: Response): void {
    const customer = customerService.findById(req.params.id);
    res.json(customer);
  },

  list(req: Request, res: Response): void {
    const customers = customerService.list();
    res.json(customers);
  },
};
