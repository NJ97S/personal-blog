# Summary

Issue #10의 관리자 마크다운 에디터 모바일 대응을 구현했다. `@uiw/react-md-editor`의 `preview` prop을 뷰포트에 따라 전환해서 모바일에서는 작성(`edit`) 단일 패널을 기본으로 보여주고, 버튼으로 미리보기(`preview`) 전용 모드와 오갈 수 있게 했다. 데스크톱(`md` 이상)에서는 기존 `live` 분할 모드와 커스텀 `MarkdownView` 프리뷰 경로를 유지했다.

스크롤 싱크 훅은 `live` 분할 모드에서만 활성화되도록 `enabled` 인자를 추가했다. 모바일 단일 패널로 전환되면 기존 컨트롤러의 스크롤 리스너, `ResizeObserver`, `MutationObserver`, off-screen mirror DOM이 `destroy()` 경로를 통해 정리된다.

구현 커밋: `0ff2910 Fix issue 10 mobile markdown editor preview`

# Files Changed

- `components/MarkdownEditor.tsx`
  - 모바일 뷰포트 감지를 위한 `matchMedia('(max-width: 767px)')` 상태를 추가했다.
  - 모바일에서는 `preview` prop을 `edit`/`preview`로 전환하고, 데스크톱에서는 기존 `live`를 유지한다.
  - 모바일 전용 토글 버튼을 추가했다. 버튼은 `lucide-react`의 `Eye`, `PencilLine` 아이콘을 사용하며 폼 제출 버튼이 되지 않도록 `type="button"`으로 고정했다.
  - 기존 hidden input 계약(`name`과 현재 마크다운 문자열 제출)은 유지했다.

- `components/useMarkdownScrollSync.ts`
  - `useMarkdownScrollSync(rootRef, value, enabled = true)` 인자를 추가했다.
  - `enabled`가 false이면 컨트롤러를 만들지 않고, 이미 생성된 컨트롤러가 있으면 `destroy()`로 정리한다.
  - 값 변경 반영도 `enabled`가 true일 때만 수행하게 해서 모바일 단일 패널 상태에서 불필요한 mirror/observer 작업이 일어나지 않게 했다.

- `app/globals.css`
  - `.markdown-editor-widget .w-md-editor*`에 한정된 모바일 CSS만 추가했다.
  - 툴바는 좁은 화면에서 가로 스크롤되도록 했고, 에디터 영역과 프리뷰 패널은 모바일에서 전체 폭을 쓰도록 보정했다.

# Design Decisions

- `preview` 전환은 CSS가 아니라 `MarkdownEditor`의 React 상태로 처리했다. 대안은 CSS로 프리뷰 패널만 숨기는 방식이었지만, 라이브러리의 분할/단일 패널 동작은 `preview` prop이 소유한다. CSS로 숨기면 내부 DOM과 스크롤 싱크는 여전히 live 분할처럼 동작할 수 있어 요구사항인 "작성 우선 + 미리보기 토글"과 자원 정리 조건을 만족하기 어렵다.

- 브레이크포인트는 Tailwind의 `md` 경계와 맞춰 `max-width: 767px`로 잡았다. 대안은 임의의 430px 전화면 전용 기준이었지만, 플랜이 `md` 이상 데스크톱 유지라고 명시했고 태블릿/넓은 모바일의 경계도 프로젝트의 Tailwind 기준과 맞추는 편이 예측 가능하다.

- 모바일 모드는 `edit`을 기본값으로 유지하고, 데스크톱으로 돌아가면 `mobileMode`를 다시 `edit`로 리셋했다. 대안은 마지막 모바일 모드를 계속 보존하는 것이었지만, 데스크톱은 항상 `live`라 모바일 내부 상태가 보이지 않는다. 다시 모바일로 줄였을 때 작성 우선 원칙을 일관되게 보장하기 위해 리셋을 선택했다.

- 스크롤 싱크 훅 내부의 기존 `destroy()` 구현을 재사용하도록 `enabled` 인자를 추가했다. 대안은 `MarkdownEditor`에서 조건부로 훅을 호출하는 것이지만 React 훅 규칙에 맞지 않는다. 또 별도 teardown 함수를 새로 만들면 기존 정리 경로와 중복되어 누락 위험이 커진다.

- 모바일 미리보기는 기존 `components.preview`의 `MarkdownView content={source} compact annotateLines`를 그대로 사용했다. 대안은 별도 `<MarkdownView>`를 버튼 아래에 직접 렌더링하는 방식이었지만, 그러면 데스크톱 프리뷰와 라이브러리 프리뷰 모드의 렌더링 경로가 갈라지고 에디터 내부 높이/스크롤 동작도 달라질 수 있다.

- 툴바 넘침은 에디터 wrapper 클래스인 `.markdown-editor-widget` 아래의 `.w-md-editor` 규칙으로만 보강했다. 대안은 전역 `.w-md-editor-toolbar`를 직접 수정하는 것이었지만, 플랜의 범위는 관리자 에디터 한정이고 공개 Markdown 렌더링이나 craft 전역 스타일은 건드리지 않아야 한다.

# Deviations from Plan

None.

# Tests

자동 테스트 스위트는 프로젝트에 없다. `package.json`에는 `test` 스크립트가 없어서 별도 테스트 명령은 실행하지 않았다.

검증으로 `npm run lint`, `npm run build`, `git diff --check`를 실행했다. 처음에는 `node_modules`가 없어 `next: command not found`로 실패했으나, `package-lock.json` 기준으로 `npm ci`를 실행한 뒤 다시 검증했고 모두 통과했다.

# Verification

- `npm ci`
  - 성공. 550개 패키지 설치.
  - npm audit이 기존 의존성 취약점 8개(중간 3, 높음 5)를 보고했지만, 이번 이슈 범위 밖이라 수정하지 않았다.

- `npm run lint`
  - 성공.
  - 출력 요약: `✔ No ESLint warnings or errors`

- `npm run build`
  - 성공.
  - 출력 요약: Next.js 14.2.35 production build compiled successfully, type/lint check passed, static page generation completed.
  - 빌드 중 기존 경고로 보이는 `Using edge runtime on a page currently disables static generation for that page`가 출력되었다.

- `git diff --check`
  - 성공. whitespace error 없음.

- Production server smoke check
  - `npm run start`로 `http://localhost:3000` production server를 실행했다.
  - `curl -I http://localhost:3000/admin/posts/new` 결과는 `307 Temporary Redirect`이고 `location: /admin/login`이었다.
  - 이 워커에는 Supabase 관리자 로그인 자격증명이나 세션 쿠키가 제공되지 않았기 때문에, acceptance의 "프로덕션 빌드 실브라우저에서 에디터 화면 직접 확인"은 수행하지 못했다. 보호 라우트 접근이 인증에서 차단되는 것을 확인했고, 이 제한은 아래 Escalations에도 기록한다.

# Escalations

관리자 인증 세션 없이 `/admin/posts/new`와 `/admin/posts/[id]/edit` 에디터 화면에 접근할 수 없어서 production browser에서 모바일/데스크톱 UI를 직접 확인하지 못했다. PM 또는 다음 검증자는 Supabase admin 계정으로 로그인한 production server 세션에서 다음을 확인해야 한다.

- 360-430px 폭에서 작성 패널이 전체 폭으로 표시되는지
- 모바일 토글 버튼으로 `미리보기`와 `작성`이 전환되는지
- 데스크톱 폭에서 기존 live 분할과 스크롤 싱크가 유지되는지
- 모바일 툴바가 화면 밖으로 깨지지 않고 가로 스크롤되는지

<!-- 복원 메모: 이 report.md는 Developer가 issue-10 worktree에 작성한 원문이다. PM이 worktree 삭제 전 main DOCDIR로 복사하지 못해 사후 복원했다(내용은 원문 그대로). -->
