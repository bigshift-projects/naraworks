'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@/components/Editor';
import { ChevronLeft, Loader2, Save, Download, Check } from 'lucide-react';
import Link from 'next/link';

interface Proposal {
    id: string;
    title: string;
    content: string;
    updated_at: string;
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

const updateProposal = async ({ id, title, content }: { id: string; title?: string; content?: string }) => {
    if (id.startsWith('mock-')) {
        // Mock update - just return success
        return { success: true };
    }
    const { data } = await axios.put(`/api/proposals/${id}`, { title, content });
    return data;
};

export default function EditorPage() {
    const { id } = useParams() as { id: string };
    const queryClient = useQueryClient();
    const router = useRouter();

    const [title, setTitle] = useState('');
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
        }
    }, [proposal]);

    // Debounced autosave for title
    useEffect(() => {
        if (!proposal) return;

        const timeoutId = setTimeout(() => {
            if (mutation.isPending) return;
            setIsSaving(true);
            mutation.mutate({ id, title, content: undefined });
        }, 10000); // Changed from 2000 to 10000

        return () => clearTimeout(timeoutId);
    }, [title]);

    const handleContentChange = useCallback((content: string) => {
        if (!proposal) return;

        setIsSaving(true);

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            mutation.mutate({ id, content });
        }, 10000); // Changed from 1500 to 10000
    }, [id, proposal, mutation]);

    const handleExportPDF = async () => {
        const element = document.getElementById('proposal-content');
        if (!element) return;

        try {
            setIsSaving(true);
            const { toPng } = await import('html-to-image');
            const { jsPDF } = await import('jspdf');

            // Capture at a standardized width (e.g., 800px) to maintain a consistent A4-like layout
            const dataUrl = await toPng(element, {
                quality: 1.0,
                backgroundColor: '#ffffff',
                width: 800,
                style: {
                    border: 'none',
                    boxShadow: 'none',
                    borderRadius: '0',
                    margin: '0',
                    width: '800px',
                },
                filter: (node) => {
                    return !(node instanceof Element && node.classList.contains('no-print'));
                }
            });

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgProps = pdf.getImageProperties(dataUrl);
            const ratio = imgProps.height / imgProps.width;
            const imgWidth = pdfWidth;
            const imgHeight = pdfWidth * ratio;

            // Simple handling for multi-page if height exceeds single A4
            // For now, it will scale to fit width. 
            pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`${title || '제안서'}.pdf`);
        } catch (error) {
            console.error('PDF Export failed:', error);
            alert('PDF 생성 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
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
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        PDF 내보내기
                    </button>
                </div>
            </header>

            {/* Editor Content Area */}
            <main className="flex-1 p-8 md:p-12 max-w-5xl mx-auto w-full">
                <Editor
                    id="proposal-content"
                    initialContent={proposal?.content}
                    onChange={handleContentChange}
                />
            </main>

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
