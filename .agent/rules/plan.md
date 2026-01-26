---
trigger: always_on
---

# 나라장터 B2G 제안서 자동 작성 AI SaaS 개발 아키텍처 및 플랜

## 1. 프로젝트 개요
* **목표:** 나라장터 입찰 공고의 제안요청서(RFP)를 분석하여, 맞춤형 제안서 초안을 자동으로 생성하는 SaaS 개발
* **핵심 가치:** 제안서 작성 시간 단축 및 목차 누락 방지, 제안요청서 요구사항 정밀 반영
* **핵심 로직:** RFP 업로드 -> 사업개요 추출 -> 목차 페이지 식별 및 구조화 -> 목차별 순차적 내용 생성

---

## 2. 시스템 아키텍처 (System Architecture)

전체 시스템은 크게 **Frontend(클라이언트)**, **Backend API(서버)**, **AI Pipeline(로직 처리)**, **Data Store(저장소)**로 구성됩니다.

### 2.1. Tech Stack (권장)
* **Frontend:** React (TypeScript) - 복잡한 제안서 에디팅 및 실시간 생성 상태 시각화
* **Backend:** Python (FastAPI 또는 Django) - 비동기 처리 및 LLM 라이브러리 호환성 우수
* **LLM Framework:** LangChain / LangGraph - 복잡한 순차적 생성 로직 및 상태 관리(State Management)에 필수
* **PDF Parsing:** PyMuPDF (fitz) 또는 OCR 솔루션 (Upstage Document Parse 등 고성능 파서 권장)
* **Database:** * RDB (PostgreSQL): 사용자 정보, 프로젝트 메타데이터, 생성된 제안서 텍스트 저장
    * Vector DB (선택사항): 회사 소개서나 방대한 RFP 참조가 필요할 경우 RAG 구축용

### 2.2. Data Flow Pipeline

#### **Phase 1: Ingestion & Pre-processing (Step 1, 2, 3)**
1.  **PDF Upload:** 사용자가 RFP PDF 업로드
2.  **Text Extraction:** 페이지 단위로 텍스트/이미지 추출 및 메타데이터(페이지 번호) 태깅
3.  **Project Overview Extraction:** * 전체 텍스트 중 앞부분(통상 1~10페이지 내)을 스캔하여 LLM에 주입 -> "사업개요(10줄)" 요약 생성
4.  **TOC Page Identification (Parallel Processing):**
    * 추출된 각 페이지 텍스트를 LLM에 전송 (병렬 처리)
    * Prompt: "이 페이지가 제안서 목차나 작성 지침을 포함하는가? (True/False)"
    * Output: `True`로 판별된 페이지 인덱스 리스트 확보

#### **Phase 2: Structuring (Step 4)**
1.  **TOC Structuring:**
    * 선별된 목차 페이지 텍스트 통합
    * LLM 호출: 비정형 텍스트를 계층적 JSON 구조로 변환
    * **Output Schema:**
        ```json
        [
          {
            "chapter_title": "I. 제안 개요",
            "sub_sections": [
              {
                "title": "1. 사업의 목적",
                "guideline": "본 사업의 추진 배경 및 필요성을 구체적으로 기술..."
              },
              ...
            ]
          },
          ...
        ]
        ```

#### **Phase 3: Generation (Step 5)**
1.  **Sequential Generation (Chain):** LangGraph 등을 활용하여 중분류 단위로 순차 실행
2.  **Context Construction:**
    * 고정 컨텍스트: "우리의 목적", "사업개요", "제안서 목차"
    * 동적 컨텍스트: "현재 목차", "이전 목차 생성 내용(Summary 또는 전체)", "맞춤 데이터(회사소개서/RFP)"
3.  **Writing:** LLM이 프롬프트에 맞춰 텍스트 생성 -> DB 저장 -> Frontend로 스트리밍 전송

---

## 3. 상세 개발 플랜 (Implementation Plan)

### Step 1: PDF 처리 및 사업개요 추출 (Core Logic)
* **개발 목표:** PDF 텍스트 추출의 정확도 확보 및 사업개요 요약
* **구현 상세:**
    * PDF 파서 선정: 표(Table) 데이터가 많은 제안요청서 특성상, 단순 텍스트 추출보다 Layout을 보존하는 파서(e.g., LlamaParse, Upstage 등) 사용 고려. 비용 절감을 위해 PyMuPDF로 1차 시도.
    * **사업개요 추출 프롬프트 최적화:** "사업명", "사업기간", "예산", "주요 과업" 등 핵심 키워드가 반드시 포함되도록 지시.

### Step 2: 지능형 목차 파악 및 구조화 (Step 3 & 4)
* **개발 목표:** 수백 페이지 중 '목차' 페이지만 정확히 찾아내어 JSON으로 구조화
* **구현 상세:**
    * **Filtering (비용 절감):** 
        * **Page Exclusion:** PDF의 1~3페이지는 PDF 자체의 목차일 가능성이 높으므로 분석 대상에서 원천 제외.
        * **Keyword Filtering:** 나머지 페이지 중 '목차', '차례', 'Contents', '작성 지침' 등의 키워드가 있는 페이지만 1차 필터링하여 LLM 호출 횟수 감소.
    * **Classification Prompt:** 해당 페이지가 실제 제안서의 구조를 설명하는 페이지인지 판단. (단순 문서 목차가 아닌, '제안서 작성 목차'인지 구분이 핵심)
    * **Structure Prompt:** 추출된 텍스트를 대분류/중분류/작성지침(Guideline)으로 나누어 JSON 리턴하도록 Few-shot Prompting 적용.

### Step 3: 데이터 관리 및 컨텍스트 조립 (Data Handling)
* **개발 목표:** Step 5의 프롬프트에 들어갈 '맞춤 데이터' 분류 로직 구현
* **구현 상세:**
    * **데이터 분류:**
        * `업체 소개`, `일반 현황`, `전략` 관련 목차 → **User Data(회사소개서)** + **RFP**
        * `기능 요건`, `기술 부문`, `사업 관리` 관련 목차 → **RFP** Only
    * 이 분류를 자동화하기 위해, Step 4의 목차 구조화 단계에서 각 목차별로 "필요 참조 문서 태그(Tagging)"를 LLM이 미리 달아두도록 설계.

### Step 4: 순차적 생성 파이프라인 구축 (Step 5 - Main Engine)
* **개발 목표:** 앞뒤 문맥이 이어지는 일관성 있는 제안서 생성
* **구현 상세 (LangGraph 활용 추천):**
    * **State 관리:** 현재 진행 중인 목차 인덱스, 직전 생성된 텍스트, 누적 토큰 수 관리.
    * **프롬프트 엔지니어링:**
        * *"직전 중분류 목차의 내용"*이 너무 길 경우 LLM의 Context Window를 초과할 수 있음.
        * **해결책:** 직전 내용은 그대로 넣되, 그 이전 내용들은 '요약(Summary)' 형태로 압축하여 전달하는 'Sliding Window' 방식 적용.
    * **RAG(검색 증강) 적용:** "맞춤 데이터"가 방대할 경우, 해당 목차와 관련된 부분만 검색(Retrieve)하여 프롬프트에 주입.

### Step 5: UI/UX 및 결과물 내보내기
* **개발 목표:** 사용자가 생성 과정을 보고, 수정하고, 최종 다운로드 가능하게 함
* **구현 상세:**
    * **Progress UI:** 전체 목차 중 현재 어느 부분을 작성 중인지 실시간 표시.
    * **Editor:** 생성된 초안을 Markdown 또는 WYSIWYG 에디터로 수정 가능.
    * **Export:** 최종 결과물을 .docx 또는 .hwp로 변환 (pandoc 또는 python-docx 활용).

---

## 4. 기술적 고려사항 및 최적화 (Deep Dive)

1.  **Token Limit & Cost Management:**
    * 제안요청서 전체를 매번 프롬프트에 넣으면 비용이 과다하고 토큰 제한에 걸림.
    * **전략:** RFP를 벡터 스토어(Vector Store)에 청크(Chunk) 단위로 저장하고, 각 목차 작성 시 **관련된 RFP 내용만 검색(Top-k)**하여 프롬프트에 넣는 RAG 방식이 필수적임.
    
2.  **Latency (생성 속도):**
    * 순차적(Sequential) 생성은 시간이 오래 걸림 (e.g., 목차가 20개면 20번의 LLM 호출 대기).
    * **전략:** 문맥 의존성이 적은 챕터(예: 회사 현황과 기술 부문은 서로 독립적일 수 있음)는 **병렬(Parallel) 생성**을 도입하여 전체 대기 시간을 단축.

3.  **Hallucination (환각) 방지:**
    * 생성된 내용이 RFP의 요구사항(스펙)을 위배하면 치명적.
    * **전략:** 생성 후 **"검증(Verification) 에이전트"**를 추가. (생성된 내용 vs RFP 원문 비교하여 팩트 체크 수행).