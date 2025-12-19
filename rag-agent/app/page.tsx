"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";
import { MessageSquare, BookOpen, FileText, Settings, Database } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const preprocessLaTeX = (content: string) => {
  // Replace block math \[ ... \] with $$ ... $$
  const blockReplaced = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `$$${equation}$$`);
  // Replace inline math \( ... \) with $ ... $
  const inlineReplaced = blockReplaced.replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation}$`);
  return inlineReplaced;
};

type Tab = "chat" | "quiz" | "outline" | "settings";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTab]);

  const handleBuildKB = async () => {
    setIsBuilding(true);
    try {
      const response = await fetch("http://localhost:8000/build-kb", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to build knowledge base");
      }
      const data = await response.json();
      alert(data.message || "知识库构建成功！");
    } catch (error) {
      console.error("Error building KB:", error);
      alert("构建知识库失败，请检查后端服务。");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userMessage.content,
          history: messages, // 传递历史记录
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to get response");
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Error chatting:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `出错啦: ${error.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            <span>EduAgent</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button
            onClick={() => setActiveTab("chat")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "chat" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>智能问答</span>
          </button>
          
          <button
            onClick={() => setActiveTab("quiz")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "quiz" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>生成测验</span>
          </button>
          
          <button
            onClick={() => setActiveTab("outline")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "outline" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span>课程大纲</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-2">
          <button
            onClick={handleBuildKB}
            disabled={isBuilding}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isBuilding
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <Database className="w-5 h-5" />
            <span>{isBuilding ? "构建中..." : "更新知识库"}</span>
          </button>
          
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "settings" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>设置</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "chat" && (
          <>
            <header className="bg-white shadow-sm p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">课程智能助手</h2>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-20">
                  <div className="bg-white p-8 rounded-2xl shadow-sm inline-block max-w-md">
                    <MessageSquare className="w-12 h-12 mx-auto text-blue-500 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">欢迎使用智能助教</h3>
                    <p>您可以询问关于课程的任何问题，或者让我也为您生成复习大纲。</p>
                  </div>
                </div>
              )}
              
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 ${
                      msg.role === "user"
                        ? "text-gray-800 shadow-sm"
                        : "bg-white text-gray-800 shadow-sm border border-gray-100"
                    }`}
                    style={{
                      backgroundColor:
                        msg.role === "user" ? "rgba(162, 205, 190, 0.78)" : undefined,
                    }}
                  >
                    <div className="prose max-w-none dark:prose-invert break-words text-base">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {preprocessLaTeX(msg.content)}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-500 rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t">
              <div className="max-w-4xl mx-auto">
                <form
                  onSubmit={handleSubmit}
                  className="flex gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="请输入您的问题..."
                    className="flex-1 border-none focus:ring-0 px-4 py-2 text-gray-800 bg-transparent focus:outline-none"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className={`px-6 py-2 rounded-xl text-white font-medium transition-colors ${
                      isLoading || !input.trim()
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    发送
                  </button>
                </form>
              </div>
            </div>
          </>
        )}

        {activeTab === "quiz" && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">测验生成功能开发中...</p>
            </div>
          </div>
        )}

        {activeTab === "outline" && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">课程大纲功能开发中...</p>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="flex-1 p-8">
            <h2 className="text-2xl font-bold mb-6">设置</h2>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">暂无设置选项</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

