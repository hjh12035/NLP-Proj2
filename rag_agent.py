from typing import List, Dict, Optional, Tuple, Any
import json
import concurrent.futures

from openai import OpenAI

from config import (
    OPENAI_API_KEY,
    OPENAI_API_BASE,
    MODEL_NAME,
    FAST_MODEL_NAME,
    TOP_K,
)
from vector_store import VectorStore


class RAGAgent:
    def __init__(
        self,
        model: str = MODEL_NAME,
        fast_model: str = FAST_MODEL_NAME,
    ):
        self.model = model
        self.fast_model = fast_model

        self.client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_API_BASE)

        self.vector_store = VectorStore()

        # 上下文窗口：存储检索到的文档片段
        # 格式：[{"content": "...", "metadata": {...}}, ...]
        self.context_window: List[Dict] = []
        self.max_window_size = 15  # 最大保留的文档片段数量

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

    def reset_context(self):
        """重置上下文窗口"""
        self.context_window = []

    def _expand_query(self, topic: str, task_type: str) -> str:
        """
        先用小模型扩展查询内容，以获得更好的检索结果
        task_type: "quiz" 或 "outline"
        """
        if not topic:
            return "课程核心知识点"

        prompt = ""
        if task_type == "quiz":
            prompt = f"""
            你是一个专业的课程助教。用户想要生成关于 "{topic}" 的习题。
            请将这个主题扩展为3-5个具体的搜索关键词或短语，以便在向量数据库中检索相关的课程资料。
            重点关注：定义、核心概念、易错点、应用场景。
            
            请直接返回扩展后的查询字符串，用空格分隔，不要包含其他解释。
            """
        elif task_type == "outline":
            prompt = f"""
            你是一个专业的课程助教。用户想要生成关于 "{topic}" 的复习提纲。
            请将这个主题扩展为3-5个具体的搜索关键词或短语，以便在向量数据库中检索相关的课程资料。
            重点关注：层级结构、主要分支、关键术语。
            
            请直接返回扩展后的查询字符串，用空格分隔，不要包含其他解释。
            """

        try:
            response = self.client.chat.completions.create(
                model=self.fast_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3, # 温度低来保证稳定输出
            )
            expanded_query = response.choices[0].message.content.strip()
            print(f"[Debug] 原始主题: {topic}, 扩展查询: {expanded_query}")
            return expanded_query
        except Exception as e:
            print(f"查询扩展失败: {e}")
            return topic

    def analyze_intent(self, query: str, chat_history: List[Dict]) -> Dict:
        """
        使用小模型分析用户意图并重写查询
        返回格式: {"intent": "...", "rewritten_query": "..."}
        """
        # 如果没有历史记录，直接视为新话题，不需要重写
        if not chat_history:
            return {"intent": "NEW_TOPIC", "rewritten_query": query}

        # 提取最近几轮对话作为上下文参考
        recent_history = chat_history[-4:]  # 取最近2轮对话（4条消息）
        history_text = "\n".join(
            [f"{msg['role']}: {msg['content']}" for msg in recent_history]
        )

        prompt = f"""
        你是一个对话分析助手。请分析用户的最新问题，结合对话历史，判断用户意图并重写查询。
        
        对话历史：
        {history_text}
        
        用户最新问题：
        {query}
        
        请输出一个 JSON 对象，包含以下字段：
        1. "intent": 意图类型，必须是以下之一：
           - "DRILL_DOWN": 深入追问细节（如"为什么？"、"具体怎么做？"）。
           - "TOPIC_SHIFT": 话题平移/关联话题（如"那 LSTM 呢？"）。
           - "NEW_TOPIC": 全新话题（如"换个话题"、"考试什么时候？"）。
           - "CLARIFICATION": 澄清/纠正（如"不是这个"、"我是说..."）。
           - "SUMMARIZATION": 总结/回顾（如"总结一下"）。
           - "CHIT_CHAT": 闲聊（如"谢谢"、"你好"）。
        2. "rewritten_query": 重写后的独立查询语句。
           - 如果是 DRILL_DOWN 或 TOPIC_SHIFT，请将代词（如"它"）替换为具体的实体。
           - 如果是 NEW_TOPIC，直接使用用户问题。
           - 如果是 CHIT_CHAT，保持原样。
        
        注意：只返回 JSON，不要包含 Markdown 标记。
        """

        try:
            response = self.client.chat.completions.create(
                model=self.fast_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # 低温度以保证格式稳定
                response_format={"type": "json_object"},
            )
            result = json.loads(response.choices[0].message.content)
            return result
        except Exception as e:
            print(f"意图分析失败: {e}")
            # 降级策略：默认视为新话题
            return {"intent": "NEW_TOPIC", "rewritten_query": query}

    def update_context_window(self, new_docs: List[Dict], intent: str):
        """根据意图更新上下文窗口"""
        if intent == "NEW_TOPIC":
            self.context_window = new_docs
        elif intent == "CLARIFICATION":
            # 替换策略：清空旧的，放入新的（或者更复杂的替换逻辑）
            self.context_window = new_docs
        elif intent in ["DRILL_DOWN", "TOPIC_SHIFT", "SUMMARIZATION"]:
            # 追加策略：去重后追加内容
            existing_ids = {
                f"{d['metadata'].get('filename')}_{d['metadata'].get('page_number')}_{d.get('content')[:20]}"
                for d in self.context_window
            }

            for doc in new_docs:
                doc_id = f"{doc['metadata'].get('filename')}_{doc['metadata'].get('page_number')}_{doc.get('content')[:20]}"
                if doc_id not in existing_ids:
                    self.context_window.append(doc)

            # 保持窗口大小限制 (FIFO)
            if len(self.context_window) > self.max_window_size:
                self.context_window = self.context_window[-self.max_window_size :]

        # CHIT_CHAT 不需要更新窗口

    def retrieve_context(
        self, query: str, top_k: int = TOP_K
    ) -> Tuple[str, List[Dict]]:
        """检索相关上下文"""
        retrieved_docs = self.vector_store.search(query, top_k=top_k)
        if not retrieved_docs:
            return "", []

        # 格式化逻辑提取出来，方便复用
        return self._format_context(retrieved_docs), retrieved_docs

    def _format_context(self, docs: List[Dict]) -> str:
        """将文档列表格式化为字符串"""
        context_parts = []
        for i, doc in enumerate(docs, 1):
            content = doc.get("content", "").strip()
            metadata = doc.get("metadata", {})
            filename = metadata.get("filename", "未知文件")
            page_number = metadata.get("page_number", 0)

            source_info = f"来源: {filename}"
            if page_number > 0:
                source_info += f" (第 {page_number} 页)"

            context_parts.append(f"文档片段 {i}:\n{content}\n[{source_info}]")

        return "\n\n".join(context_parts)

    def generate_response(
        self,
        query: str,
        context: str,
        chat_history: Optional[List[Dict]] = None,
        stream: bool = False,
    ) -> str:
        """生成回答

        参数:
            query: 用户问题
            context: 检索到的上下文
            chat_history: 对话历史
            stream: 是否流式输出
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
                stream=stream,
            )

            if stream:
                return response
            else:
                return response.choices[0].message.content
        except Exception as e:
            return f"生成回答时出错: {str(e)}"

    def _generate_single_question(
        self, topic: str, difficulty: str, question_type: str, context: str, index: int
    ) -> Dict:
        """生成单道题目 (内部方法)"""
        system_prompt = """
        你是一个专业的课程出题助手。请根据提供的课程资料生成一道高质量的测验题目。
        
        要求：
        1. 题目必须紧扣课程资料内容。
        2. 难度要符合用户要求。
        3. 必须严格按照以下 JSON 格式返回结果：
        {
            "type": "...",
            "question": "...",
            "options": ["..."] (如果是简答题则为空列表),
            "answer": "...",
            "explanation": "...",
            "source": "..."
        }
        """

        user_prompt = f"""
        请生成一道关于 "{topic}" 的 {difficulty} 难度的 {question_type}。
        这是第 {index} 道题，请尽量覆盖不同的知识点。
        
        参考资料：
        {context}
        """

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.8,  # 稍微提高温度以增加多样性
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"生成题目失败: {e}")
            return None

    def generate_quiz(
        self, topic: str, difficulty: str, question_type: str, num_questions: int = 1
    ) -> str:
        """生成测验题目 (并行生成)"""

        # 1. 扩展查询并检索相关上下文
        search_query = self._expand_query(topic, "quiz")
        context, _ = self.retrieve_context(search_query, top_k=10)

        # 2. 并行生成题目
        questions = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(
                    self._generate_single_question,
                    topic,
                    difficulty,
                    question_type,
                    context,
                    i + 1,
                )
                for i in range(num_questions)
            ]

            for i, future in enumerate(concurrent.futures.as_completed(futures)):
                result = future.result()
                if result:
                    result["id"] = i + 1  # 重新编号
                    questions.append(result)

        # 3. 组装最终结果
        return json.dumps({"questions": questions}, ensure_ascii=False)

    def generate_outline(self, topic: str = "", stream: bool = False) -> Any:
        """生成复习提纲 (支持流式 Markdown)"""

        # 1. Determine query for context retrieval
        search_query = (
            self._expand_query(topic, "outline")
            if topic
            else "课程大纲 核心知识点 总结"
        )

        # 2. Retrieve context
        context, _ = self.retrieve_context(search_query, top_k=15)

        outline_system_prompt = """
        你是一个专业的课程助教。请根据提供的课程资料和用户的主题（如果有），生成一个结构化的复习提纲。
        
        要求：
        1. 使用 Markdown 格式。
        2. 使用 #, ##, ### 表示层级结构。
        3. 使用无序列表 (-) 列出具体知识点。
        4. 重点突出，逻辑清晰。
        5. 不要包含 JSON，直接输出 Markdown 文本。
        """

        user_prompt_text = (
            f"请生成关于 '{topic}' 的复习提纲。"
            if topic
            else "请生成本课程的完整复习提纲。"
        )

        user_prompt = f"""
        {user_prompt_text}
        
        参考资料：
        {context}
        """

        messages = [
            {"role": "system", "content": outline_system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.5,
                stream=stream,
            )

            if stream:
                return response
            else:
                return response.choices[0].message.content
        except Exception as e:
            return f"生成提纲失败: {str(e)}"

    def answer_question(
        self,
        query: str,
        chat_history: Optional[List[Dict]] = None,
        top_k: int = TOP_K,
        stream: bool = False,
    ) -> Any:
        """回答问题

        参数:
            query: 用户问题
            chat_history: 对话历史
            top_k: 检索文档数量
            stream: 是否流式输出

        返回:
            生成的回答 (字符串或生成器)
        """
        # 0. 如果是新对话，重置上下文窗口
        if not chat_history:
            self.reset_context()

        # 1. 使用小模型分析意图和重写查询
        analysis_result = self.analyze_intent(query, chat_history)
        intent = analysis_result.get("intent", "NEW_TOPIC")
        rewritten_query = analysis_result.get("rewritten_query", query)

        print(f"[Debug] 意图: {intent}, 重写查询: {rewritten_query}")

        # 2. 根据意图决定是否检索
        if intent != "CHIT_CHAT":
            # 使用重写后的查询进行检索
            _, new_docs = self.retrieve_context(rewritten_query, top_k=top_k)

            # 3. 更新上下文窗口
            self.update_context_window(new_docs, intent)

        # 4. 构建最终上下文 (从窗口中获取)
        if self.context_window:
            context = self._format_context(self.context_window)
        else:
            context = "（未检索到特别相关的课程材料）"

        print(f"\n[调试] 检索到的上下文:\n{context}\n")

        # 5. 生成回答 (使用大模型)
        response = self.generate_response(
            rewritten_query, context, chat_history, stream=stream
        )

        if stream:
            # 如果是流式，返回一个生成器
            def stream_generator():
                try:
                    for chunk in response:
                        if chunk.choices[0].delta.content is not None:
                            yield chunk.choices[0].delta.content
                except Exception as e:
                    yield f"生成回答时出错: {str(e)}"

            return stream_generator()
        else:
            return response

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
