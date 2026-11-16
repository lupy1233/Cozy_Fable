'use client';

import { useEffect, useState } from 'react';

// true abia dupa hidratare: butoanele de trimitere ale formularelor de cont raman
// dezactivate pana atunci, ca un clic/Enter inainte de incarcarea JS sa nu trimita
// formularul nativ (impreuna cu method="post", campurile nu ajung niciodata in URL).
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
