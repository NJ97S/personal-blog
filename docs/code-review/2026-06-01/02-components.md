# 컴포넌트 코드리뷰

> 검토자: `code-reviewer` (Opus) · 검토일: 2026-06-01 · 범위: `components/**` (32 파일, 28 .tsx + 4 .ts)

## 요약
- 검토 컴포넌트 수: 32개
- TypeScript 컴파일: PASS (컴포넌트에는 오류 없음. `.next/types/`에 삭제된 `app/scroll-test/page.tsx` 관련 잔여 오류 2건이 있으나 `.next` 재생성으로 해소됩니다)
- 심각도 분포: **CRITICAL 1 · HIGH 4 · MEDIUM 6 · LOW 5 · INFO 4**
- 핵심 발견 (4줄)
  1. `JsonLd.tsx`가 `dangerouslySetInnerHTML`에 `JSON.stringify` 결과를 그대로 삽입해 `</script>` 이스케이프가 누락되었습니다.
  2. `PublishModal.tsx`와 `CategoryDrawer.tsx`는 모두 포커스 트랩이 없어 모달/드로어 열림 상태에서 Tab으로 배경 요소로 빠져나갈 수 있습니다.
  3. `ShareButton.tsx`의 `setTimeout`이 정리되지 않아 언마운트 후 `setCopied` 호출 위험이 있습니다.
  4. `CommentForm.tsx`가 `useFormState` (react-dom)에 의존하는데 React 18.3에서 deprecated 표시되며 React 19에서는 `useActionState`(react)로 이전되어야 합니다.

---

## 발견사항

### 🔴 Critical

- **[`components/JsonLd.tsx:5`] `<script>` 태그 내 `</script>` 이스케이프 누락 XSS 가능성**

  ```tsx
  dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
  ```

  `JSON.stringify`는 값 내부의 `</script>` 시퀀스를 이스케이프하지 않습니다. JSON-LD에 들어가는 `data`가 사용자 입력(글 제목·발췌 등)에서 유래한다면 공격자가 `"</script><script>alert(1)</script>"` 같은 페이로드를 주입할 수 있습니다.

  **권장 조치**: 결과 문자열에서 `<` 시퀀스를 이스케이프합니다.
  ```tsx
  __html: JSON.stringify(data).replace(/</g, '\\u003c')
  ```

---

### 🟠 High

- **[`components/PublishModal.tsx:86-101`] 모달 포커스 트랩 부재**
  - `aria-modal="true"`는 지정되어 있으나 실제 포커스가 모달 내부에 갇히지 않습니다 (WCAG 2.4.3 위반).
  - 열림 시 첫 포커스 가능한 요소로 이동시키지 않고, 닫힘 시 트리거로 포커스를 복원하지 않습니다.
  - **권장 조치**: `focus-trap-react`나 `inert`를 활용해 포커스를 가두고, 열림·닫힘 시 포커스 이동 / 복원 로직을 추가합니다.

- **[`components/CategoryDrawer.tsx:33-68`] 드로어 포커스 트랩 부재**
  - `role="dialog" aria-modal` 사용하면서 `body.style.overflow='hidden'`만 처리하고 포커스 트래핑은 없습니다.
  - **권장 조치**: PublishModal과 동일한 패턴으로 처리합니다.

- **[`components/ShareButton.tsx:13`] `setTimeout` 클린업 누락**
  ```tsx
  setTimeout(() => setCopied(false), 1500)
  ```
  - 1.5초 이내 언마운트 시 `setCopied`가 마운트 해제된 컴포넌트에서 호출됩니다.
  - **권장 조치**: `useRef`로 timer ID를 보관하고 cleanup에서 `clearTimeout`을 호출하거나, `useEffect` 내부에서 타이머를 관리합니다.

- **[`components/MarkdownView.tsx:41`] `any` 타입 사용**
  ```tsx
  const walk = (node: any) => { ... }
  ```
  - `rehypeSourceLine` 내부에서 hast 노드를 `any`로 타이핑해 타입 안전성이 사라집니다.
  - **권장 조치**: `import type { Root, Element } from 'hast'`로 교체하고 노드별 타입 가드를 추가합니다.

---

### 🟡 Medium

- **[`components/CommentForm.tsx:3,37`] `useFormState`는 React 18.3에서 deprecated**
  - 현재 React 18.3.1 사용 중. `react-dom`의 `useFormState`는 deprecated 경고를 출력하며 React 19에서는 `react`의 `useActionState`로 이전됩니다.
  - **권장 조치**: 마이그레이션을 계획하거나, Next.js 15 업그레이드 시 일괄 변경하도록 TODO 주석을 남깁니다.

- **[`components/PublishModal.tsx:86-94`] 닫힘 상태에서도 모달 DOM이 상시 렌더링됨**
  - `opacity-0 pointer-events-none`만 적용해 숨김 처리합니다. 스크린 리더에서 숨겨진 콘텐츠를 읽을 가능성이 있습니다.
  - **권장 조치**: `{open && <div>...</div>}`로 조건부 렌더링하거나 `<dialog>` / `@headlessui/react` Dialog로 전환합니다.

- **[`components/useMarkdownScrollSync.ts:376`] 의도적 stale-effect의 ESLint 비활성화 사유 명문화 필요**
  ```tsx
  useEffect(() => { /* ... */ }, [rootRef])   // eslint-disable-next-line react-hooks/exhaustive-deps
  ```
  - `value`를 의존성에서 제외한 설계는 올바르지만, 주석에 이유를 명시하면 유지보수성이 좋아집니다.

- **[`components/InfinitePostList.tsx:25-27`] `seenIdsRef`가 `initialItems` 변경 시 재초기화되지 않음**
  ```tsx
  const seenIdsRef = useRef<Set<string>>(
    new Set(initialItems.map((item) => item.id)),
  )
  ```
  - 부모가 `initialItems`를 새로 제공해도(예: 카테고리 변경) 이전 ID가 계속 남아 신규 데이터의 같은 ID가 중복 필터링됩니다.
  - **권장 조치**: `initialItems` 변경 시 `seenIdsRef`를 리셋하는 effect를 추가하거나, 부모에서 `key` prop으로 재마운트시킵니다.

- **[`components/PostToc.tsx:12-46`] 빈 의존 배열로 SPA 전환 시 목차 미갱신**
  - 동일 라우트 패턴(`/posts/[slug]`) 사이 클라이언트 전환 시 목차가 다시 만들어지지 않습니다.
  - **권장 조치**: `usePathname()` 또는 포스트 ID를 의존성에 추가합니다.

- **[`components/widgets/RecentComments.tsx:35`] `as unknown as CommentRow[]` 이중 캐스팅**
  - 복합 쿼리 결과의 실제 타입과 선언이 어긋나 이중 캐스팅으로 우회합니다.
  - **권장 조치**: `supabase gen types`로 자동 생성된 타입을 사용하고, 뷰·RPC에 대한 타입도 포함합니다.

---

### 🟢 Low

- **[`components/Footer.tsx:5`] `new Date().getFullYear()`가 빌드 시점에 고정될 수 있음** — 정적 생성 환경에서 연말·연초 표기 불일치 가능. 영향은 미미합니다.
- **[`components/TagInput.tsx:55`] hidden input이 쉼표 구분 문자열**
  ```tsx
  <input type="hidden" name={name} value={tags.join(',')} />
  ```
  `addTag`에서 쉼표를 제거하므로 실질적 안전성은 확보되어 있으나, 서버에서 파싱 규약을 모르면 혼동 가능. JSON 직렬화 권장.
- **[`components/CommentItem.tsx:66-97`] 서버 액션 호출에 `try/catch` 부재** — 네트워크 단절 시 unhandled rejection 가능.
- **[`components/CategoryTree.tsx:60`] `useState` 초기값 고정** — SPA 전환으로 활성 카테고리가 바뀌어도 `open`이 갱신되지 않습니다. `useEffect`로 동기화하거나 `key`로 재마운트합니다.
- **[`components/MarkdownView.tsx:10-33`] `sanitizeSchema`의 얕은 복사** — 현재 `rehype-sanitize` v6은 스키마를 변형하지 않아 안전하지만, 향후 버전에서는 깊은 복사 고려.

---

### ℹ️ Info / 개선 제안

- `MarkdownView.tsx`에서 `rehypeSourceLine`을 `rehypeSanitize` 이후에 실행하는 설계는 올바릅니다. `data-line` 속성이 sanitizer를 우회할 필요가 없습니다.
- `useMarkdownScrollSync.ts`의 CRLF/코드블록 대응 설계가 견고합니다. ZWSP로 빈 줄 높이를 유지하고 `textarea` computed style을 미러에 복제해 `word-break` 불일치를 막습니다. `monotonic()` 보장과 `bisect()` O(log n) 탐색이 인상적입니다.
- `components/` 전반의 `'use client'` 경계가 적절합니다. 17개 서버 + 15개 클라이언트로 분리.
- `MarkdownView`는 서버 컴포넌트로 유지 가능합니다. `MarkdownEditor`가 클라이언트 경계 안에서만 사용합니다.

---

## 컴포넌트별 메모

### MarkdownEditor / useMarkdownScrollSync
- off-screen mirror + line-map 접근법으로 비선형 높이 관계를 정확히 처리합니다.
- `destroy()`에서 `cancelAnimationFrame`, `clearTimeout`, observer disconnect, listener 제거를 모두 수행합니다.
- `contentObserver`로 preview content 노드 교체 시 재바인딩하는 로직이 올바릅니다.
- `MutationObserver`로 동적 import된 에디터 DOM 마운트를 감지하는 패턴이 적절합니다.

### InfinitePostList
- `IntersectionObserver` 설정/해제가 cleanup에서 올바르게 처리됩니다.
- `loadingRef`로 중복 호출 방지 패턴 적절.
- `aria-live="polite"` 적용으로 로딩·에러 상태 접근성을 챙겼습니다.
- 폴백 "더 보기" 버튼이 IntersectionObserver 미지원 환경을 커버합니다.
- 단, `seenIdsRef`가 props 변경 시 재초기화되지 않는 문제는 위 Medium 항목 참고.

### PublishModal
- 291줄로 가장 큰 컴포넌트이나 단일 책임(출간 설정)이라 허용 범위입니다.
- 파일 업로드 시 클라이언트 측 타입·크기 검증 적절. 서버 사이드 검증도 함께 확인 권장.
- `uploading` 상태로 제출 버튼 비활성화 → 중복 제출 방지.

### CommentForm / CommentItem / CommentList
- 낙관적 업데이트 없는 보수적 흐름. 안전성은 좋으나 UX 약간 느림.
- `CommentItem`에서 `try/catch` 부재로 네트워크 에러에 취약.
- 비밀번호 기반 댓글 인증 + localStorage `editToken` 이중 체계가 잘 구현되어 있습니다.

---

## 좋은 점

1. 서버/클라이언트 컴포넌트 경계가 정확합니다(17 + 15). 불필요한 클라이언트 바운더리가 없습니다.
2. 접근성 기본 요소가 일관 적용되어 있습니다 (`aria-label`, `aria-hidden`, `role="status"`, `aria-live`, `sr-only`). ThemeToggle의 `role="switch"` + `aria-checked` 사용이 적절합니다.
3. XSS 방어가 체계적입니다. `rehype-sanitize`가 `defaultSchema` 기반이며 `rehypeSourceLine`을 sanitize 이후에 실행합니다.
4. `useMarkdownScrollSync`의 설계 품질이 매우 높습니다.
5. 중복 제출 방지 패턴이 일관됩니다 (`loadingRef`, `useFormStatus`, `uploading`, `disabled`).
6. 타입 안전성 양호. `any` 1곳, `as unknown` 1곳 외에는 정밀합니다.
7. `console.log`나 빈 `catch` 블록이 없어 프로덕션 준비 상태가 양호합니다.

---

## 후속 액션 권고

1. **(CRITICAL — 즉시)** `JsonLd.tsx`의 `</script>` XSS 벡터 수정.
2. **(HIGH — 가능한 빠르게)** `PublishModal` / `CategoryDrawer` 포커스 트랩 추가.
3. **(HIGH)** `ShareButton` 타이머 정리.
4. **(HIGH)** `MarkdownView.tsx`의 `any`를 hast 타입으로 교체.
5. **(MEDIUM)** `CommentForm`의 `useFormState` → `useActionState` 마이그레이션 계획.
6. **(MEDIUM)** `InfinitePostList`의 `seenIdsRef` 리셋 로직 추가.
7. **(MEDIUM)** `CommentItem`의 서버 액션 호출을 `try/catch`로 감싸기.

**Verdict**: REQUEST CHANGES — CRITICAL 1건, HIGH 4건이 있어 수정 후 재검토를 권고합니다.
