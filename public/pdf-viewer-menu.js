// Menu PDF Viewer - Navigation with arrows integrated in PDF

document.addEventListener('DOMContentLoaded', function() {
  let currentPage = 1
  let totalPages = 1

  // Funzione per aggiornare il numero di pagine
  function updatePageCount() {
    const pdfViewer = PDFViewerApplication.pdfViewer
    if (pdfViewer && pdfViewer.pagesCount) {
      totalPages = pdfViewer.pagesCount
    }
  }

  // Funzione per cambiare pagina
  function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages) return
    currentPage = pageNum
    PDFViewerApplication.pdfViewer.currentPageNumber = currentPage
  }

  // Aggiungi listener per quando il documento è caricato
  const waitForPDF = setInterval(() => {
    if (window.PDFViewerApplication && PDFViewerApplication.eventBus) {
      clearInterval(waitForPDF)

      PDFViewerApplication.eventBus.on('documentloaded', function() {
        updatePageCount()
      })

      PDFViewerApplication.eventBus.on('pagerendered', function() {
        currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
      })

      // Se il documento è già caricato
      if (PDFViewerApplication.pdfDocument) {
        updatePageCount()
      }

      // Aggiungi listener per i click sulle frecce nel PDF
      // Le frecce sono disegnate nel PDF e intercettate come normale input
      document.addEventListener('click', (e) => {
        // Intercetta i click sulla zona sinistra del PDF per pagina precedente
        if (e.clientX < window.innerWidth * 0.15) {
          goToPage(currentPage - 1)
        }
        // Intercetta i click sulla zona destra del PDF per pagina successiva
        else if (e.clientX > window.innerWidth * 0.85) {
          goToPage(currentPage + 1)
        }
      })
    }
  }, 100)
})
