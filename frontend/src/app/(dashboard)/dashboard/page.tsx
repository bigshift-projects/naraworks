'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Plus, Trash2, Download } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useState, useEffect } from 'react';
import Editor from '@/components/Editor';
import { generatePdf } from '@/utils/pdfGenerator';


interface Proposal {
    id: string;
    title: string;
    content?: string;
    created_at: string;
    updated_at: string;
}

const MOCK_PROPOSALS: Proposal[] = [
    {
        id: 'mock-1',
        title: '[목업] 2024년도 AI 바우처 지원사업 제안서',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'mock-2',
        title: '[목업] 공공 클라우드 전환 컨설팅 사업 제안서',
        created_at: new Date(Date.now() - 259200000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
];

const fetchProposals = async () => {
    const { data } = await axios.get<Proposal[]>('/api/proposals');
    return data;
};

const createProposal = async () => {
    const { data } = await axios.post<Proposal>('/api/proposals', {
        title: '제목 없는 제안서',
        content: '<h1>새 제안서</h1><p>내용을 입력하세요...</p>',
        user_id: '00000000-0000-0000-0000-000000000000', // Placeholder
    });
    return data;
};

const deleteProposal = async (id: string) => {
    await axios.delete(`/api/proposals/${id}`);
};

export default function DashboardPage() {
    const router = useRouter();

    // PDF Export state
    const [pdfTargetProposal, setPdfTargetProposal] = useState<Proposal | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const queryClient = useQueryClient();

    const { data: proposals, isLoading, error } = useQuery({
        queryKey: ['proposals'],
        queryFn: fetchProposals,
    });

    const createMutation = useMutation({
        mutationFn: createProposal,
        onSuccess: (newProposal) => {
            router.push(`/editor/${newProposal.id}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteProposal,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proposals'] });
        },
    });

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault(); // Prevent Link navigation
        e.stopPropagation();

        if (confirm('정말로 이 제안서를 삭제하시겠습니까?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleDownloadPdf = (e: React.MouseEvent, proposal: Proposal) => {
        e.preventDefault();
        e.stopPropagation();
        // For now, redirect to editor and let user print from there
        // A dedicated print route could be added later
        router.push(`/editor/${proposal.id}`);
        // Optionally pass a query param ?print=true to auto-trigger print
    };

    // Effect to trigger PDF generation when pdfTargetProposal is set and rendered
    useEffect(() => {
        if (pdfTargetProposal && isGeneratingPdf) {
            const timer = setTimeout(async () => {
                try {
                    await generatePdf('hidden-pdf-editor', pdfTargetProposal.title || '제안서');
                } catch (e) {
                    console.error("PDF Generation failed", e);
                    alert("PDF 생성에 실패했습니다.");
                } finally {
                    setPdfTargetProposal(null);
                    setIsGeneratingPdf(false);
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [pdfTargetProposal, isGeneratingPdf]);

    const handleCreateProposal = () => {
        createMutation.mutate();
    };

    const displayProposals = error ? MOCK_PROPOSALS : proposals;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-gray-900">제안서 목록</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleCreateProposal}
                        disabled={createMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        새 제안서
                    </button>
                </div>
            </div>

            {(!displayProposals || displayProposals.length === 0) ? (
                <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">작성된 제안서가 없습니다</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mb-6">제안서를 직접 만들어보세요.</p>
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={handleCreateProposal}
                            disabled={createMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {createMutation.isPending ? '생성 중...' : '새 제안서 만들기'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {error && (
                        <div className="col-span-full mb-2 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm flex items-center gap-2">
                            데이터를 불러오는데 실패하여 목업 데이터를 표시합니다.
                        </div>
                    )}
                    {displayProposals.map((proposal) => (
                        <div
                            key={proposal.id}
                            onClick={() => router.push(`/editor/${proposal.id}`)}
                            className="group block bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <span className="text-xs text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-full">
                                    초안
                                </span>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
                                {proposal.title}
                            </h3>
                            <div className="space-y-1">
                                <p className="text-sm text-gray-500">
                                    {format(new Date(proposal.created_at), 'yyyy.MM.dd HH:mm')} 생성
                                </p>
                                <p className="text-xs text-gray-400">
                                    {formatDistanceToNow(new Date(proposal.updated_at), { addSuffix: true })} 수정됨
                                </p>
                            </div>
                            <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => handleDownloadPdf(e, proposal)}
                                    disabled={isGeneratingPdf}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="PDF 다운로드"
                                >
                                    {isGeneratingPdf && pdfTargetProposal?.id === proposal.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, proposal.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="삭제"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={handleCreateProposal}
                        disabled={createMutation.isPending}
                        className="group flex flex-col items-center justify-center bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-white transition-all min-h-[160px]"
                    >
                        <div className="p-3 bg-white rounded-full text-gray-400 group-hover:text-blue-600 group-hover:shadow-sm transition-all mb-2">
                            <Plus className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">
                            {createMutation.isPending ? '생성 중...' : '새 제안서 추가'}
                        </span>
                    </button>
                </div>
            )}

            {/* Hidden Editor for PDF Generation */}
            {pdfTargetProposal && (
                <div className="fixed -left-[9999px] top-0 overflow-hidden h-0 w-0">
                    <div id="hidden-pdf-editor" className="bg-white" style={{ width: '800px' }}>
                        <Editor
                            id="pdf-content"
                            initialContent={pdfTargetProposal.content}
                            onChange={() => { }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
