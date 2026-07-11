# Summary

Issue #11의 관리자 글쓰기/편집 화면 모바일 크롬을 구현했다. 하단 고정 액션바는 360-430px 폭에서 세로/줄바꿈 배치로 전환되고 `env(safe-area-inset-bottom)`을 반영하며, 본문 하단 예약 공간도 모바일 바 높이에 맞췄다. 제목 입력은 자동 높이 조절 `textarea`로 바꿔 긴 제목을 소프트랩으로 모두 보여주되 실제 제출 값에는 하드 개행이 들어가지 않게 했다.

신규/편집 폼은 모바일에서만 별도 에디터 높이를 넘기도록 했고, 데스크톱은 기존 `calc(100vh - 260px)` 값을 유지한다. 태그 삭제 버튼과 편집 모달의 "이 글 삭제" dangerZone 버튼은 모바일 터치 타깃을 키웠다.

# Files Changed

- `components/PostEditorShell.tsx`: 모바일 상단 여백을 줄이고, 하단 예약 공간을 `calc(144px + env(safe-area-inset-bottom))`로 확장했다. 고정 액션바는 모바일에서 세로 스택, `sm` 이상에서 기존 가로 `justify-between` 구조로 돌아가도록 했다.
- `components/TitleInput.tsx`: `<input>`을 자동 높이 `textarea`로 전환했다. `name`, `required`, `onBlur`, placeholder, aria label은 유지했고, Enter 및 붙여넣기 개행은 공백으로 정규화한다.
- `components/TagInput.tsx`: 태그 칩과 제거 버튼의 모바일 hit area를 키웠다. `sm` 이상에서는 기존 16px 제거 버튼 크기로 복귀한다.
- `app/admin/posts/new/NewPostForm.tsx`: 액션 버튼들이 모바일에서 44px 이상 터치 높이를 갖고 우측 클러스터가 줄바꿈되도록 조정했다. 모바일/데스크톱 breakpoint에 따라 `MarkdownEditor`의 `height` prop 값만 바꿔 넘긴다.
- `app/admin/posts/[id]/edit/EditPostForm.tsx`: 신규 폼과 같은 액션바/에디터 높이 처리를 적용했고, dangerZone 삭제 버튼의 모바일 터치 높이를 키웠다.

# Design Decisions

1. 제목은 `textarea`로 전환했다. 대안은 기존 `<input>`에 `truncate`나 작은 글씨만 적용하는 것이었지만, `<input>`은 줄바꿈이 불가능하고 truncate는 "전체가 보이게"라는 요구를 만족하지 못한다. `textarea`는 폼 제출의 `name="title"` 계약을 유지하면서 시각적 줄바꿈을 제공한다.

2. 제목 개행은 입력 단계에서 제거했다. 대안은 서버 액션이나 제출 직전에만 정규화하는 것이었지만, 그러면 편집 중 UI와 실제 저장 값이 달라진다. `onKeyDown`으로 Enter를 막고 `onChange`에서 붙여넣기 개행을 공백으로 바꿔, 화면과 제출 값이 같은 단일 문자열이 되게 했다.

3. 에디터 높이는 폼에서 `height` prop 값만 반응형으로 바꿨다. 대안은 `MarkdownEditor` 내부나 전역 CSS를 수정하는 것이었지만, 이는 #10 소유 영역이고 이번 이슈의 scope fence를 넘는다. 모바일에서는 `max(320px, calc(100dvh - 22rem))`, 데스크톱에서는 기존 `calc(100vh - 260px)`를 사용해 데스크톱 시각 변화를 피했다.

4. 하단 액션바는 셸에서 구조를 바꾸고 각 폼에서 액션 클러스터만 보정했다. 대안은 에러 메시지를 토스트로만 옮기는 것이었지만, 데스크톱 동작과 폼의 인라인 오류 표시를 바꿀 필요가 없다. 모바일에서만 에러 메시지를 한 줄 전체로 놓고 버튼들을 wrap시켜 overflow 원인을 제거했다.

5. 터치 타깃 확대는 모바일 breakpoint에 한정했다. 대안은 모든 viewport에서 버튼 크기를 키우는 것이었지만, 데스크톱 레이아웃 시각 동일성이 acceptance에 포함되어 있다. 그래서 `sm:` 이상에서는 기존 높이/폭에 가깝게 돌아가도록 했다.

# Deviations from Plan

None.

# Tests

자동 테스트 스위트는 없는 프로젝트라 새 테스트 파일은 추가하지 않았다. 변경 범위가 레이아웃/입력 UX 중심이어서 `npm run lint`, `npm run build`, production server smoke check로 검증했다.

# Verification

- `npm ci`: 성공. fresh worktree에 `node_modules`가 없어 최초 `npm run lint`/`npm run build`는 `next: command not found`로 실패했기 때문에 lockfile 기준으로 의존성을 설치했다.
- `npm run lint`: 성공. `✔ No ESLint warnings or errors`
- `npm run build`: 성공. Next.js 14.2.35 production build, type check, static page generation 완료.
- `npm run start`: 성공. `http://localhost:3000` production server 기동 확인.
- `curl -I http://localhost:3000/admin/posts/new`: 성공. 비로그인 상태에서 `/admin/login`으로 `307 Temporary Redirect` 확인.
- `curl -I http://localhost:3000/admin/login`: 성공. `200 OK` 확인.

실브라우저 모바일/데스크톱 시각 검증은 이 프로세스에서 완료하지 못했다. browser skill 지침에 따라 in-app browser bridge를 찾았지만 `node_repl` JavaScript 실행 도구가 노출되지 않았고, 관리자 글쓰기 화면은 인증이 필요한 보호 라우트라 production server에서 직접 시각 확인까지 진행할 수 없었다.

# Escalations

None.
