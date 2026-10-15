# UNIBLE SALE 데스크톱 앱 (Windows · macOS)

웹앱(`oksale-web`)을 앱 창으로 보여 주는 Electron 셸입니다. DB 접속정보·API 키는 앱에 들어 있지 않고 서버가 가집니다.

## 설치 파일 (`npm run dist` 결과: `dist/`)
| 파일 | 대상 |
|---|---|
| `UNIBLE-SALE-1.0.0-mac-arm64.dmg` | Apple 실리콘(M1·M2·M3·M4) Mac |
| `UNIBLE-SALE-1.0.0-mac-x64.dmg` | Intel Mac |
| `UNIBLE-SALE-1.0.0-win-x64.exe` | Windows 10/11 64비트(설치 마법사, 한국어) |

## 서버 주소
- 기본: `https://unible-sale.vercel.app` (운영). 파일 → «서버 주소 설정…»(`Ctrl/⌘+,`)에서 운영 서버·이 컴퓨터(3300/3000)·직접 입력 중 선택. 설정은 사용자 폴더에 저장됩니다.
- 서버에 닿지 않으면 «서버에 연결할 수 없습니다» 화면에서 다시 시도·주소 설정을 할 수 있습니다.
- 개발용: `UNIBLE_SALE_URL=http://localhost:3300 npm start`

## 처음 실행할 때
- **macOS**: Apple 개발자 서명·공증이 없는 빌드라 «확인되지 않은 개발자» 경고가 뜹니다. 앱을 `응용 프로그램`에 넣은 뒤 **우클릭 → 열기**를 한 번 하거나, 터미널에서 `xattr -cr "/Applications/UNIBLE SALE.app"` 를 실행하세요. (서명·공증은 Apple Developer 계정이 있어야 합니다.)
- **Windows**: 코드서명 인증서가 없어 «Windows의 PC 보호» 화면이 뜰 수 있습니다. «추가 정보 → 실행»을 누르세요.

## 다시 빌드
```bash
cd desktop && npm install
npm run dist:mac   # macOS (이 Mac에서)
npm run dist:win   # Windows 설치 파일도 Mac에서 만들 수 있음(wine 불필요, 단 .exe 아이콘 내장은 생략)
```
버전은 `package.json`의 `version`을 올리면 파일 이름에 반영됩니다.

## 알려진 한계
- 이 Mac에서 만든 Windows 설치 파일은 **실제 Windows에서 실행해 보지 못했습니다**(설치 파일 형식·크기만 확인).
- wine이 없어 Windows 실행 파일 자체(`UNIBLE SALE.exe`)에는 아이콘·버전 정보를 넣지 못했습니다(설치 마법사·바로가기 아이콘은 `build/icon.png` 기반). Windows PC에서 빌드하면 들어갑니다.
- 아이콘은 임시 디자인입니다(`build/icon.png` 교체 후 다시 빌드).
