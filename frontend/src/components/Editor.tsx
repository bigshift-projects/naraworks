'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface EditorProps {
    initialContent?: string;
    onChange: (content: string) => void;
}

const Editor = ({ initialContent, onChange }: EditorProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: '제안서 내용을 입력하세요...',
            }),
        ],
        content: initialContent,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[500px] max-w-none',
            },
        },
    });

    // Update content if initialContent changes (e.g., after loading from DB)
    useEffect(() => {
        if (editor && initialContent && editor.getHTML() !== initialContent) {
            editor.commands.setContent(initialContent);
        }
    }, [editor, initialContent]);

    if (!editor) {
        return null;
    }

    return (
        <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1 bg-gray-50 rounded-t-lg no-print">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 text-blue-600' : ''}`}
                    title="Bold"
                >
                    <b>B</b>
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-blue-600' : ''}`}
                    title="Italic"
                >
                    <i>I</i>
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`p-1 px-2 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-blue-600' : ''}`}
                >
                    H1
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`p-1 px-2 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-blue-600' : ''}`}
                >
                    H2
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-200 text-blue-600' : ''}`}
                >
                    • List
                </button>
            </div>
            <div className="p-8">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export default Editor;
