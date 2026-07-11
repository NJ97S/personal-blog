APPROVE: 현재 PR diff 기준으로 병합을 막을 검증 가능한 이슈를 찾지 못했습니다.

**Findings**

🔴 없음

🟡 없음

🟢 없음

**Verification**

- `gh pr view`, `gh pr diff`, PR 대화/인라인 코멘트/커밋 요약을 먼저 수집했습니다. 이전 리뷰는 없어 INITIAL 모드로 검토했습니다.
- `components/PublishModal.tsx`의 변경 후 전체 파일과 호출부 `NewPostForm`/`EditPostForm`, `CategoryPicker`, `CategoryDrawer`, `useFocusTrap` 문맥을 함께 확인했습니다.
- Correctness & Security: 출간 버튼은 여전히 호출부 `<form>` 내부의 `type="submit"` 계약을 유지하고, `name="visibility"`, `coverImage`, `excerpt`, `slug`, `categoryId` 제출 경로가 깨지지 않습니다. 새 body scroll lock은 `open` 상태 effect cleanup에서 해제됩니다.
- Performance & Robustness: 새 스크롤 구조는 루트 `max-height` + `overflow-hidden`, 본문 `min-h-0 flex-1 overflow-y-auto`, 헤더/푸터 `shrink-0` 조합으로 작은 세로 뷰포트에서 본문만 스크롤되는 구조입니다. 추가 쿼리나 비동기 경로는 없습니다.
- Ecosystem & Coverage: 변경 범위는 GitHub PR diff 기준 `PublishModal.tsx`와 보고서뿐이며, `git diff --check HEAD FETCH_HEAD`에서 공백 오류는 없었습니다.

**Notes**

로컬 checkout은 기존 untracked `.workflow/docs/issues/12-publish-modal-mobile/` 경로와 충돌해 PR 브랜치로 전환하지 않고 `FETCH_HEAD`와 GitHub diff를 기준으로 읽었습니다. 이 리뷰에서 별도 `npm run lint`/`npm run build`는 실행하지 않았습니다.
