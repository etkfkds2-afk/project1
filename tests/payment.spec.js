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

test('루트 페이지는 입금관리로 이동한다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/payment(?:\.html)?$/);
  await expect(page).toHaveTitle('올댓마인드 대관 관리');
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

test('테이블 CSV는 현재 화면 컬럼 기준으로 내보낸다', async ({ page }) => {
  const csv = await page.evaluate(() => {
    allData = [{
      id: 'ev_table',
      date: '2026-03-01',
      branch: '문래점',
      title: '테이블 행사',
      payStatus: '완납',
      reservationDate: '2026-01-01',
      reservationAmount: 300000,
      balanceDate: '2026-02-01',
      balanceAmount: 700000,
      depText: '100,000원',
      dep: 100000,
      netIn: 900000,
      totalIn: 1000000,
      methods: ['현금'],
      notes: '메모'
    }];
    showHidden = false;
    document.getElementById('sy').value = '2026';
    document.getElementById('sm').value = '';
    document.getElementById('sb').value = '';
    document.getElementById('ss').value = '';
    document.getElementById('sq').value = '';
    return buildTableCsv();
  });

  const header = csv.split('\n')[0].replace(/^\uFEFF/, '');
  expect(header).toBe('대관일,지점,행사명,수납상태,예약금 입금 날짜,예약금 입금 금액,잔금 입금 날짜,잔금 입금 금액,청소보증금,실수익,결제방법,메모');
  expect(csv).toContain('"2026-01-01","300,000"');
  expect(csv).toContain('"2026-02-01","700,000"');
  expect(csv).toContain('"합계"');
  expect(csv).not.toContain('총입금액');
  expect(csv).not.toContain('잔금수납액');
});

test('분석 내보내기는 전체실수익내역 시트와 월별 시트를 만든다', async ({ page }) => {
  const workbook = await page.evaluate(() => {
    allData = [
      {
        id: 'ev_chart_1',
        date: '2026-03-01',
        branch: '문래점',
        title: '분석 예약금',
        payStatus: '완납',
        reservationDate: '2026-01-05',
        reservationAmount: 300000,
        reservationDiAmt: 0,
        balanceDate: '',
        balanceAmount: 0,
        dep: 0,
        methods: ['현금'],
        netIn: 300000
      },
      {
        id: 'ev_chart_2',
        date: '2026-04-01',
        branch: '신논현점',
        title: '분석 잔금',
        payStatus: '완납',
        reservationDate: '',
        reservationAmount: 0,
        reservationDiAmt: 0,
        balanceDate: '2026-02-10',
        balanceAmount: 700000,
        balanceDiAmt: 0,
        dep: 0,
        methods: ['카드'],
        netIn: 700000
      }
    ];
    showHidden = false;
    document.getElementById('sy').value = '2026';
    document.getElementById('sb').value = '';
    document.getElementById('ss').value = '';
    document.getElementById('sq').value = '';
    switchView('chart');
    return buildCashflowWorkbook();
  });

  expect(workbook).toContain('<Worksheet ss:Name="전체실수익내역">');
  expect(workbook).toContain('<Worksheet ss:Name="1월">');
  expect(workbook).toContain('<Worksheet ss:Name="2월">');
  expect(workbook).not.toContain('<Worksheet ss:Name="3월">');
  expect(workbook).toContain('합계');
  expect(workbook).toContain('<Data ss:Type="String">입금날짜</Data>');
  expect(workbook).toContain('<Data ss:Type="String">분석 예약금</Data>');
  expect(workbook).toContain('<Data ss:Type="String">분석 잔금</Data>');
  expect(workbook).toContain('<Data ss:Type="String">300,000</Data>');
  expect(workbook).toContain('<Data ss:Type="String">700,000</Data>');
  expect(workbook).toContain('<Data ss:Type="String">1,000,000</Data>');
  expect(workbook.indexOf('분석 예약금')).toBeLessThan(workbook.indexOf('분석 잔금'));
});

test('전체 연도 선택 시 월별 실입금은 연도별로 분리되고 2024년 이전은 제외된다', async ({ page }) => {
  const result = await page.evaluate(() => {
    allData = [
      {
        id: 'ev_2024',
        date: '2024-01-10',
        branch: '문래점',
        title: '2024년 입금',
        payStatus: '완납',
        reservationDate: '2024-01-10',
        reservationAmount: 100000,
        reservationDiAmt: 0,
        balanceDate: '',
        balanceAmount: 0,
        dep: 0,
        methods: ['현금'],
        netIn: 100000
      },
      {
        id: 'ev_2025_jan',
        date: '2025-01-15',
        branch: '문래점',
        title: '2025년 1월 입금',
        payStatus: '완납',
        reservationDate: '2025-01-15',
        reservationAmount: 200000,
        reservationDiAmt: 0,
        balanceDate: '',
        balanceAmount: 0,
        dep: 0,
        methods: ['현금'],
        netIn: 200000
      },
      {
        id: 'ev_2026_jan',
        date: '2026-01-20',
        branch: '신논현점',
        title: '2026년 1월 입금',
        payStatus: '완납',
        reservationDate: '2026-01-20',
        reservationAmount: 300000,
        reservationDiAmt: 0,
        balanceDate: '',
        balanceAmount: 0,
        dep: 0,
        methods: ['카드'],
        netIn: 300000
      }
    ];
    showHidden = false;
    document.getElementById('sy').value = '';
    document.getElementById('sb').value = '';
    document.getElementById('ss').value = '';
    document.getElementById('sq').value = '';
    switchView('chart');
    const workbook = buildCashflowWorkbook();
    const { byMonth, order, grandTotal } = cashflowByMonth('');
    return { workbook, order, grandTotal };
  });

  expect(result.grandTotal).toBe(500000);
  expect(result.workbook).not.toContain('2024년');
  expect(result.workbook).not.toContain('2024년 입금');
  expect(result.workbook).toContain('<Worksheet ss:Name="2025년 1월">');
  expect(result.workbook).toContain('<Worksheet ss:Name="2026년 1월">');
  expect(result.workbook.indexOf('2025년 1월 입금')).toBeLessThan(result.workbook.indexOf('2026년 1월 입금'));

  const jan2025Index = result.order.findIndex(o => o.key === '2025-0');
  const jan2026Index = result.order.findIndex(o => o.key === '2026-0');
  expect(jan2025Index).toBeGreaterThanOrEqual(0);
  expect(jan2026Index).toBeGreaterThan(jan2025Index);
  expect(result.order.some(o => o.year === '2024')).toBe(false);
});

test('고객관리 총매출 카드는 문자열 금액도 합산한다', async ({ page }) => {
  const total = await page.evaluate(async () => {
    remoteContactsReady = true;
    remoteTypeGroupsReady = true;
    remoteTypeOverridesReady = true;
    contacts = {
      '01011112222': { totalRevenue: '1,000원' },
      '01033334444': { totalRevenue: '2,500원' }
    };
    customerAllData = [
      {
        id: 'cust_1',
        rawDesc: '010-1111-2222',
        rawTitle: '[완납] 테스트 A',
        title: '테스트 A',
        txns: [],
        date: '2026-01-01',
        branch: '문래점',
        payStatus: '완납',
        netIn: 1000
      },
      {
        id: 'cust_2',
        rawDesc: '010-3333-4444',
        rawTitle: '[완납] 테스트 B',
        title: '테스트 B',
        txns: [],
        date: '2026-01-02',
        branch: '신논현점',
        payStatus: '완납',
        netIn: 2500
      }
    ];

    await renderCustomers();
    return document.getElementById('cust-kpi-rev').textContent;
  });

  expect(total).toBe('3,500원');
});

test('분석과 고객관리에서는 월 필터를 숨기고 고객관리 라벨을 명확히 표시한다', async ({ page }) => {
  await page.evaluate(() => {
    document.body.classList.remove('locked');
    document.getElementById('authScreen').style.display = 'none';
  });
  await page.locator('#sm').evaluate(select => { select.value = '06'; });

  await page.getByRole('button', { name: '분석' }).click();
  await expect(page.locator('#sm')).not.toBeVisible();
  await expect(page.locator('#sm')).toHaveValue('06');

  await page.evaluate(async () => {
    remoteContactsReady = true;
    remoteTypeGroupsReady = true;
    remoteTypeOverridesReady = true;
    contacts = {};
    customerAllData = [{
      id: 'cust_1',
      rawDesc: '010-1111-2222',
      rawTitle: '[완납] 테스트 A',
      title: '테스트 A',
      txns: [],
      date: '2026-01-01',
      branch: '문래점',
      payStatus: '완납',
      netIn: 1000
    }];
  });

  await page.getByRole('button', { name: '고객관리' }).click();
  await expect(page.locator('.cust-kpi-label').filter({hasText:'총 대관횟수'})).toBeVisible();
  await expect(page.locator('.cust-thead')).toContainText('대관횟수');
  await expect(page.locator('.cust-thead')).toContainText('최근 대관일');
  await expect(page.getByText('총 방문 (2025-27)')).toHaveCount(0);
  await expect(page.getByText('마지막 방문')).toHaveCount(0);
  await expect(page.getByText('대관이력')).toBeVisible();
});
