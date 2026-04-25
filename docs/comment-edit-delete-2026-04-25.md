# 댓글 수정·삭제 (회원가입 없는 본인 인증) 계획 (2026-04-25)

## 0. 요약

- **목표**: 댓글 작성자가 회원가입 없이 본인의 댓글을 수정·삭제한다.
- **방식**: **혼합** — 토큰 우선(브라우저 localStorage), 토큰 없거나 만료 시 비밀번호 fallback.
- **결정 사항**:
  - 비밀번호: 작성 시 **필수**, 4~20자
  - 토큰: 서버에서 자동 발급, 클라이언트가 localStorage에 저장
  - 기존 댓글(이전 데이터): 본인 인증 불가 → admin만 삭제 가능
  - 수정 시간 제한: **무제한** (단순함 우선)
  - 삭제: **soft delete** (`deleted_at` 타임스탬프 마킹). 화면에는 "삭제된 댓글" 표시도 없이 완전히 안 보임. DB에는 남아 복구·감사 가능.

---

## 1. 배경과 전제

### 왜 이 작업이 필요했나
- 댓글 작성자가 오타·실수를 바로잡거나 삭제할 길이 없음
- 회원가입을 추가하면 진입장벽이 너무 높고, 1인 블로그에 오버엔지니어링

### 비채택 옵션
| 옵션 | 채택 안 한 이유 |
|------|-----------------|
| 비밀번호만 | 매번 입력 불편 |
| 토큰만 (쿠키) | 시크릿창·다른 기기에서 회수 불가 |
| 이메일 magic link | 사실상 회원가입에 가깝고 구현 부담 큼 |
| IP+UA 해시 식별 | UX 불안정, 신뢰 어려움 |

---

## 2. 아키텍처 개요

### 작성 흐름
```
[사용자]
  └─> 이름, 비밀번호(4~20자), 내용 입력
       └─> createComment 서버 액션
             ├─ password_hash = crypt(password, gen_salt('bf', 10))   -- pgcrypto
             ├─ edit_token = randomBytes(32).toString('hex')         -- 64자
             ├─ INSERT INTO comments (..., password_hash, edit_token)
             └─ 응답: { ok: true, commentId, editToken }
                       └─ 클라이언트: localStorage["comment-tokens"]에 {commentId: editToken} 저장
```

### 수정/삭제 흐름
```
[사용자가 댓글 옆 "수정"/"삭제" 클릭]
  ├─ 클라이언트: localStorage["comment-tokens"][commentId] 조회
  ├─ 토큰 있음 → editToken 함께 액션 호출 (비번 입력 X)
  └─ 토큰 없음 → 비밀번호 모달 → password 함께 액션 호출

[updateComment / deleteComment 서버 액션]
  ├─ rate limit (브루트포스 방어)
  ├─ editToken 제공 → comments WHERE id = ? AND edit_token = ?
  └─ password 제공 → comments WHERE id = ? AND password_hash = crypt(?, password_hash)
       └─ 일치 → UPDATE/DELETE, 불일치 → "비밀번호가 일치하지 않습니다"
```

---

## 3. 변경 대상 파일

### 신규
| 파일 | 역할 |
|------|------|
| `supabase/migrations/008_comment_auth.sql` | `edit_token`/`password_hash` 컬럼 + RLS 재설계 + `public_comments` view |
| `lib/comment-tokens.ts` | localStorage 헬퍼 (브라우저 전용) |
| `components/CommentItem.tsx` | 개별 댓글 (수정 폼·삭제 확인) — Client Component |

### 수정
| 파일 | 변경 |
|------|------|
| `app/actions/comments.ts` | `createComment`에 비밀번호/토큰 발급, `updateComment`/`deleteComment` 추가 |
| `components/CommentForm.tsx` | 비밀번호 input 추가, 응답 토큰 받아서 localStorage 저장 |
| `components/Comments.tsx` | `public_comments` view에서 조회, `<CommentItem>` 사용 |

---

## 4. 상세 구현

### 4.1 마이그레이션 `008_comment_auth.sql`

```sql
-- pgcrypto는 Supabase 기본 활성화 (gen_random_uuid에 이미 사용됨)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS edit_token    text,
  ADD COLUMN IF NOT EXISTS deleted_at    timestamptz;

CREATE INDEX IF NOT EXISTS idx_comments_edit_token ON comments(edit_token);
CREATE INDEX IF NOT EXISTS idx_comments_post_active
  ON comments(post_id, created_at) WHERE deleted_at IS NULL;

-- 기존 "Public read" 정책은 password_hash, edit_token까지 노출시키므로 폐기.
-- 대신 public 노출용 view 를 만들어 안전 컬럼만 SELECT 허용.
DROP POLICY IF EXISTS "Public read" ON comments;
-- admin 만 base 테이블 SELECT
DROP POLICY IF EXISTS "Admin read comments" ON comments;
CREATE POLICY "Admin read comments" ON comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- public 용 view (민감 컬럼 제외 + soft delete 필터)
CREATE OR REPLACE VIEW public_comments AS
SELECT id, post_id, author_name, content, created_at
FROM comments
WHERE deleted_at IS NULL;

GRANT SELECT ON public_comments TO anon, authenticated;

-- 수정/삭제 RPC: 토큰 또는 비밀번호 매칭 시에만 동작 (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION update_comment(
  p_comment_id uuid,
  p_new_content text,
  p_edit_token text DEFAULT NULL,
  p_password text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match boolean := false;
BEGIN
  IF p_edit_token IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM comments
      WHERE id = p_comment_id
        AND deleted_at IS NULL
        AND edit_token IS NOT NULL
        AND edit_token = p_edit_token
    ) INTO v_match;
  END IF;

  IF NOT v_match AND p_password IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM comments
      WHERE id = p_comment_id
        AND deleted_at IS NULL
        AND password_hash IS NOT NULL
        AND password_hash = crypt(p_password, password_hash)
    ) INTO v_match;
  END IF;

  IF NOT v_match THEN RETURN false; END IF;

  UPDATE comments SET content = p_new_content WHERE id = p_comment_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION delete_comment(
  p_comment_id uuid,
  p_edit_token text DEFAULT NULL,
  p_password text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match boolean := false;
BEGIN
  IF p_edit_token IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM comments
      WHERE id = p_comment_id
        AND deleted_at IS NULL
        AND edit_token IS NOT NULL
        AND edit_token = p_edit_token
    ) INTO v_match;
  END IF;

  IF NOT v_match AND p_password IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM comments
      WHERE id = p_comment_id
        AND deleted_at IS NULL
        AND password_hash IS NOT NULL
        AND password_hash = crypt(p_password, password_hash)
    ) INTO v_match;
  END IF;

  IF NOT v_match THEN RETURN false; END IF;

  -- soft delete: 컬럼만 마킹, 행은 보존
  UPDATE comments SET deleted_at = now() WHERE id = p_comment_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION update_comment(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_comment(uuid, text, text) TO anon, authenticated;
```

**핵심 포인트**
- `crypt()`는 pgcrypto 함수. bcrypt 해시 검증을 한 줄로 처리.
- RPC가 모든 인증 로직을 캡슐화 → 클라이언트에서 직접 password_hash/edit_token 비교 불필요 (그래서도 안 됨, 노출되니까).
- view를 통해 anon은 민감 컬럼 자체를 못 봄.
- `SECURITY DEFINER`라서 RLS bypass. 그래서 함수 내부에서 매칭 검증을 직접 수행.

### 4.2 `lib/comment-tokens.ts` (브라우저 전용)

```ts
const KEY = 'comment-tokens'

export function loadTokens(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveToken(commentId: string, token: string) {
  if (typeof window === 'undefined') return
  const cur = loadTokens()
  cur[commentId] = token
  localStorage.setItem(KEY, JSON.stringify(cur))
}

export function removeToken(commentId: string) {
  if (typeof window === 'undefined') return
  const cur = loadTokens()
  delete cur[commentId]
  localStorage.setItem(KEY, JSON.stringify(cur))
}

export function getToken(commentId: string): string | null {
  return loadTokens()[commentId] ?? null
}
```

### 4.3 `app/actions/comments.ts` 변경 사항

#### `createComment` 수정
- formData에 `password` 추가 받기 (4~20자 검증)
- `crypto.randomBytes(32).toString('hex')`로 token 생성
- INSERT 시 `password_hash` (DB가 crypt 처리할 수 있도록 RPC로 분리할지, 또는 JS bcrypt → 외부 의존). **결정: pgcrypto crypt를 RPC로 분리**해서 의존성 추가 안 함.

```sql
-- 008 마이그레이션에 추가
CREATE OR REPLACE FUNCTION insert_comment(
  p_post_id uuid,
  p_author_name text,
  p_content text,
  p_password text,
  p_edit_token text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM posts WHERE id = p_post_id AND visibility = 'public') THEN
    RAISE EXCEPTION 'post not public';
  END IF;
  IF char_length(p_password) < 4 OR char_length(p_password) > 20 THEN
    RAISE EXCEPTION 'invalid password length';
  END IF;
  INSERT INTO comments (post_id, author_name, content, password_hash, edit_token)
  VALUES (p_post_id, p_author_name, p_content,
          crypt(p_password, gen_salt('bf', 10)), p_edit_token)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_comment(uuid, text, text, text, text) TO anon, authenticated;
```

서버 액션:
```ts
const editToken = crypto.randomBytes(32).toString('hex')
const { data: commentId, error } = await supabase.rpc('insert_comment', {
  p_post_id: postId,
  p_author_name: safeName,
  p_content: safeContent,
  p_password: password,
  p_edit_token: editToken,
})
if (error || !commentId) return { ok: false, error: '댓글 저장에 실패했습니다.' }
// 텔레그램 알림 (기존)
return { ok: true, commentId, editToken }
```

#### `updateComment` 신규
```ts
'use server'
export async function updateComment(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  // rate limit (기존 ratelimit 인스턴스 재사용)
  // 입력: commentId, newContent, editToken? | password?
  // supabase.rpc('update_comment', { p_comment_id, p_new_content, p_edit_token, p_password })
  // boolean false → 인증 실패 메시지
  // revalidatePath
}
```

#### `deleteComment` 신규
- 동일한 패턴으로 `delete_comment` RPC 호출

### 4.4 `components/CommentForm.tsx` 변경

- `password` input 추가 (`type="password"`, `minLength=4`, `maxLength=20`)
- `useFormState` 응답에서 `commentId`, `editToken` 받아 `saveToken(commentId, editToken)`

타입 갱신:
```ts
type State = { ok: boolean; error?: string; commentId?: string; editToken?: string }
```

### 4.5 `components/Comments.tsx` 변경

- 쿼리 대상을 `comments` → `public_comments` view로 변경
- 각 댓글을 `<CommentItem>` (Client Component)로 렌더 — admin 여부, postSlug를 prop으로 전달

### 4.6 `components/CommentItem.tsx` (신규, Client Component)

- `useEffect`로 mount 후 `getToken(comment.id)` 확인 → 본인 식별
- 본인이면: "수정" "삭제" 버튼 → 비번 입력 없이 토큰으로 처리
- 본인 아니면: "수정" "삭제" 버튼 → 모달로 비번 입력 → 비번으로 처리
- admin이면: "삭제" 추가 표시 (관리자용 — 기존 admin 정책은 RLS DELETE인데, 우리는 RPC를 거치므로 별도 admin RPC 추가 또는 관리자도 비밀번호 없이 RPC 통과시키는 분기 필요)
  - **단순화**: 이번 작업에선 admin 삭제는 기존 RLS DELETE 그대로 둠. 관리자 페이지에서 별도로 처리. 글 페이지의 일반 사용자 UI는 토큰/비번 인증만.

---

## 5. 보안 고려사항

| 항목 | 처리 |
|------|------|
| password_hash, edit_token 외부 노출 | `public_comments` view로 차단 |
| 비밀번호 평문 저장 | pgcrypto bcrypt (`gen_salt('bf', 10)`) |
| 브루트포스 비밀번호 | Upstash ratelimit으로 update/delete 액션도 제한 (예: IP당 10분 10회) |
| 토큰 추측 | 32바이트 랜덤 = 256비트 → 사실상 불가 |
| 토큰 누출 (XSS 등) | localStorage 저장 → XSS가 발생하면 토큰 노출. 비밀번호는 hash라 안전. **본 블로그는 댓글 본문에 sanitize 적용 안 함**(span/strong 같은 단순 태그도 없음, 그냥 텍스트). XSS 표면적 작음. |
| 본인 인증 우회 | RPC가 SECURITY DEFINER로 토큰/비번 매칭 검증을 강제 |
| Replay (CSRF) | Next.js Server Actions가 자동 처리 |

---

## 6. 검증 계획

### 로컬·수동 시나리오
1. 새 댓글 작성 (비밀번호 `1234`) → 응답에 `commentId`, `editToken` 옴 → localStorage 확인
2. 같은 브라우저에서 새로고침 → 본인 댓글 옆 수정/삭제 버튼 보임 → 클릭 시 비번 안 묻고 동작
3. 시크릿창에서 같은 글 진입 → 토큰 없음 → 수정/삭제 클릭 시 비번 모달 → `1234` 입력 → 동작
4. 시크릿창에서 잘못된 비번(`9999`) 입력 → "비밀번호가 일치하지 않습니다"
5. 마이그레이션 이전 댓글: 수정/삭제 버튼 클릭 → 토큰 없음 → 비번 모달 → 어떤 비번도 실패 (password_hash가 NULL)
6. SQL Editor에서 `SELECT password_hash FROM public_comments` 시도 → 컬럼 없음 (view에서 제외됨)
7. 동일 IP에서 update_comment 11회 연속 요청 → 11번째 rate limit 차단

### TypeScript / 빌드
- `npx tsc --noEmit` 통과
- `npm run lint` 통과

---

## 7. 작업 순서

| 단계 | 항목 |
|------|------|
| 1 | `008_comment_auth.sql` 작성 + Supabase 적용 |
| 2 | `lib/comment-tokens.ts` 작성 |
| 3 | `app/actions/comments.ts` 수정 (createComment 갱신 + updateComment + deleteComment) |
| 4 | `components/CommentForm.tsx` 수정 (비밀번호 input, 토큰 저장) |
| 5 | `components/CommentItem.tsx` 신규 작성 |
| 6 | `components/Comments.tsx` 수정 (view 조회 + CommentItem 사용) |
| 7 | tsc/lint, 로컬 시나리오 검증 |
| 8 | 커밋 → 배포 |

---

## 8. 결정 로그

| 결정 | 채택 | 사유 |
|------|------|------|
| 본인 인증 방식 | 혼합 (토큰 + 비밀번호) | UX·복원성 모두 충족 |
| 비밀번호 해시 | pgcrypto bcrypt(rounds 10) | DB 내장. 외부 라이브러리 추가 불필요 |
| 토큰 길이 | 32바이트 hex (64자) | 추측 불가능 + 적당히 짧음 |
| 토큰 저장 위치 | localStorage | 쿠키보다 가벼움. CSRF 무관(Server Action이 처리) |
| 비밀번호 길이 | 4~20자 | 한국 게시판 관습 + 기억 부담 낮춤 |
| 인증 검증 위치 | DB RPC (SECURITY DEFINER) | 클라이언트에 hash·token 노출 안 함, atomic |
| public 컬럼 노출 차단 | `public_comments` view | base 테이블 RLS는 admin 전용으로 |
| 수정 시간 제한 | 없음 | 단순함 우선 |
| 삭제 방식 | soft delete (`deleted_at`) | 복구·감사 가능. view 필터로 화면에선 완전히 안 보임 |
| 기존 댓글 처리 | author edit 불가 (admin만) | 비밀번호 backfill 불가능 |
| Admin UI 통합 | 이번 범위 제외 | 별도 admin 페이지 작업으로 분리 |
