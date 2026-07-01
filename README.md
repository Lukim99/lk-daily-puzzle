# 데일리퍼즐

Vite + React + Supabase 기반의 일일 퍼즐 게임입니다.

## 로컬 실행

~~~bash
npm install
copy .env.example .env.local
npm run dev
~~~

.env.local에는 다음 값을 설정합니다.

~~~env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=sb_publishable_your_key
~~~

SUPABASE_KEY에는 브라우저 공개가 허용된 publishable/anon 키만 사용합니다. secret 또는 service-role 키를 넣으면 안 됩니다.

## Supabase / 카카오 설정

1. supabase/migrations의 마이그레이션을 적용합니다.
2. Supabase Dashboard의 Authentication > Providers에서 Kakao를 활성화합니다.
3. Kakao Developers의 Redirect URI에 https://project-ref.supabase.co/auth/v1/callback 을 등록합니다.
4. Supabase URL Configuration의 Redirect Allow List에 로컬 주소와 Vercel 배포 주소를 등록합니다.

포인트 차감, 힌트 구매, 최초 정답 판정, 상금 분배는 모두 DB RPC 트랜잭션에서 실행됩니다.

## 배경 이미지

다음 파일을 public/에 추가하면 CSS 폴백 대신 지정 이미지가 적용됩니다.

- bg_pc.png: PC 가로 배경, 권장 1920×1080 이상
- bg_mobile.png: 모바일 세로 배경, 권장 1080×1920 이상

두 이미지는 background-size: cover로 화면 전체를 채우며 반복되지 않습니다.

## Vercel

Vercel 프로젝트에 SUPABASE_URL, SUPABASE_KEY 환경변수를 설정한 뒤 배포합니다. 별도 서버 라우팅 설정은 필요하지 않습니다.
