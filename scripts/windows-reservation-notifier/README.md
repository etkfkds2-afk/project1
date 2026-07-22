# 올댓마인드 예약관리 Windows 알림

대관관리 페이지나 브라우저를 열지 않아도, Windows 로그인 후 백그라운드에서 Wix 예약관리 API를 확인해 새 예약신청 알림을 띄웁니다. ZIP 파일을 웹사이트에 올리는 것만으로는 실행되지 않으며, 알림을 받을 각 Windows PC에서 아래 설치를 한 번 진행해야 합니다.

## 설치

압축을 푼 뒤 `install-notifier.bat`를 더블클릭합니다.

설치 중 `Enter reservation API token`이 나오면 예약관리 API 토큰을 입력합니다. 작업 스케줄러에 `AllthatmindReservationNotifier`가 등록되고 바로 실행됩니다. 설치 창은 결과를 확인할 수 있도록 마지막에 멈춥니다.

설치 직후 테스트 알림이 한 번 표시됩니다. 테스트 알림만 다시 확인하려면 `test-notifier.bat`를 더블클릭합니다.

작업 상태와 최근 로그를 확인하려면 `check-notifier.bat`를 더블클릭합니다.

## 동작

- 60초마다 문래점/신논현점 예약 API를 확인합니다.
- 한 지점 API에 장애가 생겨도 정상 지점 조회와 알림은 계속합니다.
- 처음 실행 시 기존 예약은 본 예약으로 저장합니다.
- 이후 새 예약 `_id`가 발견되면 Windows 알림을 띄웁니다.
- 알림 기록은 `%APPDATA%\AllthatmindReservationNotifier\seen-reservations.json`에 저장됩니다.
- 로그는 `%APPDATA%\AllthatmindReservationNotifier\notifier.log`에 저장됩니다.
- 현재 상태는 `%APPDATA%\AllthatmindReservationNotifier\status.json`에 저장됩니다.
- 실행 파일은 설치 중 `%APPDATA%\AllthatmindReservationNotifier`로 복사되므로, 압축을 푼 폴더를 옮겨도 등록된 작업에는 영향이 없습니다.

Windows가 절전 상태이거나 사용자가 로그아웃한 동안에는 알림을 표시할 수 없습니다. 다시 로그인하거나 절전에서 복귀하면 작업 상태를 `check-notifier.bat`로 확인하세요. Windows의 알림 및 집중 지원 설정에서 PowerShell/앱 알림이 차단되어 있으면 화면에 표시되지 않을 수 있습니다.

## 제거

```powershell
.\uninstall-notifier.ps1
```

작업 스케줄러 등록만 제거합니다. 토큰 설정과 알림 기록 파일은 남겨둡니다.
