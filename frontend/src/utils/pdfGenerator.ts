
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

export const generatePdf = async (elementId: string, filename: string) => {
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`Element with id ${elementId} not found`);

    try {
        // Temporarily hide page break lines for PDF export
        const originalBackground = element.style.backgroundImage;
        element.style.backgroundImage = 'none';

        // Capture as JPEG with 0.5 quality for better compression
        // FIX: html-to-image doesn't capture CSS counters correctly (shows 0).
        // We manually inject styles to force the correct numbers.
        const pageNumbers = element.querySelectorAll('.rm-page-number');
        const tempStyleId = 'pdf-export-styles';
        let styleEl = document.getElementById(tempStyleId) as HTMLStyleElement;

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = tempStyleId;
            document.head.appendChild(styleEl);
        }

        let cssRules = '';
        pageNumbers.forEach((el, index) => {
            const pageNum = index + 1;
            const uniqueClass = `pdf-page-${pageNum}`;
            el.classList.add(uniqueClass);
            // Force the content to be the hardcoded page number
            cssRules += `
                .rm-page-number.${uniqueClass}::before {
                    content: "${pageNum}" !important;
                }
            `;
        });
        styleEl.innerHTML = cssRules;

        const dataUrl = await toJpeg(element, {
            quality: 0.8,
            backgroundColor: '#ffffff',
            width: 800,
            style: {
                border: 'none',
                boxShadow: 'none',
                borderRadius: '0',
                margin: '0',
                width: '800px',
                backgroundImage: 'none',
            },
        });

        // Cleanup: Remove temporary classes and style element
        pageNumbers.forEach((el, index) => {
            el.classList.remove(`pdf-page-${index + 1}`);
        });
        if (styleEl) {
            styleEl.remove();
        }

        // Restore page break lines
        element.style.backgroundImage = originalBackground;

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const imgProps = pdf.getImageProperties(dataUrl);
        const ratio = imgProps.height / imgProps.width;
        const imgWidth = pdfWidth;
        const imgHeight = pdfWidth * ratio;

        // Multi-page handling: split content across multiple A4 pages
        let heightLeft = imgHeight;
        let position = 0;
        let pageNumber = 0;

        while (heightLeft > 0) {
            if (pageNumber > 0) {
                pdf.addPage();
            }
            // Position the image
            pdf.addImage(dataUrl, 'JPEG', 0, -position, imgWidth, imgHeight, undefined, 'FAST');
            position += pdfHeight;
            heightLeft -= pdfHeight;
            pageNumber++;
        }

        pdf.save(`${filename}.pdf`);
    } catch (error) {
        console.error('PDF Export failed:', error);
        throw error;
    }
};
