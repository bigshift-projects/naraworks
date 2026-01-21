
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
        const dataUrl = await toJpeg(element, {
            quality: 0.5,
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
            // Position the image at (0,0) because margins are included in the image itself
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
