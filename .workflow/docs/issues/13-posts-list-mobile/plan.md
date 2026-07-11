# Plan — #13 글 목록 페이지(`/admin/posts`) 모바일

> **For the next worker (zero context 가정):** 이 문서는 개인 블로그(ShyLog, Next.js 14 App Router + Tailwind, 크래프트 종이 디자인)의 **관리자 글 목록 페이지를 폰에서 안전하게 만드는** 작업 계획입니다. 에픽 "관리자 모바일 최적화"(GitHub milestone #1, 트래킹 이슈 #15)의 다섯 이슈 중 **Issue D**에 해당하며, 에픽 설계는 `.workflow/docs/epics/admin-mobile/design.md`에 있습니다. 이 계획은 *무엇을/왜*만 다루고, *어떻게*(줄 번호·클래스명·코드)는 Developer가 결정합니다.

## Goal

관리자 글 목록 페이지(`/admin/posts`, 파일 `app/admin/posts/page.tsx`) 전체를 폰(~360–430px, 하한 320px까지 고려)에서 가로 넘침 없이 쓸 수 있게 반응형으로 보정한다. 구체적으로 (1) 상단 헤더의 제목 + [카테고리 관리][+ 새 글][로그아웃] 3버튼 클러스터가 좁은 화면에서 겹치거나 화면 밖으로 넘치지 않게 래핑/세로 스택하고, (2) 목록 행의 아주 긴 제목이 확실히 `truncate`되어 행이 가로로 밀리지 않게 안쪽 flex의 shrink/`min-width` 보정을 한다. 상태 필터 탭 동작과 데스크톱 표시는 그대로 유지한다.

## Scope Fence (Phase 1에서 사용자 승인 완료)

**Must do**
- 헤더 제목 + 3버튼 클러스터가 폰에서 넘치지 않게 래핑 또는 세로 스택.
- 목록 행의 긴 제목이 `truncate`되도록 안쪽 flex의 shrink/`min-width` 보정, 상태 배지·편집 링크 유지.
- 상태 필터 nav의 동작(탭 링크로 `?status=` 필터) 유지.

**Must NOT touch**
- 다른 admin 페이지·컴포넌트(에디터/모달/카테고리 = 형제 이슈 #10·#11·#12·#14 소유).
- 목록 조회 쿼리·`logoutAction` 등 서버 액션 — 레이아웃/스타일만, 동작 변경 없음.
- `components/Layout.tsx`(공개 셸, 공유).
- 데스크톱(`md:` 이상) 표시는 시각적으로 동일하게 유지.

**Sequencing**
- Depends on: 없음. 소유 파일 `app/admin/posts/page.tsx` 단독이라 형제 이슈와 독립·병렬 진행 가능.

## Approach

### 채택: 페이지 자체 마크업에 Tailwind 반응형 프리픽스 + shrink/min-width 보정만 추가
데스크톱 레이아웃은 손대지 않고, 폰 폭(`md:` 미만)에서만 헤더를 세로 스택 + 버튼 클러스터 래핑으로 전환하고, 목록 행 안쪽 flex가 제목을 truncate할 수 있게 shrink 계약을 보정한다. 새 컴포넌트·클라이언트 상태·드로어 없이 순수 서버 컴포넌트의 className 조정으로 끝낸다.

*why:* 이 페이지는 `components/Layout.tsx`의 `<main className="min-w-0">` 안, 컨테이너 `mx-auto w-full max-w-[1440px] px-4`(Layout.tsx:17,26)에 이미 감싸져 폰에서 단일 컬럼으로 흐른다. 즉 바깥 셸은 이미 반응형이므로 **페이지 안쪽 두 지점(헤더 클러스터, 목록 행 안쪽 flex)만** 보정하면 목표가 충족된다. 에픽 설계(`design.md`의 "Approach / architecture")가 정한 방침 — 공용 셸을 새로 만들지 않고 화면별로 Tailwind 반응형 프리픽스와 최소 조건부 렌더링만 더한다 — 과도 일치한다.

### 기각한 대안
- **모바일 전용 헤더 컴포넌트/드로어 신설**: 에픽 비목표("관리자 전용 모바일 내비 드로어 신설" 명시적 제외, design.md "Epic-level Non-goals"). 3버튼 래핑으로 충분한데 새 UX 도입은 과함.
- **헤더를 sticky/재배치하는 구조 변경**: Acceptance는 "겹치거나 넘치지 않는다"만 요구. 스크롤 고정 등은 데스크톱 표시를 바꿀 위험이 있어 스코프 밖.
- **목록 행을 세로 스택으로 재설계**: 긴 제목 문제의 원인은 레이아웃 구조가 아니라 안쪽 flex의 min-width 계약 부재이므로, 구조를 바꾸기보다 shrink 보정이 최소·정확하다.

## Design decisions (각 항목 코드 근거 명시)

1. **헤더는 폰에서 세로 스택(제목 위 / 버튼 클러스터 아래), 데스크톱은 현행 가로 space-between 유지. 버튼 클러스터 자체도 래핑 가능하게 한다.**
   - *why:* 현재 헤더는 `flex items-center justify-between`(page.tsx:45)에 wrap·스택이 전혀 없고, 그 안 3버튼은 `flex gap-2`(page.tsx:47)로 한 줄 고정이다. 제목 "글 관리"와 3버튼이 한 행 space-between이면 폰 폭에서 버튼 클러스터가 넘친다. 세로 스택으로 제목과 버튼 줄을 분리하면 버튼 줄이 폭 전체를 쓰고, 그래도 320px급에서 빠듯할 수 있으니 클러스터에 래핑 여지를 둔다. 데스크톱은 `md:` 이상에서 기존 가로 배치를 복원해 시각적으로 동일하게 둔다.

2. **목록 행: 제목 링크가 실제로 `truncate`되도록 안쪽 flex와 제목 링크에 min-width 축소를 허용하고, 상태 배지와 편집 링크는 축소되지 않게 고정한다.**
   - *why:* 제목 링크에는 이미 `truncate`가 걸려 있으나(page.tsx:95), truncate(=overflow hidden + nowrap)는 flex item의 min-width가 auto인 한 내용 크기 아래로 줄지 않아 무력화된다. `min-w-0`는 바깥 컨테이너(page.tsx:91)에만 있고, 제목 링크+상태 배지를 담은 안쪽 `flex items-baseline`(page.tsx:92)에는 shrink/min-width 축소 계약이 없다. 따라서 긴 제목이 줄지 못하고 배지를 밀어 행이 가로로 넘친다. 안쪽 flex(그리고 그 안 제목 링크)가 min-width로 줄 수 있게 하고, 상태 배지(page.tsx:100)와 우측 편집 링크(page.tsx:107)는 축소 금지로 두어 항상 온전히 보이게 한다.
   - 참고: slug 줄(page.tsx:105)도 이미 `truncate`가 있고 `min-w-0` 바깥 컨테이너 직속이라 별도 보정 없이 함께 해결된다. Developer가 확인만 하면 된다.

3. **상태 필터 nav는 동작 유지, 필요 시 폰에서 넘치지 않게만 처리한다.**
   - *why:* nav는 `flex gap-3 text-sm`(page.tsx:71)의 짧은 탭 4개(전체/공개/비공개/초안)라 폰에서도 대개 한 줄에 들어간다. Acceptance는 "상태 필터 탭 동작 유지"만 요구하므로 링크 구조(`?status=` 쿼리)와 활성 표시(밑줄)는 그대로 두고, 가로 넘침이 실제로 관찰되면 래핑 정도의 최소 보정만 허용한다(구조·동작 변경 금지).

4. **모두 서버 컴포넌트의 className 조정으로 처리, 클라이언트 컴포넌트화 금지.**
   - *why:* 현재 페이지는 `async` 서버 컴포넌트(page.tsx:17)로 Supabase 조회를 직접 수행한다. 목표는 순수 레이아웃/스타일이며 상태나 이벤트 핸들러가 필요 없으므로 `'use client'` 전환은 불필요하고 조회 아키텍처를 흔든다.

## Constraints
- 데스크톱(`md:` 이상) 표시는 시각적으로 동일해야 한다. 반응형 프리픽스는 폰(`md:` 미만) 조정에만 쓴다.
- 크래프트 디자인 토큰(`craft-card`, `craft-*`, `ink-*` 색) 유지 — 새 색/보더 도입 없이 기존 유틸리티 재사용.
- 서버 액션·조회 쿼리·prop 시그니처 변경 없음.
- `npm run lint`와 `npm run build` 통과. UI 검증은 프로덕션 빌드(`next build && next start`)로 실브라우저 확인 — `next dev`는 Fast Refresh가 앱 CSP(`unsafe-eval` 미허용)에 막혀 하이드레이션이 실패하므로 UI 검증에 쓰지 않는다(에픽 design.md 및 프로젝트 메모리 근거).

## Edge cases
- **아주 긴 제목(공백 없는 긴 문자열 포함) + 상태 배지 동시**: 제목은 `…`로 truncate, 상태 배지와 편집 링크는 온전히 유지되어야 하고 행은 절대 가로로 넘치지 않아야 한다.
- **공개 글(배지 없음)**: 상태 배지는 `visibility !== 'public'`일 때만 렌더(page.tsx:99)되므로, 배지 없는 행에서도 truncate가 정상 동작해야 한다.
- **빈 목록**: "작성된 글이 없습니다" 행(page.tsx:116-118)은 기존 그대로.
- **320px 하한**: 헤더 3버튼이 세로 스택 후에도 한 줄에 안 들어가면 래핑으로 흘러 겹치지 않아야 한다.
- **데스크톱 회귀 없음**: `md:` 이상에서 헤더·행 모양이 현행과 픽셀 단위로 동일해야 한다.

## Non-goals
- 형제 이슈가 소유하는 다른 admin 화면(#10·#11 에디터 = CLOSED, #12 출간 모달, #14 카테고리 트리) 변경.
- 서버 액션(`logoutAction`)·조회 쿼리·인증·DB 변경.
- `components/Layout.tsx`(공개 셸) 변경.
- 상태 필터의 신규 기능(정렬·검색·페이지네이션 등) 추가.
- 모바일 전용 신규 UX(드로어/바텀시트 등, 에픽 비목표).

## Acceptance (이슈 #13 기준)
- 폰에서 헤더 제목 + 3버튼이 겹치거나 넘치지 않는다(래핑/세로 스택).
- 아주 긴 제목의 목록 행도 가로로 넘치지 않고 `truncate`되며, 상태 배지와 편집 링크가 유지된다.
- 상태 필터 탭 동작 유지.
- 데스크톱 표시는 시각적으로 동일.
- `npm run lint`/`build` 통과, 프로덕션 빌드 실브라우저 확인.
