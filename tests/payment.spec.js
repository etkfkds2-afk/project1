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

test('예약관리 상세 표시에는 고객정보를 예약정보 위에 붙인다', async ({ page }) => {
  const display = await page.evaluate(() => reservationDisplayEstimate({
    name: '홍길동',
    eventType: '세미나',
    phone: '010-1234-5678',
    email: 'hong@example.com',
    total: '[예약 정보]\n• 지점: 문래점'
  }));

  expect(display).toContain('[고객정보]');
  expect(display.indexOf('[고객정보]')).toBeLessThan(display.indexOf('[예약 정보]'));
  expect(display).toContain('• 예약자명: 홍길동');
  expect(display).toContain('• 행사명: 세미나');
  expect(display).toContain('• 전화번호: 010-1234-5678');
  expect(display).toContain('• 이메일: hong@example.com');
});

test('예약관리 상세 복사 텍스트는 줄바꿈을 유지한다', async ({ page }) => {
  const copied = await page.evaluate(() => {
    reservationItems = [{
      _id: 'copy_1',
      name: '홍길동',
      eventType: '세미나',
      phone: '010-1234-5678',
      email: 'hong@example.com',
      total: '[예약 정보]\n• 지점: 문래점'
    }];
    return reservationEstimateTextById('copy_1');
  });

  expect(copied).toBe('[고객정보]\n• 예약자명: 홍길동\n• 행사명: 세미나\n• 전화번호: 010-1234-5678\n• 이메일: hong@example.com\n\n[예약 정보]\n• 지점: 문래점');
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

test('로그인은 평문 비밀번호를 같은 출처 인증 API로 보내고 서버 세션으로 화면을 연다', async ({ page }) => {
  let loginRequest;
  await page.route('**/api/auth', async route => {
    if (route.request().method() === 'POST') {
      loginRequest = {
        url: route.request().url(),
        body: route.request().postDataJSON()
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) });
  });
  await page.route('**/api/overrides**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ value: {}, updated_at: null })
  }));

  await page.locator('#accessUser').fill('boss');
  await page.locator('#accessPass').fill('test-password');
  await page.locator('#authScreen button[type="submit"]').click();

  await expect(page.locator('#authScreen')).toBeHidden();
  expect(new URL(loginRequest.url).pathname).toBe('/api/auth');
  expect(loginRequest.body).toEqual({ username: 'boss', password: 'test-password' });
  expect(await page.evaluate(() => sessionStorage.getItem('atm_payment_access_ok'))).toBe('1');
});

test('예약 API 호출은 Wix 토큰을 브라우저에 싣지 않고 같은 출처 프록시를 사용한다', async ({ page }) => {
  let requestInfo;
  await page.route('**/api/reservations?branch=munrae', async route => {
    requestInfo = {
      url: route.request().url(),
      authorization: await route.request().headerValue('authorization')
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ _id: 'secure_1', name: '보안 테스트' }] })
    });
  });

  const rows = await page.evaluate(() => fetchReservationBranch('munrae', RESV_BASES.munrae, 'must-not-leak'));
  expect(rows[0]).toMatchObject({ _id: 'secure_1', _branch: 'munrae' });
  expect(new URL(requestInfo.url).origin).toBe('http://127.0.0.1:4173');
  expect(requestInfo.authorization).toBeNull();
});

test('서버 세션 복원 후 390px 화면에서 가로 넘침 없이 주요 탭이 동작한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/auth', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ authenticated: true })
  }));
  await page.route('**/api/overrides**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ value: {}, updated_at: null })
  }));
  await page.evaluate(() => sessionStorage.setItem('atm_payment_access_ok', '1'));
  await page.reload();
  await expect(page.locator('#authScreen')).toBeHidden();

  for (const id of ['tab-table', 'tab-chart', 'tab-customer', 'tab-reservation']) {
    await page.locator(`#${id}`).click();
    await expect(page.locator(`#${id}`)).toHaveClass(/active/);
  }
  const width = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
});

test('직접 추가 데이터는 새로고침 후 유지되고 전체 삭제로 제거된다', async ({ page }) => {
  await page.evaluate(() => {
    remoteOvReady = false;
    const row = makeManualRow({ id: 'persist_manual_1', title: '저장 유지 확인', amount: 150000 });
    persistManualRow(row);
    saveOv();
  });
  await page.reload();

  expect(await page.evaluate(() => manualRows().map(row => row.id))).toContain('persist_manual_1');
  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(() => {
    allData = manualRows().map(row => makeManualRow(row));
    clearAllManualRows();
  });
  expect(await page.evaluate(() => manualRows())).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('atm_ov') || '{}').__manualRows)).toEqual([]);
});

test('보호된 설정·예약 API는 세션 없는 요청을 거부한다', async () => {
  const overridesApi = await import('../functions/api/overrides.js');
  const reservationsApi = await import('../functions/api/reservations.js');
  const context = {
    request: new Request('https://example.com/api/overrides'),
    env: { DB: {} }
  };
  const settingsResponse = await overridesApi.onRequestGet(context);
  const reservationResponse = await reservationsApi.onRequestGet({
    ...context,
    request: new Request('https://example.com/api/reservations?branch=munrae')
  });

  expect(settingsResponse.status).toBe(401);
  expect(reservationResponse.status).toBe(401);
});

test('브라우저 배포 파일에는 관리자 해시와 예약 토큰 저장 키가 없다', async ({ page }) => {
  const html = await page.locator('html').evaluate(element => element.outerHTML);
  expect(html).not.toContain('585821c6e0290e4ad6f01a88007d4c05875a0d59ffc50bd9bf95499d654c353c');
  expect(html).not.toContain('reservation_api_token');
  expect(html).not.toContain('atm_reservation_session_token');
});
