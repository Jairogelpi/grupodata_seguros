/**
 * Classifies a product string into a high-level "Ramo" category.
 * This provides a first-depth grouping for the Product Mix charts.
 *
 * Classification rules (order matters — first match wins):
 *   SALUD       → contains "sanit"
 *   ACCIDENTES  → contains "accid"
 *   AGROSEGURO  → contains "agro"
 *   VIDA RIESGO → contains "ind.riesgo" or "riesgo"
 *   VIDA AHORRO → contains "ahorro" or "sialp"
 *   DECESOS     → contains "decesos"
 *   AUTOS       → contains "<A>"
 *   DIVERSOS    → contains "<D>" (catch-all for remaining <D> products)
 *   OTROS       → anything else
 */
export function getRamo(producto: string): string {
    const p = producto.toLowerCase();

    if (p.includes('sanit')) return 'SALUD';
    if (p.includes('accid')) return 'ACCIDENTES';
    if (p.includes('agro')) return 'DIVERSOS'; // Mapped to DIVERSOS
    // Check "ind.riesgo" before "riesgo" to avoid false positives
    if (p.includes('ind.riesgo') || p.includes('riesgo') || p.includes('ahorro') || p.includes('sialp')) return 'VIDA RIESGO';
    if (p.includes('decesos')) return 'DECESOS';
    if (producto.includes('<A>')) return 'AUTOS';
    if (producto.includes('<D>')) return 'DIVERSOS';

    return 'OTROS';
}
