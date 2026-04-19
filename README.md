# ShyLog

크래프트 종이 노트 감성의 개인 기술 블로그. Next.js 14 App Router + Supabase로 구축.

- **URL**: https://www.shylog.com
- **저자**: Soshy ([GitHub](https://github.com/NJ97S))

---

## 주요 기능

### 독자용
- **글 목록 / 상세**: 카테고리 breadcrumb, 큰 제목, 태그 pill, 우측 TOC 스크롤 스파이, 같은 카테고리 내 시리즈 박스, 이전/다음 포스트 네비게이션
- **카테고리 계층 탐색**: `parent_id` 기반 트리. 데스크톱 좌측 사이드바 + 모바일 포털 드로어 (애니메이션 슬라이드)
- **태그 검색**: `/tags/[tag]`로 해당 태그 글 모음
- **전문 검색**: `/search?q=…`
- **댓글**: 로그인 없이 공개 댓글 작성, 관리자만 삭제
- **다크/라이트 테마**: `prefers-color-scheme` 기반 자동 전환 + 헤더의 알약 스위치로 수동 전환 (localStorage 영속화)
- **링크 공유**: 글 상세 메타 행의 공유 버튼으로 URL 클립보드 복사
- **마크다운 지원**: CommonMark + GFM (테이블, 취소선, 태스크 리스트, 자동 링크) + 단일 엔터 줄바꿈 (`remark-breaks`) + syntax highlight (`rehype-highlight` / github-dark)

### 관리자용 (`/admin`)
- **벨록(velog) 스타일 에디터**: 제목 입력(밑줄 only) → 태그 pill (Enter/쉼표 추가, Backspace 삭제, IME 안전) → 마크다운 에디터 (live preview)
- **임시저장 / 출간하기**: 하단 고정 액션 바 (나가기 / 임시저장 / 출간하기). 출간 시 공개/비공개 토글, URL(slug), 시리즈(카테고리) 지정하는 모달
- **카테고리 관리 (`/admin/categories`)**: 트리 뷰 인라인 편집. 생성/이름·slug·상위 카테고리 변경/삭제(영향 개수 경고)/상하 이동(sort_order swap), 순환 부모 방지
- **글 관리 (`/admin/posts`)**: 발행/초안/전체 필터, 삭제, 편집
- **관리자 인증**: Supabase Auth + `profiles.is_admin` 플래그. 미들웨어에서 `/admin/*` 세션 갱신

### URL / SEO
- **한글 slug**: `posts.slug` CHECK 완화로 `/posts/번역-자바스크립트의-내부-동작` 형태 URL 지원
- **자동 sitemap**: `/sitemap.xml` (글 + 카테고리 경로)
- **자동 robots**: `/robots.txt`
- **OG 이미지**: 각 글의 `/posts/[slug]/opengraph-image` 에서 동적 생성

### 디자인 시스템
- **Memoment Kkukkukk** (핸드라이팅 한글 폰트) + **JetBrains Mono** (코드)
- 팔레트: `craft-50 ~ craft-400` (크래프트 종이 톤) + `ink-400 ~ ink-900` (잉크 톤)
- 공용 유틸: `.craft-card` (rounded + border), `.craft-prose` (Tailwind typography 커스터마이즈)

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 14.2 (App Router, RSC) |
| 언어 | TypeScript, React 18 |
| 스타일 | Tailwind CSS 3, `@tailwindcss/typography` |
| DB / Auth | Supabase (PostgreSQL + Auth + RLS) |
| 마크다운 | `react-markdown`, `remark-gfm`, `remark-breaks`, `rehype-highlight`, `rehype-slug`, `rehype-sanitize` |
| 에디터 | `@uiw/react-md-editor` (관리자 전용) |
| 아이콘 | `lucide-react` |
| Rate Limit | `@upstash/ratelimit` + `@upstash/redis` |
| 배포 | Vercel (icn1 / 서울 리전) |

---

## 프로젝트 구조

```
app/
├─ layout.tsx              # 루트 레이아웃 (폰트, 다크모드 초기화 스크립트)
├─ page.tsx                # 홈 (최신 글 페이지네이션)
├─ loading.tsx             # 공용 로딩 스피너 (Suspense fallback)
├─ globals.css             # Tailwind + craft-prose + hljs 테마
├─ posts/[slug]/           # 글 상세 (breadcrumb, TOC, 시리즈, 이전/다음)
├─ categories/[...slug]/   # 카테고리 트리 경로 대응 목록
├─ tags/[tag]/             # 태그별 글 모음
├─ search/                 # 검색 결과
├─ admin/                  # 관리자 영역 (posts, categories, login)
├─ actions/                # Server Actions (posts, categories)
├─ sitemap.ts / robots.ts  # SEO 정적 엔드포인트
└─ fonts/                  # Memoment Kkukkukk TTF

components/
├─ Layout.tsx              # 3컬럼 (카테고리 사이드바 + 본문 + 위젯/TOC)
├─ Header.tsx / Footer.tsx
├─ CategorySidebar.tsx / CategoryTree.tsx / CategoryDrawer.tsx / CategoryPicker.tsx
├─ SideWidgets.tsx
│  └─ widgets/ (PopularPosts, RecentPosts, RecentComments, SearchBox)
├─ PostCard.tsx
├─ Comments.tsx / CommentForm.tsx
├─ MarkdownEditor.tsx      # 관리자 에디터 (live preview)
├─ TitleInput.tsx / TagInput.tsx
├─ PostEditorShell.tsx     # 하단 고정 액션 바 + 중앙 편집 영역
├─ PublishModal.tsx        # 출간 모달 (slug, 카테고리, 공개 설정)
├─ PostToc.tsx             # 글 상세 우측 목차 (스크롤 스파이)
├─ SeriesBox.tsx           # 같은 카테고리 글 목록
├─ ShareButton.tsx / ThemeToggle.tsx / LoadingSpinner.tsx
└─ ...

lib/
├─ categories.ts           # fetchCategoryTree (서버 전용, Supabase 조회)
├─ category-tree.ts        # 순수 트리 유틸 (client import 안전)
└─ supabase/
   ├─ server.ts            # 서버/RSC용 클라이언트 (cookies)
   ├─ client.ts            # 브라우저 클라이언트
   └─ middleware.ts        # 세션 갱신 헬퍼

supabase/migrations/       # DB 스키마 순차 마이그레이션
├─ 001_initial.sql         # posts, comments, profiles, RLS
├─ 002_categories.sql      # categories + posts.category_id + RLS + seed
├─ 002_profiles_and_comments_rls.sql
└─ 003_posts_slug_allow_korean.sql  # slug CHECK 제약 완화

middleware.ts              # /admin/* 세션 갱신
next.config.mjs            # remotePatterns + 보안 헤더
tailwind.config.ts         # craft/ink 팔레트 + 폰트 패밀리
vercel.json                # Vercel 서울 리전 (icn1) 고정
```

---

## 시작하기

### 1. 사전 요구사항
- Node.js 18.17 이상
- npm 9 이상
- [Supabase](https://supabase.com) 프로젝트 (무료 티어 가능)

### 2. 저장소 클론 & 의존성 설치
```bash
git clone https://github.com/NJ97S/personal-blog.git
cd personal-blog
npm install
```

### 3. Supabase 프로젝트 준비
1. [Supabase Dashboard](https://supabase.com/dashboard)에서 신규 프로젝트 생성 (리전은 **서울(ap-northeast-2)** 권장)
2. SQL Editor에서 다음 마이그레이션을 **순서대로** 실행
   ```
   supabase/migrations/001_initial.sql
   supabase/migrations/002_categories.sql
   supabase/migrations/002_profiles_and_comments_rls.sql
   supabase/migrations/003_posts_slug_allow_korean.sql
   ```
3. Authentication → Users에서 관리자 이메일로 가입
4. SQL Editor에서 해당 유저를 관리자로 승격
   ```sql
   INSERT INTO profiles (id, is_admin)
   VALUES ('<AUTH_USER_UUID>', true)
   ON CONFLICT (id) DO UPDATE SET is_admin = true;
   ```

### 4. 환경변수 설정
루트에 `.env.local` 파일 생성:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>

# (선택) Rate limiting용 Upstash Redis
UPSTASH_REDIS_REST_URL=<URL>
UPSTASH_REDIS_REST_TOKEN=<TOKEN>
```
Supabase 키는 Dashboard → Settings → API 에서 확인.

### 5. 개발 서버 실행
```bash
npm run dev
# http://localhost:3000
```

### 6. 프로덕션 빌드
```bash
npm run build
npm start
```

---

## 관리자 흐름

### 로그인
1. `/admin/login` 접속 → Supabase 이메일/비밀번호 로그인
2. 로그인 후 `/admin/posts`로 진입

### 글 작성
1. `/admin/posts` → `+ 새 글`
2. 상단 제목 입력 (포커스 해제 시 slug 자동 생성)
3. 태그 입력 (Enter 또는 쉼표로 추가)
4. 마크다운 본문 작성 (우측 라이브 프리뷰)
5. 하단 액션 바:
   - **나가기**: 변경사항 있으면 confirm
   - **임시저장**: `published=false`로 저장 → 편집 페이지 유지
   - **출간하기**: 모달 오픈 → 썸네일 URL / 소개글 (150자) / 공개 설정 / URL(slug) / 시리즈(카테고리) 확정 → 저장

### 카테고리 관리
- `/admin/categories` → 인라인 편집 트리
- 이름/slug/상위 카테고리 수정, 상/하 버튼으로 순서 변경, 삭제 시 영향 개수 안내
- 자기 자신 또는 자손을 상위로 지정하면 차단 (순환 방지)

---

## 배포 (Vercel)

### 1. 프로젝트 연결
- [Vercel](https://vercel.com)에서 GitHub 저장소 임포트

### 2. 환경변수 등록
Project → Settings → Environment Variables에 `.env.local`과 동일한 항목 추가

### 3. 리전 확인
- `vercel.json`에 `"regions": ["icn1"]` 지정됨 (서울 리전)
- Supabase 프로젝트 리전도 **같은 서울**로 두면 DB 왕복이 최소화됨 (체감 속도 핵심)

### 4. 빌드
- Framework Preset: **Next.js**
- Build command 기본값 (`next build`)
- 자동 배포 (main 브랜치 push 시)

---

## DB 스키마 요약

### `posts`
- `id uuid PK`
- `title text`
- `slug text UNIQUE` (한글/영문/숫자/하이픈 허용)
- `content text` (마크다운)
- `excerpt text` (선택)
- `tags text[]`
- `published bool` (기본 false)
- `cover_image text` (URL)
- `category_id uuid → categories`
- `created_at / updated_at`

### `categories`
- `id uuid PK`
- `slug text` (parent별 UNIQUE)
- `name text`
- `parent_id uuid → categories` (계층)
- `sort_order int`

### `comments`
- `id uuid PK`
- `post_id uuid → posts`
- `author_name text (≤50자)`
- `content text (≤500자)`
- `created_at`

### `profiles`
- `id uuid PK → auth.users`
- `is_admin bool`

### RLS 핵심 정책
- 공개: `posts` — `published=true`만 SELECT 가능
- 공개: `comments` — 전체 SELECT/INSERT 가능, 삭제는 관리자만
- 관리자: `posts`/`categories` 전체 권한 (`profiles.is_admin=true`)

---

## 성능 관련 설계

- **ISR**: `/posts/[slug]`, `/categories/[...slug]`, `/tags/[tag]` 에 `revalidate = 60` 적용 → 60초 캐싱
- **재검증 범위 정밀화**: mutation 시 관련 경로만 `revalidatePath` 호출 (root layout 전체 무효화 지양)
- **Suspense 로딩**: 각 라우트에 `loading.tsx`로 스피너 표시, 네비게이션 즉각 피드백
- **서울 리전**: Vercel Functions가 Supabase(Seoul)와 같은 리전에서 실행 → DB 왕복 <10ms

---

## 라이선스

개인 프로젝트입니다. 코드 자체는 참고용으로 자유롭게 살펴보셔도 됩니다. 폰트(Memoment Kkukkukk)는 별도 라이선스를 확인해주세요.
