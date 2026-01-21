'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@/components/Editor';
import { ChevronLeft, Loader2, Save, Download, Check, FileText } from 'lucide-react';
import Link from 'next/link';

interface Proposal {
    id: string;
    title: string;
    content: string;
    updated_at: string;
    toc?: { title: string; description?: string; status?: string }[];
}

const MOCK_PROPOSAL_DETAILS: Record<string, Proposal> = {
    'mock-1': {
        id: 'mock-1',
        title: '[목업] 2024년도 AI 바우처 지원사업 제안서',
        content: `
<h1>2024년도 AI 바우처 지원사업 제안서</h1>
<p>이것은 서버 에러 시 표시되는 <strong>목업 데이터</strong>입니다.</p>
<h2>1. 사업 개요</h2>
<p>본 사업은 중소기업의 AI 도입을 지원하기 위한 바우처 사업입니다.</p>
<h2>2. 수행 계획</h2>
<p>최신 LLM 기술을 활용하여 업무 자동화를 실현합니다.</p>
        `,
        updated_at: new Date().toISOString(),
    },
    'mock-2': {
        id: 'mock-2',
        title: '[목업] 공공 클라우드 전환 컨설팅 사업 제안서',
        content: `
<h1>공공 클라우드 전환 컨설팅 사업 제안서</h1>
<p>공공 부문의 안정적인 클라우드 전환을 위한 컨설팅을 제공합니다.</p>
        `,
        updated_at: new Date(Date.now() - 86400000).toISOString(),
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

const updateProposal = async ({ id, title, content, toc, status }: { id: string; title?: string; content?: string; toc?: any[]; status?: string }) => {
    if (id.startsWith('mock-')) {
        // Mock update - just return success
        return { success: true };
    }
    const { data } = await axios.put(`/api/proposals/${id}`, { title, content, toc, status });
    return data;
};

export default function EditorPage() {
    const { id } = useParams() as { id: string };
    const queryClient = useQueryClient();
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState(''); // Track content for manual save
    const [toc, setToc] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { data: proposal, isLoading, error } = useQuery({
        queryKey: ['proposal', id],
        queryFn: () => fetchProposal(id),
    });

    const mutation = useMutation({
        mutationFn: updateProposal,
        onSuccess: () => {
            setLastSaved(new Date());
            setIsSaving(false);
        },
    });

    useEffect(() => {
        if (proposal) {
            setTitle(proposal.title);
            setContent(proposal.content);
            if (proposal.toc) setToc(proposal.toc);
        }
    }, [proposal]);

    // Debounced autosave for title - COMMENTED OUT
    /*
    useEffect(() => {
        if (!proposal) return;

        const timeoutId = setTimeout(() => {
            if (mutation.isPending) return;
            setIsSaving(true);
            mutation.mutate({ id, title, content: undefined });
        }, 10000); // Changed from 2000 to 10000

        return () => clearTimeout(timeoutId);
    }, [title]);
    */

    const handleContentChange = useCallback((content: string) => {
        setContent(content);
        /* Autosave logic commented out
        if (!proposal) return;

        setIsSaving(true);

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            mutation.mutate({ id, content });
        }, 10000); // Changed from 1500 to 10000
        */
    }, []); // Removed id, proposal, mutation from dependencies to avoid unnecessary re-renders if not needed for state updates

    const handleSave = async () => {
        if (!proposal) return;
        setIsSaving(true);
        mutation.mutate({ id, title, content });
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

        try {
            alert('RFP 분석 중입니다. 잠시만 기다려주세요...');
            const res = await axios.post('/api/proposals/parse-rfp', formData);

            if (res.data.toc && res.data.toc.length > 0) {
                const newToc = res.data.toc.map((item: any) => ({ ...item, status: 'pending' }));
                setToc(newToc);
                // Save immediately
                mutation.mutate({ id, title, content, toc: newToc, status: 'toc_confirmed' });
            } else {
                alert('목차 생성에 실패했습니다. PDF에 텍스트가 포함되어 있는지 확인해주세요.');
            }
        } catch (e) {
            console.error(e);
            alert('목차 생성 중 오류가 발생했습니다.');
        }
    };

    const handleGenerateSection = async (index: number) => {
        const section = toc[index];
        if (!section) return;

        // Update status to generating
        const newToc = [...toc];
        newToc[index] = { ...section, status: 'generating' };
        setToc(newToc);

        try {
            const res = await axios.post(`/api/proposals/${id}/generate-section`, {
                section_title: section.title
            });

            const generatedContent = res.data.content;

            // Append content
            const newContent = content + `\n\n${generatedContent}`;
            setContent(newContent);

            // Update TOC status
            newToc[index] = { ...section, status: 'done' };
            setToc(newToc);

            // Save immediately
            mutation.mutate({ id, title, content: newContent, toc: newToc });

        } catch (e) {
            console.error(e);
            alert('섹션 생성 실패');
            newToc[index] = { ...section, status: 'error' };
            setToc(newToc);
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
            {/* Editor Header */}
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

            {/* Main Layout with Sidebar */}
            <div className="flex flex-1 max-w-7xl mx-auto w-full">
                {/* TOC Sidebar */}
                <aside className="w-80 border-r border-gray-200 bg-white p-6 hidden lg:block h-[calc(100vh-80px)] overflow-y-auto sticky top-[80px]">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wider">목차 (Table of Contents)</h3>
                    <div className="space-y-4">
                        {toc.map((section, idx) => (
                            <div key={idx} className="group">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <span className="text-sm font-medium text-gray-800 leading-tight">{section.title}</span>
                                    {section.status === 'generating' && <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />}
                                    {section.status === 'done' && <Check className="w-3 h-3 text-green-500 shrink-0" />}
                                </div>
                                <p className="text-xs text-gray-400 mb-2 line-clamp-2">{section.description}</p>

                                {(!section.status || section.status === 'pending' || section.status === 'error') && (
                                    <button
                                        onClick={() => handleGenerateSection(idx)}
                                        className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded transition-colors"
                                    >
                                        <span className="text-[10px]">✨</span> 생성하기
                                    </button>
                                )}
                            </div>
                        ))}
                        {toc.length === 0 && (
                            <div className="text-center py-8">
                                <p className="text-sm text-gray-400 italic mb-4">목차가 없습니다.</p>

                                <input
                                    type="file"
                                    id="sidebar-rfp-upload"
                                    className="hidden"
                                    accept=".pdf"
                                    onChange={handleGenerateTOCFromRFP}
                                />
                                <label
                                    htmlFor="sidebar-rfp-upload"
                                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 cursor-pointer transition-colors"
                                >
                                    <FileText className="w-3 h-3" />
                                    RFP로 목차 생성하기
                                </label>

                                <p className="text-xs text-gray-300 mt-2">
                                    또는 수동으로 작성하세요 (준비중)
                                </p>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Editor Content Area */}
                <main className="flex-1 p-8 md:p-12 w-full">
                    <Editor
                        id="proposal-content"
                        initialContent={proposal?.content}
                        onChange={handleContentChange}
                    />
                </main>
            </div>

            <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          .prose {
            max-width: none !important;
          }
        }
      `}</style>
        </div>
    );
}
