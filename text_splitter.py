from typing import List, Dict
from tqdm import tqdm


class TextSplitter:
    def __init__(self, chunk_size: int, chunk_overlap: int):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> List[str]:
        """将文本切分为块

        TODO: 实现文本切分算法
        要求：
        1. 将文本按照chunk_size切分为多个块
        2. 相邻块之间要有chunk_overlap的重叠（用于保持上下文连续性）
        3. 尽量在句子边界处切分（查找句子结束符：。！？.!?\n\n）
        4. 返回切分后的文本块列表
        """
        if not text:
            return []

        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            # 确定当前块的结束位置（不超过 chunk_size）
            end = min(start + self.chunk_size, text_len)

            # 如果不是最后一段，尝试在 chunk_size 范围内寻找句子结束符
            if end < text_len:
                chunk_text = text[start:end]
                split_point = -1
                # 从后往前查找句子结束符，尽量让块更长
                for i in range(len(chunk_text) - 1, -1, -1):
                    if chunk_text[i] in "。！？.!?\n":
                        split_point = start + i + 1
                        break

                # 如果找到了结束符，就在结束符处切分
                if split_point != -1:
                    end = split_point

            # 添加当前块
            chunk = text[start:end]
            chunks.append(chunk)

            # 如果已经处理完所有文本，退出循环
            if end == text_len:
                break

            # 计算下一个块的起始位置（考虑重叠）
            next_start = end - self.chunk_overlap

            # 防止死循环：如果重叠导致起始位置没有前进（例如块长度小于重叠长度），强制前进至少1个字符
            if next_start <= start:
                next_start = start + 1

            start = next_start

        return chunks

    def split_documents(self, documents: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """切分多个文档。
        对于PDF和PPT，已经按页/幻灯片分割，不再进行二次切分
        对于DOCX和TXT，进行文本切分
        """
        chunks_with_metadata = []

        for doc in tqdm(documents, desc="处理文档", unit="文档"):
            content = doc.get("content", "")
            filetype = doc.get("filetype", "")

            if filetype in [".pdf", ".pptx"]:
                chunk_data = {
                    "content": content,
                    "filename": doc.get("filename", "unknown"),
                    "filepath": doc.get("filepath", ""),
                    "filetype": filetype,
                    "page_number": doc.get("page_number", 0),
                    "chunk_id": 0,
                    "image_id": doc.get("image_id", 0),
                    "chunk_type": doc.get("chunk_type", "text"),
                }
                chunks_with_metadata.append(chunk_data)

            elif filetype in [".docx", ".txt"]:
                chunks = self.split_text(content)
                for i, chunk in enumerate(chunks):
                    chunk_data = {
                        "content": chunk,
                        "filename": doc.get("filename", "unknown"),
                        "filepath": doc.get("filepath", ""),
                        "filetype": filetype,
                        "page_number": 0,
                        "chunk_id": i,
                        "image_id": doc.get("image_id", 0),
                        "chunk_type": doc.get("chunk_type", "text"),
                    }
                    chunks_with_metadata.append(chunk_data)

        print(f"\n文档处理完成，共 {len(chunks_with_metadata)} 个块")
        return chunks_with_metadata
