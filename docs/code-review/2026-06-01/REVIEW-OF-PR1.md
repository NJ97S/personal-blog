# PR #1 머지 직전 객관 검토

> 검토자: `code-reviewer` (Opus, read-only) · 검토 시각: 2026-06-04 · 대상: `NJ97S/personal-blog#1` (`chore/code-review-2026-06-01` → `main`, 30 files, +1637/−90, 7 atomic commits)
> 본 문서는 작성자(`docs(review)`)와 별개의 독립 검토 결과로, 머지 직전 게이트 기록입니다.

## 판정
**🟠 APPROVE WITH NITS** — 머지 차단 사유 없음. MEDIUM 3건은 후속 PR 권장.

## 발견사항

### 🔴 Blocking
없음.

### 🟠 Should fix (별도 후속 PR)

**[REV-M-1] 미들웨어 `profiles` 이중 조회 가능성** — `lib/supabase/middleware.ts:47-66`
- 로그인했지만 admin이 아닌 사용자가 `/admin/posts`에 접근할 때 `getUser()` + `profiles` 조회로 Supabase 왕복이 늘어납니다. `isAdminArea`와 `/admin/login` 분기 모두에서 `profiles`를 조회하므로, 동일 요청에서 두 번 조회되는 경로는 없으나 admin 트래픽 빈도가 높아지면 한 번이라도 캐싱 도입을 고려해야 합니다.
- 권장: 같은 effect 내에서 한 번 조회 후 변수 공유.

**[REV-M-2] `safeBearerEqual`의 더미 비교 타이밍 균일성 불완전** — `app/api/cron/digest/route.ts:72-76`
- 길이가 다를 때 `timingSafeEqual(a, a)`로 타이밍을 맞추려 했으나, 자기 자신 비교는 `expected`와 길이가 달라 실행 시간이 살짝 다를 수 있습니다.
- 권장: `match` 플래그 + 길이 통일된 버퍼로 비교.
  ```ts
  const match = a.length === b.length
  const safeA = match ? a : b
  return timingSafeEqual(safeA, b) && match
  ```

**[REV-M-3] `CategoryDrawer` 닫힌 상태의 Tab 접근 가능성** — `components/CategoryDrawer.tsx:38-48`
- `useFocusTrap(open)`은 `open=false` 시 무동작이지만, 드로어 자체는 portal로 계속 마운트되어 내부 링크/버튼이 Tab 순서에 남아 있을 수 있습니다.
- 권장: 닫힘 상태에서 컨테이너에 `inert` 속성 적용(React 19) 또는 `tabIndex={-1}` + 폴리필.

### 🟡 Non-blocking (정보)

- **[REV-L-1] `escapeLike`에 `[` 미처리** — `app/search/page.tsx:71`. `sanitize()`가 선행 제거하므로 실질 위험 없음.
- **[REV-L-2] CSP `script-src 'unsafe-inline'`** — 인라인 테마 스크립트 때문에 의도된 선택. 주석에 nonce 전환 검토 명시.
- **[REV-L-3] `highlight.js` 서브셋에서 `c`/`cpp`/`csharp`/`kotlin`/`swift`/`ruby`/`php` 누락** — `ignoreMissing: true` 덕분에 plain text로 폴백, 기능 결함 아님.
- **[REV-L-4] `app/error.tsx`가 `<html>/<body>`를 감싸지 않음** — 루트 layout 하위의 segment error boundary이므로 의도된 형태. `global-error.tsx`였다면 필요.

### ✅ 검토하면서 확인된 좋은 점

- `loadPostForSlug` React `cache()` dedup이 `force-dynamic`과 호환되며 깔끔.
- `escapeCdata`의 `]]]]><![CDATA[>` 분할이 표준 기법과 일치.
- `JsonLd.tsx`의 `<` 치환이 JSON 파서 호환을 유지하면서 `</script>` 탈출 차단.
- `encodeURI` → `encodeURIComponent` 5곳 일괄 변경이 sitemap·RSS·canonical·og:url·Telegram 링크에서 일관적.
- `CommentItem` try/catch가 happy path를 해치지 않으면서 네트워크 오류 대응.
- `trackView` fire-and-forget 호출이 내부 try/catch + 외부 `.catch()`로 이중 방어.
- `useFocusTrap` 훅이 focusable 0개, 비동기 자식 추가, cleanup 시 트리거 detach 시나리오를 모두 처리.
- `revalidate=60` + `revalidatePath('/')` 조합이 의도대로 발행 직후 ~0초 반영.
- `HastNode` 로컬 타입이 실제 hast 스펙 핵심 필드와 일치.
- 보안 헤더(HSTS, CSP, X-Frame-Options, Referrer-Policy)가 견고.

## 검토 노트 (영역별)

- **회귀 위험**: 기능을 깨뜨리는 변경은 발견되지 않음. `CategoryTree`의 `setOpen(true)`만 강제하고 `false`로는 강제하지 않아 사용자 토글 의도 존중.
- **CSP**: 인라인 스크립트, JSON-LD, sonner toast, lucide 아이콘, Supabase 호출, OG 이미지 모두 새 정책에서 정상 동작 예상. 외부 분석 도구 추가 시 `connect-src` 업데이트 필요.
- **보안 변경**: `escapeHtml` 5문자 처리, `publishPost`/`unpublishPost` UUID 검증이 정합.
- **a11y**: 트랩 훅 견고. `CategoryDrawer` 닫힘 상태만 후속 개선 대상.
- **성능**: ISR 정책, React `cache` dedup, highlight.js 서브셋 모두 정합.
- **타입/인코딩**: `encodeURIComponent` 전환이 한글 slug 라우팅과 호환. App Router가 자동 디코딩, `decodeSlug`로 이중 인코딩 안전.
- **신뢰성**: try/catch, 타이머 cleanup, 동기화 effect 모두 기존 동작 유지.

## 머지 권고

머지 가능. 7개 atomic 커밋이 의미 있는 단위로 구분되어 있으므로 **rebase merge**를 권장합니다.

## 후속 처리

REV-M-1, REV-M-2, REV-M-3을 별도 후속 이슈로 트래킹할 것을 권장합니다.
