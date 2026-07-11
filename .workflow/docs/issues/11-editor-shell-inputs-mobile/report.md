# Summary

Directive r1에 따라 관리자 글쓰기/편집 화면의 모바일 하단 액션바 배치를 다시 조정했다. 기존 r0 구현은 모바일에서 `나가기` 버튼이 단독 행으로 가운데에 놓이고, 그 아래에 `임시저장`/`출간하기`가 놓이는 세로 스택이었다. 이번 수정은 모바일에서도 데스크톱처럼 버튼 행을 한 줄로 유지해 `나가기`는 왼쪽, 저장/출간 묶음은 오른쪽에 배치한다.

에러 메시지는 버튼 행과 같은 줄에 두지 않고 모바일에서 전체 폭 별도 행으로 올렸다. 하단 고정 바가 단일 버튼 행 중심으로 줄었으므로 본문 하단 예약 공간도 `144px`에서 `104px + env(safe-area-inset-bottom)`으로 줄였다. r0의 제목 `textarea`, 개행 정규화, 태그/삭제 버튼 터치 타깃, 반응형 에디터 height, dangerZone 변경은 그대로 유지했다.

# Files Changed

- `components/PostEditorShell.tsx`: 모바일 하단 예약 공간을 `calc(104px + env(safe-area-inset-bottom))`로 줄였다. 액션바 내부 컨테이너는 `flex-col` 세로 스택에서 `flex-wrap items-center justify-between` 구조로 바꿔 모바일에서도 기본 버튼 행이 좌우 정렬되게 했다. `sm:` 이상은 `flex-nowrap`와 기존 gap으로 돌아가 데스크톱 시각 구조를 유지한다.
- `app/admin/posts/new/NewPostForm.tsx`: 신규 글 폼의 액션 children 순서와 responsive order class를 조정했다. 모바일에서는 에러 메시지가 `order-1 w-full`로 버튼 위 전체 폭 행이 되고, `나가기`는 `order-2` 왼쪽, 저장/출간 묶음은 `order-3` 오른쪽에 놓인다. 데스크톱에서는 `sm:order-none`과 `sm:ml-auto`로 기존 좌측 나가기, 우측 에러/버튼 인라인 배치를 유지한다.
- `app/admin/posts/[id]/edit/EditPostForm.tsx`: 편집 글 폼에도 신규 폼과 같은 액션바 order/gap/shrink 처리를 적용했다. dangerZone, publish modal props, 서버 액션, dirty tracking, 단축키 로직은 변경하지 않았다.

# Design Decisions

1. 셸은 `flex-col` 대신 wrapping row로 바꿨다. 대안은 폼 내부에서만 grid나 absolute 배치로 버튼을 재배치하는 것이었지만, 고정 바의 좌우 정렬 책임은 `PostEditorShell`에 있다. 셸을 `flex-wrap justify-between`으로 바꾸면 세 폼 액션 조각이 자연스럽게 한 줄에 놓이고, 아주 좁은 폭에서는 directive가 허용한 graceful wrap도 가능하다.

2. 에러 메시지는 action fragment의 직접 자식으로 끌어올렸다. 대안은 기존처럼 우측 버튼 클러스터 안의 `w-full` 문단으로 두는 것이었지만, 그 경우 모바일에서 전체 바 폭이 아니라 오른쪽 클러스터 폭만 차지한다. 직접 자식에 `order-1 w-full`을 주면 모바일에서 진짜 전체 폭 에러 행이 되고, 버튼 행은 별도로 좌우 정렬된다.

3. 데스크톱 에러 배치는 기존 inline 형태를 유지했다. 대안은 모든 viewport에서 에러를 전체 폭 행으로 분리하는 것이었지만, directive가 `sm:` 이상 시각 회귀 없음을 요구했다. 그래서 에러 문단은 모바일에서만 `w-full order-1`이고, `sm:` 이상에서는 `order-none sm:w-auto sm:ml-auto`로 나가기 버튼과 우측 버튼 묶음 사이에 붙는다.

4. 본문 하단 예약 공간은 `104px`로 줄였다. 대안은 기존 `144px`를 유지하는 것이었지만, directive는 2줄 모바일 바 기준으로 크게 잡은 예약을 단일 행 높이에 맞춰 줄이라고 했다. 모바일 버튼 높이 약 44px, 컨테이너 상하 padding 24px, 에러 행이 있을 때의 추가 line-height/gap을 고려해 104px를 선택했다. 이는 평시 단일 버튼 행에서는 과도하지 않고, 에러 메시지가 표시될 때도 고정 바에 본문이 가려질 위험을 낮춘다.

5. 버튼 터치 타깃과 r0의 입력 UX 변경은 건드리지 않았다. 대안은 액션바 재배치 중 버튼 padding이나 publish/draft label을 줄이는 것이었지만, directive가 모바일 약 44px 터치 높이 유지와 다른 #11 변경 보존을 명시했다. 따라서 이번 fix round는 actionbar 관련 class와 에러 위치만 수정했다.

# Deviations from Plan

None.

# Tests

새 테스트 파일은 추가하지 않았다. 이 fix round는 directive가 지정한 세 파일의 actionbar 관련 class 조정으로 한정되며, 프로젝트에는 별도 자동 테스트 스크립트가 없다. 검증은 lint, production build, diff whitespace check, production server route smoke check로 수행했다.

# Verification

- `git diff --check`: 성공. whitespace error 없음.
- `npm run lint`: 성공. `✔ No ESLint warnings or errors`
- `npm run build`: 성공. Next.js 14.2.35 production build, type check, static page generation 완료.
- `npm run start -- -p 3001`: 성공. `http://localhost:3001` production server 기동 확인.
- `curl -I http://localhost:3001/admin/posts/new`: 성공. 비로그인 상태에서 `/admin/login`으로 `307 Temporary Redirect` 확인.
- `curl -I http://localhost:3001/admin/posts`: 성공. 비로그인 상태에서 `/admin/login`으로 `307 Temporary Redirect` 확인.

실브라우저 모바일 시각 검증은 이 leaf process에서 완료하지 못했다. browser skill을 읽고 tool discovery를 시도했지만 Node REPL JavaScript 실행 도구가 노출되지 않았고, production server의 관리자 글쓰기/편집 라우트는 인증 보호로 `/admin/login`에 redirect되었다. 대신 directive가 요구한 layout contract는 class diff 기준으로 확인했다: 모바일 에러는 전체 폭 첫 행, 버튼 세 개는 다음 행의 좌우 정렬, `sm:` 이상은 기존 desktop inline 구조다.

# Escalations

None.
