import { RouteModel } from '../../model/types';
import { sequenceSafeText, slug } from '../mermaidUtils';

/** Splits "customerService.create()" into { participant: "customerService", message: "create()" }; a bare call like "mergeSort()" becomes its own participant. */
function splitCall(call: string): { participant: string; message: string } {
  const match = call.match(/^(.+)\.(\w+\(\))$/);
  if (match) return { participant: match[1], message: match[2] };
  return { participant: call.replace(/\(\)$/, ''), message: call };
}

export function renderSequenceDiagram(routes: RouteModel): string {
  const lines = ['sequenceDiagram', '  %% Routes / Sequence'];
  const declared = new Set<string>();

  function declareParticipant(id: string, label: string): void {
    if (declared.has(id)) return;
    declared.add(id);
    lines.push(`  participant ${id} as ${sequenceSafeText(label)}`);
  }

  routes.routes.forEach((route, index) => {
    if (index > 0) lines.push('  %% ---');

    const handlerId = slug(route.handler);
    declareParticipant(handlerId, route.handler);
    lines.push(`  Client->>${handlerId}: ${sequenceSafeText(`${route.method} ${route.path}`)}`);

    for (const call of route.calls) {
      const { participant, message } = splitCall(call);
      const participantId = slug(participant);
      declareParticipant(participantId, participant);
      lines.push(`  ${handlerId}->>${participantId}: ${sequenceSafeText(message)}`);
    }

    if (route.returns !== 'unknown') {
      lines.push(`  ${handlerId}-->>Client: ${sequenceSafeText(`returns ${route.returns}`)}`);
    }
  });

  return lines.join('\n') + '\n';
}
