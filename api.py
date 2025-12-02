from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
import os
from rag_agent import RAGAgent
from process_data import main as build_kb_main
from config import MODEL_NAME, VECTOR_DB_PATH

app = FastAPI()

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],  # 允许所有来源，生产环境建议设置为具体的前端地址 ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局 RAG Agent 实例
rag_agent = None


class ChatRequest(BaseModel):
    query: str
    history: Optional[List[Dict[str, str]]] = []


class ChatResponse(BaseModel):
    answer: str


@app.on_event("startup")
async def startup_event():
    global rag_agent
    # 只有当向量库存在时才初始化 Agent，否则等待构建
    if os.path.exists(VECTOR_DB_PATH):
        try:
            rag_agent = RAGAgent(model=MODEL_NAME)
            print("RAG Agent initialized successfully.")
        except Exception as e:
            print(f"Failed to initialize RAG Agent: {e}")


@app.post("/build-kb")
async def build_knowledge_base():
    try:
        # 调用 process_data.py 中的 main 函数来构建知识库
        build_kb_main()

        # 构建完成后重新初始化 Agent
        global rag_agent
        rag_agent = RAGAgent(model=MODEL_NAME)

        return {"message": "知识库构建成功！"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"构建知识库失败: {str(e)}")


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    global rag_agent
    if not rag_agent:
        # 尝试重新初始化
        if os.path.exists(VECTOR_DB_PATH):
            rag_agent = RAGAgent(model=MODEL_NAME)
        else:
            raise HTTPException(
                status_code=400, detail="知识库尚未构建，请先点击'构建知识库'按钮。"
            )

    try:
        # 转换历史记录格式以匹配 RAGAgent 的期望 (如果需要)
        # 这里假设 RAGAgent.answer_question 接受的 history 格式与前端一致
        answer = rag_agent.answer_question(request.query, chat_history=request.history)
        return ChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成回答失败: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
