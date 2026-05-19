// Dish selection for PDF viewer - tap dishes to view details

document.addEventListener('DOMContentLoaded', function() {
  const params = new URLSearchParams(window.location.search)
  const fileParam = params.get('file')

  let menuId = ''
  let token = ''

  if (fileParam && fileParam.includes('menu-pdf')) {
    const urlParams = new URLSearchParams(new URL(fileParam, window.location.origin).search)
    menuId = urlParams.get('menuId')
    token = urlParams.get('token')
  }

  let dishes = []
  let currentPage = 1

  // Carica i piatti
  async function loadDishes() {
    try {
      if (!menuId || !token) return

      const response = await fetch(`/api/menu-dishes?menuId=${menuId}&token=${token}`)
      if (!response.ok) return

      const data = await response.json()
      dishes = data.dishes || []

      // Intercetta i click sulla pagina per mostrare i piatti
      document.addEventListener('click', handlePageClick)

      // Ascolta i cambiamenti di pagina
      waitForPageChange()
    } catch (error) {
      console.log('Unable to load dishes:', error)
    }
  }

  function waitForPageChange() {
    const checkPage = setInterval(() => {
      if (window.PDFViewerApplication && PDFViewerApplication.pdfViewer) {
        const newPage = PDFViewerApplication.pdfViewer.currentPageNumber
        if (newPage !== currentPage) {
          currentPage = newPage
        }
      }
    }, 500)
  }

  function handlePageClick(e) {
    // Non aprire modal se clicchi su frecce o elementi speciali
    if (e.target.closest('.nav-arrow') || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
      return
    }

    // Ignora click su altri elementi
    if (e.target.closest('#viewerContainer') === null) {
      return
    }

    // Mostra menu piatti quando clicchi sulla pagina
    showDishesForPage()
  }

  function showDishesForPage() {
    if (dishes.length === 0) return

    // Crea modal overlay
    const modal = document.createElement('div')
    modal.id = 'dishes-modal'
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: flex-end;
      z-index: 2000;
      padding: 0;
    `

    const content = document.createElement('div')
    content.style.cssText = `
      background: white;
      width: 100%;
      max-height: 75vh;
      border-radius: 16px 16px 0 0;
      overflow-y: auto;
      padding: 20px;
      box-shadow: 0 -4px 12px rgba(0,0,0,0.15);
    `

    let html = '<h2 style="margin: 0 0 16px 0; color: #2a1d16;">Piatti</h2>'
    html += '<div style="display: grid; gap: 10px;">'

    for (const dish of dishes) {
      const desc = dish.description || ''
      const shortDesc = desc.length > 40 ? desc.substring(0, 40) + '...' : desc
      html += `
        <div class="dish-item" data-id="${dish.id}" data-name="${dish.name}" data-desc="${desc}" data-price="${dish.price || 0}"
             style="border: 1px solid #ddd; padding: 12px; border-radius: 8px; cursor: pointer; background: #f9f9f9; transition: all 0.2s;">
          <div style="font-weight: bold; color: #2a1d16;">${dish.name}</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">${shortDesc}</div>
          ${dish.price ? `<div style="color: #8b4513; font-weight: bold; margin-top: 4px;">€ ${(dish.price).toFixed(2)}</div>` : ''}
        </div>
      `
    }

    html += '</div>'
    content.innerHTML = html
    modal.appendChild(content)

    // Aggiungi event listener ai piatti
    content.querySelectorAll('.dish-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation()
        const id = item.getAttribute('data-id')
        const name = item.getAttribute('data-name')
        const desc = item.getAttribute('data-desc')
        const price = item.getAttribute('data-price')

        modal.remove()
        showDishDetail(name, desc, price)
      })

      // Hover effect
      item.addEventListener('mouseenter', () => {
        item.style.background = '#f0e8dc'
        item.style.borderColor = '#8b4513'
      })
      item.addEventListener('mouseleave', () => {
        item.style.background = '#f9f9f9'
        item.style.borderColor = '#ddd'
      })
    })

    // Chiudi modal al click esterno
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })

    document.body.appendChild(modal)
  }

  function showDishDetail(name, description, price) {
    const modal = document.createElement('div')
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    `

    const card = document.createElement('div')
    card.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `

    const priceNum = parseFloat(price)
    const priceHtml = priceNum > 0 ? `<div style="color: #8b4513; font-weight: bold; font-size: 18px; margin: 12px 0;">€ ${priceNum.toFixed(2)}</div>` : ''

    card.innerHTML = `
      <h2 style="margin: 0 0 12px 0; color: #2a1d16;">${name}</h2>
      <p style="color: #5c4a3a; line-height: 1.6; margin: 0 0 16px 0;">${description}</p>
      ${priceHtml}
      <button onclick="this.closest('div').parentElement.remove()"
              style="background: #2a1d16; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; font-weight: bold;">
        Chiudi
      </button>
    `

    modal.appendChild(card)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })

    document.body.appendChild(modal)
  }

  loadDishes()
})
