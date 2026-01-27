'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { useState, useEffect, useCallback } from 'react';
import Editor from '@/components/Editor';
import StepProgress from '@/components/StepProgress';
import { ChevronLeft, Loader2, Save, Download, Check, FileText, Pencil, Trash, X } from 'lucide-react';
import Link from 'next/link';

interface TOCSubSection {
    title: string;
    guideline?: string;
    status?: string; // 'pending' | 'generating' | 'done' | 'error'
    content?: string;
}

interface TOCChapter {
    chapter_title: string;
    sub_sections: TOCSubSection[];
}

interface Proposal {
    id: string;
    title: string;
    content: string;
    status: string;
    updated_at: string;
    toc?: TOCChapter[];
    overview?: any;
}

const MOCK_PROPOSAL_DETAILS: Record<string, Proposal> = {
    'mock-1': {
        id: 'mock-1',
        title: '[목업] 2024년도 AI 바우처 지원사업 제안서',
        content: `
<h1>2024년도 AI 바우처 지원사업 제안서</h1>
<p>이것은 서버 에러 시 표시되는 <strong>목업 데이터</strong>입니다.</p>
        `,
        updated_at: new Date().toISOString(),
        status: 'draft',
        overview: {
            project_name: "[목업] 2024년도 AI 바우처 지원사업",
            budget: "2.5억원",
            period: "2024.03 ~ 2024.12",
            project_summary: "본 사업은 중소기업의 AI 도입을 지원하는 바우처 사업입니다.",
            key_objectives: ["AI 솔루션 도입 지원", "인프라 구축", "데이터 가공 서비스"]
        },
        toc: [
            {
                chapter_title: "I. 사업 개요",
                sub_sections: [
                    { title: "1. 사업의 목적", guideline: "사업 목적 기술", status: "done" },
                    { title: "2. 추진 배경", guideline: "배경 기술", status: "pending" }
                ]
            }
        ]
    },
};

const fetchProposal = async (id: string) => {
    if (id.startsWith('mock-')) {
        const mock = MOCK_PROPOSAL_DETAILS[id];
        if (mock) return mock;
        throw new Error('Mock proposal not found');
    }
    const { data } = await axios.get<Proposal>(`/api/proposals/${id}`);
    return data;
};

const updateProposal = async ({ id, title, content, toc, status, overview }: { id: string; title?: string; content?: string; toc?: any[]; status?: string; overview?: any }) => {
    if (id.startsWith('mock-')) {
        return { success: true };
    }
    const { data } = await axios.put(`/api/proposals/${id}`, { title, content, toc, status, overview });
    return data;
};

export default function EditorPage() {
    const { id } = useParams() as { id: string };
    const queryClient = useQueryClient();
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [toc, setToc] = useState<TOCChapter[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Editing State
    const [editingChapterIdx, setEditingChapterIdx] = useState<number | null>(null);
    const [editingSection, setEditingSection] = useState<{ cIdx: number, sIdx: number } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [editGuideline, setEditGuideline] = useState("");

    // Progress State
    const [currentStep, setCurrentStep] = useState(1);
    const [stepStatus, setStepStatus] = useState({
        pdfUploaded: false,
        overviewExtracted: false
    });
    const [overviewData, setOverviewData] = useState<any>(null);

    const { data: proposal, isLoading, error, refetch } = useQuery({
        queryKey: ['proposal', id],
        queryFn: () => fetchProposal(id),
    });

    const mutation = useMutation({
        mutationFn: updateProposal,
        onSuccess: () => {
            setLastSaved(new Date());
            setIsSaving(false);
            queryClient.invalidateQueries({ queryKey: ['proposal', id] });
        },
    });

    useEffect(() => {
        if (proposal) {
            setTitle(proposal.title);
            if (!content) {
                setContent(proposal.content);
            }
            if (proposal.toc) {
                setToc(proposal.toc);
                // Assume if TOC exists, PDF was uploaded and overview extracted (restoring state)
                if (proposal.toc.length > 0) {
                    setStepStatus(prev => ({ ...prev, pdfUploaded: true, overviewExtracted: true }));
                }
            }
            if (proposal.overview) {
                setOverviewData(proposal.overview);
                setStepStatus(prev => ({ ...prev, pdfUploaded: true, overviewExtracted: true }));
            }
        }
    }, [proposal, content]);

    const handleContentChange = useCallback((newContent: string) => {
        setContent(newContent);
    }, []);

    const handleSave = async () => {
        if (!proposal) return;
        setIsSaving(true);
        mutation.mutate({ id, title, content, toc, overview: overviewData });
    };

    const handleExportPDF = async () => {
        const element = document.getElementById('proposal-content');
        if (!element) return;

        try {
            setIsSaving(true);
            const { generatePdf } = await import('@/utils/pdfGenerator');
            await generatePdf('proposal-content', title || '제안서');
        } catch (error) {
            console.error('PDF Export failed:', error);
            alert('PDF 생성 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateTOCFromRFP = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('rfp', file);
        formData.append('proposal_id', id);

        // Update status: PDF Uploaded
        setStepStatus(prev => ({ ...prev, pdfUploaded: true }));

        try {
            // alert('RFP 분석 중입니다. 잠시만 기다려주세요...'); // Removed alert to avoid blocking UI update
            const res = await axios.post('/api/generation/parse-rfp', formData);

            if (res.data.toc && res.data.toc.length > 0) {
                const newToc = res.data.toc.map((chapter: any) => ({
                    ...chapter,
                    sub_sections: chapter.sub_sections ? chapter.sub_sections.map((sub: any) => ({
                        ...sub,
                        status: 'pending'
                    })) : []
                }));
                setToc(newToc);

                // Update Overview Data & Status
                if (res.data.overview) {
                    setOverviewData(res.data.overview);
                    setStepStatus(prev => ({ ...prev, overviewExtracted: true }));
                }

                mutation.mutate({ id, title, content, toc: newToc, overview: res.data.overview, status: 'toc_confirmed' });
            } else {
                alert('목차 생성에 실패했습니다. PDF에 텍스트가 포함되어 있는지 확인해주세요.');
                setStepStatus(prev => ({ ...prev, pdfUploaded: false })); // Reset on failure
            }
        } catch (e) {
            console.error(e);
            alert('목차 생성 중 오류가 발생했습니다.');
            setStepStatus(prev => ({ ...prev, pdfUploaded: false })); // Reset on failure
        }
    };

    const handleGenerateSection = async (chapterIdx: number, sectionIdx: number) => {
        const chapter = toc[chapterIdx];
        if (!chapter || !chapter.sub_sections[sectionIdx]) return;

        const newToc = [...toc];
        // Create deep copy for nested update
        newToc[chapterIdx] = {
            ...chapter,
            sub_sections: [...chapter.sub_sections]
        };
        const section = newToc[chapterIdx].sub_sections[sectionIdx];

        section.status = 'generating';
        setToc(newToc);

        try {
            const res = await axios.post(`/api/generation/${id}/generate-section`, {
                section_title: section.title
            });

            const generatedContent = res.data.content;

            // Append content with header 
            // Optional: You might want to format this better or let the backend handle everything
            const newContentSection = generatedContent;
            const newContent = content + newContentSection;

            setContent(newContent);

            section.status = 'done';
            setToc(newToc);

            mutation.mutate({ id, title, content: newContent, toc: newToc });

        } catch (e) {
            console.error(e);
            alert('섹션 생성 실패');
            section.status = 'error';
            setToc(newToc);
        }
    };

    // --- TOC Editing Handlers ---

    const updateTocAndSave = (newToc: TOCChapter[]) => {
        setToc(newToc);
        mutation.mutate({ id, title, content, toc: newToc });
    };

    // Chapter Actions
    const startEditChapter = (idx: number) => {
        setEditingChapterIdx(idx);
        setEditValue(toc[idx].chapter_title);
        setEditingSection(null);
    };

    const saveEditChapter = (idx: number) => {
        if (!editValue.trim()) return;
        const newToc = [...toc];
        newToc[idx] = { ...newToc[idx], chapter_title: editValue };
        updateTocAndSave(newToc);
        setEditingChapterIdx(null);
    };

    const deleteChapter = (idx: number) => {
        if (confirm('대분류를 삭제하시겠습니까? 포함된 모든 소제목도 함께 삭제됩니다.')) {
            const newToc = toc.filter((_, i) => i !== idx);
            updateTocAndSave(newToc);
        }
    };

    // Section Actions
    const startEditSection = (cIdx: number, sIdx: number) => {
        setEditingSection({ cIdx, sIdx });
        const section = toc[cIdx].sub_sections[sIdx];
        setEditValue(section.title);
        setEditGuideline(section.guideline || "");
        setEditingChapterIdx(null);
    };

    const saveEditSection = (cIdx: number, sIdx: number) => {
        if (!editValue.trim()) return;
        const newToc = [...toc];
        const newChapter = { ...newToc[cIdx] };
        const newSections = [...newChapter.sub_sections];

        newSections[sIdx] = {
            ...newSections[sIdx],
            title: editValue,
            guideline: editGuideline
        };

        newChapter.sub_sections = newSections;
        newToc[cIdx] = newChapter;

        updateTocAndSave(newToc);
        setEditingSection(null);
    };

    const deleteSection = (cIdx: number, sIdx: number) => {
        if (confirm('이 항목을 삭제하시겠습니까?')) {
            const newToc = [...toc];
            const newChapter = { ...newToc[cIdx] };
            newChapter.sub_sections = newChapter.sub_sections.filter((_, i) => i !== sIdx);
            newToc[cIdx] = newChapter;
            updateTocAndSave(newToc);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Proposal not found</h2>
                    <Link href="/dashboard" className="text-blue-600 hover:underline">Return to Dashboard</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 no-print">
                <div className="flex items-center gap-4 flex-1">
                    <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </Link>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="text-xl font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 w-full max-w-2xl"
                        placeholder="제안서 제목을 입력하세요"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mr-4">
                        {isSaving ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>저장 중...</span>
                            </>
                        ) : lastSaved ? (
                            <>
                                <Check className="w-3 h-3 text-green-500" />
                                <span>마지막 저장: {lastSaved.toLocaleTimeString()}</span>
                            </>
                        ) : (
                            <span>저장됨</span>
                        )}
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        저장
                    </button>

                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        PDF 내보내기
                    </button>
                </div>
            </header>

            <div className="flex flex-1 max-w-7xl mx-auto w-full">
                {/* Sidebar (Split Layout) */}
                <aside className="w-80 border-r border-gray-200 bg-white flex flex-col h-[calc(100vh-80px)] sticky top-[80px]">

                    {/* Top Hand: Step Progress & Overview (Fixed/Flexible) */}
                    <div className="border-b border-gray-200 bg-gray-50/50">
                        <StepProgress
                            step={currentStep}
                            status={stepStatus}
                            overviewData={overviewData}
                        />
                    </div>

                    {/* Bottom Half: TOC (Flexible height) */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wider">목차 (Table of Contents)</h3>
                        <div className="space-y-4">
                            {toc.map((chapter, cIdx) => (
                                <div key={cIdx} className="mb-6">
                                    {/* Chapter Header with Edit Mode */}
                                    <div className="group/chapter flex items-center justify-between mb-3 px-2 border-l-4 border-gray-200 pl-2 min-h-[28px]">
                                        {editingChapterIdx === cIdx ? (
                                            <div className="flex items-center gap-2 w-full">
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="flex-1 text-sm font-bold border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                    autoFocus
                                                />
                                                <button onClick={() => saveEditChapter(cIdx)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                                                <button onClick={() => setEditingChapterIdx(null)} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <h4 className="text-sm font-bold text-gray-800 break-words flex-1 pr-2">
                                                    {chapter.chapter_title}
                                                </h4>
                                                <div className="flex items-center gap-1 opacity-0 group-hover/chapter:opacity-100 transition-opacity">
                                                    <button onClick={() => startEditChapter(cIdx)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors" title="수정"><Pencil size={12} /></button>
                                                    <button onClick={() => deleteChapter(cIdx)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded transition-colors" title="삭제"><Trash size={12} /></button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="space-y-3 pl-2">
                                        {chapter.sub_sections && chapter.sub_sections.map((section, sIdx) => (
                                            <div key={sIdx} className={`group relative p-3 rounded-lg border transition-all ${section.status === 'generating' ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-blue-100 hover:shadow-sm'}`}>

                                                {/* Section Edit Mode */}
                                                {editingSection?.cIdx === cIdx && editingSection?.sIdx === sIdx ? (
                                                    <div className="flex flex-col gap-2">
                                                        <input
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            className="text-sm font-medium border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100 w-full"
                                                            placeholder="목차 제목"
                                                            autoFocus
                                                        />
                                                        <textarea
                                                            value={editGuideline}
                                                            onChange={(e) => setEditGuideline(e.target.value)}
                                                            className="text-xs text-gray-600 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300 w-full min-h-[60px]"
                                                            placeholder="작성 지침 (Guideline)"
                                                        />
                                                        <div className="flex justify-end gap-2 mt-1">
                                                            <button onClick={() => setEditingSection(null)} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">취소</button>
                                                            <button onClick={() => saveEditSection(cIdx, sIdx)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">저장</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-md shadow-sm border border-gray-100 p-0.5 z-10">
                                                            <button onClick={() => startEditSection(cIdx, sIdx)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded" title="수정"><Pencil size={11} /></button>
                                                            <button onClick={() => deleteSection(cIdx, sIdx)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded" title="삭제"><Trash size={11} /></button>
                                                        </div>

                                                        <div className="flex items-start justify-between gap-2 mb-1 pr-6">
                                                            <span className={`text-sm font-medium leading-tight ${section.status === 'generating' ? 'text-blue-700' : 'text-gray-700'}`}>
                                                                {section.title}
                                                            </span>
                                                            {section.status === 'generating' && <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />}
                                                            {section.status === 'done' && <Check className="w-4 h-4 text-green-500 shrink-0" />}
                                                        </div>
                                                        {section.guideline && (
                                                            <p className="text-xs text-gray-400 mb-2 line-clamp-2 leading-relaxed whitespace-pre-line">{section.guideline}</p>
                                                        )}
                                                        {(!section.status || section.status === 'pending' || section.status === 'error') && (
                                                            <button
                                                                onClick={() => handleGenerateSection(cIdx, sIdx)}
                                                                className="w-full mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 py-1.5 rounded transition-all"
                                                            >
                                                                <span className="text-[10px]">✨</span> 생성하기
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {toc.length === 0 && (
                                <div className="py-4">
                                    <input type="file" id="sidebar-rfp-upload" className="hidden" accept=".pdf" onChange={handleGenerateTOCFromRFP} />
                                    <label
                                        htmlFor="sidebar-rfp-upload"
                                        className="flex flex-col items-center justify-center gap-3 px-4 py-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl text-center cursor-pointer transition-all shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] w-full group mb-4"
                                    >
                                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors shadow-inner">
                                            <FileText className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-base font-bold tracking-tight">AI로 초안 작성하기</span>
                                            <span className="text-[11px] text-blue-100 font-medium">RFP 분석 및 자동 생성</span>
                                        </div>
                                    </label>
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                                        <p className="text-[12px] text-gray-500 text-center leading-relaxed">
                                            제안요청서(RFP)를 업로드하시면<br />
                                            AI가 <span className="text-blue-600 font-semibold">목차 구성부터 본문 초안</span>까지<br />
                                            한 번에 작성해 드립니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </aside>

                <main className="flex-1 p-8 pt-4 w-full relative">

                    <Editor id="proposal-content" initialContent={proposal?.content} onChange={handleContentChange} />
                </main>
            </div>
        </div>
    );
}
