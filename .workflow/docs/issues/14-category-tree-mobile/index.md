# Issue #14 — 카테고리 관리 트리 모바일

> **For the next worker (zero context 가정):** 개인 블로그(ShyLog, Next.js 14 App Router + Tailwind, 크래프트 종이 디자인)의 관리자 카테고리 관리 화면(`/admin/categories`) 트리 행을 폰에서 조작할 수 있게 반응형 보정한 작업의 전체 기록입니다. 에픽 "관리자 모바일 최적화"(GitHub milestone #1, 트래킹 이슈 #15)의 다섯 이슈 중 **Issue E**. 에픽 설계: `.workflow/docs/epics/admin-mobile/design.md`.

## 최종 상태

- **완료 · 병합됨 (CLOSED)**
- GitHub 이슈: [#14](https://github.com/NJ97S/personal-blog/issues/14)
- PR: [#20](https://github.com/NJ97S/personal-blog/pull/20) — squash 병합, `main` 커밋 `f5db957`
- fresh-eyes 코드 리뷰 결과: **APPROVE** (blocking 0건)

## 무엇을 바꿨나

`app/admin/categories/CategoryAdmin.tsx` 한 파일만 수정. 폰(`md:` 미만)에서:
1. **아이콘 버튼 히트 영역 확대** — 위/아래/편집/삭제 `IconButton`을 `h-11 w-11`(44px)로, `md:` 이상은 기존 `h-7 w-7`(28px) 유지. 아이콘(`h-4 w-4`) 크기는 불변(형제 #11 선례: 아이콘 유지, 히트 영역만 확대).
2. **행 래핑** — 이름 영역(`basis-full`)과 버튼 클러스터(`ml-auto`)가 두 줄로 분리되어 좁은 폭에서 겹침/클리핑 방지. `md:`에서 기존 한 줄 배치(`md:flex-nowrap md:items-center`, `md:basis-auto`)로 복원.
3. **긴 이름 `break-words`** 로 320px 하한에서도 가로 오버플로 방지.

들여쓰기·서버 액션(`app/actions/categories.ts`)·prop 시그니처·편집/추가 폼(`CategoryForm`)·삭제 확인(`confirm`) 로직·트리 렌더 depth 상한(3단계)은 **불변**. 데스크톱 표시 실질 동일.

### 왜 이렇게 했나 (핵심 결정 근거)
- 실제 렌더되는 최대 들여쓰기는 **52px(depth 2)** — `CategoryAdmin.tsx`의 `renderChild` 재귀가 손자 아래를 `() => null`로 잘라 depth 3 이상은 행으로 렌더되지 않음. 이슈 배경의 "depth 3 → 72px"는 공식값일 뿐. 따라서 폰 래핑만으로 클리핑이 해소되어 들여쓰기 축소는 불필요.
- 44px 버튼 4개(gap 포함 ≈188px)는 320px 폭에서 이름과 한 줄에 두면 충돌 → 이름/버튼 줄 분리가 최소·정확한 해법. "더보기 메뉴" 접기는 새 상태/팝오버 UX라 "디자인 유지 + 반응형 보정" 방침 초과로 기각.

## 검증
- `npm run lint` / `npm run build` 통과
- 브라우저 레이아웃 fixture(실제 `TreeRow` 마크업 + `next build` CSS): 320px·430px에서 버튼 44×44px·이름/버튼 겹침 없음, 768px에서 28×28px·한 줄 유지 확인
- `git diff --check` 통과

## 문서 (이 폴더)

| 문서 | 내용 |
| --- | --- |
| [plan.md](plan.md) | PM 계획 — Goal / Scope Fence / Approach / Design decisions / Constraints / Edge cases / Non-goals |
| [plan-review.md](plan-review.md) | fresh-eyes 계획 리뷰 (Codex) — 결과 **PASS** |
| [report.md](report.md) | Developer 구현 리포트 — 변경 파일·설계 결정·검증 |
| [pr-review-r1.md](pr-review-r1.md) | fresh-eyes 코드 리뷰 R1 (Codex) — 결과 **APPROVE** |

## 라이프사이클 요약

P1 컨텍스트+스코프 펜스(승인) → P2 솔루션 탐색 → P3 계획 → P4 라우팅(펜스 밖 문제 없음) → P5 계획 리뷰(PASS) → 계획 승인 → P6 worktree+Developer 구현(이탈/에스컬레이션 없음) → P7 push+PR #20 → P8 코드 리뷰(APPROVE, R1) → P9 squash 병합·이슈 CLOSED.
