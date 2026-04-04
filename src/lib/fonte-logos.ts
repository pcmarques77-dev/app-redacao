/**
 * URLs de ícone/favicon por nome da fonte (igual a `fonte` em SCRAPERS_GOVERNO).
 * O browser carrega via `<img>`; não há proxy no servidor.
 */
export const LOGO_URL_POR_FONTE: Record<string, string> = {
  "Agência Brasil":
    "https://agenciabrasil.ebc.com.br/sites/default/themes/agenciabrasil_v3/images/agbrasil-color-logo.svg",
  "Agência Gov":
    "https://agenciagov.ebc.com.br/++plone++ebc.agenciagov.images/logo.png",
  "Senado Federal": "https://www.senado.leg.br/favicon.ico",
  "Receita Federal": "https://www.gov.br/receitafederal/pt-br/favicon.ico",
  "Câmara dos Deputados": "https://www.camara.leg.br/favicon.ico",
  "Polícia Federal": "https://www.gov.br/pf/pt-br/favicon.ico",
  INSS: "https://www.gov.br/inss/pt-br/favicon.ico",
  "Ministério da Previdência Social":
    "https://www.gov.br/previdencia/pt-br/favicon.ico",
  "Agência SP": "https://www.agenciasp.sp.gov.br/favicon.ico",
  STF: "https://portal.stf.jus.br/assets/img/logo-STF.png",
};

export function logoUrlDaFonte(fonte: string): string | undefined {
  return LOGO_URL_POR_FONTE[fonte];
}
