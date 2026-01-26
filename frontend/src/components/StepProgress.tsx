import { Check, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface StepProgressProps {
    step: number;
    // Status object to track granular progress within steps
    status: {
        pdfUploaded: boolean;
        overviewExtracted: boolean;
        // Add more status flags as needed for future steps
    };
    // The extracted overview data to display
    overviewData?: {
        project_name?: string;
        period?: string;
        budget?: string;
        key_objectives?: string[]; // Major Tasks
        project_summary?: string; // 10-line summary
        [key: string]: any;
    };
}

export default function StepProgress({ step, status, overviewData }: StepProgressProps) {
    const [isOverviewExpanded, setIsOverviewExpanded] = useState(true);

    return (
        <div className="flex flex-col h-full bg-gray-50 border-t border-gray-200">
            <div className="p-4 border-b border-gray-200 bg-white">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs">1</span>
                    Step 1: RFP 분석 및 개요
                </h3>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* 1. PDF Upload Status */}
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${status.pdfUploaded ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                    <div className={`p-2 rounded-full ${status.pdfUploaded ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {status.pdfUploaded ? (
                            <Check className="w-4 h-4 text-green-600" />
                        ) : (
                            <FileText className="w-4 h-4 text-gray-400" />
                        )}
                    </div>
                    <div className="flex-1">
                        <p className={`text-sm font-medium ${status.pdfUploaded ? 'text-gray-900' : 'text-gray-500'}`}>
                            제안요청서(RFP) 업로드
                        </p>
                    </div>
                </div>

                {/* 2. Overview Extraction Status */}
                <div className={`flex flex-col rounded-lg border transition-all ${status.overviewExtracted
                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'bg-white border-gray-200'
                    }`}>
                    <div className="flex items-center gap-3 p-3">
                        <div className={`p-2 rounded-full ${status.overviewExtracted ? 'bg-blue-100' :
                            step === 1 && status.pdfUploaded ? 'bg-blue-50 animate-pulse' : 'bg-gray-100'
                            }`}>
                            {status.overviewExtracted ? (
                                <Check className="w-4 h-4 text-blue-600" />
                            ) : step === 1 && status.pdfUploaded ? (
                                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            ) : (
                                <FileText className="w-4 h-4 text-gray-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${status.overviewExtracted ? 'text-gray-900' : 'text-gray-500'}`}>
                                사업개요 추출
                            </p>
                        </div>
                        {status.overviewExtracted && overviewData && (
                            <button
                                onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
                                className="p-1 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
                            >
                                {isOverviewExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        )}
                    </div>

                    {/* Extracted Overview Details */}
                    {status.overviewExtracted && overviewData && isOverviewExpanded && (
                        <div className="px-4 pb-4 animate-in slide-in-from-top-2 fade-in duration-300">
                            <div className="bg-white rounded-md border border-blue-100 p-3 text-xs space-y-3">
                                {/* Basic Info */}
                                <div className="space-y-2 pb-2 border-b border-gray-100">
                                    <div>
                                        <span className="text-gray-500 block mb-0.5">사업명</span>
                                        <span className="font-medium text-gray-900">{overviewData.project_name || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-gray-500 block mb-0.5">예산</span>
                                            <span className="font-medium text-gray-900">{overviewData.budget || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block mb-0.5">기간</span>
                                            <span className="font-medium text-gray-900">{overviewData.period || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Project Summary */}
                                {overviewData.project_summary && (
                                    <div className="pb-2 border-b border-gray-100">
                                        <span className="text-gray-500 block mb-1">사업 개요 (요약)</span>
                                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {overviewData.project_summary}
                                        </p>
                                    </div>
                                )}

                                {/* Major Tasks */}
                                <div>
                                    <span className="text-gray-500 block mb-1">주요 과업</span>
                                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                                        {overviewData.key_objectives?.map((obj, i) => (
                                            <li key={i} className="leading-tight">{obj}</li>
                                        )) || <li className="text-gray-400 italic">추출된 과업 없음</li>}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
