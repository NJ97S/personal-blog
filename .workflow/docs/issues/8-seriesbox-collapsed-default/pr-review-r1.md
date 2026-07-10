APPROVE — 현재 diff에서 병합을 막을 결함을 찾지 못했습니다.

**Findings**
- 🔴 없음
- 🟡 없음
- 🟢 없음

**Verification**
- `components/SeriesBox.tsx`의 접힘 기본값, 5개 초과 시 앞 5개 미리보기, 펼침/숨김 토글, 5개 이하 토글 숨김, `n/total` 인디케이터 유지 동작을 diff와 호출부(`app/posts/[slug]/page.tsx`) 기준으로 확인했습니다.
- 현재 글이 앞 5개 밖이면 접힘 미리보기에서 하이라이트가 보이지 않는 케이스는 이 이슈 계획에서 의도된 정책으로 명시되어 있어 결함으로 보지 않았습니다.
- `npm run lint` 통과.
- `npm run build` 통과.
