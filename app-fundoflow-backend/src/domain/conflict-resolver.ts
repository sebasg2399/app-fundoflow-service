export type Timestamped = { updated_at: string };

export type ConflictResolution<T> =
  | { winner: "incoming"; merged: T }
  | { winner: "existing"; merged: T };

/**
 * Last-Write-Wins por `updated_at` (string ISO8601, comparables lexicográficamente
 * si el offset es consistente — UTC con sufijo Z).
 *
 * Semántica:
 * - Si NO existe la entidad en el server → incoming gana (es la primera escritura).
 * - Si incoming.updated_at > existing.updated_at → incoming gana.
 * - Si incoming.updated_at <= existing.updated_at → existing gana (no se hace nada).
 *
 * Esto da un comportamiento idempotente y determinista: si el mismo batch llega
 * dos veces (ej. retry de SQS), el resultado final es el mismo.
 *
 * El soft delete se propaga naturalmente: si `deleted_at` está seteado, el
 * registro se mantiene en la tabla pero se filtra en las queries de lectura.
 */
export function resolveLWW<T extends Timestamped>(
  incoming: T,
  existing: T | null,
): ConflictResolution<T> {
  if (!existing) {
    return { winner: "incoming", merged: incoming };
  }
  if (incoming.updated_at > existing.updated_at) {
    return { winner: "incoming", merged: incoming };
  }
  return { winner: "existing", merged: existing };
}
