import { Request, Response } from 'express';
import { DealRepository } from '../repositories/dealRepository';
import { DealService } from '../services/dealService';

const dealService = new DealService(new DealRepository());

export const DealController = {
  create(req: Request, res: Response): void {
    const deal = dealService.create(req.body);
    res.json(deal);
  },

  totalForCustomer(req: Request, res: Response): void {
    const total = dealService.totalValueForCustomer(req.params.customerId);
    res.json({ total });
  },
};
