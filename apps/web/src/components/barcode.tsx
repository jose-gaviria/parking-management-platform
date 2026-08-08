'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/** Código de barras Code 128 renderizado como SVG (buena calidad en térmicas). */
export function Barcode({ value, height = 60 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current && value) {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: false,
        height,
        width: 1.6,
        margin: 0,
      });
    }
  }, [value, height]);

  return <svg ref={ref} aria-label={`Código de barras ${value}`} />;
}
