# Naraworks

B2G 제안서 작성 지원 SaaS 플랫폼입니다.

## 프로젝트 구조

- `frontend/`: Next.js 기반 프론트엔드
- `backend/`: FastAPI 기반 백엔드

## 실행 방법

루트 폴더에서 다음 커맨드를 사용하여 각 서버를 간편하게 실행할 수 있습니다.

### 1. 백엔드 실행
백엔드 가상환경(`venv`) 활성화와 서버 실행을 동시에 처리합니다.
```bash
npm run back
```

### 2. 프론트엔드 실행
프론트엔드 개발 서버를 실행합니다.
```bash
npm run front
```

---

## 기타 상세

### 백엔드 개별 실행 (backend 폴더)
```bash
cd backend
./dev.sh
```

### 프론트엔드 개별 실행 (frontend 폴더)
```bash
cd frontend
npm run dev
```
