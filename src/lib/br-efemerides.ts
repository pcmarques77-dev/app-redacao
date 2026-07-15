/**
 * Efemérides estáticas — datas comemorativas recorrentes (MM-DD).
 * Somente leitura no calendário; alteração via código/deploy.
 */

export type BrEfemerideCategory = "jornalismo" | "geral" | "gastronomia";

export type BrEfemerideScope = "nacional" | "internacional" | "regional";

export type BrEfemeride = {
  /** Identificador estável (ordenação e chave React). */
  id: string;
  /** Recorrência anual — "MM-DD". */
  md: string;
  title: string;
  category: BrEfemerideCategory;
  scope?: BrEfemerideScope;
};

export const BR_EFEMERIDES: readonly BrEfemeride[] = [
  // —— Jornalismo e imprensa ——
  {
    id: "jornalismo-01-24-sao-francisco",
    md: "01-24",
    title: "Dia de São Francisco de Sales",
    category: "jornalismo",
    scope: "nacional",
  },
  {
    id: "jornalismo-02-16-reporter",
    md: "02-16",
    title: "Dia do Repórter",
    category: "jornalismo",
    scope: "nacional",
  },
  {
    id: "jornalismo-04-07-jornalista",
    md: "04-07",
    title: "Dia do Jornalista",
    category: "jornalismo",
    scope: "nacional",
  },
  {
    id: "jornalismo-05-03-liberdade-imprensa",
    md: "05-03",
    title: "Dia Mundial da Liberdade de Imprensa",
    category: "jornalismo",
    scope: "internacional",
  },
  {
    id: "jornalismo-06-01-imprensa",
    md: "06-01",
    title: "Dia da Imprensa",
    category: "jornalismo",
    scope: "nacional",
  },
  {
    id: "jornalismo-06-07-liberdade-imprensa",
    md: "06-07",
    title: "Dia Nacional da Liberdade de Imprensa",
    category: "jornalismo",
    scope: "nacional",
  },

  // —— Geral ——
  {
    id: "geral-03-08-mulher",
    md: "03-08",
    title: "Dia Internacional da Mulher",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-03-22-agua",
    md: "03-22",
    title: "Dia Mundial da Água",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-04-22-terra",
    md: "04-22",
    title: "Dia da Terra",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-05-13-abolicao",
    md: "05-13",
    title: "Dia da Abolição da Escravatura",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-06-05-meio-ambiente",
    md: "06-05",
    title: "Dia Mundial do Meio Ambiente",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-06-12-namorados",
    md: "06-12",
    title: "Dia dos Namorados",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-07-20-amigo",
    md: "07-20",
    title: "Dia do Amigo",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-07-25-escritor",
    md: "07-25",
    title: "Dia do Escritor",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-07-26-avos",
    md: "07-26",
    title: "Dia dos Avós",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-07-30-amizade",
    md: "07-30",
    title: "Dia Internacional da Amizade",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-08-11-estudante",
    md: "08-11",
    title: "Dia do Estudante",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-08-12-juventude",
    md: "08-12",
    title: "Dia Internacional da Juventude",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-08-15-brasilia",
    md: "08-15",
    title: "Aniversário de Brasília",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-08-22-folclore",
    md: "08-22",
    title: "Dia do Folclore",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-09-05-amazonia",
    md: "09-05",
    title: "Dia da Amazônia",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-09-08-alfabetizacao",
    md: "09-08",
    title: "Dia Internacional da Alfabetização",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-09-21-arvore",
    md: "09-21",
    title: "Dia da Árvore",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-09-21-paz",
    md: "09-21",
    title: "Dia Internacional da Paz",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-09-22-primavera",
    md: "09-22",
    title: "Início da primavera",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-09-27-turismo",
    md: "09-27",
    title: "Dia do Turismo",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-10-15-professor",
    md: "10-15",
    title: "Dia do Professor",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-10-31-halloween",
    md: "10-31",
    title: "Halloween",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-11-13-bandeira",
    md: "11-13",
    title: "Dia da Bandeira",
    category: "geral",
    scope: "nacional",
  },
  {
    id: "geral-11-25-violencia-mulher",
    md: "11-25",
    title: "Dia Internacional pelo Fim da Violência contra a Mulher",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-12-01-aids",
    md: "12-01",
    title: "Dia Mundial de Luta contra a AIDS",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-12-03-deficiencia",
    md: "12-03",
    title: "Dia Internacional das Pessoas com Deficiência",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-12-10-direitos-humanos",
    md: "12-10",
    title: "Dia Internacional dos Direitos Humanos",
    category: "geral",
    scope: "internacional",
  },
  {
    id: "geral-12-18-migrante",
    md: "12-18",
    title: "Dia Internacional do Migrante",
    category: "geral",
    scope: "internacional",
  },

  // —— Gastronomia ——
  {
    id: "gastronomia-01-24-nutricao",
    md: "01-24",
    title: "Dia Nacional da Nutrição",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-03-25-waffle",
    md: "03-25",
    title: "Dia Internacional do Waffle",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-04-07-pao",
    md: "04-07",
    title: "Dia Mundial do Pão",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-05-02-atum",
    md: "05-02",
    title: "Dia Mundial do Atum",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-05-13-chef-nacional",
    md: "05-13",
    title: "Dia Nacional do Chef de Cozinha",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-05-17-pastelaria",
    md: "05-17",
    title: "Dia Mundial da Pastelaria",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-05-21-cha",
    md: "05-21",
    title: "Dia Internacional do Chá",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-05-25-churrasco",
    md: "05-25",
    title: "Dia Nacional do Churrasco",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-05-28-hamburger",
    md: "05-28",
    title: "Dia Internacional do Hambúrguer",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-05-30-batata-frita",
    md: "05-30",
    title: "Dia Mundial da Batata Frita",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-06-18-gastronomia-sustentavel",
    md: "06-18",
    title: "Dia da Gastronomia Sustentável",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-06-24-sao-joao",
    md: "06-24",
    title: "São João",
    category: "gastronomia",
    scope: "regional",
  },
  {
    id: "gastronomia-06-28-ceviche",
    md: "06-28",
    title: "Dia do Ceviche",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-07-04-chef-internacional",
    md: "07-04",
    title: "Dia Internacional do Chef de Cozinha",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-07-06-gastronomia-mineira",
    md: "07-06",
    title: "Dia da Gastronomia Mineira",
    category: "gastronomia",
    scope: "regional",
  },
  {
    id: "gastronomia-07-07-chocolate",
    md: "07-07",
    title: "Dia Mundial do Chocolate",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-07-10-pizza",
    md: "07-10",
    title: "Dia da Pizza",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-07-15-tapioca",
    md: "07-15",
    title: "Dia Nacional da Tapioca",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-07-20-biscoito",
    md: "07-20",
    title: "Dia do Biscoito",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-07-22-manga",
    md: "07-22",
    title: "Dia Internacional da Manga",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-07-24-tequila",
    md: "07-24",
    title: "Dia Internacional da Tequila",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-07-29-lasanha",
    md: "07-29",
    title: "Dia da Lasanha",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-07-30-cheesecake",
    md: "07-30",
    title: "Dia do Cheesecake",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-08-02-mel",
    md: "08-02",
    title: "Dia Nacional do Mel",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-09-01-acai",
    md: "09-01",
    title: "Dia Nacional do Açaí",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-09-25-camarao",
    md: "09-25",
    title: "Dia Internacional do Camarão",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-10-01-cafe",
    md: "10-01",
    title: "Dia Internacional do Café",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-10-16-alimentacao",
    md: "10-16",
    title: "Dia Mundial da Alimentação",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-10-25-massa",
    md: "10-25",
    title: "Dia Internacional da Massa",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-11-01-veganismo",
    md: "11-01",
    title: "Dia Mundial do Veganismo",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-11-01-sushi",
    md: "11-01",
    title: "Dia do Sushi",
    category: "gastronomia",
    scope: "internacional",
  },
  {
    id: "gastronomia-11-29-churrasco",
    md: "11-29",
    title: "Dia Nacional do Churrasco",
    category: "gastronomia",
    scope: "nacional",
  },
  {
    id: "gastronomia-12-30-bacalhau",
    md: "12-30",
    title: "Dia Nacional do Bacalhau",
    category: "gastronomia",
    scope: "nacional",
  },
];

const EFEMERIDE_CATEGORY_ORDER: Record<BrEfemerideCategory, number> = {
  jornalismo: 1,
  geral: 2,
  gastronomia: 3,
};

export function getEfemeridesForDay(ymd: string): BrEfemeride[] {
  const md = ymd.slice(5);
  return BR_EFEMERIDES.filter((e) => e.md === md).sort((a, b) => {
    const catDiff =
      EFEMERIDE_CATEGORY_ORDER[a.category] -
      EFEMERIDE_CATEGORY_ORDER[b.category];
    if (catDiff !== 0) return catDiff;
    return a.title.localeCompare(b.title, "pt-BR");
  });
}

const EFEMERIDE_CATEGORY_EMOJI: Record<BrEfemerideCategory, string> = {
  jornalismo: "📰",
  geral: "📌",
  gastronomia: "🍽️",
};

const EFEMERIDE_SCOPE_EMOJI: Record<NonNullable<BrEfemeride["scope"]>, string> =
  {
    nacional: "🇧🇷",
    internacional: "🌐",
    regional: "🗺️",
  };

/** Emoji temático por palavra-chave no título; cai na categoria se não houver match. */
const EFEMERIDE_TITLE_EMOJI_RULES: readonly { pattern: RegExp; emoji: string }[] =
  [
    { pattern: /jornalista|repórter|imprensa|liberdade de imprensa/i, emoji: "🗞️" },
    { pattern: /pizza/i, emoji: "🍕" },
    { pattern: /chocolate/i, emoji: "🍫" },
    { pattern: /café|cafe/i, emoji: "☕" },
    { pattern: /churrasco/i, emoji: "🥩" },
    { pattern: /hambúrguer|hamburger/i, emoji: "🍔" },
    { pattern: /sushi/i, emoji: "🍣" },
    { pattern: /lasanha|massa|macarr/i, emoji: "🍝" },
    { pattern: /tapioca/i, emoji: "🫓" },
    { pattern: /manga/i, emoji: "🥭" },
    { pattern: /tequila/i, emoji: "🍹" },
    { pattern: /mel/i, emoji: "🍯" },
    { pattern: /açaí|acai/i, emoji: "🫐" },
    { pattern: /camarão|camarao/i, emoji: "🦐" },
    { pattern: /vegan/i, emoji: "🌱" },
    { pattern: /bacalhau|atum|ceviche/i, emoji: "🐟" },
    { pattern: /chef/i, emoji: "👨‍🍳" },
    { pattern: /pão|pao/i, emoji: "🍞" },
    { pattern: /waffle/i, emoji: "🧇" },
    { pattern: /biscoito/i, emoji: "🍪" },
    { pattern: /cheesecake/i, emoji: "🍰" },
    { pattern: /batata frita/i, emoji: "🍟" },
    { pattern: /são joão|sao joao/i, emoji: "🔥" },
    { pattern: /chá|cha/i, emoji: "🍵" },
    { pattern: /pastelaria|bolo/i, emoji: "🥐" },
    { pattern: /alimentação|alimentacao/i, emoji: "🥗" },
    { pattern: /mulher/i, emoji: "👩" },
    { pattern: /água|agua/i, emoji: "💧" },
    { pattern: /terra|meio ambiente|amazonia|amazônia|árvore|arvore/i, emoji: "🌍" },
    { pattern: /namorad/i, emoji: "💕" },
    { pattern: /amig|amizade/i, emoji: "🤝" },
    { pattern: /avós|avos/i, emoji: "👵" },
    { pattern: /estudante|professor|alfabetiza/i, emoji: "📚" },
    { pattern: /primavera/i, emoji: "🌸" },
    { pattern: /halloween/i, emoji: "🎃" },
    { pattern: /bandeira|brasília|brasilia|abolici/i, emoji: "🇧🇷" },
    { pattern: /violência contra a mulher|violencia contra a mulher/i, emoji: "🎗️" },
    { pattern: /aids/i, emoji: "🎗️" },
    { pattern: /direitos humanos|paz/i, emoji: "✊" },
    { pattern: /deficiência|deficiencia/i, emoji: "♿" },
    { pattern: /migrante/i, emoji: "🧳" },
    { pattern: /turismo/i, emoji: "✈️" },
    { pattern: /folclore/i, emoji: "🎭" },
    { pattern: /escritor/i, emoji: "✍️" },
    { pattern: /juventude/i, emoji: "🧑" },
    { pattern: /nutri/i, emoji: "🥗" },
  ];

export function efemerideEmoji(ef: BrEfemeride): string {
  for (const { pattern, emoji } of EFEMERIDE_TITLE_EMOJI_RULES) {
    if (pattern.test(ef.title)) return emoji;
  }
  return EFEMERIDE_CATEGORY_EMOJI[ef.category];
}

export function efemerideScopeEmoji(
  scope: BrEfemeride["scope"]
): string | null {
  if (!scope) return null;
  return EFEMERIDE_SCOPE_EMOJI[scope];
}

export function efemerideCalendarChipClass(
  category: BrEfemerideCategory
): string {
  const base =
    "pointer-events-none block w-full rounded border px-1.5 py-1 text-left text-[11px] font-medium leading-snug shadow-sm ring-1";
  if (category === "jornalismo") {
    return `${base} border-indigo-400/75 bg-indigo-100 text-indigo-950 ring-indigo-300/55`;
  }
  if (category === "gastronomia") {
    return `${base} border-teal-400/75 bg-teal-100 text-teal-950 ring-teal-300/55`;
  }
  return `${base} border-rose-400/75 bg-rose-100 text-rose-950 ring-rose-300/55`;
}
