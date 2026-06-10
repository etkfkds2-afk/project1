# 로또 번호 생성기

중복 없는 로또 번호 6개를 생성하는 정적 웹 페이지입니다.

## 기능

- 1게임 또는 5게임 번호 생성
- 고정 번호와 제외 번호 선택
- 최근 생성 히스토리 자동 저장
- 생성 결과 클립보드 복사
- 모바일 화면 대응
- 키보드 포커스 및 스크린 리더 보조 속성 지원

## 실행

별도 빌드 과정 없이 `index.html`을 브라우저에서 열면 됩니다.

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

`main` 브랜치에 push되면 GitHub Actions가 Cloudflare Pages로 루트 디렉터리를 배포합니다.
