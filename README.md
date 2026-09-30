# 컴활 1급 필기 학습 앱

섹션별 핵심 요약 + 기출문제/예상문제 풀이 + 오답노트를 제공하는 정적 웹 앱(PWA)입니다.
빌드 과정 없이 이 폴더를 그대로 GitHub Pages에 올리면 동작합니다.

## 구성

```
index.html            앱 화면
css/style.css         디자인 (Pretendard 고딕, 라이트/다크)
js/app.js             앱 로직 (학습 기록은 브라우저 localStorage에 저장)
sw.js                 오프라인 캐시 (서비스 워커)
manifest.webmanifest  홈 화면에 추가용 설정
icons/                파비콘·앱 아이콘
data/subjects.json    과목 목록 (여기에 과목·장 파일을 등록)
data/s1/ch1~8.json    1과목 컴퓨터 일반 (73섹션, 기출 371 + 예상 100문제)
data/s2/ch1~7.json    2과목 스프레드시트 일반 (51섹션, 기출 250 + 예상 100문제)
data/s3/ch1~6.json    3과목 데이터베이스 일반 (58섹션, 기출 346 + 예상 100문제)
```

## GitHub Pages에 올리기

1. GitHub에서 새 저장소를 만듭니다 (예: `comhwal`).
2. 저장소 화면의 **Add file → Upload files**에서 이 폴더 **안의 파일과 폴더 전체**를 끌어다 놓고 Commit 합니다.
   (`index.html`이 저장소 최상단에 있어야 합니다.)
3. **Settings → Pages → Branch: main / (root) → Save**.
4. 1~2분 뒤 `https://<아이디>.github.io/comhwal/` 로 접속합니다.
5. 휴대폰: Safari는 공유 → **홈 화면에 추가**, Chrome은 메뉴 → **홈 화면에 추가**.

## 데이터 형식 (장 파일)

```json
{
  "id": "s1_ch1", "number": 1, "title": "한글 Windows 10의 기본",
  "sections": [{
    "id": "s1_001", "number": "001", "title": "…", "grade": "B",
    "key_terms": ["…"],
    "summary": [{ "h": "소제목", "items": ["**굵게**, ==형광펜== 지원", { "t": "상위 항목", "sub": ["하위 항목"] }] }],
    "quizzes": [{
      "id": "s1_001_q01", "type": "past", "source": "24년 1회",
      "question": "…", "passage": "(선택) <보기> 등",
      "options": ["①", "②", "③", "④"], "answer": 2, "explanation": "…"
    }]
  }]
}
```

- `type`: `past` = 기출(교재 수록), `pred` = 예상문제
- `passage`: 빈 줄로 나뉜 덩어리마다 모든 줄이 `|`로 나뉘어 있으면 표로 그립니다(첫 줄은 머리글, 첫 칸을 비우려면 ` | A | B`). 그 밖에는 줄바꿈·들여쓰기를 그대로 살린 글로 표시합니다.
- 문제 `id`는 학습 기록의 키이므로 한 번 배포한 뒤에는 바꾸지 마세요.

## 과목 추가하기

1. `data/<과목id>/ch1.json …` 형식으로 장 파일을 추가합니다.
2. `data/subjects.json`의 해당 과목 `chapters`에 파일 경로를 넣습니다. (`chapters`가 비어 있으면 “준비 중” 탭으로 표시)
3. 홈 화면 과목 탭, 랜덤 풀이, 오답노트에 자동으로 합쳐집니다.

## 업데이트 시 참고

- 서비스 워커는 네트워크 우선이라 새 데이터를 올리면 온라인 상태에서 바로 반영됩니다.
- 학습 기록은 기기별로 저장됩니다. 휴대폰↔PC 이동은 **설정 → 백업 코드 복사/불러오기**를 사용하세요.
