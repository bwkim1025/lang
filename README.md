# 발음 연습

한국어 사용자가 일본어와 영어를 한 문장씩 듣고, 따라 말하고, 녹음과 비교하는 정적 웹 앱입니다.

[https://bwkim1025.github.io/lang/](https://bwkim1025.github.io/lang/)

## 로컬에서 열기

저장소 루트에서 정적 서버를 띄웁니다.

```sh
python3 -m http.server 4173
```

브라우저에서 `http://127.0.0.1:4173/` 를 엽니다. 마이크와 음성 인식은 보안 주소(`http://localhost` 또는 `https`)에서만 동작합니다.

## 테스트

```sh
./tests/run.sh
```

`npm test` 와 같습니다. 음성 인식은 브라우저 대역을 흉내 낸 가짜 객체로 확인합니다. Chrome이 있으면 `node tests/layout.mjs`로 화면 너비, 녹음, 서비스 워커를 한 번 더 볼 수 있습니다. 이 스크립트는 `puppeteer-core`가 필요합니다.

## 구성

- `js/data.js`: 일본어·영어 레슨. 문장을 이 파일에 추가하면 됩니다.
- 점수는 `localStorage` 키 `pronounce.progress.v1` 에만 저장됩니다. 이전 키는 지우지 않습니다.
- 글꼴은 Pretendard Variable과 Noto Sans JP를 함께 둡니다. 라이선스는 `fonts/` 의 SIL Open Font License입니다.

GitHub Pages는 `main` 브랜치 루트를 배포합니다. 서비스 워커 캐시를 바꿀 때는 `sw.js` 의 `CACHE` 값을 올립니다.
