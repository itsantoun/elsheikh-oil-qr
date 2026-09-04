import elsheikhLogo from '../assets/elsheikh-logo.png';

const BRAND_BLUE = [25, 58, 130];
const TEXT_DARK = [22, 31, 45];
const TEXT_MUTED = [91, 104, 124];
const BORDER = [218, 226, 238];
const SOFT_BG = [245, 249, 253];
const TOTALS_BOTTOM_RESERVE = 30;

let logoDataUrlPromise = null;

const loadLogoDataUrl = () => {
  if (logoDataUrlPromise) return logoDataUrlPromise;

  logoDataUrlPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = elsheikhLogo;
  });

  return logoDataUrlPromise;
};

export const money = (value) =>
  `$${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const createReceiptDoc = (jsPDF, { orientation = 'landscape', format = 'a5' } = {}) =>
  new jsPDF({ orientation, unit: 'mm', format });

export const addReceiptHeader = async (doc, {
  title = 'RECEIPT',
  subtitle = '',
  receiptNo = '',
  client = '',
  dateRange = '',
  issuedAt = new Date(),
  showLogo = true,
  // Controls the "El Sheikh" name fallback + phone/address lines. When
  // false, that whole block is left blank (background box still shows).
  showCompanyInfo = true,
  showReceiptNo = true,
  showDateRangeLabel = true,
} = {}) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  doc.setFillColor(...SOFT_BG);
  doc.roundedRect(margin, 6, pageWidth - margin * 2, 35, 3, 3, 'F');

  const drawNameFallback = () => {
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...BRAND_BLUE);
    doc.text('El Sheikh', margin + 23, 21, { align: 'center' });
  };

  if (showLogo) {
    try {
      const logoDataUrl = await loadLogoDataUrl();
      doc.addImage(logoDataUrl, 'PNG', margin + 5, 7, 36, 22.5);
    } catch (error) {
      if (showCompanyInfo) drawNameFallback();
    }
  } else if (showCompanyInfo) {
    drawNameFallback();
  }

  if (showCompanyInfo) {
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text('+961 81 708 870', margin + 23, 33.5, { align: 'center' });
    doc.text('Nabay, Lebanon', margin + 23, 37, { align: 'center' });
  }

  doc.setFontSize(17);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...BRAND_BLUE);
  doc.text(title, pageWidth - margin - 3, 16, { align: 'right' });

  if (subtitle) {
    doc.setFontSize(8.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(subtitle, pageWidth - margin - 3, 22, { align: 'right' });
  }

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.line(pageWidth - 76, 27, pageWidth - margin - 3, 27);

  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  const issuedY = showReceiptNo ? 37 : 34.5;
  if (showReceiptNo) {
    doc.text('Receipt No.', pageWidth - 76, 32);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont(undefined, 'bold');
    doc.text(receiptNo || '-', pageWidth - margin - 3, 32, { align: 'right' });
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont(undefined, 'normal');
  }
  doc.text('Issued', pageWidth - 76, issuedY);
  doc.setTextColor(...TEXT_DARK);
  doc.setFont(undefined, 'bold');
  doc.text(formatIssuedAt(issuedAt), pageWidth - margin - 3, issuedY, { align: 'right' });

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 44, pageWidth - margin * 2, 11.5, 2, 2, 'F');
  doc.setDrawColor(...BORDER);
  doc.roundedRect(margin, 44, pageWidth - margin * 2, 11.5, 2, 2, 'S');

  doc.setFontSize(7.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Bill To', margin + 4, 48.5);
  if (showDateRangeLabel) doc.text('Date Range', pageWidth / 2, 48.5);
  const dateRangeY = showDateRangeLabel ? 53 : 50.5;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text(client || 'All Clients', margin + 4, 53);
  doc.text(dateRange || '-', pageWidth / 2, dateRangeY);

  return 59;
};

// `scale` lets a caller with more page real estate (e.g. Client Reports on
// A4 instead of the default A5) ask for uniformly larger text without
// changing the row-count thresholds that decide when to compact at all.
export const getReceiptDensity = (rowCount, scale = 1) => {
  if (rowCount > 18) return { fontSize: 6.4 * scale, verticalPadding: 0.7 * scale, totalsCompact: true };
  if (rowCount > 12) return { fontSize: 7 * scale, verticalPadding: 1 * scale, totalsCompact: true };
  return { fontSize: 8 * scale, verticalPadding: 1.6 * scale, totalsCompact: false };
};

export const receiptTableOptions = ({
  head,
  body,
  startY,
  rightAlignedColumns = [],
  density = getReceiptDensity(body.length),
  // Reserves space at the top of page 2+ for a repeating header (e.g. the
  // client's name), drawn via `onPageDraw` below — 0 keeps the old
  // behavior where the table butts right up against the top margin.
  topMargin = 0,
  // Called on every page as autoTable draws it (including page 1), after
  // the built-in footer logic — use it to draw a repeating per-page header.
  onPageDraw,
}) => ({
  head: [head],
  body,
  startY,
  margin: { left: 10, right: 10, bottom: TOTALS_BOTTOM_RESERVE, top: topMargin },
  theme: 'plain',
  tableLineColor: BORDER,
  tableLineWidth: 0.2,
  styles: {
    fontSize: density.fontSize,
    cellPadding: { top: density.verticalPadding, right: 1.8, bottom: density.verticalPadding, left: 1.8 },
    textColor: TEXT_DARK,
    lineColor: BORDER,
    lineWidth: 0.15,
    overflow: 'linebreak',
  },
  headStyles: {
    fillColor: BRAND_BLUE,
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    halign: 'left',
  },
  alternateRowStyles: {
    fillColor: [250, 252, 255],
  },
  columnStyles: rightAlignedColumns.reduce((acc, col) => {
    acc[col] = { halign: 'right' };
    return acc;
  }, {}),
  didDrawPage: (data) => {
    const pageCount = docPageCount(data.doc);
    if (pageCount > 1) drawPageFooter(data.doc);
    if (onPageDraw) onPageDraw(data);
  },
});

export const drawTotalsBlock = (doc, {
  paid = 0,
  unpaid = 0,
  grandTotal = 0,
  startY,
  compact = false,
  // When false, the Paid/Unpaid breakdown lines are dropped — only Grand
  // Total is shown, with the Paid + Unpaid formula printed as a small caption.
  showBreakdown = true,
} = {}) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
  const minY = currentPage > 1 ? 16 : 0;
  const boxH = showBreakdown ? (compact ? 18 : 20) : (compact ? 16 : 18);
  let y = Math.max(startY, minY);
  const requiredBottom = boxH + 10;
  if (y > pageHeight - requiredBottom) {
    const pageCount = docPageCount(doc);
    if (pageCount === 1 && currentPage === 1) {
      y = pageHeight - requiredBottom;
    } else {
      doc.addPage();
      y = 16;
    }
  }

  if (showBreakdown) {
    const boxX = pageWidth - 76;
    const boxW = 66;
    doc.setFillColor(...SOFT_BG);
    doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'F');
    doc.setDrawColor(...BORDER);
    doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'S');

    drawTotalLine(doc, 'Paid', paid, boxX + 4, y + 5, boxW);
    drawTotalLine(doc, 'Unpaid', unpaid, boxX + 4, y + 9.8, boxW);

    doc.setDrawColor(...BORDER);
    doc.line(boxX + 4, y + 12.4, boxX + boxW - 4, y + 12.4);
    doc.setFontSize(compact ? 9 : 10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...BRAND_BLUE);
    doc.text('Grand Total', boxX + 4, y + 17);
    doc.text(money(grandTotal), boxX + boxW - 4, y + 17, { align: 'right' });
  } else {
    // Full-width banner under the item listing — Grand Total is the headline
    // figure here, deliberately much larger than the per-line item prices.
    const margin = 10;
    const boxX = margin;
    const boxW = pageWidth - margin * 2;
    doc.setFillColor(...SOFT_BG);
    doc.roundedRect(boxX, y, boxW, boxH, 2.5, 2.5, 'F');
    doc.setDrawColor(...BORDER);
    doc.roundedRect(boxX, y, boxW, boxH, 2.5, 2.5, 'S');

    doc.setFontSize(compact ? 12 : 14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...BRAND_BLUE);
    doc.text('GRAND TOTAL', boxX + 6, y + boxH / 2 + 3, { align: 'left' });

    doc.setFontSize(compact ? 18 : 22);
    doc.text(money(grandTotal), boxX + boxW - 6, y + boxH / 2 + 3, { align: 'right' });
  }

  drawPageFooter(doc);
};

const drawTotalLine = (doc, label, value, x, y, width) => {
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...TEXT_MUTED);
  doc.text(label, x, y);
  doc.setTextColor(...TEXT_DARK);
  doc.text(money(value), x + width - 8, y, { align: 'right' });
};

// Repeated on every page after the first (which already has the full
// `addReceiptHeader` branded header) — a slim band naming the client and
// noting the page number, so a multi-page report is still identifiable
// after being separated from page 1.
export const drawContinuationHeader = (doc, { title = 'CLIENT REPORT', client = '' } = {}) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const bandH = 12;

  doc.setFillColor(...SOFT_BG);
  doc.roundedRect(margin, 6, pageWidth - margin * 2, bandH, 2, 2, 'F');
  doc.setDrawColor(...BORDER);
  doc.roundedRect(margin, 6, pageWidth - margin * 2, bandH, 2, 2, 'S');

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...BRAND_BLUE);
  doc.text(title, margin + 4, 6 + bandH / 2 + 1.5);

  doc.setFontSize(9.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...TEXT_DARK);
  doc.text(`Client: ${client || 'All Clients'}`, pageWidth - margin - 4, 6 + bandH / 2 + 1.5, { align: 'right' });
};

export const drawPageFooter = (doc) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - 10, pageHeight - 6, { align: 'right' });
};

const docPageCount = (doc) => {
  if (doc.internal?.getNumberOfPages) return doc.internal.getNumberOfPages();
  return doc.internal.pages?.length ? doc.internal.pages.length - 1 : 1;
};

const formatIssuedAt = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
};
