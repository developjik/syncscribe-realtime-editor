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

## This Week Updates (2026-03-04 ~ 2026-03-06)

### 1) 문서 전환 시 협업 세션 재초기화 및 메모리 정리

- 문서를 바꿀 때 기존 Yjs/WebRTC 세션을 정리하고 새 문서 room으로 재초기화하도록 개선
- 문서 간 전환 시 이전 세션 잔여 상태가 섞이는 문제를 방지

### 2) 편집 이벤트 기반 `updatedAt` 자동 갱신

- Yjs update 이벤트를 구독해 문서 수정 시 최근 수정일이 자동 반영되도록 개선
- 800ms 디바운스로 과도한 저장/렌더링을 방지하고 문서 목록 정렬 정확도를 유지

### 3) 문서 목록/툴바 접근성 강화

- 입력/버튼에 `label`, `aria-label`, `aria-current` 추가
- 키보드 포커스 가시성(`:focus-visible`)과 스크린리더 전용 텍스트(`srOnly`) 적용
- 협업 인원 수를 실시간(`awareness`)으로 표시해 상태 인지성 강화

## Interview Highlights (문제-해결-성과)

1. **문제:** 문서 전환 시 이전 room 상태가 남아 협업 문맥이 섞일 위험  
   **해결:** 전환 시 provider/ydoc/persistence를 정리 후 문서별 room으로 재생성  
   **성과:** 문서 경계가 명확해져 세션 오염 없이 안정적인 멀티 문서 협업 구현

2. **문제:** 실제로 편집된 문서를 목록에서 바로 식별하기 어려움  
   **해결:** Yjs `update` 이벤트 기반 `updatedAt` 자동 갱신 + 디바운스 적용  
   **성과:** 최신 작업 문서가 상단에 유지되어 탐색/재진입 동선 개선

3. **문제:** 초기 UI가 마우스 중심이라 키보드/보조기기 접근성이 낮음  
   **해결:** 입력/버튼 ARIA 보강, 활성 문서 `aria-current`, 포커스 스타일 개선  
   **성과:** 기본 접근성 품질을 확보해 실무 협업 도구 수준의 UX 완성도 향상

4. **문제:** 협업 중 접속 상태를 직관적으로 파악하기 어려움  
   **해결:** Yjs awareness 상태 수를 기반으로 현재 접속자 수를 실시간 노출  
   **성과:** 동시 편집 상황 인지가 쉬워져 협업 피드백 루프 단축

## Next Steps (Portfolio 강화)

- 인증 고도화 (Supabase/Auth.js)
- 문서 목록 서버 저장 + 권한 모델
- 변경 이력/버전 롤백
- Playwright E2E + 성능 측정 리포트
- 아키텍처 다이어그램 + 트러블슈팅 기록
