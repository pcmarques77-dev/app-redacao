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
  TudoCelular: "https://www.tudocelular.com/favicon.ico",
  "G1 Tecnologia": "https://g1.globo.com/favicon.ico",
  "Folha — Tecnologia": "https://www.folha.uol.com.br/favicon.ico",
  TecMundo: "https://www.tecmundo.com.br/favicon.ico",
  TechTudo: "https://www.techtudo.com.br/favicon.ico",
  Canaltech: "https://canaltech.com.br/favicon.ico",
  Tecnoblog: "https://tecnoblog.net/favicon.ico",
  "Olhar Digital": "https://olhardigital.com.br/favicon.ico",
  G1: "https://g1.globo.com/favicon.ico",
  "O Globo": "https://oglobo.globo.com/favicon.ico",
  Folha: "https://www.folha.uol.com.br/favicon.ico",
  UOL: "https://conteudo.imguol.com.br/c/_layout/favicon/uol2021.ico",
  Metrópoles: "https://www.metropoles.com/favicon.ico",
  Terra: "https://www.terra.com.br/favicon.ico",
  "CNN Brasil": "https://www.cnnbrasil.com.br/favicon.ico",
  Estadão:
    "https://www.estadao.com.br/pf/resources/apple-touch-icon.png?d=2552",
  "Google Trends": "https://www.google.com/favicon.ico",
};

export function logoUrlDaFonte(fonte: string): string | undefined {
  return LOGO_URL_POR_FONTE[fonte];
}
