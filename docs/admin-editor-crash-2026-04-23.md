# 관리자 에디터 저장 시 클라이언트 예외 — 원인 분석과 해결 방안

- **대상**: `/Users/sonamju/project/personal-blog` (main, commit `9e432e3`)
- **작성 일시**: 2026-04-23
- **관련 파일**
  - `app/actions/posts.ts`
  - `app/admin/posts/new/NewPostForm.tsx`
  - `app/admin/posts/[id]/edit/EditPostForm.tsx`
  - `components/PublishModal.tsx`
  - `components/MarkdownEditor.tsx`

---

## 1. 재현 현상

1. 관리자로 로그인 후 `/admin/posts/new` 에서 새 글 작성.
2. "임시저장" 또는 PublishModal 의 "출간하기/비공개 저장" 클릭.
3. 다음과 같은 Next.js 에러 오버레이가 표시됨.
   > Application error: a client-side exception has occurred (see the browser console for more information).
4. 그러나 **서버 데이터는 정상 저장**되며, `/admin/posts` 로 이동하면 레코드가 반영되어 있음.

## 2. 브라우저 콘솔 증거

```
POST https://www.shylog.com/admin/posts/new 500 (Internal Server Error)
...
TypeError: Cannot read properties of undefined (reading 'error')
  at f (page-60c858ad20cf24fe.js:1:1360)
  at rE (fd9d1056-75635bde90299a3e.js:1:40341)  // react-dom 내부
  ...
```

두 가지 사실이 드러납니다.

- **Server Action 엔드포인트(`POST /admin/posts/new`) 가 500 응답** 을 반환
- 이후 클라이언트 렌더 중 **`state.error` 접근에서 `state` 가 `undefined`** 라 TypeError 가 throw

## 3. 원인 진단

### 3.1 근본 원인 (Server Side) — 서버 액션이 500 을 반환

`app/actions/posts.ts` 의 `createPost` / `updatePost` 는 **성공 경로를 `redirect()` 로 종료**합니다.

```ts
// app/actions/posts.ts:104-137
export async function createPost(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // ...
  revalidateAll(data.slug)                                     // ①
  redirect(input.published ? '/admin/posts'
                           : `/admin/posts/${data.id}/edit`)   // ②
}
```

- `redirect()` 는 내부적으로 `NEXT_REDIRECT` 예외를 던져 Next.js 가 서버 액션 리플라이를 redirect 로 교체해야 합니다.
- Next.js 14.2.x 는 `useFormState` 로 호출된 서버 액션이 `redirect()` 를 던질 때 **프로덕션 빌드에서 리다이렉트 응답 직렬화에 실패해 500 을 반환하는 케이스** 가 다수 보고되었습니다. 특히 `revalidatePath('/posts/[slug]', 'page')` 처럼 **동적 세그먼트를 포함하는 `revalidatePath` 가 `redirect()` 직전에 호출** 될 때 재현성이 높습니다.
- 본 프로젝트는 `next@14.2.35` 이며 Vercel 배포 런타임에서 해당 조합이 그대로 동작합니다. 그래서 "저장(INSERT/UPDATE) 은 성공했는데 응답은 500" 이라는 현상이 정확히 설명됩니다.

### 3.2 직접 원인 (Client Side) — `state` 가 undefined 인 상태에서 `state.error` 참조

서버가 500 을 돌려주면 `useFormState` 는 기대하는 `ActionState` 객체를 받지 못합니다. 프레임워크 내부에서 실패한 액션 리플라이를 처리하면서 **다음 렌더에서 state 가 undefined 로 잠깐 흘러가는 상황** 이 발생합니다. 그 순간 다음 JSX 가 실행되며 크래시가 납니다.

```tsx
// app/admin/posts/new/NewPostForm.tsx:80-82
{state.error && (                                  // ← state 가 undefined → TypeError
  <p className="...">{state.error}</p>
)}
```

`EditPostForm.tsx:93-98` 의 `state.error` / `state.ok` 접근도 동일한 위험을 공유합니다.

### 3.3 부수적 악화 요인

1. **`updatePost.bind(null, post.id)` 가 매 렌더마다 새 참조** (`EditPostForm.tsx:50`)
   - `useFormState` 가 받는 액션 함수가 매 렌더 변경되어, 리플라이 매칭이 어긋나는 상황을 악화시킬 수 있음.
2. **`PublishModal` 이 `createPortal` 없이 form 내부에 상주** (`components/PublishModal.tsx:88-293`)
   - 닫혀도 DOM 에 남아 있어 제출 시 모달 내부 hidden inputs (`coverImage`, `excerpt`, `slug`, `categoryId`) 가 항상 함께 직렬화됨. 기본 직접 원인은 아니지만 포커스 트랩 부재와 함께 정리 대상.
3. **`revalidatePath('/posts/[slug]', 'page')` 의 광범위 무효화** (`app/actions/posts.ts:97`)
   - redirect 직전 호출되는 동적 경로 무효화는 Next 14.2.x 에서 `redirect()` 직렬화 실패 패턴과 상관관계가 있음.
4. **앱/DB slug 정규식 차이와 draft slug**
   - 앱: `^[a-zA-Z0-9가-힣]+(?:-[a-zA-Z0-9가-힣]+)*$`
   - DB(003 적용 시): `^[a-zA-Z0-9가-힣]+(-[a-zA-Z0-9가-힣]+)*$`
   - 현재 증상의 직접 원인은 아니나, 003 migration 이 프로덕션에 미적용이면 한글/대문자 slug 에서 별도 저장 실패(정상 처리되는 409/에러 반환 경로) 가 발생할 수 있음. 이번 증상은 insert 가 성공했으므로 해당 경로는 아님을 확정.

## 4. 해결 방안

### 4.1 1차 패치 (즉시, 비파괴) — `state` 방어 접근

현재 에러 오버레이의 직접 트리거를 제거합니다. 서버 500 의 진짜 원인과 분리해서라도, **UI 가 undefined 로부터 보호** 되어야 합니다.

`app/admin/posts/new/NewPostForm.tsx`

```tsx
{state?.error && (
  <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
)}
```

`app/admin/posts/[id]/edit/EditPostForm.tsx`

```tsx
{state?.error && (
  <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
)}
{state?.ok && (
  <p className="text-sm text-green-700 dark:text-green-400">저장되었습니다.</p>
)}
```

> **효과**: 클라이언트 TypeError 는 즉시 사라집니다. 다만 서버 500 자체는 남으므로 사용자가 리다이렉트 되지 않는 문제(현재와 동일) 는 존재합니다.

### 4.2 핵심 수정 — 서버 액션에서 `redirect()` 제거, 클라이언트에서 내비게이션 (**권장**)

`useFormState` 는 `ActionState` 반환을 전제로 설계되어 있습니다. 성공 시에도 반환값을 돌려주고, **이동은 클라이언트에서 `router.replace()` 로 수행**하면 500 경로 자체가 사라집니다.

`app/actions/posts.ts`

```ts
export type ActionState = {
  ok: boolean
  error?: string
  id?: string
  redirectTo?: string
}

export async function createPost(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }

  const input = parseFormData(formData)
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const { data, error } = await guard.supabase
    .from('posts')
    .insert({
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      tags: input.tags,
      published: input.published,
      cover_image: input.coverImage,
      category_id: input.categoryId,
    })
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 사용 중인 slug 입니다.' }
    return { ok: false, error: error.message }
  }

  revalidateAll(data.slug)
  return {
    ok: true,
    id: data.id,
    redirectTo: input.published
      ? '/admin/posts'
      : `/admin/posts/${data.id}/edit`,
  }
}

export async function updatePost(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireAdmin()
  if (guard.error) return { ok: false, error: guard.error }
  if (!UUID_RE.test(id)) return { ok: false, error: '잘못된 요청입니다.' }

  const input = parseFormData(formData)
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const { data: prev } = await guard.supabase
    .from('posts').select('slug').eq('id', id).single()
  const oldSlug = prev?.slug ?? null

  const { error } = await guard.supabase
    .from('posts')
    .update({
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      tags: input.tags,
      published: input.published,
      cover_image: input.coverImage,
      category_id: input.categoryId,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 사용 중인 slug 입니다.' }
    return { ok: false, error: error.message }
  }

  revalidateAll(input.slug, oldSlug ?? '')
  return {
    ok: true,
    id,
    redirectTo: input.published ? '/admin/posts' : undefined,
  }
}
```

`deletePost`, `logoutAction` 은 클라이언트에서 `useFormState` 로 호출하지 않으므로 기존 `redirect()` 사용을 유지해도 안전합니다.

`app/admin/posts/new/NewPostForm.tsx`

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
// ...

export default function NewPostForm({ categoryPicker }: { categoryPicker: React.ReactNode }) {
  const [state, formAction] = useFormState(createPost, initialState)
  const router = useRouter()
  // ...

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      router.replace(state.redirectTo)
    }
  }, [state, router])

  return (
    <form action={formAction} onChange={markDirty}>
      {/* ... */}
      {state?.error && <p className="...">{state.error}</p>}
      {/* ... */}
    </form>
  )
}
```

`app/admin/posts/[id]/edit/EditPostForm.tsx`

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'

export default function EditPostForm({ post, categoryPicker }: Props) {
  const update = useMemo(() => updatePost.bind(null, post.id), [post.id])
  const [state, formAction] = useFormState(update, initialState)
  const router = useRouter()
  // ...

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      router.replace(state.redirectTo)
    }
  }, [state, router])

  return (
    <form action={formAction} onChange={markDirty}>
      {/* ... */}
      {state?.error && <p className="...">{state.error}</p>}
      {state?.ok && !state.redirectTo && (
        <p className="...">저장되었습니다.</p>
      )}
      {/* ... */}
    </form>
  )
}
```

#### 왜 이 수정이 근본 해법인가

- `redirect()` 가 서버 액션 리플라이 직렬화에 개입하지 않으므로 500 경로가 사라짐.
- `useFormState` 가 항상 정상 `ActionState` 를 받아 state 가 undefined 가 되지 않음.
- 같은 파일 내 `revalidatePath` 는 유지할 수 있음 (redirect 제거만으로 문제가 해결됨).
- Next.js 14.2.x / 15.x 양쪽에서 동일한 코드로 안정 동작.

### 4.3 `updatePost.bind` 안정화

`EditPostForm.tsx:50` 의 bind 를 `useMemo` 로 감싸 동일 참조를 유지합니다 (위 코드에 포함).

```tsx
const update = useMemo(() => updatePost.bind(null, post.id), [post.id])
```

### 4.4 `PublishModal` 을 `createPortal` + 조건부 마운트로 전환 (선택, 권장)

`components/CategoryDrawer.tsx` 와 동일한 패턴을 적용하면, 제출 시 모달 내부 input 이 form 직렬화에 개입하지 않고, 접근성 이슈(기존 코드 리뷰 `6.4`) 도 동시에 해결됩니다.

```tsx
// components/PublishModal.tsx
'use client'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

export default function PublishModal({ open, onClose, ... }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // ... (상태 관리 동일)

  if (!mounted || !open) return null

  const content = (
    <>
      <div /* overlay */ onClick={onClose} className="fixed inset-0 z-40 bg-black/50" />
      <div role="dialog" aria-modal="true" className="fixed left-1/2 top-1/2 z-50 ...">
        {/* ...본문 동일... */}
      </div>
    </>
  )

  return createPortal(content, document.body)
}
```

> 주의: Portal 로 이동하면 **form 바깥에 렌더** 되므로, 모달 내부의 submit 버튼과 hidden input 이 해당 form 에 귀속되려면 `<button form="post-form">` / `<input form="post-form">` 처럼 `form` 속성을 명시해야 합니다. 폼에 `id="post-form"` 을 부여하고 모달의 모든 폼 컨트롤에 `form="post-form"` 을 추가합니다.
>
> ```tsx
> <form id="post-form" action={formAction} onChange={markDirty}>
>   {/* ... */}
> </form>
>
> // PublishModal 내부
> <input type="hidden" name="coverImage" value={coverImage} form="post-form" readOnly />
> <input id="slug" name="slug" form="post-form" ... />
> <textarea id="excerpt" name="excerpt" form="post-form" ... />
> <select id="categoryId" name="categoryId" form="post-form" ... />
> <button type="submit" name="published" form="post-form" ...>출간하기</button>
> ```

### 4.5 `revalidatePath` 범위 재정비 (선택)

동일 액션에서 redirect 를 제거하면 500 이슈는 해결되지만, 리뷰 `7.2` 의 TODO 를 함께 적용하면 캐시 정확도가 올라갑니다.

```ts
function revalidateAll(...slugs: string[]) {
  revalidatePath('/')
  revalidatePath('/posts/[slug]', 'page')
  revalidatePath('/categories/[...slug]', 'page')
  revalidatePath('/tags/[tag]', 'page')
  revalidatePath('/sitemap.xml')
  revalidatePath('/rss.xml')
  for (const slug of slugs.filter(Boolean)) {
    revalidatePath(`/posts/${slug}`)
  }
  revalidatePath('/admin/posts')
}
```

### 4.6 진단용 에러 경계 (선택)

재발 시 스택을 바로 확보할 수 있도록 관리자 영역에 에러 파일을 둡니다.

`app/admin/posts/error.tsx`

```tsx
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6 space-y-3">
      <h2 className="font-serif font-bold">저장 중 오류가 발생했습니다.</h2>
      <pre className="text-xs whitespace-pre-wrap">{error.message}</pre>
      <pre className="text-xs opacity-60">{error.stack}</pre>
      <button onClick={reset} className="underline">다시 시도</button>
    </div>
  )
}
```

## 5. 권장 적용 순서

| 단계 | 작업 | 변경 파일 | 비고 |
|------|------|-----------|------|
| 1 | `state?.error` 방어 접근 | `NewPostForm.tsx`, `EditPostForm.tsx` | 1차 패치, 즉시 |
| 2 | 서버 액션 `redirect()` 제거 + `redirectTo` 반환 | `app/actions/posts.ts` | 핵심 수정 |
| 3 | 클라이언트 `useEffect` 내비게이션 | `NewPostForm.tsx`, `EditPostForm.tsx` | 2 와 세트 |
| 4 | `updatePost.bind` 를 `useMemo` 로 | `EditPostForm.tsx` | 안정화 |
| 5 | `PublishModal` → `createPortal` + `form` 속성 명시 | `PublishModal.tsx`, 두 Form | 선택, 권장 |
| 6 | `revalidatePath` 범위 확대 | `app/actions/posts.ts` | 선택, SEO 개선 |
| 7 | `app/admin/posts/error.tsx` | 신규 파일 | 선택, 재발 대비 |

## 6. 검증 방법

1. 로컬 `npm run build && npm start` 로 **프로덕션 빌드 상태** 에서 검증 (dev 에서는 재현되지 않을 수 있음).
2. 관리자로 로그인 → 새 글 → 임시저장 → `/admin/posts/${id}/edit` 로 이동하는지 확인.
3. 같은 흐름에서 "출간하기" → `/admin/posts` 로 이동하는지 확인.
4. 의도적으로 실패하는 입력(중복 slug 등) 으로 `state.error` 가 form 내부에 표시되는지 확인.
5. Vercel Preview 배포로 동일 플로우 검증 후 production promote.

## 7. 결론

- **UI 크래시의 직접 원인**: `state` 가 undefined 인 상태에서 `state.error` 에 점 접근.
- **서버 500 의 근본 원인**: `useFormState` 를 통한 서버 액션에서 `redirect()` 를 호출하는 패턴이 Next.js 14.2.x 프로덕션 빌드에서 리다이렉트 리플라이 직렬화에 실패하는 사례.
- **해결**: 서버 액션은 상태만 반환하고, 이동은 클라이언트 `router.replace()` 로 수행. 방어적 옵셔널 체이닝은 기본으로 탑재.
- **부수 개선**: `updatePost.bind` 안정화, `PublishModal` 의 portal 전환, 캐시 재검증 범위 확대.
