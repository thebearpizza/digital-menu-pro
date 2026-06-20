// Shared types and defaults for embedded info/allergen pages.
// Not a server action file — safe to import from both server and client components.

export const ALLERGENI_DEFAULT_TEXT = `ALLERGENI

Secondo il Regolamento UE 1169/2011, gli ingredienti e le sostanze che possono causare allergie o intolleranze devono essere riconoscibili nell'elenco degli ingredienti.

I 14 allergeni principali:

1. Cereali contenenti glutine (frumento, segale, orzo, avena, farro, kamut e i loro prodotti derivati)
2. Crostacei e prodotti a base di crostacei
3. Uova e prodotti a base di uova
4. Pesce e prodotti a base di pesce
5. Arachidi e prodotti a base di arachidi
6. Soia e prodotti a base di soia
7. Latte e prodotti a base di latte (incluso il lattosio)
8. Frutta a guscio: mandorle, nocciole, noci comuni, noci di acagiù, noci di pecan, noci del Brasile, pistacchi, noci macadamia e i loro prodotti
9. Sedano e prodotti a base di sedano
10. Senape e prodotti a base di senape
11. Semi di sesamo e prodotti a base di semi di sesamo
12. Anidride solforosa e solfiti in concentrazioni superiori a 10 mg/kg o 10 mg/L espressi come SO2
13. Lupini e prodotti a base di lupini
14. Molluschi e prodotti a base di molluschi

Per qualsiasi informazione sugli allergeni presenti nei nostri piatti, il nostro staff è a vostra disposizione.`

export interface EmbeddedPageContent {
  enabled:    boolean
  position:   'first' | 'last'
  body:       string
  font:       string
  fontSize:   number
  align:      'left' | 'center' | 'right'
  color:      string
  bold:       boolean
  italic:     boolean
  lineHeight: number
}

export interface MenuExtraPages {
  info:     EmbeddedPageContent
  allergen: EmbeddedPageContent
}

export function defaultExtraPages(): MenuExtraPages {
  return {
    info: {
      enabled: false, position: 'first',
      body: '', font: 'Helvetica', fontSize: 12,
      align: 'left', color: '#1a1a1a', bold: false, italic: false, lineHeight: 1.6,
    },
    allergen: {
      enabled: false, position: 'last',
      body: ALLERGENI_DEFAULT_TEXT, font: 'Helvetica', fontSize: 11,
      align: 'left', color: '#1a1a1a', bold: false, italic: false, lineHeight: 1.5,
    },
  }
}
