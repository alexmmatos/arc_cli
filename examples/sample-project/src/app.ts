import express from 'express';
import { CustomerController } from './controllers/customerController';
import { DealController } from './controllers/dealController';
import { HistoryController } from './controllers/historyController';
import { PaymentController } from './controllers/paymentController';

const app = express();
app.use(express.json());

app.post('/customers', CustomerController.create);
app.get('/customers/:id', CustomerController.get);
app.get('/customers', CustomerController.list);
app.get('/customers/:id/history', HistoryController.get);

app.post('/deals', DealController.create);
app.get('/customers/:customerId/deals/total', DealController.totalForCustomer);

app.post('/payments', PaymentController.create);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
