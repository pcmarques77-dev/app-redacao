/** Duração máxima da sessão no app (23 horas), contada a partir do primeiro acesso autenticado. */
export const SESSION_WALL_MS = 23 * 60 * 60 * 1000;

/** Cookie httpOnly com timestamp (ms) de início da janela de sessão. */
export const SESSION_START_COOKIE = "pautas_session_start";
