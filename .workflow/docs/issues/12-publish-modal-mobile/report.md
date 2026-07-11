# Summary

`components/PublishModal.tsx`의 출간 모달을 모바일 뷰포트 안에 갇힌 스크롤 가능한 다이얼로그로 바꿨습니다. 모달이 열려 있는 동안 `document.body` 스크롤을 잠그고, 닫히거나 언마운트될 때 원복하도록 기존 Escape 처리 생명주기에 같은 cleanup을 묶었습니다.

본문 필드와 선택적 `dangerZone`은 모달 내부 스크롤 영역에 포함했고, 하단 취소/출간 버튼은 고정 푸터에 남겨 작은 세로 화면에서도 항상 접근 가능하게 했습니다. 닫기, 파일 선택/교체, 제거, 공개/비공개 토글, 취소, 출간 버튼은 모바일에서 최소 44px 수준의 터치 타깃을 갖도록 보정했습니다.

# Files Changed

- `components/PublishModal.tsx`
  - 다이얼로그 루트에 `max-height`, `overflow-hidden`, `flex flex-col`을 추가했습니다.
  - 헤더와 푸터는 `shrink-0`으로 유지하고, 기존 필드 그리드와 `dangerZone`을 `min-h-0 flex-1 overflow-y-auto` 영역 안으로 이동했습니다.
  - `open` 상태의 effect에서 Escape 리스너와 함께 `document.body.style.overflow = 'hidden'`을 설정하고 cleanup에서 원복했습니다.
  - 모달 소유 컨트롤에 모바일 기본 `min-h-11`/`h-11`과 데스크톱 복원용 `md:` 클래스를 적용했습니다.

# Design Decisions

- 본문만 스크롤하고 헤더/푸터는 고정했습니다. 대안은 다이얼로그 전체를 한 덩어리로 스크롤하는 방식이었지만, 그러면 긴 내용에서 취소/출간 버튼이 시야 밖으로 사라집니다. 이번 이슈의 핵심은 모바일에서 마지막 액션까지 신뢰성 있게 도달하는 것이므로, `dangerZone`까지 포함한 가운데 영역만 스크롤하고 푸터는 고정하는 구조를 선택했습니다.

- `dangerZone`은 기존 마크업을 그대로 렌더하되 스크롤 영역 안으로만 옮겼습니다. 대안은 삭제 영역 내부 버튼 크기까지 함께 보정하는 것이었지만, 계획의 Scope Fence가 `dangerZone` 내용 마크업과 터치 크기를 형제 이슈 소유로 명시했습니다. 따라서 C 이슈는 슬롯을 담는 그릇만 반응형으로 만들었습니다.

- 모달을 포털로 옮기지 않았습니다. 대안인 `createPortal`은 시각적 오버레이 관점에서는 깔끔하지만, 현재 `PublishModal`은 호출부 `<form>` 내부에 있고 출간 버튼이 `type="submit"`으로 그 폼 컨텍스트에 의존합니다. 포털 전환은 호출부 변경과 `form` 속성 보강을 요구하므로 이 이슈의 Must NOT touch 범위를 넘습니다.

- 높이 제한은 모바일에서 `100dvh` 기반, 데스크톱에서 `100vh` 기반으로 두었습니다. 모바일 브라우저 주소창 변화에 더 잘 맞는 `dvh`를 기본으로 사용하고, `md:` 이상에서는 기존 데스크톱 시각을 건드리지 않도록 넉넉한 상한만 부여했습니다. 내용이 상한보다 짧으면 레이아웃은 기존과 동일하게 보입니다.

- 배경 스크롤 잠금은 `CategoryDrawer`와 같은 `body.style.overflow` 패턴을 따랐습니다. 대안은 `position: fixed`로 body 위치까지 보존하는 강한 잠금이지만, iOS 보완을 위한 별도 UX/스크롤 복원 로직이 추가되고 코드베이스의 기존 패턴과 달라집니다. 계획도 기존 패턴 수준을 목표로 했으므로 단순한 overflow 잠금을 선택했습니다.

- 모바일 터치 타깃 보정은 기본 클래스로 적용하고 기존 데스크톱 치수는 `md:`로 복원했습니다. 대안은 모든 화면에서 버튼을 크게 만드는 것이었지만, 계획은 데스크톱 표시를 시각적으로 유지하라고 했습니다. 그래서 닫기 버튼은 `h-11 w-11 md:h-7 md:w-7`, 다른 버튼류는 `min-h-11 md:min-h-0` 형태로 제한했습니다.

# Deviations from Plan

None. 구현 방식은 계획의 권장안인 "헤더/푸터 고정 + 본문 스크롤"을 따랐고, prop 인터페이스와 호출부는 변경하지 않았습니다.

# Tests

자동화 테스트 파일은 추가하지 않았습니다. 이 저장소는 별도 테스트 스크립트가 없고, 계획의 필수 검증 명령은 `npm run lint`와 `npm run build`입니다.

검증 과정에서 `node_modules`가 없어 첫 `npm run lint`가 `next: command not found`로 실패했습니다. `package-lock.json` 기준으로 `npm ci`를 실행한 뒤 lint/build를 다시 수행했습니다.

# Verification

- `npm ci`: 성공. npm이 deprecated 패키지 경고와 audit 취약점 8개(3 moderate, 5 high)를 보고했지만 설치는 완료됐습니다.
- `npm run lint`: 성공. `✔ No ESLint warnings or errors`
- `npm run build`: 성공. Next.js 14.2.35 프로덕션 빌드가 컴파일, 타입 검사, 정적 페이지 생성을 완료했습니다. 빌드 중 "edge runtime on a page currently disables static generation for that page" 경고가 있었고 실패는 없었습니다.
- `git diff --check`: 성공. 공백 오류 없음.
- `npm run start`: 서버 시작 성공. `http://localhost:3000`에서 Next production server가 ready 상태가 됐습니다.
- 프로덕션 브라우저/런타임 확인: 차단됨. `/admin/posts/new` 요청이 페이지 렌더 전 middleware에서 `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` 부재로 500을 반환했습니다. 서버 로그의 핵심 오류는 "Your project's URL and Key are required to create a Supabase client!"입니다. 이 worktree에는 필요한 Supabase 환경 변수가 제공되지 않아 실제 관리자 모달을 브라우저에서 열어 확인할 수 없었습니다.

# Escalations

프로덕션 실브라우저 확인에는 PM 결정이 필요합니다. 현재 worktree에 Supabase 환경 변수가 없어 `next start` 상태에서도 `/admin/posts/new`가 middleware에서 500으로 막힙니다. PM이 실제 Supabase env/auth 세션을 제공하거나, 이 검증을 별도 환경에서 수행하도록 승인해야 모바일 스크롤/배경 잠금 동작을 브라우저로 최종 확인할 수 있습니다.
