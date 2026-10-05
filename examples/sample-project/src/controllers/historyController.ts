import { Request, Response } from 'express';
import { DealRepository } from '../repositories/dealRepository';
import { PaymentRepository } from '../repositories/paymentRepository';
import { HistoryService } from '../services/historyService';

const historyService = new HistoryService(new DealRepository(), new PaymentRepository());

export const HistoryController = {
  get(req: Request, res: Response): void {
    const history = historyService.getHistory(req.params.id);
    res.json(history);
  },
};
