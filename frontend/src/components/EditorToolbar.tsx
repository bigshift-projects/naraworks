import { Editor } from '@tiptap/react';
import {
    Bold, Italic, Underline as UnderlineIcon,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Palette, Highlighter, ChevronDown,
    List, ListOrdered, Heading1, Heading2, Heading3
} from 'lucide-react';
import { useState } from 'react';

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px'];
const FONT_FAMILIES = [
    { name: 'Default', value: 'Inter, sans-serif' },
    { name: 'Serif', value: 'serif' },
    { name: 'Monospace', value: 'monospace' },
    { name: 'Pretendard', value: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif' },
];

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

interface EditorToolbarProps {
    editor: Editor | null;
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
    const [showFontSizes, setShowFontSizes] = useState(false);
    const [showFontFamilies, setShowFontFamilies] = useState(false);

    if (!editor) {
        return null;
    }

    return (
        <div className="w-full bg-gray-50/90 backdrop-blur pt-6 pb-2 px-8 flex justify-center shrink-0 z-10 border-b border-gray-200 sticky top-0">
            <div className="w-full max-w-[800px] border border-gray-200 p-1.5 flex flex-wrap gap-0.5 bg-white rounded-xl no-print shadow-sm">
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
        </div>
    );
}
