"use client";

import { useState } from "react";
import { logoUrlDaFonte } from "@/lib/fonte-logos";

type Props = {
  fonte: string;
};

export function FonteLogo({ fonte }: Props) {
  const [visible, setVisible] = useState(true);
  const url = logoUrlDaFonte(fonte);

  if (!url || !visible) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- ícones externos por fonte; sem otimização Next.
    <img
      src={url}
      alt=""
      className="h-8 max-h-8 w-auto max-w-[140px] shrink-0 object-contain object-left"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setVisible(false)}
    />
  );
}
