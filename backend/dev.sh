#!/bin/bash
# backend 폴더 위치에서 실행되도록 보장
cd "$(dirname "$0")"

# 가상환경의 python을 사용하여 uvicorn 실행 (별도의 activate 없이 한 번에 실행)
echo "Starting backend server with venv..."
./venv/bin/uvicorn src.main:app --reload --port 8080
