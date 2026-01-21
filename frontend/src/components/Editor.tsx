'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface EditorProps {
    id?: string;
    initialContent?: string;
    onChange: (content: string) => void;
}

const Editor = ({ id, initialContent, onChange }: EditorProps) => {
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

    // Pagination logic
    useEffect(() => {
        if (!editor) return;

        const checkPagination = () => {
            const paper = document.getElementById(id || '');
            if (!paper) return;

            const contentArea = paper.querySelector('.ProseMirror');
            if (!contentArea) return;

            const PAGE_HEIGHT = 1123; // A4 height in pixels
            // Assuming 20mm top padding ~ 75px
            const MARGIN_TOP = 75;
            const MARGIN_BOTTOM = 75;

            const blocks = Array.from(contentArea.children) as HTMLElement[];

            // Reset all margins first
            blocks.forEach(block => {
                block.style.marginTop = '0px';
                block.removeAttribute('data-page-break');
            });

            let currentY = MARGIN_TOP; // Content starts after top padding

            blocks.forEach((block) => {
                const blockHeight = block.offsetHeight;
                const style = window.getComputedStyle(block);
                const marginBottom = parseInt(style.marginBottom || '0', 10);

                const blockTop = currentY;
                const blockBottom = currentY + blockHeight;

                // Determine which page this block belongs to based on its top position
                const pageIndex = Math.floor(blockTop / PAGE_HEIGHT);

                // Calculate the printable area for this page
                const pageStart = pageIndex * PAGE_HEIGHT;
                const validContentEnd = pageStart + PAGE_HEIGHT - MARGIN_BOTTOM;

                // If the block extends beyond the printable area of the current page
                if (blockBottom > validContentEnd) {
                    // Push to the next page
                    // Calculate where the content should start on the next page
                    const nextPageContentStart = (pageIndex + 1) * PAGE_HEIGHT + MARGIN_TOP;

                    // The spacer needs to cover the distance from current position to the start of next page content
                    const spacer = nextPageContentStart - blockTop;

                    if (spacer > 0) {
                        block.style.marginTop = `${spacer}px`;
                        block.setAttribute('data-page-break', 'true');
                        // Update currentY to the new start position + block height
                        currentY = nextPageContentStart + blockHeight + marginBottom;
                        return; // Done with this block
                    }
                }

                currentY += blockHeight + marginBottom;
            });
        };

        // Run on content update
        const timeout = setTimeout(checkPagination, 500);
        return () => clearTimeout(timeout);
    }, [editor?.getHTML()]);

    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-col gap-4 w-full max-w-[800px] mx-auto">
            {/* Toolbar - Located outside the Paper */}
            <div className="sticky top-20 z-50 border border-gray-200 p-2 flex flex-wrap gap-1 bg-gray-50 rounded-lg no-print shadow-sm">
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

            {/* Paper - The actual content for PDF export */}
            <div
                id={id}
                className="editor-paper w-full bg-white border border-gray-200 shadow-lg relative"
                style={{
                    minHeight: '1123px',
                    padding: '20mm',
                    boxSizing: 'border-box'
                }}
            >
                <EditorContent editor={editor} />
            </div>

            {/* Page break indicator overlay */}
            <style jsx>{`
                .editor-paper {
                    background-image: repeating-linear-gradient(
                        to bottom,
                        transparent 0px,
                        transparent 1122px,
                        #e5e7eb 1122px,
                        #e5e7eb 1125px,
                        transparent 1125px,
                        transparent 1126px
                    );
                    /* No offset needed as toolbar is outside */
                    background-position: 0 0; 
                }
            `}</style>
        </div>
    );
};

export default Editor;
