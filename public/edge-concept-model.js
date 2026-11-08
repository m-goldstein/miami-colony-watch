export const VISIT_GAP_MS = 120000;
export const DOSE_COOLDOWN_MS = 30000;
export function conceptSummary(concept) {
  const linked = concept.sessions.filter(session => concept.bindings[session.token]);
  return { rawReads: concept.reads.length, sessions: concept.sessions.length,
    uniqueLinkedCats: new Set(linked.map(session => concept.bindings[session.token].catId)).size,
    unlinkedTags: new Set(concept.sessions.filter(session => !concept.bindings[session.token]).map(session => session.token)).size,
    queued: concept.wireless.packets.filter(packet => !packet.ackedAt).length,
    acknowledged: concept.wireless.packets.filter(packet => packet.ackedAt).length };
}
