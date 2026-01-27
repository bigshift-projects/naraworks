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
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useEffect, useState } from 'react';
import {
    Bold, Italic, Underline as UnderlineIcon,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Type, Palette, Highlighter, ChevronDown,
    List, ListOrdered, Heading1, Heading2, Heading3, ArrowUpDown
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
        lineHeight: {
            setLineHeight: (lineHeight: string) => ReturnType;
            unsetLineHeight: () => ReturnType;
        };
        paragraphSpacing: {
            setMarginBottom: (size: string) => ReturnType;
            unsetMarginBottom: () => ReturnType;
        };
    }
}

const LineHeight = Extension.create({
    name: 'lineHeight',
    addOptions() {
        return {
            types: ['heading', 'paragraph'],
            defaultLineHeight: '1.5',
        };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    lineHeight: {
                        default: this.options.defaultLineHeight,
                        parseHTML: element => element.style.lineHeight || this.options.defaultLineHeight,
                        renderHTML: attributes => {
                            if (!attributes.lineHeight) return {};
                            return { style: `line-height: ${attributes.lineHeight}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setLineHeight: lineHeight => ({ commands }) => {
                return commands.updateAttributes('paragraph', { lineHeight })
                    || commands.updateAttributes('heading', { lineHeight });
            },
            unsetLineHeight: () => ({ commands }) => {
                return commands.resetAttributes('paragraph', 'lineHeight')
                    || commands.resetAttributes('heading', 'lineHeight');
            },
        };
    },
});

const ParagraphSpacing = Extension.create({
    name: 'paragraphSpacing',
    addOptions() {
        return {
            types: ['heading', 'paragraph'],
        };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    marginBottom: {
                        default: null,
                        parseHTML: element => element.style.marginBottom || null,
                        renderHTML: attributes => {
                            if (!attributes.marginBottom) return {};
                            return { style: `margin-bottom: ${attributes.marginBottom}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setMarginBottom: size => ({ commands }) => {
                return commands.updateAttributes('paragraph', { marginBottom: size })
                    || commands.updateAttributes('heading', { marginBottom: size });
            },
            unsetMarginBottom: () => ({ commands }) => {
                return commands.updateAttributes('paragraph', { marginBottom: null })
                    || commands.updateAttributes('heading', { marginBottom: null });
            },
        };
    },
});

interface EditorProps {
    id?: string;
    initialContent?: string;
    onChange: (content: string) => void;
}

const FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '18pt', '24pt', '30pt', '36pt', '48pt', '60pt', '72pt', '96pt'];
const FONT_FAMILIES = [
    { name: '기본(프리텐다드)', value: 'Pretendard, sans-serif' },
    { name: '노토산스 KR', value: '"Noto Sans KR", sans-serif' },
    { name: '나눔바른고딕', value: '"Nanum Barun Gothic", sans-serif' },
    { name: 'Inter', value: 'Inter, sans-serif' },
    { name: 'Serif', value: 'serif' },
    { name: 'Monospace', value: 'monospace' },
];
const LINE_HEIGHTS = [
    { name: '1.0(한 줄 간격)', value: '1.0' },
    { name: '1.15', value: '1.15' },
    { name: '1.5', value: '1.5' },
    { name: '2.0', value: '2.0' },
];

const Editor = ({ id, initialContent, onChange }: EditorProps) => {
    const [_, setUpdate] = useState(0);
    const [showFontSizes, setShowFontSizes] = useState(false);
    const [showFontFamilies, setShowFontFamilies] = useState(false);
    const [showLineHeights, setShowLineHeights] = useState(false);

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
            LineHeight.configure({ types: ['heading', 'paragraph'], defaultLineHeight: '1.15' }),
            ParagraphSpacing,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
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
                class: 'prose max-w-none mx-auto focus:outline-none min-h-[500px] text-[11pt] leading-[1.5] text-gray-900',
                style: 'font-size: 11pt; font-family: Pretendard, sans-serif;',
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
                        {FONT_FAMILIES.find(f => f.value === editor.getAttributes('textStyle').fontFamily)?.name || '기본(프리텐다드)'} <ChevronDown size={14} />
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
                        {editor.getAttributes('textStyle').fontSize || '11pt'} <ChevronDown size={14} />
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

                {/* Line Height Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowLineHeights(!showLineHeights)}
                        className="p-2 rounded transition-colors hover:bg-gray-200 text-gray-600"
                        title="Line & Paragraph Spacing"
                    >
                        <ArrowUpDown size={18} />
                    </button>
                    {showLineHeights && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-[60] py-1 min-w-[180px]">
                            {LINE_HEIGHTS.map((lh) => (
                                <button
                                    key={lh.value}
                                    onClick={() => {
                                        editor.chain().focus().setLineHeight(lh.value).run();
                                        setShowLineHeights(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 flex items-center justify-between"
                                >
                                    <span>{lh.name}</span>
                                    {editor.getAttributes('paragraph').lineHeight === lh.value && (
                                        <span className="text-blue-600">✓</span>
                                    )}
                                </button>
                            ))}
                            <div className="h-px bg-gray-100 my-1" />
                            <button
                                onClick={() => {
                                    const currentMb = editor.getAttributes('paragraph').marginBottom;
                                    if (currentMb) {
                                        editor.chain().focus().unsetMarginBottom().run();
                                    } else {
                                        editor.chain().focus().setMarginBottom('12pt').run();
                                    }
                                    setShowLineHeights(false);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 flex items-center justify-between"
                            >
                                <span>
                                    {editor.getAttributes('paragraph').marginBottom
                                        ? 'Remove space after paragraph'
                                        : 'Add space after paragraph'}
                                </span>
                                {editor.getAttributes('paragraph').marginBottom && (
                                    <span className="text-blue-600">✓</span>
                                )}
                            </button>
                        </div>
                    )}
                </div>

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

                /* Table Styles */
                :global(.ProseMirror table) {
                    border-collapse: collapse;
                    table-layout: fixed;
                    width: 100%;
                    margin: 0;
                    overflow: hidden;
                }
                :global(.ProseMirror td),
                :global(.ProseMirror th) {
                    min-width: 1em;
                    border: 1px solid #ced4da;
                    padding: 3px 5px;
                    vertical-align: top;
                    box-sizing: border-box;
                    position: relative;
                }
                :global(.ProseMirror th) {
                    font-weight: bold;
                    text-align: left;
                    background-color: #f1f3f5;
                }
                :global(.ProseMirror .selectedCell:after) {
                    z-index: 2;
                    position: absolute;
                    content: "";
                    left: 0; right: 0; top: 0; bottom: 0;
                    background: rgba(200, 200, 255, 0.4);
                    pointer-events: none;
                }
                :global(.ProseMirror .column-resize-handle) {
                    position: absolute;
                    right: -2px;
                    top: 0;
                    bottom: 0;
                    width: 4px;
                    background-color: #adf;
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
};

export default Editor;

