'use client';

import React, { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { Upload, FileText, Loader2, Trash2, PenTool } from 'lucide-react';
import Link from 'next/link';

interface KnowledgeItem {
    id: string;
    filename: string;
    content_preview: string;
    created_at: string;
}

export default function KnowledgeBasePage() {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');

    // Text Input State
    const [textTitle, setTextTitle] = useState('');
    const [textContent, setTextContent] = useState('');

    const fetchItems = async () => {
        try {
            const res = await axios.get('/api/knowledge');
            setItems(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;

        setIsUploading(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        try {
            await axios.post('/api/knowledge/upload', formData);
            await fetchItems();
        } catch (e: any) {
            console.error(e);
            alert(`업로드 실패: ${e.response?.data?.detail || e.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleTextSubmit = async () => {
        if (!textTitle.trim() || !textContent.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        setIsUploading(true); // Reuse loading state
        try {
            await axios.post('/api/knowledge/text', {
                title: textTitle,
                content: textContent
            });
            await fetchItems();
            setTextTitle('');
            setTextContent('');
        } catch (e: any) {
            console.error(e);
            alert(`등록 실패: ${e.response?.data?.detail || e.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="text-xl font-bold text-gray-900">Naraworks</Link>
                    <span className="text-gray-300">|</span>
                    <h1 className="text-lg font-semibold text-gray-700">지식 베이스 (Knowledge Base)</h1>
                </div>
            </header>

            <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">컨텍스트 문서 추가</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        제안서 작성 시 참조할 수 있는 회사 소개서, 실적 증명서, 기술 문서 등을 등록하세요.
                    </p>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 mb-6">
                        <button
                            className={`px-6 py-3 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('upload')}
                        >
                            <Upload className="w-4 h-4" /> 파일 업로드
                        </button>
                        <button
                            className={`px-6 py-3 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'text' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('text')}
                        >
                            <PenTool className="w-4 h-4" /> 직접 입력
                        </button>
                    </div>

                    {activeTab === 'upload' && (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors min-h-[200px]">
                            {isUploading ? (
                                <div className="flex flex-col items-center">
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                                    <span className="text-gray-600">분석 및 업로드 중...</span>
                                </div>
                            ) : (
                                <>
                                    <input
                                        type="file"
                                        id="kb-upload"
                                        className="hidden"
                                        accept=".pdf,.txt,.md"
                                        onChange={handleFileUpload}
                                    />
                                    <label htmlFor="kb-upload" className="cursor-pointer flex flex-col items-center">
                                        <Upload className="w-10 h-10 text-gray-400 mb-2" />
                                        <span className="text-sm font-medium text-gray-700">파일 선택 (PDF, TXT)</span>
                                    </label>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'text' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">제목 (파일명)</label>
                                <input
                                    type="text"
                                    value={textTitle}
                                    onChange={(e) => setTextTitle(e.target.value)}
                                    placeholder="예: 회사 연혁 및 소개"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                                <textarea
                                    value={textContent}
                                    onChange={(e) => setTextContent(e.target.value)}
                                    placeholder="내용을 입력하세요..."
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-40 resize-none"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={handleTextSubmit}
                                    disabled={isUploading}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    저장하기
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900">등록된 문서 목록</h2>
                        <span className="text-sm text-gray-500">{items.length}개의 문서</span>
                    </div>

                    {isLoading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            등록된 문서가 없습니다.
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {items.map((item) => (
                                <li key={item.id} className="px-6 py-4 hover:bg-gray-50 transition-colors flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className="bg-blue-100 p-2 rounded-lg">
                                            <FileText className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">{item.filename}</h3>
                                            <p className="text-xs text-gray-400 mb-1">{new Date(item.created_at).toLocaleString()}</p>
                                            <p className="text-sm text-gray-600 line-clamp-1">{item.content_preview}</p>
                                        </div>
                                    </div>
                                    {/* Delete button could be added here */}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </main>
        </div>
    );
}
