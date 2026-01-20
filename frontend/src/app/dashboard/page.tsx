'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import axios from '@/lib/axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Proposal {
    id: string;
    title: string;
    updated_at: string;
}

const MOCK_PROPOSALS: Proposal[] = [
    {
        id: 'mock-1',
        title: '[목업] 2024년도 AI 바우처 지원사업 제안서',
        updated_at: new Date().toISOString(),
    },
    {
        id: 'mock-2',
        title: '[목업] 공공 클라우드 전환 컨설팅 사업 제안서',
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

export default function DashboardPage() {
    const router = useRouter();
    const { data: proposals, isLoading, error } = useQuery({
        queryKey: ['proposals'],
        queryFn: fetchProposals,
    });

    const mutation = useMutation({
        mutationFn: createProposal,
        onSuccess: (newProposal) => {
            router.push(`/editor/${newProposal.id}`);
        },
    });

    const handleCreateProposal = () => {
        mutation.mutate();
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
                <button
                    onClick={handleCreateProposal}
                    disabled={mutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    새 제안서 작성
                </button>
            </div>

            {(!displayProposals || displayProposals.length === 0) ? (
                <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">작성된 제안서가 없습니다</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mb-6">첫 번째 제안서를 만들어 B2G 사업을 시작해보세요.</p>
                    <button
                        onClick={handleCreateProposal}
                        disabled={mutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {mutation.isPending ? '생성 중...' : '제안서 만들기'}
                    </button>
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
                            <p className="text-sm text-gray-500">
                                {formatDistanceToNow(new Date(proposal.updated_at), { addSuffix: true })} 수정됨
                            </p>
                        </Link>
                    ))}

                    <button
                        onClick={handleCreateProposal}
                        disabled={mutation.isPending}
                        className="group flex flex-col items-center justify-center bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-white transition-all min-h-[160px]"
                    >
                        <div className="p-3 bg-white rounded-full text-gray-400 group-hover:text-blue-600 group-hover:shadow-sm transition-all mb-2">
                            <Plus className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">
                            {mutation.isPending ? '생성 중...' : '새 제안서 추가'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}
