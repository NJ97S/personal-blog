export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  // application/ld+json 스크립트는 브라우저가 JS로 실행하지는 않지만,
  // JSON.stringify 결과에 `</script>` 시퀀스가 그대로 들어가면 스크립트 태그가
  // 조기 종료되어 후속 페이로드가 실제 스크립트로 해석될 수 있습니다.
  // `<` 만 < 로 치환하면 충분하며 JSON 파서는 동일하게 복원합니다.
  const safe = JSON.stringify(data).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
