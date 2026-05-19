// Dish selection modal for PDF viewer

document.addEventListener('DOMContentLoaded', function() {
  const params = new URLSearchParams(window.location.search)
  const fileParam = params.get('file')

  // Estrai menuId e token dall'URL del file
  let menuId = ''
  let token = ''

  if (fileParam && fileParam.includes('menu-pdf')) {
    const urlParams = new URLSearchParams(new URL(fileParam, window.location.origin).search)
    menuId = urlParams.get('menuId')
    token = urlParams.get('token')
  }

  let dishes = []
  let currentCategory = ''

  // Carica i piatti
  async function loadDishes() {
    try {
      if (!menuId || !token) return

      const response = await fetch(`/api/menu-dishes?menuId=${menuId}&token=${token}`)
      if (!response.ok) return

      const data = await response.json()
      dishes = data.dishes || []
      currentCategory = data.category || ''
      createDishButton()
    } catch (error) {
      console.log('Unable to load dishes:', error)
    }
  }

  // Crea bottone per aprire modal piatti
  function createDishButton() {
    if (dishes.length === 0) return

    const btn = document.createElement('div')
    btn.id = 'dishes-button'
    btn.innerHTML = '📋'
    btn.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #333;
      border-radius: 8px;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 999;
      user-select: none;
    `
    btn.onclick = openDishesModal
    document.body.appendChild(btn)
  }

  // Apri modal con lista piatti
  function openDishesModal() {
    const modal = document.createElement('div')
    modal.id = 'dishes-modal'
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: flex-end;
      z-index: 2000;
    `

    const content = document.createElement('div')
    content.style.cssText = `
      background: white;
      width: 100%;
      max-height: 80vh;
      border-radius: 12px 12px 0 0;
      overflow-y: auto;
      padding: 20px;
    `

    let html = `<h2>${currentCategory || 'Piatti'}</h2>`
    html += '<div style="display: grid; gap: 12px;">'

    for (const dish of dishes) {
      html += `
        <div onclick="selectDish('${dish.id}', '${dish.name.replace(/'/g, "\\'")}', '${(dish.description || '').replace(/'/g, "\\'")}')"
             style="border: 1px solid #ddd; padding: 12px; border-radius: 8px; cursor: pointer; background: #f9f9f9;">
          <div style="font-weight: bold;">${dish.name}</div>
          <div style="font-size: 12px; color: #666;">${dish.description?.substring(0, 50)}${(dish.description?.length || 0) > 50 ? '...' : ''}</div>
          ${dish.price ? `<div style="color: #8b4513; font-weight: bold;">€ ${(dish.price).toFixed(2)}</div>` : ''}
        </div>
      `
    }

    html += '</div>'
    content.innerHTML = html
    modal.appendChild(content)

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove()
    }

    document.body.appendChild(modal)
  }

  window.selectDish = function(id, name, description) {
    const modal = document.getElementById('dishes-modal')
    if (modal) modal.remove()

    // Crea modal con dettagli piatto
    const detailModal = document.createElement('div')
    detailModal.style.cssText = `
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
      padding: 20px;
      max-width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    `

    card.innerHTML = `
      <h2>${name}</h2>
      <p style="color: #666;">${description}</p>
      <button onclick="this.closest('div').parentElement.remove()"
              style="background: #333; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
        Chiudi
      </button>
    `

    detailModal.appendChild(card)
    detailModal.onclick = (e) => {
      if (e.target === detailModal) detailModal.remove()
    }

    document.body.appendChild(detailModal)
  }

  loadDishes()
})
