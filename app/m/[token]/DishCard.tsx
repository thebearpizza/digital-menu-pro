'use client'

import { useState, useEffect } from 'react'
import { allergenNumber } from '@/lib/allergens'

interface DishCardProps {
  dish: {
    id: string
    name: string
    description: string | null
    price: number | null
    category: string | null
    image_url: string | null
    allergens: string[] | null
  }
  allergensList: readonly string[]
  onClose: () => void
}

export function DishCard({ dish, allergensList, onClose }: DishCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Attiva l'espansione subito dopo il mount
    setIsOpen(true)
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    // Attendi la fine dell'animazione prima di chiudere
    setTimeout(onClose, 300)
  }

  // Converti allergen names a numeri e indici
  const allergenNums = dish.allergens
    ? dish.allergens
        .map(name => allergenNumber(name))
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b)
    : []

  const allergenDetails = allergenNums.map(num => ({
    number: num,
    name: allergensList[num - 1] || `Allergene ${num}`,
  }))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1001,
        background: isOpen ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
        transition: 'background-color 0.3s ease',
        display: 'flex',
        alignItems: 'flex-end',
        backdropFilter: isOpen ? 'blur(2px)' : 'none',
      }}
      onClick={handleClose}
    >
      {/* Card espandibile */}
      <div
        style={{
          background: 'white',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxHeight: isOpen ? '90vh' : '60px',
          maxWidth: '600px',
          margin: '0 auto',
          padding: '0',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Contenuto scrollabile - X galleggiante in alto a destra */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            paddingTop: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative',
          }}
        >
          {/* Close button galleggiante sulla parte bianca */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #e5ddd5',
              borderRadius: '50%',
              fontSize: '20px',
              lineHeight: '1',
              cursor: 'pointer',
              color: '#555',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              zIndex: 2,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
            }}
            aria-label="Close"
          >
            ×
          </button>

          {/* Foto - aspect ratio originale (no crop) */}
          {dish.image_url && (
            <img
              src={dish.image_url}
              alt={dish.name}
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '60vh',
                objectFit: 'contain',
                borderRadius: '12px',
                background: '#f0f0f0',
              }}
            />
          )}

          {/* Nome e categoria */}
          <div>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#2c2420',
                margin: '0 0 4px 0',
              }}
            >
              {dish.name}
            </h2>
            {dish.category && (
              <p
                style={{
                  fontSize: '12px',
                  color: '#999',
                  margin: '0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {dish.category}
              </p>
            )}
          </div>

          {/* Descrizione */}
          {dish.description && (
            <p
              style={{
                fontSize: '14px',
                color: '#555',
                lineHeight: '1.6',
                margin: '0',
              }}
            >
              {dish.description}
            </p>
          )}

          {/* Prezzo */}
          {dish.price != null && (
            <div
              style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#8b6f47',
              }}
            >
              EUR {dish.price.toFixed(2)}
            </div>
          )}

          {/* Allergeni */}
          {allergenDetails.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <h3
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  margin: '0 0 8px 0',
                }}
              >
                Allergeni
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                {allergenDetails.map(({ number, name }) => (
                  <span
                    key={number}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      background: '#f5f0eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#555',
                      border: '1px solid #e5ddd5',
                    }}
                  >
                    <span style={{ fontWeight: '700', color: '#8b6f47' }}>{number}.</span>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Abbinamenti consigliati - placeholder */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5ddd5' }}>
            <h3
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#666',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: '0 0 8px 0',
              }}
            >
              Abbinamenti consigliati
            </h3>
            <p
              style={{
                fontSize: '13px',
                color: '#999',
                fontStyle: 'italic',
                margin: '0',
              }}
            >
              Scopri i nostri vini e bevande selezionati per accompagnare questo piatto.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
