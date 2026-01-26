'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axios';

export default function NewProposalPage() {
    const router = useRouter();
    const [step, setStep] = useState<'upload' | 'parsing' | 'review' | 'creating'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [toc, setToc] = useState<any[]>([]);
    const [overview, setOverview] = useState<any>(null);
    const [rfpText, setRfpText] = useState('');
    const [title, setTitle] = useState('');
    const [proposalId, setProposalId] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleParse = async () => {
        if (!file) return;
        setStep('parsing');

        try {
            // 1. Create a placeholder proposal first
            const { data: newProposal } = await axios.post('/api/proposals', {
                title: file.name.replace('.pdf', '') + ' (분석 중)',
                content: '',
                user_id: '00000000-0000-0000-0000-000000000000',
            });

            const pId = newProposal.id;
            setProposalId(pId);

            // 2. Parse RFP with the proposal ID
            const formData = new FormData();
            formData.append('rfp', file);
            formData.append('proposal_id', pId);

            const { data } = await axios.post('/api/generation/parse-rfp', formData);

            if (data.toc) {
                setToc(data.toc);
                setOverview(data.overview);
                setRfpText(data.rfp_text);
                setStep('review');
                setTitle(data.overview?.project_name || file.name.replace('.pdf', '') + ' 제안서');
            } else {
                alert('Could not generate TOC');
                setStep('upload');
            }
        } catch (e) {
            console.error(e);
            alert('Error parsing PDF');
            setStep('upload');
        }
    };

    const handleCreate = async () => {
        setStep('creating');
        try {
            let pId = proposalId;

            if (!pId) {
                // If it was a "skip" (blank proposal)
                const { data: newProposal } = await axios.post('/api/proposals', {
                    title: title || '새 제안서',
                    content: '',
                    user_id: '00000000-0000-0000-0000-000000000000',
                    toc: toc,
                    status: 'toc_generated'
                });
                pId = newProposal.id;
            } else {
                // Update existing proposal with final TOC and title
                await axios.put(`/api/proposals/${pId}`, {
                    title,
                    toc,
                    status: 'toc_generated'
                });
            }

            // Redirect to editor
            router.push(`/editor/${pId}`);
        } catch (e) {
            console.error(e);
            alert('Error creating proposal');
            setStep('review');
        }
    };

    const updateSectionRaw = (index: number, field: string, value: string) => {
        const newToc = [...toc];
        newToc[index] = { ...newToc[index], [field]: value };
        setToc(newToc);
    };


    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-20">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-10 min-h-[600px]">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">새 제안서 시작하기</h1>
                <p className="text-gray-500 mb-10">RFP를 분석하여 제안서 목차를 자동으로 생성합니다.</p>

                {step === 'upload' && (
                    <>
                        <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                <span className="text-6xl mb-4">📄</span>
                                <span className="text-lg font-medium text-gray-700">
                                    {file ? file.name : "RFP(제안요청서) PDF 파일을 업로드하세요"}
                                </span>
                                <span className="text-sm text-gray-400 mt-2">클릭하여 파일 선택</span>
                            </label>

                            {file && (
                                <button
                                    onClick={handleParse}
                                    className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                                >
                                    RFP 분석 및 목차 생성
                                </button>
                            )}
                        </div>
                        <div className="mt-6 flex justify-center">
                            <button
                                onClick={() => {
                                    setToc([]);
                                    setTitle("새 제안서");
                                    handleCreate();
                                }}
                                className="text-gray-500 hover:text-gray-700 text-sm underline"
                            >
                                건너뛰고 빈 제안서 생성하기
                            </button>
                        </div>
                    </>
                )}

                {step === 'parsing' && (
                    <div className="flex flex-col items-center justify-center h-96">
                        <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 text-blue-600 border-t-blue-600 animate-spin"></div>
                        <h2 className="text-xl font-semibold text-gray-800">RFP 분석 중...</h2>
                        <p className="text-gray-500 mt-2">AI가 문서 구조를 파악하고 목차를 생성하고 있습니다.</p>
                    </div>
                )}

                {step === 'review' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="mb-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
                            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                                <span>📋</span> 사업 개요 분석 결과
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-blue-600 font-semibold block mb-1">사업명</span>
                                    <p className="text-gray-800 bg-white p-2 rounded border border-blue-100">{overview?.project_name || '-'}</p>
                                </div>
                                <div>
                                    <span className="text-blue-600 font-semibold block mb-1">사업 기간</span>
                                    <p className="text-gray-800 bg-white p-2 rounded border border-blue-100">{overview?.period || '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-blue-600 font-semibold block mb-1">사업 예산</span>
                                    <p className="text-gray-800 bg-white p-2 rounded border border-blue-100">{overview?.budget || '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-blue-600 font-semibold block mb-1">사업 개요 (요약)</span>
                                    <p className="text-gray-800 bg-white p-2 rounded border border-blue-100 whitespace-pre-wrap">{overview?.project_summary || '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-blue-600 font-semibold block mb-1">주요 과업</span>
                                    <ul className="list-disc list-inside bg-white p-3 rounded border border-blue-100 space-y-1">
                                        {overview?.key_objectives?.map((obj: string, i: number) => (
                                            <li key={i} className="text-gray-700">{obj}</li>
                                        )) || <li className="text-gray-400">추출된 목표 없음</li>}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">제안서 제목</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="mb-4 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-800">생성된 목차 (수정 가능)</h3>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">AI Generated</span>
                        </div>


                        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                            {toc.map((section, idx) => (
                                <div key={idx} className="p-4 border-b border-gray-100 bg-white hover:bg-blue-50 transition-colors group">
                                    <div className="flex gap-4">
                                        <span className="text-gray-400 font-mono w-6 pt-2">{idx + 1}</span>
                                        <div className="flex-1 space-y-2">
                                            <input
                                                type="text"
                                                value={section.title}
                                                onChange={(e) => updateSectionRaw(idx, 'title', e.target.value)}
                                                className="w-full font-semibold text-gray-800 bg-transparent border-none focus:ring-0 p-0 placeholder-gray-400"
                                                placeholder="섹션 제목"
                                            />
                                            <textarea
                                                value={section.description || ''}
                                                onChange={(e) => updateSectionRaw(idx, 'description', e.target.value)}
                                                className="w-full text-sm text-gray-600 bg-transparent border-none focus:ring-0 p-0 resize-none h-12 placeholder-gray-400"
                                                placeholder="이 섹션에 들어갈 내용 설명..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={() => setStep('upload')}
                                className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
                            >
                                다시 업로드
                            </button>
                            <button
                                onClick={handleCreate}
                                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5"
                            >
                                제안서 생성 시작하기
                            </button>
                        </div>
                    </div>
                )}

                {step === 'creating' && (
                    <div className="flex flex-col items-center justify-center h-96">
                        <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 text-green-500 border-t-green-500 animate-spin"></div>
                        <h2 className="text-xl font-semibold text-gray-800">제안서 생성 중...</h2>
                        <p className="text-gray-500 mt-2">편집기로 이동합니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
