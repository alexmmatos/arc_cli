import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgram } from '../parser/project';
import { writeFixture } from './testFixture';
import { analyzeRoutes } from './routes';

test('detects express-style routes, resolved handler calls, and return type', () => {
  const { file, dir } = writeFixture(
    'app.ts',
    `
    const app = { get(_p: string, _h: unknown) {}, post(_p: string, _h: unknown) {} };

    const UserController = {
      create(req: any, res: any): void {
        const user = userService.create(req.body);
        res.json(user);
      },
    };

    app.post('/users', UserController.create);
    app.get('/health', (req: any, res: any) => {
      res.json({ status: 'ok' });
    });
    `
  );

  const program = createProgram([file]);
  const model = analyzeRoutes(program, [file], dir);

  assert.equal(model.routes.length, 2);

  const postRoute = model.routes.find((r) => r.method === 'POST');
  assert.ok(postRoute);
  assert.equal(postRoute?.path, '/users');
  assert.equal(postRoute?.handler, 'UserController.create');
  assert.deepEqual(postRoute?.calls, ['userService.create()', 'res.json()']);
  assert.equal(postRoute?.returns, 'void');

  const getRoute = model.routes.find((r) => r.method === 'GET');
  assert.equal(getRoute?.handler, '<inline handler>');
  assert.deepEqual(getRoute?.calls, ['res.json()']);
});

test('unwraps await so calls inside async handlers are still detected', () => {
  const { file, dir } = writeFixture(
    'asyncApp.ts',
    `
    const app = { post(_p: string, _h: unknown) {} };

    const PaymentController = {
      async create(req: any, res: any): Promise<void> {
        const payment = await paymentService.createPayment(req.body);
        res.json(payment);
      },
    };

    app.post('/payments', PaymentController.create);
    `
  );

  const program = createProgram([file]);
  const model = analyzeRoutes(program, [file], dir);

  assert.equal(model.routes.length, 1);
  assert.deepEqual(model.routes[0].calls, ['paymentService.createPayment()', 'res.json()']);
  assert.equal(model.routes[0].returns, 'Promise<void>');
});
