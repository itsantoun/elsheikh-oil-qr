// Prints a generated jsPDF document directly, so the printout matches the
// exported PDF exactly. The PDF is loaded into a hidden iframe and the
// browser's print dialog is opened on it.

// The previous print's frame is only removed when the next print starts —
// removing it earlier can pull the PDF out from under an open print dialog.
let activeFrame = null;
let activeUrl = null;

export const printPdfBlob = (blob) => {
  if (activeFrame) activeFrame.remove();
  if (activeUrl) URL.revokeObjectURL(activeUrl);

  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  Object.assign(frame.style, {
    position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0',
  });
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (err) {
      // Some browsers block printing a PDF from an iframe — fall back to
      // opening it in a new tab where the user can print it.
      console.warn('Direct print failed, opening PDF in a new tab:', err);
      window.open(url, '_blank');
    }
  };

  activeFrame = frame;
  activeUrl = url;
  document.body.appendChild(frame);
};

export const printPdfDoc = (doc) => printPdfBlob(doc.output('blob'));
