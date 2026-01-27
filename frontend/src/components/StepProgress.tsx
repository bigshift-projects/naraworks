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

    // If no overview data and not extracting, show a minimal progress view
    if (!status.overviewExtracted && !overviewData) {
        return (
            <div className="flex flex-col bg-white">
                <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full ${status.pdfUploaded ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={status.pdfUploaded ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                            {status.pdfUploaded ? 'RFP 업로드 완료' : '제안요청서(RFP) 업로드 필요'}
                        </span>
                    </div>
                </div>
                {status.pdfUploaded && (
                    <div className="p-4 border-b border-gray-100">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                            RFP 분석 중...
                        </h3>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-white">
            <div
                className="p-4 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
            >
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    사업개요
                </h3>
                <button className="text-gray-400 hover:text-blue-600 transition-colors">
                    {isOverviewExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {isOverviewExpanded && overviewData && (
                <div className="overflow-y-auto max-h-[400px] animate-in slide-in-from-top-1 duration-200">
                    <div className="p-4 space-y-4 text-xs">
                        {/* Project Name */}
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <span className="text-md text-blue-600 font-bold uppercase tracking-wider block mb-1">사업명</span>
                            <span className="text-sm font-bold text-gray-900">{overviewData.project_name || '-'}</span>
                        </div>

                        {/* Budget & Period */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <span className="text-md text-gray-500 font-bold uppercase tracking-wider block mb-1">예산</span>
                                <span className="font-semibold text-gray-900">{overviewData.budget || '-'}</span>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <span className="text-md text-gray-500 font-bold uppercase tracking-wider block mb-1">기간</span>
                                <span className="font-semibold text-gray-900">{overviewData.period || '-'}</span>
                            </div>
                        </div>

                        {/* Project Summary */}
                        {overviewData.project_summary && (
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <span className="text-md text-gray-500 font-bold uppercase tracking-wider block mb-1">사업 개요</span>
                                <span className="text-gray-900">{overviewData.project_summary}</span>
                            </div>
                        )}

                        {/* Key Objectives */}
                        {overviewData.key_objectives && overviewData.key_objectives.length > 0 && (
                            <div className="space-y-1.5 pb-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">주요 과업</span>
                                <ul className="space-y-1.5">
                                    {overviewData.key_objectives.map((obj, i) => (
                                        <li key={i} className="flex gap-2 text-gray-700 leading-snug">
                                            <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                                            <span>{obj}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
