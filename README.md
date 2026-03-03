# SyncScribe — Real-time Collaborative Editor

프론트엔드 이직용 서브 프로젝트로 만든 **실시간 협업 에디터**입니다.  
핵심 목표는 아래 3가지를 실제 코드로 증명하는 것입니다.

- CRDT 기반 동시 편집 처리
- 협업 UX(커서/방 단위 세션)
- 실무형 제품 구조(로그인, 문서목록, 배포 준비)

## Stack

- React + TypeScript + Vite
- Tiptap Editor
- Yjs (CRDT)
- y-webrtc (P2P 실시간 동기화)
- y-indexeddb (오프라인 복구)
- LocalStorage 기반 간단 인증/문서 메타데이터 저장

## Implemented (Step 1 + Step 2)

### Step 1

- 실시간 공동 편집 (같은 Room ID 접속)
- 사용자별 협업 커서 표시
- IndexedDB 기반 오프라인 복구

### Step 2

- 로그인 화면 + 사용자 프로필 로컬 저장
- 문서 목록 사이드바 (생성/선택/삭제)
- 문서별 room 분리 협업
- 로그아웃/세션 상태 유지

## Architecture (요약)

- `문서 본문`: Yjs Doc + WebRTC provider로 동기화
- `문서 메타`: 로컬 스토리지(`title`, `updatedAt`, `id`) 관리
- `사용자 상태`: 로컬 스토리지(`name`, `color`) 관리
- `협업 세션`: 선택된 문서의 `id`를 room id로 사용

## Quick Start

```bash
npm install
npm run dev
```

동작 확인:

1. 브라우저 탭 2개를 연다.
2. 같은 문서를 선택한다.
3. 텍스트 입력 시 실시간 동기화되는지 확인한다.

## Build

```bash
npm run build
npm run preview
```

## Deploy (Vercel)

이미 `vercel.json`이 포함되어 있어 바로 배포 가능합니다.

```bash
npm i -g vercel
vercel
```

## Next Steps (Portfolio 강화)

- 인증 고도화 (Supabase/Auth.js)
- 문서 목록 서버 저장 + 권한 모델
- 변경 이력/버전 롤백
- Playwright E2E + 성능 측정 리포트
- 아키텍처 다이어그램 + 트러블슈팅 기록
