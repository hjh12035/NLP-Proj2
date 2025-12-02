import os
from typing import List, Dict

import chromadb
from chromadb.config import Settings
from openai import OpenAI
from tqdm import tqdm

from config import (
    VECTOR_DB_PATH,
    COLLECTION_NAME,
    OPENAI_API_KEY,
    OPENAI_API_BASE,
    OPENAI_EMBEDDING_MODEL,
    TOP_K,
)


class VectorStore:

    def __init__(
        self,
        db_path: str = VECTOR_DB_PATH,
        collection_name: str = COLLECTION_NAME,
        api_key: str = OPENAI_API_KEY,
        api_base: str = OPENAI_API_BASE,
    ):
        self.db_path = db_path
        self.collection_name = collection_name

        # 初始化OpenAI客户端
        self.client = OpenAI(api_key=api_key, base_url=api_base)

        # 初始化ChromaDB
        os.makedirs(db_path, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(
            path=db_path, settings=Settings(anonymized_telemetry=False)
        )

        # 获取或创建collection
        self.collection = self.chroma_client.get_or_create_collection(
            name=collection_name, metadata={"description": "课程材料向量数据库"}
        )

    def get_embedding(self, text: str) -> List[float]:
        """获取文本的向量表示

        TODO: 使用OpenAI API获取文本的embedding向量

        """
        # 移除换行符以获得更好的embedding效果
        text = text.replace("\n", " ")
        try:
            response = self.client.embeddings.create(
                input=[text], model=OPENAI_EMBEDDING_MODEL
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"获取Embedding失败: {e}")
            return []

    def add_documents(self, chunks: List[Dict[str, str]]) -> None:
        """添加文档块到向量数据库
        TODO: 实现文档块添加到向量数据库
        要求：
        1. 遍历文档块
        2. 获取文档块内容
        3. 获取文档块元数据
        5. 打印添加进度
        """
        ids = []
        documents = []
        metadatas = []
        embeddings = []

        print(f"正在处理 {len(chunks)} 个文档块...")

        for chunk in tqdm(chunks, desc="生成向量并准备数据"):
            content = chunk.get("content", "")
            if not content:
                continue

            # 1. 获取Embedding
            embedding = self.get_embedding(content)
            if not embedding:
                continue

            # 2. 生成唯一ID (文件名_页码_块ID)
            # PDF/PPT: chunk_id为0，依靠page_number区分
            # DOCX/TXT: page_number为0，依靠chunk_id区分
            filename = chunk.get("filename", "unknown")
            chunk_id = chunk.get("chunk_id", 0)
            page_number = chunk.get("page_number", 0)
            uid = f"{filename}_p{page_number}_c{chunk_id}"

            # 3. 准备元数据 (过滤掉复杂对象)
            meta = {
                "filename": filename,
                "filepath": chunk.get("filepath", ""),
                "filetype": chunk.get("filetype", ""),
                "page_number": chunk.get("page_number", 0),
                "chunk_id": chunk_id,
            }

            ids.append(uid)
            documents.append(content)
            embeddings.append(embedding)
            metadatas.append(meta)

        # 批量添加到ChromaDB
        if ids:
            try:
                self.collection.add(
                    documents=documents,
                    embeddings=embeddings,
                    metadatas=metadatas,
                    ids=ids,
                )
                print(f"成功添加 {len(ids)} 个文档块到向量数据库")
            except Exception as e:
                print(f"添加文档到向量数据库失败: {e}")

    def search(self, query: str, top_k: int = TOP_K) -> List[Dict]:
        """搜索相关文档

        TODO: 实现向量相似度搜索
        要求：
        1. 首先获取查询文本的embedding向量（调用self.get_embedding）
        2. 使用self.collection进行向量搜索, 得到top_k个结果
        3. 格式化返回结果，每个结果包含：
           - content: 文档内容
           - metadata: 元数据（文件名、页码等）
        4. 返回格式化的结果列表
        """
        # 1. 获取查询文本的embedding
        query_embedding = self.get_embedding(query)
        if not query_embedding:
            return []

        # 2. 搜索
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding], n_results=top_k
            )

            # 3. 格式化结果
            formatted_results = []
            if results["documents"]:
                # Chroma返回的是列表的列表
                docs = results["documents"][0]
                metas = results["metadatas"][0]
                distances = results["distances"][0] if results["distances"] else []

                for i in range(len(docs)):
                    formatted_results.append(
                        {
                            "content": docs[i],
                            "metadata": metas[i],
                            "score": distances[i] if i < len(distances) else 0.0,
                        }
                    )

            return formatted_results

        except Exception as e:
            print(f"搜索失败: {e}")
            return []

    def clear_collection(self) -> None:
        """清空collection"""
        self.chroma_client.delete_collection(name=self.collection_name)
        self.collection = self.chroma_client.create_collection(
            name=self.collection_name, metadata={"description": "课程向量数据库"}
        )
        print("向量数据库已清空")

    def get_collection_count(self) -> int:
        """获取collection中的文档数量"""
        return self.collection.count()
