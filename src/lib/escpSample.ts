import type { Business, NotaDetail } from '@/lib/notaEscp'

// Static sample so the lab needs no login or API: the longest nota on the
// staging DB (7 items + notes + PPN), issued under the "M.E Plastisindo" alias.
export const SAMPLE_BUSINESS: Business = {
  "business_name": "M.E Plastisindo",
  "business_address": "Jalan Kyai Haji Mushonif",
  "business_contact_person": "Rudi Salim",
  "business_contact_number": "085381618888",
  "business_email": null,
  "payment_bank_name": "BCA",
  "payment_account_name": "Rudi Salim",
  "payment_account_number": "8575-2922-47"
}

export const SAMPLE_NOTA: NotaDetail = {
  "nota_number": "INV/2610/9-8/88",
  "nota_date": "2026-10-14",
  "customer_company_name_snapshot": "UD Gift & Craft Indah",
  "customer_address_snapshot": "Jl. Margonda Raya No. 101, Depok",
  "contact_name_snapshot": "Rudi Hartono",
  "notes": "Customer PO: PO/2610/9-008",
  "pajak_name": "PPN",
  "pajak_percentage": 11,
  "total_price": 5225750,
  "items": [
    {
      "item_name_snapshot": "Mika Warna (Merah/Biru/Kuning)",
      "unit_snapshot": "lembar",
      "qty": 167,
      "price": 1800,
      "total_price": 300600
    },
    {
      "item_name_snapshot": "Mika Tebal 1mm Super Clear",
      "unit_snapshot": "lembar",
      "qty": 312,
      "price": 3800,
      "total_price": 1185600
    },
    {
      "item_name_snapshot": "Mika Lembar Bening 0.5mm",
      "unit_snapshot": "lembar",
      "qty": 314,
      "price": 2200,
      "total_price": 690800
    },
    {
      "item_name_snapshot": "PVC Sheet Bening 1mm",
      "unit_snapshot": "lembar",
      "qty": 233,
      "price": 3200,
      "total_price": 745600
    },
    {
      "item_name_snapshot": "Blister Pack Standar A5",
      "unit_snapshot": "pcs",
      "qty": 773,
      "price": 850,
      "total_price": 657050
    },
    {
      "item_name_snapshot": "Double Blister Card",
      "unit_snapshot": "pcs",
      "qty": 698,
      "price": 1950,
      "total_price": 1361100
    },
    {
      "item_name_snapshot": "Mika Lembar Bening 0.3mm",
      "unit_snapshot": "lembar",
      "qty": 190,
      "price": 1500,
      "total_price": 285000
    }
  ]
}
