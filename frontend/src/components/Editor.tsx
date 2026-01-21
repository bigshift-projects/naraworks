'use client';

import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import { useEffect, useState } from 'react';
import {
    Bold, Italic, Underline as UnderlineIcon,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Type, Palette, Highlighter, ChevronDown,
    List, ListOrdered, Heading1, Heading2, Heading3
} from 'lucide-react';

// Custom Font Size Extension
const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return {
            types: ['textStyle'],
        };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element: HTMLElement) => element.style.fontSize.replace(/['"]+/g, ''),
                        renderHTML: (attributes: Record<string, any>) => {
                            if (!attributes.fontSize) {
                                return {};
                            }
                            return {
                                style: `font-size: ${attributes.fontSize}`,
                            };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontSize: fontSize => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize })
                    .run();
            },
            unsetFontSize: () => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize: null })
                    .removeEmptyTextStyle()
                    .run();
            },
        };
    },
});

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (size: string) => ReturnType;
            unsetFontSize: () => ReturnType;
        };
    }
}

interface EditorProps {
    id?: string;
    initialContent?: string;
    onChange: (content: string) => void;
}

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px'];
const FONT_FAMILIES = [
    { name: 'Default', value: 'Inter, sans-serif' },
    { name: 'Serif', value: 'serif' },
    { name: 'Monospace', value: 'monospace' },
    { name: 'Pretendard', value: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif' },
];

const Editor = ({ id, initialContent, onChange }: EditorProps) => {
    const [_, setUpdate] = useState(0);
    const [showFontSizes, setShowFontSizes] = useState(false);
    const [showFontFamilies, setShowFontFamilies] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: '제안서 내용을 입력하세요...',
            }),
            TextStyle,
            Color,
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Highlight.configure({ multicolor: true }),
            FontFamily,
            FontSize,
        ],
        content: initialContent,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        onSelectionUpdate: () => {
            setUpdate(s => s + 1);
        },
        onTransaction: () => {
            setUpdate(s => s + 1);
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
            const MARGIN_TOP = 75;
            const MARGIN_BOTTOM = 75;

            const blocks = Array.from(contentArea.children) as HTMLElement[];

            // Reset all margins first
            blocks.forEach(block => {
                block.style.marginTop = '0px';
                block.removeAttribute('data-page-break');
            });

            let currentY = MARGIN_TOP;

            blocks.forEach((block) => {
                const blockHeight = block.offsetHeight;
                const style = window.getComputedStyle(block);
                const marginBottom = parseInt(style.marginBottom || '0', 10);

                const blockTop = currentY;
                const blockBottom = currentY + blockHeight;

                const pageIndex = Math.floor(blockTop / PAGE_HEIGHT);
                const pageStart = pageIndex * PAGE_HEIGHT;
                const validContentEnd = pageStart + PAGE_HEIGHT - MARGIN_BOTTOM;

                if (blockBottom > validContentEnd) {
                    const nextPageContentStart = (pageIndex + 1) * PAGE_HEIGHT + MARGIN_TOP;
                    const spacer = nextPageContentStart - blockTop;

                    if (spacer > 0) {
                        block.style.marginTop = `${spacer}px`;
                        block.setAttribute('data-page-break', 'true');
                        currentY = nextPageContentStart + blockHeight + marginBottom;
                        return;
                    }
                }

                currentY += blockHeight + marginBottom;
            });
        };

        const timeout = setTimeout(checkPagination, 500);
        return () => clearTimeout(timeout);
    }, [editor?.getHTML()]);

    if (!editor) {
        return null;
    }

    const ToolbarButton = ({
        onClick,
        isActive = false,
        children,
        title
    }: {
        onClick: () => void,
        isActive?: boolean,
        children: React.ReactNode,
        title?: string
    }) => (
        <button
            onClick={onClick}
            className={`p-2 rounded transition-colors hover:bg-gray-200 ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
            title={title}
        >
            {children}
        </button>
    );

    return (
        <div className="flex flex-col gap-4 w-full max-w-[800px] mx-auto">
            {/* Toolbar */}
            <div className="sticky top-20 z-50 border border-gray-200 p-1.5 flex flex-wrap gap-0.5 bg-white/80 backdrop-blur-md rounded-xl no-print shadow-sm border-gray-200">
                {/* Font Family */}
                <div className="relative">
                    <button
                        onClick={() => setShowFontFamilies(!showFontFamilies)}
                        className="flex items-center gap-1 p-2 h-9 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                    >
                        Font <ChevronDown size={14} />
                    </button>
                    {showFontFamilies && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-[60] py-1 min-w-[120px]">
                            {FONT_FAMILIES.map((f) => (
                                <button
                                    key={f.name}
                                    onClick={() => {
                                        editor.chain().focus().setFontFamily(f.value).run();
                                        setShowFontFamilies(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100"
                                    style={{ fontFamily: f.value }}
                                >
                                    {f.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Font Size */}
                <div className="relative">
                    <button
                        onClick={() => setShowFontSizes(!showFontSizes)}
                        className="flex items-center gap-1 p-2 h-9 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                    >
                        {editor.getAttributes('textStyle').fontSize || '16px'} <ChevronDown size={14} />
                    </button>
                    {showFontSizes && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-[60] py-1 min-w-[60px]">
                            {FONT_SIZES.map((size) => (
                                <button
                                    key={size}
                                    onClick={() => {
                                        editor.chain().focus().setFontSize(size).run();
                                        setShowFontSizes(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100"
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-px h-6 bg-gray-200 mx-1 self-center" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    title="Bold"
                >
                    <Bold size={18} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    title="Italic"
                >
                    <Italic size={18} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive('underline')}
                    title="Underline"
                >
                    <UnderlineIcon size={18} />
                </ToolbarButton>

                <div className="w-px h-6 bg-gray-200 mx-1 self-center" />

                {/* Color Pickers */}
                <div className="flex items-center gap-0.5">
                    <label className="p-2 cursor-pointer hover:bg-gray-100 rounded relative" title="Text Color">
                        <Palette size={18} className="text-gray-600" />
                        <input
                            type="color"
                            onInput={(event) => editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                    </label>
                    <label className="p-2 cursor-pointer hover:bg-gray-100 rounded relative" title="Highlight">
                        <Highlighter size={18} className="text-gray-600" />
                        <input
                            type="color"
                            onInput={(event) => editor.chain().focus().toggleHighlight({ color: (event.target as HTMLInputElement).value }).run()}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                    </label>
                </div>

                <div className="w-px h-6 bg-gray-200 mx-1 self-center" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    isActive={editor.isActive({ textAlign: 'left' })}
                    title="Align Left"
                >
                    <AlignLeft size={18} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    isActive={editor.isActive({ textAlign: 'center' })}
                    title="Align Center"
                >
                    <AlignCenter size={18} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    isActive={editor.isActive({ textAlign: 'right' })}
                    title="Align Right"
                >
                    <AlignRight size={18} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                    isActive={editor.isActive({ textAlign: 'justify' })}
                    title="Align Justify"
                >
                    <AlignJustify size={18} />
                </ToolbarButton>

                <div className="w-px h-6 bg-gray-200 mx-1 self-center" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    isActive={editor.isActive('heading', { level: 1 })}
                >
                    <Heading1 size={18} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive('heading', { level: 2 })}
                >
                    <Heading2 size={18} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    isActive={editor.isActive('heading', { level: 3 })}
                >
                    <Heading3 size={18} />
                </ToolbarButton>

                <div className="w-px h-6 bg-gray-200 mx-1 self-center" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                >
                    <List size={18} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                >
                    <ListOrdered size={18} />
                </ToolbarButton>
            </div>

            {/* Paper */}
            <div
                id={id}
                className="editor-paper w-full bg-white border border-gray-200 shadow-[0_0_50px_rgba(0,0,0,0.1)] relative transition-all duration-300"
                style={{
                    minHeight: '1123px',
                    padding: '20mm',
                    boxSizing: 'border-box'
                }}
            >
                <EditorContent editor={editor} />
            </div>

            {/* Styles */}
            <style jsx>{`
                .editor-paper {
                    background-image: repeating-linear-gradient(
                        to bottom,
                        transparent 0px,
                        transparent 1122px,
                        #f1f5f9 1122px,
                        #f1f5f9 1125px,
                        transparent 1125px,
                        transparent 1126px
                    );
                    background-position: 0 0; 
                }
                :global(.ProseMirror) {
                    outline: none;
                }
                :global(.ProseMirror p.is-editor-empty:first-child::before) {
                    content: attr(data-placeholder);
                    float: left;
                    color: #adb5bd;
                    pointer-events: none;
                    height: 0;
                }
            `}</style>
        </div>
    );
};

export default Editor;

