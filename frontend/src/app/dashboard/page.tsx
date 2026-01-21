'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Plus, Sparkles, X, Trash2, Download } from 'lucide-react';
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

const generateProposal = async (formData: FormData) => {
    const { data } = await axios.post<Proposal>('/api/proposals/generate', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return data;
};

export default function DashboardPage() {
    const router = useRouter();
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);

    // File states
    const [rfpFile, setRfpFile] = useState<File | null>(null);
    const [noticeFile, setNoticeFile] = useState<File | null>(null);

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

    const generateMutation = useMutation({
        mutationFn: generateProposal,
        onSuccess: (newProposal) => {
            setIsAiModalOpen(false);
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

    const handleDownloadPdf = async (e: React.MouseEvent, proposal: Proposal) => {
        e.preventDefault();
        e.stopPropagation();

        if (isGeneratingPdf) return;

        // If content is missing in the list view object, we might need to fetch it first.
        // Assuming fetchProposals returns full objects or we fetch detail.
        // If the current list API returns content, we can use it directly.
        // Based on previous code, fetchProposals returns Proposal[] and MOCK has content but interface didn't.
        // Let's assume content is available or we need to fetch detail if missing.

        // For robust implementation, let's fetch the latest detail to ensure we have content
        setIsGeneratingPdf(true);
        try {
            // We can optimize this if the list already has content, but fetching ensures fresh data
            const { data: fullProposal } = await axios.get<Proposal>(`/api/proposals/${proposal.id}`);
            setPdfTargetProposal(fullProposal);
            // The useEffect below will trigger the actual generation once the Editor receives the content
        } catch (error) {
            console.error("Failed to fetch proposal for PDF", error);
            setIsGeneratingPdf(false);
            alert("제안서 내용을 불러오는데 실패했습니다.");
        }
    };

    // Effect to trigger PDF generation when pdfTargetProposal is set and rendered
    useEffect(() => {
        if (pdfTargetProposal && isGeneratingPdf) {
            // Give a small delay for the hidden editor to render the content
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
            }, 1000); // 1 second delay to ensure TipTap renders
            return () => clearTimeout(timer);
        }
    }, [pdfTargetProposal, isGeneratingPdf]);

    const handleCreateProposal = () => {
        createMutation.mutate();
    };

    const handleGenerateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!rfpFile || !noticeFile) return;

        const formData = new FormData();
        formData.append('rfp', rfpFile);
        formData.append('notice', noticeFile);

        generateMutation.mutate(formData);
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
                        onClick={() => setIsAiModalOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        <Sparkles className="w-4 h-4" />
                        AI로 초안 작성
                    </button>
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
                    <p className="text-gray-500 max-w-sm mx-auto mb-6">제안서를 직접 만들거나 AI의 도움을 받아보세요.</p>
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={() => setIsAiModalOpen(true)}
                            className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <Sparkles className="w-4 h-4" />
                            AI로 시작하기
                        </button>
                        <button
                            onClick={handleCreateProposal}
                            disabled={createMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {createMutation.isPending ? '생성 중...' : '빈 제안서 만들기'}
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
                        <Link
                            key={proposal.id}
                            href={`/editor/${proposal.id}`}
                            className="group block bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
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
                                    {format(new Date(proposal.created_at), 'yyyy.MM.dd')} 생성
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
                        </Link>
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
                    <button
                        onClick={() => setIsAiModalOpen(true)}
                        className="group flex flex-col items-center justify-center bg-purple-50 p-6 rounded-xl border-2 border-dashed border-purple-200 hover:border-purple-400 hover:bg-white transition-all min-h-[160px]"
                    >
                        <div className="p-3 bg-white rounded-full text-purple-400 group-hover:text-purple-600 group-hover:shadow-sm transition-all mb-2">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-medium text-purple-600 group-hover:text-purple-700">
                            AI로 초안 작성
                        </span>
                    </button>
                </div>
            )}

            {/* AI Generation Modal */}
            {isAiModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-2 text-purple-700">
                                <Sparkles className="w-5 h-5" />
                                <h3 className="font-bold text-lg">AI 제안서 초안 작성</h3>
                            </div>
                            <button
                                onClick={() => setIsAiModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 text-sm text-purple-800">
                                공고서(Notice)와 제안요청서(RFP) 파일을 업로드하면 AI가 제안서 초안을 자동으로 작성해줍니다.
                            </div>

                            <form onSubmit={handleGenerateSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        공고서 (PDF)
                                        <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={(e) => setNoticeFile(e.target.files?.[0] || null)}
                                            required
                                            className="block w-full text-sm text-slate-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-full file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-blue-50 file:text-blue-700
                                                hover:file:bg-blue-100
                                                border border-gray-300 rounded-lg p-1"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        제안요청서 (RFP) - PDF
                                        <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={(e) => setRfpFile(e.target.files?.[0] || null)}
                                            required
                                            className="block w-full text-sm text-slate-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-full file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-blue-50 file:text-blue-700
                                                hover:file:bg-blue-100
                                                border border-gray-300 rounded-lg p-1"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsAiModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={generateMutation.isPending || !rfpFile || !noticeFile}
                                        className="px-6 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                                    >
                                        {generateMutation.isPending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                분석 및 작성 중...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                제안서 생성하기
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {/* Hidden Editor for PDF Generation */}
            {pdfTargetProposal && (
                <div className="fixed -left-[9999px] top-0 overflow-hidden h-0 w-0">
                    <div id="hidden-pdf-editor" className="bg-white" style={{ width: '800px' }}>
                        <Editor
                            id="pdf-content" // Inner ID used by Editor, but we wrap it
                            initialContent={pdfTargetProposal.content}
                            onChange={() => { }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
