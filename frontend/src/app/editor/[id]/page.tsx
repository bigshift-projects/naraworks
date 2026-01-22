'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { useState, useEffect, useCallback } from 'react';
import Editor from '@/components/Editor';
import StepProgress from '@/components/StepProgress';
import { ChevronLeft, Loader2, Save, Download, Check, FileText } from 'lucide-react';
import Link from 'next/link';

interface Proposal {
    id: string;
    title: string;
    content: string;
    status: string;
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
        status: 'draft',
    },
    'mock-2': {
        id: 'mock-2',
        title: '[목업] 공공 클라우드 전환 컨설팅 사업 제안서',
        content: `
<h1>공공 클라우드 전환 컨설팅 사업 제안서</h1>
<p>공공 부문의 안정적인 클라우드 전환을 위한 컨설팅을 제공합니다.</p>
        `,
        updated_at: new Date(Date.now() - 86400000).toISOString(),
        status: 'draft',
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
    const [content, setContent] = useState('');
    const [toc, setToc] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

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
            if (proposal.status === 'generating_sections' || !content) {
                setContent(proposal.content);
            }
            if (proposal.toc) {
                setToc(proposal.toc);
                // Assume if TOC exists, PDF was uploaded and overview extracted (restoring state)
                if (proposal.toc.length > 0) {
                    setStepStatus(prev => ({ ...prev, pdfUploaded: true, overviewExtracted: true }));
                }
            }
        }
    }, [proposal, content]);

    // Polling effect for generating status
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (proposal?.status === 'generating_sections') {
            interval = setInterval(() => {
                refetch();
            }, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [proposal?.status, refetch]);

    const handleContentChange = useCallback((newContent: string) => {
        setContent(newContent);
    }, []);

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

        // Update status: PDF Uploaded
        setStepStatus(prev => ({ ...prev, pdfUploaded: true }));

        try {
            // alert('RFP 분석 중입니다. 잠시만 기다려주세요...'); // Removed alert to avoid blocking UI update
            const res = await axios.post('/api/proposals/parse-rfp', formData);

            if (res.data.toc && res.data.toc.length > 0) {
                const newToc = res.data.toc.map((item: any) => ({ ...item, status: 'pending' }));
                setToc(newToc);

                // Update Overview Data & Status
                if (res.data.overview) {
                    setOverviewData(res.data.overview);
                    setStepStatus(prev => ({ ...prev, overviewExtracted: true }));
                }

                mutation.mutate({ id, title, content, toc: newToc, status: 'toc_confirmed' });
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

    const handleGenerateSection = async (index: number) => {
        const section = toc[index];
        if (!section) return;

        const newToc = [...toc];
        newToc[index] = { ...section, status: 'generating' };
        setToc(newToc);

        try {
            const res = await axios.post(`/api/proposals/${id}/generate-section`, {
                section_title: section.title
            });

            const generatedContent = res.data.content;
            const newContent = content + `\n\n${generatedContent}`;
            setContent(newContent);
            newToc[index] = { ...section, status: 'done' };
            setToc(newToc);
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

                    {/* Top Hand: TOC (Flexible height) */}
                    <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wider">목차 (Table of Contents)</h3>
                        <div className="space-y-4">
                            {toc.map((section, idx) => (
                                <div key={idx} className={`group p-2 rounded-lg transition-colors ${section.status === 'generating' ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50'}`}>
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className={`text-sm font-medium leading-tight ${section.status === 'generating' ? 'text-blue-700' : 'text-gray-800'}`}>
                                            {section.title}
                                        </span>
                                        {section.status === 'generating' && <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />}
                                        {section.status === 'done' && <Check className="w-4 h-4 text-green-500 shrink-0" />}
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

                    {/* Bottom Half: Step Progress (Fixed/Flexible) */}
                    <div className="h-1/3 min-h-[250px] border-t border-gray-200">
                        <StepProgress
                            step={currentStep}
                            status={stepStatus}
                            overviewData={overviewData}
                        />
                    </div>
                </aside>

                <main className="flex-1 p-8 md:p-12 w-full relative">
                    {proposal?.status === 'generating_sections' && (
                        <div className="mb-8 p-4 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-between animate-pulse">
                            <div className="flex items-center gap-3">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="font-medium">AI가 실시간으로 제안서를 작성하고 있습니다... (3초마다 자동 갱신)</span>
                            </div>
                            <div className="text-sm bg-blue-700 px-3 py-1 rounded-full">
                                {toc.filter(s => s.status === 'done').length} / {toc.length} 완료
                            </div>
                        </div>
                    )}

                    <Editor id="proposal-content" initialContent={proposal?.content} onChange={handleContentChange} />
                </main>
            </div>
        </div>
    );
}
