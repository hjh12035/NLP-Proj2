# RAG 智能助教系统

一个基于 RAG (Retrieval-Augmented Generation) 技术的智能课程助教系统，能够根据课程资料回答学生问题、生成习题和复习提纲。

## 项目简介

本项目是一个完整的课程辅助学习系统，包含后端 RAG 引擎和前端交互界面。系统通过向量数据库存储指定的课程资料，使用大语言模型提供智能问答、习题生成和提纲生成等功能。

## 主要特性

- **智能问答**：基于课程资料回答学生问题，并标注信息来源
- **多模态处理**：支持提取和理解PDF、PPT中的图片内容（OCR），实现图文跨模态检索
- **检索优化**：
  - **混合检索**：结合向量检索（语义检索）和关键词检索（BM25），使用 RRF 算法融合排序
  - **查询扩展**：自动扩展用户查询，提高检索召回率
  - **意图识别**：分析用户意图（如追问、换话题等），动态管理上下文窗口
- **上下文管理**：支持多轮对话，自动分析意图并管理上下文窗口
- **习题生成**：根据指定主题和难度生成不同种类的习题
- **提纲生成**：自动生成结构化的主题复习提纲
- **文件管理**：支持上传、删除课程文件（包括PDF、PPTX、DOCX、TXT四种类别）
- **流式输出**：支持流式输出响应，提供更好的用户体验
- **可配置性**：支持自定义API、模型、向量数据库等配置

## 技术栈

### 后端
- **FastAPI**：Web API 框架
- **OpenAI API**：大语言模型接口
- **ChromaDB**：向量数据库
- **LangChain**：LLM 应用开发框架
- **sentence-transformers**：文本向量化
- **rank_bm25**：BM25 关键词检索算法
- **pytesseract**：OCR 文字识别
- **Pillow**：图像处理

### 前端
- **Next.js 16**：React 框架
- **TypeScript**：类型安全
- **Tailwind CSS**：样式框架
- **React Markdown**：Markdown 渲染
- **KaTeX**：数学公式渲染
- **Lucide React**：图标库

## 项目结构

```
NLP-Proj2/
├── api.py                  # FastAPI 后端服务
├── main.py                 # 命令行交互入口
├── rag_agent.py           # RAG Agent 核心逻辑（包含意图识别、查询扩展）
├── document_loader.py     # 文档加载器（支持多模态OCR）
├── text_splitter.py       # 文本切分器
├── vector_store.py        # 向量数据库管理（支持混合检索）
├── process_data.py        # 数据处理和知识库构建
├── config.py              # 配置管理
├── config.json            # 配置文件
├── requirements.txt       # Python 依赖
├── rag-agent/             # Next.js 前端应用
│   ├── app/               # Next.js App Router
│   │   ├── page.tsx       # 主页面
│   │   ├── layout.tsx     # 布局
│   │   └── globals.css    # 全局样式
│   ├── package.json       # 前端依赖
│   └── tsconfig.json      # TypeScript 配置
├── data/                  # 课程资料目录 (用户上传的文件)
│   └── images/            # 提取的图片缓存
└── vector_db/             # ChromaDB 向量数据库文件
```

## 安装步骤

### 1. 克隆项目

```bash
git clone https://github.com/hjh12035/NLP-Proj2.git
cd NLP-Proj2
```

### 2. 环境准备

#### 安装 Tesseract OCR
本项目使用了 OCR 技术提取图片文字，需要安装 Tesseract 引擎：
- **Windows**: 下载安装包 [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/) 并将安装路径添加到环境变量 PATH 中。
- **Linux**: `sudo apt-get install tesseract-ocr`
- **MacOS**: `brew install tesseract`

#### 安装 Node.js
前端项目基于 Next.js 开发，需要安装 Node.js 环境（建议安装 v20 或更高版本）：
- 访问 [Node.js 官网](https://nodejs.org/) 下载并安装 LTS 版本。
- 安装完成后，在终端运行 `node -v` 和 `npm -v` 检查是否安装成功。

### 3. 后端安装

```bash
# 安装 Python 依赖
pip install -r requirements.txt
```

### 4. 前端安装

```bash
cd rag-agent
npm install
```

## 配置说明

> **提示**：在运行项目之前，请务必修改根目录下的 `config.json` 文件，将 `"OPENAI_API_KEY"` 的值替换为您自己的 API Key。如果使用其他兼容 OpenAI 接口的模型服务，请同时修改 `"OPENAI_API_BASE"` 和 `"MODEL_NAME"`。

### 配置文件 (config.json)

```json
{
    "OPENAI_API_KEY": "your-api-key",
    "OPENAI_API_BASE": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "MODEL_NAME": "qwen3-max",
    "FAST_MODEL_NAME": "qwen-flash",
    "OPENAI_EMBEDDING_MODEL": "text-embedding-v3",
    "DATA_DIR": "./data",
    "VECTOR_DB_PATH": "./vector_db",
    "COLLECTION_NAME": "nlp_course_rag",
    "CHUNK_SIZE": 500,
    "CHUNK_OVERLAP": 50,
    "MAX_TOKENS": 4096,
    "TOP_K": 10
}
```

### 配置项说明

- `OPENAI_API_KEY`: OpenAI API 密钥（或兼容接口的密钥）
- `OPENAI_API_BASE`: API 基础 URL
- `MODEL_NAME`: 主模型名称（用于生成回答、习题、提纲）
- `FAST_MODEL_NAME`: 快速模型名称（用于意图分析、查询扩展）
- `OPENAI_EMBEDDING_MODEL`: 向量化模型名称
- `DATA_DIR`: 课程资料存放目录
- `VECTOR_DB_PATH`: 向量数据库存储路径
- `COLLECTION_NAME`: ChromaDB 集合名称
- `CHUNK_SIZE`: 文本切分块大小
- `CHUNK_OVERLAP`: 文本块重叠大小
- `MAX_TOKENS`: 最大 token 数量
- `TOP_K`: 检索返回的文档数量

## 使用方法

### 方法一：使用完整系统（推荐）

#### 1. 启动后端服务

```bash
# 在项目根目录下
python api.py
```

后端服务将在 `http://localhost:8000` 启动。

#### 2. 启动前端服务

```bash
cd rag-agent
npm run dev
```

前端服务将在 `http://localhost:3000` 启动。

#### 3. 使用系统

1. 打开浏览器访问 `http://localhost:3000`
2. 上传课程文件（PDF、PPTX、DOCX、TXT）
3. 点击"构建知识库"按钮处理文件
4. 开始使用智能问答、习题生成、提纲生成等功能

### 方法二：命令行交互

#### 1. 准备课程资料

将课程文件（PDF、PPTX、DOCX、TXT）放入 `./data` 目录。

```bash
mkdir -p data
# 将课程文件复制到 data 目录
```

#### 2. 构建知识库

```bash
python process_data.py
```

此命令会：
- 加载所有文档
- 对文档进行切分
- 生成向量并存储到 ChromaDB

#### 3. 启动命令行对话

```bash
python main.py
```

进入交互式问答模式，可以直接提问。

## 核心功能说明

### 1. 文档加载 (document_loader.py)

支持多种文档格式：
- **PDF**：按页提取文本
- **PPTX**：按幻灯片提取文本
- **DOCX**：提取完整文档文本
- **TXT**：直接读取文本

### 2. 文本切分 (text_splitter.py)

- 按照配置的 `CHUNK_SIZE` 切分文本
- 支持 `CHUNK_OVERLAP` 保持上下文连续性
- 智能在句子边界处切分

### 3. 向量存储 (vector_store.py)

- 使用 ChromaDB 作为向量数据库
- 使用 OpenAI Embedding API 生成向量
- 支持相似度搜索

### 4. RAG Agent (rag_agent.py)

#### 意图分析
自动分析用户问题的意图类型：
- `NEW_TOPIC`: 全新话题
- `DRILL_DOWN`: 深入追问
- `TOPIC_SHIFT`: 话题平移
- `CLARIFICATION`: 澄清纠正
- `SUMMARIZATION`: 总结回顾
- `CHIT_CHAT`: 闲聊

#### 上下文管理
- 维护上下文窗口（默认 15 个文档片段）
- 根据意图动态更新窗口
- 支持去重和 FIFO 策略

#### 查询优化
- 使用快速模型进行查询扩展
- 提高检索相关性

#### 流式输出
- 支持流式响应，实时返回生成内容

## 开发说明

### 后端开发

```bash
# 启动开发服务器（带自动重载）
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

### 前端开发

```bash
cd rag-agent
npm run dev
```

前端会自动代理 API 请求到后端服务。

### 添加新功能

1. 在 `rag_agent.py` 中添加新方法
2. 在 `api.py` 中添加新的 API 端点
3. 在前端添加对应的 UI 和 API 调用

## 常见问题

### 1. 如何更换模型？

修改 `config.json` 中的 `MODEL_NAME` 和 `OPENAI_EMBEDDING_MODEL`，或者在用户界面中的设置页面更改。

### 2. 知识库构建失败？

- 检查 API 密钥是否正确
- 确认 `data` 目录下有支持的文件格式
- 查看控制台错误信息

### 3. 回答质量不理想？

- 增加 `TOP_K` 值以检索更多文档
- 调整 `CHUNK_SIZE` 和 `CHUNK_OVERLAP`
- 优化系统提示词

### 4. 前端无法连接后端？

确保后端服务已启动，并检查 API 地址配置。

### 5. 如何支持更多文件格式？

在 `document_loader.py` 中添加新的加载方法，并更新 `supported_formats` 列表。

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件
