import { Request, Response } from 'express';
import { PaymentRepository } from '../repositories/paymentRepository';
import { PaymentService } from '../services/paymentService';

const paymentService = new PaymentService(new PaymentRepository());

export const PaymentController = {
  async create(req: Request, res: Response): Promise<void> {
    const payment = await paymentService.createPayment(req.body);
    res.json(payment);
  },
};
