import { RouteModel } from '../../model/types';
import { escapeFlowLabel } from '../mermaidUtils';

export function renderRoutesDiagram(routes: RouteModel): string {
  const nodeLines: string[] = [];
  const edgeLines: string[] = [];

  routes.routes.forEach((route, index) => {
    const routeId = `route_${index}`;
    const handlerId = `${routeId}_handler`;
    nodeLines.push(`  ${routeId}["${escapeFlowLabel(`${route.method} ${route.path}`)}"]`);
    nodeLines.push(`  ${handlerId}["${escapeFlowLabel(route.handler)}"]`);
    edgeLines.push(`  ${routeId} --> ${handlerId}`);

    let prevId = handlerId;
    route.calls.forEach((call, callIndex) => {
      const callId = `${routeId}_call_${callIndex}`;
      nodeLines.push(`  ${callId}["${escapeFlowLabel(call)}"]`);
      edgeLines.push(`  ${prevId} --> ${callId}`);
      prevId = callId;
    });

    if (route.returns !== 'unknown') {
      const returnId = `${routeId}_returns`;
      nodeLines.push(`  ${returnId}["${escapeFlowLabel(`returns ${route.returns}`)}"]`);
      edgeLines.push(`  ${prevId} --> ${returnId}`);
    }
  });

  return ['flowchart TD', '  %% Routes / HTTP Flows', ...nodeLines, ...edgeLines].join('\n') + '\n';
}
