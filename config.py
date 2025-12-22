import os
import json

# 默认配置
DEFAULT_CONFIG = {
    "OPENAI_API_KEY": "sk-fb4a196bdd0a4f3ca90971f9ecd90ee9",
    "OPENAI_API_BASE": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "MODEL_NAME": "qwen3-max",
    "FAST_MODEL_NAME": "qwen-flash",
    "OPENAI_EMBEDDING_MODEL": "text-embedding-v2",
    "DATA_DIR": "./data",
    "VECTOR_DB_PATH": "./vector_db",
    "COLLECTION_NAME": "nlp_course_rag",
    "CHUNK_SIZE": 500,
    "CHUNK_OVERLAP": 50,
    "MAX_TOKENS": 4096,
    "TOP_K": 10,
}

# 尝试加载 config.json
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
_config = DEFAULT_CONFIG.copy()

if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            custom_config = json.load(f)
            _config.update(custom_config)
    except Exception as e:
        print(f"Error loading config.json: {e}")

# 导出变量
OPENAI_API_KEY = _config.get("OPENAI_API_KEY", DEFAULT_CONFIG["OPENAI_API_KEY"])
OPENAI_API_BASE = _config.get("OPENAI_API_BASE", DEFAULT_CONFIG["OPENAI_API_BASE"])
MODEL_NAME = _config.get("MODEL_NAME", DEFAULT_CONFIG["MODEL_NAME"])
FAST_MODEL_NAME = _config.get("FAST_MODEL_NAME", DEFAULT_CONFIG["FAST_MODEL_NAME"])
OPENAI_EMBEDDING_MODEL = _config.get(
    "OPENAI_EMBEDDING_MODEL", DEFAULT_CONFIG["OPENAI_EMBEDDING_MODEL"]
)

DATA_DIR = _config.get("DATA_DIR", DEFAULT_CONFIG["DATA_DIR"])

VECTOR_DB_PATH = _config.get("VECTOR_DB_PATH", DEFAULT_CONFIG["VECTOR_DB_PATH"])
COLLECTION_NAME = _config.get("COLLECTION_NAME", DEFAULT_CONFIG["COLLECTION_NAME"])

CHUNK_SIZE = _config.get("CHUNK_SIZE", DEFAULT_CONFIG["CHUNK_SIZE"])
CHUNK_OVERLAP = _config.get("CHUNK_OVERLAP", DEFAULT_CONFIG["CHUNK_OVERLAP"])
MAX_TOKENS = _config.get("MAX_TOKENS", DEFAULT_CONFIG["MAX_TOKENS"])

TOP_K = _config.get("TOP_K", DEFAULT_CONFIG["TOP_K"])
