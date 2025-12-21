"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";
import { MessageSquare, BookOpen, FileText, Settings, Database, GraduationCap, Trash2, Upload, File, RefreshCw, AlertTriangle, X, Loader2, Save, ChevronDown, ChevronUp } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface QuizQuestion {
  id: number;
  type: string;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  source: string;
}

interface KBFile {
  name: string;
  size: number;
}

const preprocessLaTeX = (content: string) => {
  // Replace block math \[ ... \] with $$ ... $$
  const blockReplaced = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `$$${equation}$$`);
  // Replace inline math \( ... \) with $ ... $
  const inlineReplaced = blockReplaced.replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation}$`);
  return inlineReplaced;
};

type Tab = "chat" | "quiz" | "outline" | "settings" | "knowledge-base";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  
  // Knowledge Base State
  const [files, setFiles] = useState<KBFile[]>([]);
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Quiz State
  const [quizTopic, setQuizTopic] = useState("");
  const [quizDifficulty, setQuizDifficulty] = useState("简单");
  const [quizType, setQuizType] = useState("选择题");
  const [quizNum, setQuizNum] = useState(1);
  const [quizResults, setQuizResults] = useState<QuizQuestion[]>([]);
  const [isQuizLoading, setIsQuizLoading] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<any>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Outline State
  const [outlineTopic, setOutlineTopic] = useState("");
  const [outlineContent, setOutlineContent] = useState("");
  const [isOutlineLoading, setIsOutlineLoading] = useState(false);

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
      setShowRebuildConfirm(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await fetch("http://localhost:8000/files");
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
      }
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch("http://localhost:8000/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const response = await fetch("http://localhost:8000/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
      } else {
        alert("保存设置失败");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("保存设置出错");
    } finally {
      setIsSavingSettings(false);
    }
  };

  useEffect(() => {
    if (activeTab === "knowledge-base") {
      fetchFiles();
    } else if (activeTab === "settings") {
      fetchSettings();
    }
  }, [activeTab]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const formData = new FormData();
        formData.append("file", file);
        
        try {
          const response = await fetch("http://localhost:8000/upload", {
            method: "POST",
            body: formData,
          });
          
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          failCount++;
        }
      }
      
      await fetchFiles();
      if (failCount === 0) {
        alert(`成功上传 ${successCount} 个文件！`);
      } else {
        alert(`上传完成：${successCount} 个成功，${failCount} 个失败`);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      alert("文件上传出错");
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`确定要删除文件 ${filename} 吗？`)) return;
    
    try {
      const response = await fetch(`http://localhost:8000/files/${filename}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        await fetchFiles();
      } else {
        alert("删除文件失败");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("删除文件出错");
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

      if (!response.body) {
        throw new Error("ReadableStream not supported in this browser.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = { role: "assistant", content: "" } as Message;
      
      // 先添加一个空的 assistant message
      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        assistantMessage.content += chunk;
        
        // 更新最后一条消息
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { ...assistantMessage };
          return newMessages;
        });
      }

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

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTopic.trim() || isQuizLoading) return;

    setIsQuizLoading(true);
    setQuizResults([]); // Clear previous results

    try {
      const response = await fetch("http://localhost:8000/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: quizTopic,
          difficulty: quizDifficulty,
          type: quizType,
          num_questions: quizNum,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate quiz");
      }

      const data = await response.json();
      if (data.questions) {
        setQuizResults(data.questions);
      } else {
        alert("生成格式有误，请重试");
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
      alert("生成习题失败，请稍后重试");
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleOutlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOutlineLoading) return;

    setIsOutlineLoading(true);
    setOutlineContent("");

    try {
      const response = await fetch("http://localhost:8000/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: outlineTopic,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate outline");
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        setOutlineContent((prev) => prev + chunk);
      }
    } catch (error) {
      console.error("Error generating outline:", error);
      alert("生成提纲失败，请稍后重试");
    } finally {
      setIsOutlineLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside 
        className="w-20 hover:w-48 transition-all duration-300 ease-in-out text-white flex flex-col group overflow-hidden z-20 shadow-xl"
        style={{ backgroundColor: "#2F3E46" }}
      >
        <div className="h-20 flex items-center pl-6 shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-4">
            <GraduationCap className="w-8 h-8 min-w-[2rem] text-emerald-400" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap delay-75">
              EduAgent
            </span>
          </h1>
        </div>
        
        <nav className="flex-1 px-3 space-y-2 mt-4">
          <button
            onClick={() => setActiveTab("chat")}
            className={`w-full flex items-center h-12 px-4 rounded-xl transition-all duration-200 ${
              activeTab === "chat" 
                ? "bg-white/10 text-white shadow-sm" 
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <MessageSquare className="w-6 h-6 min-w-[1.5rem]" />
            <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap delay-75">
              智能问答
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab("quiz")}
            className={`w-full flex items-center h-12 px-4 rounded-xl transition-all duration-200 ${
              activeTab === "quiz" 
                ? "bg-white/10 text-white shadow-sm" 
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <FileText className="w-6 h-6 min-w-[1.5rem]" />
            <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap delay-75">
              生成习题
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab("outline")}
            className={`w-full flex items-center h-12 px-4 rounded-xl transition-all duration-200 ${
              activeTab === "outline" 
                ? "bg-white/10 text-white shadow-sm" 
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <BookOpen className="w-6 h-6 min-w-[1.5rem]" />
            <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap delay-75">
              复习提纲
            </span>
          </button>
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2 mb-4">
          <button
            onClick={() => setActiveTab("knowledge-base")}
            className={`w-full flex items-center h-12 px-4 rounded-xl transition-all duration-200 ${
              activeTab === "knowledge-base"
                ? "bg-white/10 text-white shadow-sm"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Database className="w-6 h-6 min-w-[1.5rem]" />
            <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap delay-75">
              管理知识库
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center h-12 px-4 rounded-xl transition-all duration-200 ${
              activeTab === "settings" 
                ? "bg-white/10 text-white shadow-sm" 
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Settings className="w-6 h-6 min-w-[1.5rem]" />
            <span className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap delay-75">
              设置
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "chat" && (
          <>
            <header className="bg-white shadow-sm p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">课程智能助手</h2>
              <button
                onClick={() => setMessages([])}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="开启新对话"
              >
                <RefreshCw className="w-4 h-4" />
                <span>新对话</span>
              </button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="bg-white p-8 rounded-2xl shadow-sm inline-block max-w-md text-center">
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
          <div className="flex-1 flex flex-col h-full bg-gray-50">
            <header className="bg-white shadow-sm p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">生成习题</h2>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Results Area */}
              {quizResults.length > 0 ? (
                <div className="max-w-3xl mx-auto space-y-6 pb-20">
                  {quizResults.map((q) => (
                    <QuizCard key={q.id} question={q} />
                  ))}
                  <div className="text-center pt-8 pb-4">
                    <button
                      onClick={() => setQuizResults([])}
                      className="text-blue-600 hover:underline"
                    >
                      生成新习题
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  {!isQuizLoading && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm inline-block max-w-md text-center">
                      <FileText className="w-12 h-12 mx-auto text-blue-500 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">输入考点，生成定制化练习题</h3>
                      <p className="text-gray-500">
                        支持选择题和简答题，自动匹配课程难度
                      </p>
                    </div>
                  )}
                  {isQuizLoading && (
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="text-gray-500">正在生成题目...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Area (Only show if no results or loading) */}
            {quizResults.length === 0 && !isQuizLoading && (
              <div className="p-6 bg-white border-t">
                <div className="max-w-4xl mx-auto">
                  <form onSubmit={handleQuizSubmit} className="space-y-4">
                    <div className="flex gap-4">
                      <select
                        value={quizDifficulty}
                        onChange={(e) => setQuizDifficulty(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                      >
                        <option value="简单">简单</option>
                        <option value="困难">困难</option>
                      </select>
                      <select
                        value={quizType}
                        onChange={(e) => setQuizType(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                      >
                        <option value="选择题">选择题</option>
                        <option value="简答题">简答题</option>
                      </select>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50">
                        <span className="text-gray-600 text-sm whitespace-nowrap">题目数量:</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={quizNum}
                          onChange={(e) => setQuizNum(parseInt(e.target.value) || 1)}
                          className="w-16 bg-transparent border-none focus:ring-0 p-0 text-gray-700"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                      <input
                        type="text"
                        value={quizTopic}
                        onChange={(e) => setQuizTopic(e.target.value)}
                        placeholder="请输入预期考点（例如：Transformer架构、注意力机制）..."
                        className="flex-1 border-none focus:ring-0 px-4 py-2 text-gray-800 bg-transparent focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!quizTopic.trim()}
                        className={`px-6 py-2 rounded-xl text-white font-medium transition-colors ${
                          !quizTopic.trim()
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        生成题目
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "outline" && (
          <div className="flex-1 flex flex-col h-full bg-gray-50">
            <header className="bg-white shadow-sm p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">复习提纲</h2>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              {outlineContent ? (
                <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                  <div className="prose max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {preprocessLaTeX(outlineContent)}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-8 text-center border-t pt-4">
                    <button
                      onClick={() => setOutlineContent("")}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      重新生成
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  {!isOutlineLoading && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm inline-block max-w-md text-center">
                      <BookOpen className="w-12 h-12 mx-auto text-blue-500 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">生成结构化复习提纲</h3>
                      <p className="text-gray-500">
                        输入特定主题，或直接点击生成获取全课程大纲
                      </p>
                    </div>
                  )}
                  {isOutlineLoading && (
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="text-gray-500">正在梳理知识点...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!outlineContent && !isOutlineLoading && (
              <div className="p-6 bg-white border-t">
                <div className="max-w-4xl mx-auto">
                  <form onSubmit={handleOutlineSubmit}>
                    <div className="flex gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                      <input
                        type="text"
                        value={outlineTopic}
                        onChange={(e) => setOutlineTopic(e.target.value)}
                        placeholder="请输入复习主题（留空则生成全课程大纲）..."
                        className="flex-1 border-none focus:ring-0 px-4 py-2 text-gray-800 bg-transparent focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-6 py-2 rounded-xl text-white font-medium transition-colors bg-blue-600 hover:bg-blue-700"
                      >
                        生成提纲
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "knowledge-base" && (
          <div className="flex-1 flex flex-col h-full bg-gray-50">
            <header className="bg-white shadow-sm p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">知识库管理</h2>
                <p className="text-gray-500 mt-1">管理用于RAG检索的文档资料</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRebuildConfirm(true)}
                  disabled={isBuilding}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    isBuilding
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                      : "bg-white text-amber-600 border-amber-200 hover:bg-amber-50"
                  }`}
                >
                  {isBuilding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isBuilding ? "构建中..." : "重建索引"}
                </button>
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors shadow-sm">
                  <Upload className="w-4 h-4" />
                  上传文档
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".txt,.pdf,.md"
                  />
                </label>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4 font-medium text-gray-500">文件名</th>
                        <th className="px-6 py-4 font-medium text-gray-500">大小</th>
                        <th className="px-6 py-4 font-medium text-gray-500 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {files.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                            <div className="flex flex-col items-center gap-3">
                              <FileText className="w-12 h-12 text-gray-200" />
                              <p>暂无文档，请上传</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        files.map((file) => (
                          <tr key={file.name} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="px-6 py-4 text-gray-900 font-medium flex items-center gap-3">
                              <FileText className="w-5 h-5 text-blue-500" />
                              {file.name}
                            </td>
                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                              {(file.size / 1024).toFixed(1)} KB
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleDeleteFile(file.name)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Rebuild Confirmation Modal */}
            {showRebuildConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transform transition-all scale-100">
                  <div className="flex items-center gap-4 mb-4 text-amber-600">
                    <div className="p-3 bg-amber-50 rounded-full">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">确认重建索引？</h3>
                  </div>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    重建索引将重新处理所有文档并生成向量数据。此过程可能需要几分钟时间，期间无法进行问答。
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowRebuildConfirm(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        setShowRebuildConfirm(false);
                        handleBuildKB();
                      }}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium shadow-sm"
                    >
                      确认重建
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
            <header className="bg-white shadow-sm p-6 border-b flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">系统设置</h2>
                <p className="text-gray-500 mt-1">配置模型参数与系统选项</p>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存设置
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                
                {/* API Configuration */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-500" />
                    API 配置
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">API Key</label>
                      <input
                        type="password"
                        value={settings.OPENAI_API_KEY || ""}
                        onChange={(e) => setSettings({...settings, OPENAI_API_KEY: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">API Base URL</label>
                      <input
                        type="text"
                        value={settings.OPENAI_API_BASE || ""}
                        onChange={(e) => setSettings({...settings, OPENAI_API_BASE: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">主模型 (Model Name)</label>
                      <input
                        type="text"
                        value={settings.MODEL_NAME || ""}
                        onChange={(e) => setSettings({...settings, MODEL_NAME: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">快速模型 (Fast Model)</label>
                      <input
                        type="text"
                        value={settings.FAST_MODEL_NAME || ""}
                        onChange={(e) => setSettings({...settings, FAST_MODEL_NAME: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Embedding Model</label>
                      <input
                        type="text"
                        value={settings.OPENAI_EMBEDDING_MODEL || ""}
                        onChange={(e) => setSettings({...settings, OPENAI_EMBEDDING_MODEL: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* RAG Configuration */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-500" />
                    RAG 参数配置
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Top K (检索数量)</label>
                      <input
                        type="number"
                        value={settings.TOP_K || 0}
                        onChange={(e) => setSettings({...settings, TOP_K: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Chunk Size (分块大小)</label>
                      <input
                        type="number"
                        value={settings.CHUNK_SIZE || 0}
                        onChange={(e) => setSettings({...settings, CHUNK_SIZE: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Chunk Overlap (重叠大小)</label>
                      <input
                        type="number"
                        value={settings.CHUNK_OVERLAP || 0}
                        onChange={(e) => setSettings({...settings, CHUNK_OVERLAP: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Max Tokens</label>
                      <input
                        type="number"
                        value={settings.MAX_TOKENS || 0}
                        onChange={(e) => setSettings({...settings, MAX_TOKENS: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                 {/* Path Configuration */}
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500" />
                    路径配置
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">数据目录 (Data Dir)</label>
                      <input
                        type="text"
                        value={settings.DATA_DIR || ""}
                        onChange={(e) => setSettings({...settings, DATA_DIR: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">向量库路径 (Vector DB Path)</label>
                      <input
                        type="text"
                        value={settings.VECTOR_DB_PATH || ""}
                        onChange={(e) => setSettings({...settings, VECTOR_DB_PATH: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function QuizCard({ question }: { question: QuizQuestion }) {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
            {question.type}
          </span>
          <span className="text-xs text-gray-400">{question.source}</span>
        </div>

        <div className="text-lg font-medium text-gray-900 mb-4 prose max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeKatex]}
          >
            {preprocessLaTeX(question.question)}
          </ReactMarkdown>
        </div>

        {question.options && question.options.length > 0 && (
          <div className="space-y-2 mb-6">
            {question.options.map((opt, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors text-gray-700 prose max-w-none"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {preprocessLaTeX(opt)}
                </ReactMarkdown>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            {showAnswer ? (
              <>
                <span>收起解析</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>查看解析</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Answer Section with Animation */}
      <div
        className={`bg-blue-50/50 border-t border-blue-100 transition-all duration-300 ease-in-out overflow-hidden ${
          showAnswer ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-6 space-y-3">
          <div>
            <span className="font-semibold text-gray-900">参考答案：</span>
            <div className="text-blue-700 prose max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
              >
                {preprocessLaTeX(question.answer)}
              </ReactMarkdown>
            </div>
          </div>
          <div>
            <span className="font-semibold text-gray-900 block mb-1">
              解析：
            </span>
            <div className="text-gray-700 text-sm leading-relaxed prose max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
              >
                {preprocessLaTeX(question.explanation)}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


