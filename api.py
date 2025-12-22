from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import uvicorn
import os
import json
import re
import shutil
import importlib
from rag_agent import RAGAgent
from process_data import main as build_kb_main
import config

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
    if os.path.exists(config.VECTOR_DB_PATH):
        try:
            rag_agent = RAGAgent(model=config.MODEL_NAME)
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
        rag_agent = RAGAgent(model=config.MODEL_NAME)

        return {"message": "知识库构建成功！"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"构建知识库失败: {str(e)}")


@app.post("/chat")
async def chat(request: ChatRequest):
    global rag_agent
    if not rag_agent:
        # 尝试重新初始化
        if os.path.exists(config.VECTOR_DB_PATH):
            rag_agent = RAGAgent(model=config.MODEL_NAME)
        else:
            raise HTTPException(
                status_code=400, detail="知识库尚未构建，请先点击'构建知识库'按钮。"
            )

    try:
        # 使用流式响应
        return StreamingResponse(
            rag_agent.answer_question(
                request.query, chat_history=request.history, stream=True
            ),
            media_type="text/event-stream",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成回答失败: {str(e)}")


class QuizRequest(BaseModel):
    topic: str
    difficulty: str
    type: str
    num_questions: int = 1


@app.post("/quiz")
async def generate_quiz(request: QuizRequest):
    global rag_agent
    if not rag_agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        quiz_json = rag_agent.generate_quiz(
            topic=request.topic,
            difficulty=request.difficulty,
            question_type=request.type,
            num_questions=request.num_questions,
        )
        # Try to parse it to ensure it's valid JSON before returning
        try:
            return json.loads(quiz_json)
        except json.JSONDecodeError:
            # If strict JSON fails, try to find JSON block
            match = re.search(r"\{.*\}", quiz_json, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            else:
                return {"error": "Failed to parse quiz JSON", "raw": quiz_json}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class OutlineRequest(BaseModel):
    topic: Optional[str] = ""


@app.post("/outline")
async def generate_outline(request: OutlineRequest):
    global rag_agent
    if not rag_agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        # 使用流式响应返回 Markdown
        response = rag_agent.generate_outline(topic=request.topic, stream=True)

        def stream_generator():
            try:
                for chunk in response:
                    if chunk.choices[0].delta.content is not None:
                        yield chunk.choices[0].delta.content
            except Exception as e:
                yield f"生成提纲失败: {str(e)}"

        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/files")
async def list_files():
    """列出知识库目录下的所有文件"""
    try:
        if not os.path.exists(config.DATA_DIR):
            os.makedirs(config.DATA_DIR)

        files = []
        for f in os.listdir(config.DATA_DIR):
            file_path = os.path.join(config.DATA_DIR, f)
            if os.path.isfile(file_path):
                files.append({"name": f, "size": os.path.getsize(file_path)})
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件列表失败: {str(e)}")


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传文件到知识库目录"""
    try:
        if not os.path.exists(config.DATA_DIR):
            os.makedirs(config.DATA_DIR)

        file_path = os.path.join(config.DATA_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {"message": f"文件 {file.filename} 上传成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传文件失败: {str(e)}")


@app.delete("/files/{filename}")
async def delete_file(filename: str):
    """删除知识库目录下的文件"""
    try:
        file_path = os.path.join(config.DATA_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return {"message": f"文件 {filename} 删除成功"}
        else:
            raise HTTPException(status_code=404, detail="文件不存在")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除文件失败: {str(e)}")


@app.get("/settings")
async def get_settings():
    """获取当前配置"""
    try:
        current_config = config.DEFAULT_CONFIG.copy()
        if os.path.exists(config.CONFIG_FILE):
            with open(config.CONFIG_FILE, "r", encoding="utf-8") as f:
                custom_config = json.load(f)
                current_config.update(custom_config)
        return current_config
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取配置失败: {str(e)}")


@app.post("/settings")
async def update_settings(settings: Dict[str, Any]):
    """更新配置"""
    try:
        # 读取现有配置以保留未修改的项
        current_custom_config = {}
        if os.path.exists(config.CONFIG_FILE):
            with open(config.CONFIG_FILE, "r", encoding="utf-8") as f:
                current_custom_config = json.load(f)

        # 更新配置
        current_custom_config.update(settings)

        # 写入文件
        with open(config.CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(current_custom_config, f, indent=4, ensure_ascii=False)

        # 记录旧值用于对比
        old_model = config.MODEL_NAME

        # 重新加载配置模块
        importlib.reload(config)

        print(f"[Debug] Configuration reloaded.")
        print(f"[Debug] Model update: {old_model} -> {config.MODEL_NAME}")

        # 重新初始化 Agent
        global rag_agent
        if rag_agent:
            # 使用新的配置重新初始化
            rag_agent = RAGAgent(
                model=config.MODEL_NAME, fast_model=config.FAST_MODEL_NAME
            )
            print(f"[Debug] RAG Agent re-initialized with model: {config.MODEL_NAME}")

        return {"message": "配置已更新并生效"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新配置失败: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
