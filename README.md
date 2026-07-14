# 올댓마인드 입금관리

Google Calendar 일정 설명을 기준으로 입금 현황, 분석, 고객 관리를 확인하는 정적 웹 페이지입니다.

## 기능

- 캘린더 일정 기반 입금 현황 테이블
- 예약금, 잔금, 분할잔금, 청소보증금 집계
- 월별 실입금 분석
- 고객 방문 이력과 메모 관리
- 예약관리 Wix API 연동
- CSV 내보내기
- D1 기반 수정사항 저장

## 예약관리 Windows 알림

대관관리 페이지나 브라우저를 열지 않아도 Windows 로그인 후 새 예약신청 알림을 받을 수 있습니다.

PowerShell에서 `scripts/windows-reservation-notifier/install-notifier.ps1`을 실행해 작업 스케줄러에 등록합니다. 자세한 설치/제거 방법은 `scripts/windows-reservation-notifier/README.md`를 확인합니다.

## 실행

별도 빌드 과정 없이 `payment.html`을 브라우저에서 열면 됩니다. 루트 `index.html`은 입금관리 페이지로 이동합니다.

## 테스트

처음 한 번 의존성과 브라우저를 설치합니다.

```bash
npm install
npx playwright install --with-deps chromium
```

브라우저 자동 검수를 실행합니다.

```bash
npm test
```

권한 문제로 `--with-deps`가 실패하면 Chromium만 설치한 뒤 다시 테스트합니다.

```bash
npx playwright install chromium
npm test
```

## 배포

`main` 브랜치에 push되면 GitHub Actions가 Cloudflare Pages로 입금관리 페이지를 배포합니다.

배포 워크플로는 Cloudflare Pages 업로드 전에 `npm ci`와 `npm test`를 실행합니다.

## 운영 보안

`payment.html`과 `/api/*`는 운영 환경에서 Cloudflare Access 같은 서버 측 접근 제어로 함께 보호해야 합니다. 정적 HTML 안의 화면 잠금은 편의 기능일 뿐이며, API 접근 제어를 대체하지 않습니다.
