// Menu PDF Viewer - Navigation and Product Click Handler

document.addEventListener('DOMContentLoaded', function() {
  let currentPage = 1
  let totalPages = 1

  // Funzione per aggiornare il numero di pagine
  function updatePageCount() {
    const pdfViewer = PDFViewerApplication.pdfViewer
    if (pdfViewer && pdfViewer.pagesCount) {
      totalPages = pdfViewer.pagesCount
      updateNavButtons()
    }
  }

  // Funzione per aggiornare stato dei bottoni
  function updateNavButtons() {
    const prevBtn = document.querySelector('.nav-arrow.prev')
    const nextBtn = document.querySelector('.nav-arrow.next')

    if (prevBtn) {
      if (currentPage <= 1) {
        prevBtn.classList.add('disabled')
      } else {
        prevBtn.classList.remove('disabled')
      }
    }

    if (nextBtn) {
      if (currentPage >= totalPages) {
        nextBtn.classList.add('disabled')
      } else {
        nextBtn.classList.remove('disabled')
      }
    }
  }

  // Funzione per cambiare pagina
  function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages) return
    currentPage = pageNum
    PDFViewerApplication.pdfViewer.currentPageNumber = currentPage
    updateNavButtons()
  }

  // Crea i bottoni di navigazione
  function createNavButtons() {
    const prevBtn = document.createElement('div')
    prevBtn.className = 'nav-arrow prev'
    prevBtn.innerHTML = '&#10094;'
    prevBtn.onclick = () => goToPage(currentPage - 1)
    document.body.appendChild(prevBtn)

    const nextBtn = document.createElement('div')
    nextBtn.className = 'nav-arrow next'
    nextBtn.innerHTML = '&#10095;'
    nextBtn.onclick = () => goToPage(currentPage + 1)
    document.body.appendChild(nextBtn)
  }

  // Aggiorna pagina corrente quando cambia
  const observer = setInterval(() => {
    if (PDFViewerApplication && PDFViewerApplication.pdfViewer) {
      currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
      updateNavButtons()
      clearInterval(observer)
    }
  }, 100)

  // Aspetta che PDFViewerApplication sia pronto
  const waitForPDF = setInterval(() => {
    if (window.PDFViewerApplication && PDFViewerApplication.eventBus) {
      clearInterval(waitForPDF)

      // Aggiungi listener per quando il documento è caricato
      PDFViewerApplication.eventBus.on('documentloaded', function() {
        updatePageCount()
        createNavButtons()
      })

      // Aggiungi listener per quando la pagina cambia
      PDFViewerApplication.eventBus.on('pagerendered', function() {
        currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
        updateNavButtons()
      })

      // Se il documento è già caricato
      if (PDFViewerApplication.pdfDocument) {
        updatePageCount()
        createNavButtons()
      }
    }
  }, 100)
})
