from typing import List, Dict, Optional, Tuple

from openai import OpenAI

from config import (
    OPENAI_API_KEY,
    OPENAI_API_BASE,
    MODEL_NAME,
    TOP_K,
)
from vector_store import VectorStore


class RAGAgent:
    def __init__(
        self,
        model: str = MODEL_NAME,
    ):
        self.model = model

        self.client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_API_BASE)

        self.vector_store = VectorStore()

        """
        TODO: 实现并调整系统提示词，使其符合课程助教的角色和回答策略
        """
        self.system_prompt = """
        你是这门课程的助教，你的职责是帮助学生更好地理解和掌握课程内容。在回答问题时，请遵循以下指导思想：
        1. 专业且友好：尽量使用专业术语，但保持语气友好，拥有耐心，使得学生易于理解，保持积极鼓励的态度。
        2. 优先结合课程内容：优先参考提供的知识库中的课程相关资料，并**说明来自哪个文档的第几页**；如果知识库中没有相关信息，基于你的通用知识谨慎回答，明确告知学生回答的置信度和来源。
            - 交互示例：
                学生: 词的连续向量表示为什么又称作“分布式表达”？
                助教: 根据课程文档《词向量》第 6 页... 其由且仅由这一维度表示，因此也被称为“局部语义表达”或“非分布式表达”...
        3. 对待学生的问题要分类处理：
              - 概念性问题：解释相关概念，提供定义和背景信息。
              - 作业/练习题：引导学生理解题目要求，提供解题思路，但不要直接给出完整答案。
              - 实践应用问题/代码题：结合实际案例，解释逻辑，指出常见错误，展示伪代码或核心逻辑。
        4. 教育原则：使用苏格拉底式提问法引导学生自己找到答案，将复杂问题拆解为多个简单问题，尽可能提供多种角度的解释方式。
        5. 沟通风格：使用中文为主要语言（除非学生使用其他语言），适当使用类比来帮助理解，对于不确定的问题，坦诚说明并提供进一步获取帮助的途径。
        6. 安全与隐私：不解答与课程无关的敏感话题，尊重学生隐私，遵守学术诚信原则。
        """

    def retrieve_context(
        self, query: str, top_k: int = TOP_K
    ) -> Tuple[str, List[Dict]]:
        """检索相关上下文
        TODO: 实现检索相关上下文
        要求：
        1. 使用向量数据库检索相关文档
        2. 格式化检索结果，构建上下文字符串
        3. 每个检索结果需要包含来源信息（文件名和页码）
        4. 返回格式化的上下文字符串和原始检索结果列表
        """
        # 1. 使用向量数据库检索相关文档
        retrieved_docs = self.vector_store.search(query, top_k=top_k)

        if not retrieved_docs:
            return "", []

        # 2. 格式化检索结果，构建上下文字符串
        context_parts = []
        for i, doc in enumerate(retrieved_docs, 1):
            content = doc.get("content", "").strip()
            metadata = doc.get("metadata", {})
            filename = metadata.get("filename", "未知文件")
            page_number = metadata.get("page_number", 0)

            # 3. 每个检索结果需要包含来源信息（文件名和页码）
            source_info = f"来源: {filename}"
            if page_number > 0:
                source_info += f" (第 {page_number} 页)"

            context_parts.append(f"文档片段 {i}:\n{content}\n[{source_info}]")

        # 4. 返回格式化的上下文字符串和原始检索结果列表
        context_str = "\n\n".join(context_parts)
        return context_str, retrieved_docs

    def generate_response(
        self,
        query: str,
        context: str,
        chat_history: Optional[List[Dict]] = None,
    ) -> str:
        """生成回答

        参数:
            query: 用户问题
            context: 检索到的上下文
            chat_history: 对话历史
        """
        messages = [{"role": "system", "content": self.system_prompt}]

        if chat_history:
            messages.extend(chat_history)

        """
        TODO: 实现用户提示词
        要求：
        1. 包含相关的课程内容
        2. 包含学生问题
        3. 包含来源信息（文件名和页码）
        4. 返回用户提示词
        """
        user_text = f"""
        请基于以下课程资料回答学生的问题。如果资料中没有相关信息，请明确说明。

        ---课程资料开始---
        {context}
        ---课程资料结束---

        学生问题: {query}
        """

        messages.append({"role": "user", "content": user_text})

        # 多模态接口示意（如需添加图片支持，可参考以下格式）：
        # content_parts = [{"type": "text", "text": user_text}]
        # content_parts.append({
        #     "type": "image_url",
        #     "image_url": {"url": f"data:image/png;base64,{base64_image}"}
        # })
        # messages.append({"role": "user", "content": content_parts})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=1500,
                seed=1024,
            )

            return response.choices[0].message.content
        except Exception as e:
            return f"生成回答时出错: {str(e)}"

    def generate_quiz(
        self, topic: str, difficulty: str, question_type: str, num_questions: int = 1
    ) -> str:
        """生成测验题目"""

        # 1. 检索相关上下文
        context, _ = self.retrieve_context(topic, top_k=3)

        quiz_system_prompt = """
        你是一个专业的课程出题助手。请根据提供的课程资料（如果有）和用户的主题要求，生成测验题目。
        
        必须严格按照以下 JSON 格式返回结果，不要包含任何 Markdown 格式标记（如 ```json ... ```）：
        {
            "questions": [
                {
                    "id": 1,
                    "type": "选择题" 或 "简答题",
                    "question": "题目内容",
                    "options": ["选项A", "选项B", "选项C", "选项D"] (如果是简答题则为空列表),
                    "answer": "参考答案",
                    "explanation": "答案解析",
                    "source": "参考资料来源（如：文档X 第Y页）"
                }
            ]
        }
        """

        user_prompt = f"""
        请生成 {num_questions} 道关于 "{topic}" 的 {difficulty} 难度的 {question_type}。
        
        参考资料：
        {context}
        """

        messages = [
            {"role": "system", "content": quiz_system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                response_format={"type": "json_object"},
            )
            return response.choices[0].message.content
        except Exception as e:
            # Fallback for models that don't support response_format
            try:
                response = self.client.chat.completions.create(
                    model=self.model, messages=messages, temperature=0.7
                )
                return response.choices[0].message.content
            except Exception as inner_e:
                return f'{{"error": "{str(inner_e)}"}}'

    def answer_question(
        self, query: str, chat_history: Optional[List[Dict]] = None, top_k: int = TOP_K
    ) -> Dict[str, any]:
        """回答问题

        参数:
            query: 用户问题
            chat_history: 对话历史
            top_k: 检索文档数量

        返回:
            生成的回答
        """
        context, retrieved_docs = self.retrieve_context(query, top_k=top_k)

        if not context:
            context = "（未检索到特别相关的课程材料）"

        answer = self.generate_response(query, context, chat_history)

        return answer

    def chat(self) -> None:
        """交互式对话"""
        print("=" * 60)
        print("欢迎使用智能课程助教系统！")
        print("=" * 60)

        chat_history = []

        while True:
            try:
                query = input("\n学生: ").strip()

                if not query:
                    continue

                answer = self.answer_question(query, chat_history=chat_history)

                print(f"\n助教: {answer}")

                chat_history.append({"role": "user", "content": query})
                chat_history.append({"role": "assistant", "content": answer})

            except Exception as e:
                print(f"\n错误: {str(e)}")
