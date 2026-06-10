const { test, expect } = require('@playwright/test');

const ballNumbers = async locator => (await locator.allTextContents()).map(Number);

const expectValidGame = async locator => {
  const numbers = await ballNumbers(locator);
  expect(numbers).toHaveLength(6);
  expect(new Set(numbers).size).toBe(6);
  for (const number of numbers) {
    expect(number).toBeGreaterThanOrEqual(1);
    expect(number).toBeLessThanOrEqual(45);
  }
};

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', error => errors.push(error.message));
  page.errors = errors;
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

test('1게임 생성 시 번호 6개가 나오고 히스토리에 저장된다', async ({ page }) => {
  await page.getByRole('button', { name: '1게임 생성' }).click();

  await expect(page.locator('#balls .ball')).toHaveCount(6);
  await expectValidGame(page.locator('#balls .ball'));
  await expect(page.getByText('1게임을 생성했습니다.')).toBeVisible();

  await expect(page.locator('.history-item')).toHaveCount(1);
  await expectValidGame(page.locator('.history-item').first().locator('.ball'));
});

test('5게임 생성 시 5게임이 나오고 각 게임 번호가 유효하다', async ({ page }) => {
  await page.getByRole('button', { name: '5게임 생성' }).click();

  await expect(page.locator('.result-group')).toHaveCount(5);
  await expect(page.locator('.history-item')).toHaveCount(5);

  for (const group of await page.locator('.result-group').all()) {
    await expectValidGame(group.locator('.ball'));
  }
});

test('고정 번호와 제외 번호 조건을 지켜 번호를 생성한다', async ({ page }) => {
  await page.locator('#fixedGrid').getByRole('button', { name: '7번 고정', exact: true }).click();
  await page.locator('#fixedGrid').getByRole('button', { name: '14번 고정', exact: true }).click();
  await page.locator('#excludedGrid').getByRole('button', { name: '1번 제외', exact: true }).click();
  await page.locator('#excludedGrid').getByRole('button', { name: '2번 제외', exact: true }).click();

  await expect(page.locator('#excludedGrid').getByRole('button', { name: '7번 제외', exact: true })).toBeDisabled();
  await expect(page.locator('#fixedGrid').getByRole('button', { name: '1번 고정', exact: true })).toBeDisabled();
  await expect(page.locator('#fixedCount')).toHaveText('2/5');
  await expect(page.locator('#excludedCount')).toHaveText('2개');

  await page.getByRole('button', { name: '1게임 생성' }).click();
  const numbers = await ballNumbers(page.locator('#balls .ball'));

  expect(numbers).toContain(7);
  expect(numbers).toContain(14);
  expect(numbers).not.toContain(1);
  expect(numbers).not.toContain(2);
  expect(new Set(numbers).size).toBe(6);
});

test('복사 버튼은 생성 전 비활성화되고 생성 후 복사 결과 또는 안내를 보여준다', async ({ page, context }) => {
  await expect(page.getByRole('button', { name: '복사' })).toBeDisabled();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });

  await page.getByRole('button', { name: '1게임 생성' }).click();
  await expect(page.getByRole('button', { name: '복사' })).toBeEnabled();
  await page.getByRole('button', { name: '복사' }).click();

  const toast = page.locator('#toast');
  await expect(toast).toHaveText(/번호를 복사했습니다|복사를 지원하지 않는 브라우저입니다/);

  if ((await toast.textContent()) === '번호를 복사했습니다.') {
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('1게임:');
  }
});

test('히스토리는 새로고침 후 유지되고 전체 삭제로 초기화된다', async ({ page }) => {
  await page.getByRole('button', { name: '1게임 생성' }).click();
  await expect(page.locator('.history-item')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('.history-item')).toHaveCount(1);

  await page.getByRole('button', { name: '전체 삭제' }).click();
  await expect(page.locator('.history-item')).toHaveCount(0);
  await expect(page.getByText('아직 생성된 번호가 없습니다.')).toBeVisible();

  await page.reload();
  await expect(page.locator('.history-item')).toHaveCount(0);
  await expect(page.getByText('아직 생성된 번호가 없습니다.')).toBeVisible();
});

test('모바일 390px 레이아웃에서 주요 영역이 화면 밖으로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '5게임 생성' }).click();

  const viewportWidth = page.viewportSize().width;
  const selectors = ['main', '.number-settings', '.generator', '.actions', '.history-section'];

  for (const selector of selectors) {
    const box = await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth);
  }

  for (const ball of await page.locator('.ball').all()) {
    const box = await ball.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth);
  }
});
