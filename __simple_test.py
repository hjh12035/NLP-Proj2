import os
from document_loader import DocumentLoader

from config import DATA_DIR


def main():
    if not os.path.exists(DATA_DIR):
        print(f"数据目录不存在: {DATA_DIR}")
        print("请创建数据目录并放入PDF、PPTX、DOCX或TXT文件")
        return

    # 初始化组件
    loader = DocumentLoader(
        data_dir=DATA_DIR,
    )

    # 测试加载PDF文件
    # pdf_file = os.path.join(DATA_DIR, "3.4 机器翻译.pdf")
    # # pdf_file = os.path.join(DATA_DIR, "1.绪论-2024.pdf")
    # if os.path.exists(pdf_file):
    #     pdf_content = loader.load_pdf(pdf_file)
    #     print(f"加载PDF文件成功，共 {len(pdf_content)} 页")
    #     for page in pdf_content:
    #         print(page["text"])
    # else:
    #     print(f"PDF文件不存在: {pdf_file}")

    # 测试加载PPTX文件
    # pptx_file = os.path.join(DATA_DIR, "4.2 大语言模型 v2.pptx")
    # if os.path.exists(pptx_file):
    #     pptx_content = loader.load_pptx(pptx_file)
    #     print(f"加载PPTX文件成功，共 {len(pptx_content)} 幻灯片")
    #     for slide in pptx_content:
    #         print(slide["text"])
    # else:
    #     print(f"PPTX文件不存在: {pptx_file}")

    # 测试加载DOCX文件
    docx_file = os.path.join(DATA_DIR, "示例文档.docx")
    if os.path.exists(docx_file):
        docx_content = loader.load_docx(docx_file)
        print(f"加载DOCX文件成功，内容如下：")
        print(docx_content)
    else:
        print(f"DOCX文件不存在: {docx_file}")

    # # 测试加载TXT文件
    # txt_file = os.path.join(DATA_DIR, "示例文档.txt")
    # if os.path.exists(txt_file):
    #     txt_content = loader.load_txt(txt_file)
    #     print(f"加载TXT文件成功，内容如下：")
    #     print(txt_content)
    # else:
    #     print(f"TXT文件不存在: {txt_file}")


if __name__ == "__main__":
    main()
