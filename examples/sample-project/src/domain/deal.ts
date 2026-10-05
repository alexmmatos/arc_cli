import { Customer } from './customer';

export interface Deal {
  id: string;
  customerId: Customer['id'];
  title: string;
  value: number;
  createdAt: string;
}
