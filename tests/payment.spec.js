const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', error => errors.push(error.message));
  page.errors = errors;
  await page.goto('/payment.html');
});

test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

test('입금 설명에서 현금 보증금을 차감하고 예약금/잔금을 분리한다', async ({ page }) => {
  const parsed = await page.evaluate(() => parseDesc(`
    20260101 홍길동 개인계좌 300,000원 예약금
    20260201 홍길동 개인계좌 1,100,000원 잔금 청소보증금 100,000원 포함
  `, '2026'));

  expect(parsed.totalIn).toBe(1400000);
  expect(parsed.dep).toBe(100000);
  expect(parsed.netIn).toBe(1300000);
  expect(parsed.reservation.amount).toBe(300000);
  expect(parsed.balance.amount).toBe(1100000);
  expect(parsed.methods).toEqual(['현금']);
});

test('카드 결제는 청소보증금을 실입금에서 차감하지 않는다', async ({ page }) => {
  const amount = await page.evaluate(() => {
    document.getElementById('sy').value = '2026';
    return paymentParts({
      payStatus: '완납',
      methods: ['카드'],
      reservationDate: '2026-01-02',
      reservationAmount: 0,
      reservationDiAmt: 0,
      balanceDate: '2026-01-03',
      balanceAmount: 1100000,
      balanceDiAmt: 100000,
      dep: 100000
    }, '2026').reduce((sum, part) => sum + part.amount, 0);
  });

  expect(amount).toBe(1100000);
});

test('분할잔금과 환불은 입금일 기준 금액에 반영된다', async ({ page }) => {
  const parts = await page.evaluate(() => {
    document.getElementById('sy').value = '2026';
    return paymentParts({
      payStatus: '환불',
      methods: ['현금'],
      reservationDate: '2026-02-01',
      reservationAmount: 200000,
      reservationDiAmt: 0,
      balanceDate: '2026-02-10',
      balanceAmount: 300000,
      balanceDiAmt: 0,
      balanceDate2: '2026-02-20',
      balanceAmount2: 50000,
      dep: 0,
      manual: true
    }, '2026');
  });

  expect(parts.map(part => part.amount)).toEqual([-200000, -300000, -50000]);
});

test('CSV 셀은 스프레드시트 수식 실행을 방어한다', async ({ page }) => {
  const cells = await page.evaluate(() => ({
    formula: csvCell('=HYPERLINK("https://example.com")'),
    plus: csvCell('+SUM(1,1)'),
    normal: csvCell('일반 메모'),
    quote: csvCell('따옴표 " 포함')
  }));

  expect(cells.formula).toBe('"\'=HYPERLINK(""https://example.com"")"');
  expect(cells.plus).toBe('"\'+SUM(1,1)"');
  expect(cells.normal).toBe('"일반 메모"');
  expect(cells.quote).toBe('"따옴표 "" 포함"');
});
