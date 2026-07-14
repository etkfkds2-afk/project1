# 올댓마인드 예약관리 Windows 알림

대관관리 페이지나 브라우저를 열지 않아도, Windows 로그인 후 백그라운드에서 Wix 예약관리 API를 확인해 새 예약신청 알림을 띄웁니다.

## 설치

압축을 푼 뒤 `install-notifier.bat`를 더블클릭합니다.

설치 중 `Enter reservation API token`이 나오면 예약관리 API 토큰을 입력합니다. 작업 스케줄러에 `AllthatmindReservationNotifier`가 등록되고 바로 실행됩니다. 설치 창은 결과를 확인할 수 있도록 마지막에 멈춥니다.

설치 직후 테스트 알림이 한 번 표시됩니다. 테스트 알림만 다시 확인하려면 `test-notifier.bat`를 더블클릭합니다.

작업 상태와 최근 로그를 확인하려면 `check-notifier.bat`를 더블클릭합니다.

## 동작

- 60초마다 문래점/신논현점 예약 API를 확인합니다.
- 처음 실행 시 기존 예약은 본 예약으로 저장합니다.
- 이후 새 예약 `_id`가 발견되면 Windows 알림을 띄웁니다.
- 알림 기록은 `%APPDATA%\AllthatmindReservationNotifier\seen-reservations.json`에 저장됩니다.
- 로그는 `%APPDATA%\AllthatmindReservationNotifier\notifier.log`에 저장됩니다.

## 제거

```powershell
.\uninstall-notifier.ps1
```

작업 스케줄러 등록만 제거합니다. 토큰 설정과 알림 기록 파일은 남겨둡니다.
