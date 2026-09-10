/** Operación: incidencias, bitácoras de mantenimiento, consumibles, documentos internos y anuncios. */
import { Announcement, Consumable, Incident, InternalDocument, MaintenanceLog, type Actor } from '@psp/contracts';
import { DEMO_IDS } from '../ids';
import { daysAgo, hoursAgo, daysFromNow } from '../time';
import { L, audit } from './common';

const ID = DEMO_IDS;
const tech: Actor = { type: 'user', id: ID.user.tecnicoNorte, name: 'Luis Garza' };
const system: Actor = { type: 'system', name: 'station-agent' };

export function buildIncidents(): Incident[] {
  return [
    Incident.parse({
      id: ID.incident.premiumPaper, code: 'PAP-7Q2', machineId: ID.machine.premium, locationId: ID.location.mallCdmx, organizationId: ID.org.unaDeTodos, severity: 'high', category: 'consumables',
      title: 'Papel fotográfico agotado', description: 'La impresora reporta no_paper; la cabina sigue activa con advertencia.', reportedAt: hoursAgo(6), reportedBy: { type: 'machine', id: ID.machine.premium }, status: 'open',
      notes: [{ at: hoursAgo(5), by: system, text: 'Sesiones de impresión suspendidas; captura permitida en modo demo.' }], source: 'auto', ...audit(), createdAt: hoursAgo(6),
    }),
    Incident.parse({
      id: ID.incident.cinemaCamera, code: 'CAM-3KD', machineId: ID.machine.cinema, locationId: ID.location.cinema, organizationId: ID.org.unaDeTodos, franchiseId: ID.franchise.bajio, severity: 'critical', category: 'camera',
      title: 'Cámara no responde', description: 'La cámara principal no entrega frames tras el reinicio; máquina en mantenimiento.', reportedAt: daysAgo(1, 2), reportedBy: { type: 'machine', id: ID.machine.cinema }, assigneeId: ID.user.soporte, status: 'investigating',
      notes: [{ at: daysAgo(1, 3), by: { type: 'user', id: ID.user.soporte, name: 'Soporte temporal' }, text: 'Acceso de soporte concedido; se revisa el bus USB de forma remota.' }], source: 'auto', ...audit(), createdAt: daysAgo(1, 2),
    }),
    Incident.parse({
      id: ID.incident.terminalThermal, code: 'THR-9XA', machineId: ID.machine.terminal, locationId: ID.location.mallCdmx, organizationId: ID.org.unaDeTodos, severity: 'medium', category: 'printer',
      title: 'Cabezal térmico dañado', description: 'Impresión con líneas blancas; se solicita cabezal de repuesto.', reportedAt: daysAgo(4), reportedBy: tech, assigneeId: ID.user.tecnicoNorte, status: 'awaiting_part',
      notes: [{ at: daysAgo(3), by: tech, text: 'Refacción pedida al proveedor; entrega estimada en 5 días.' }], partsUsed: [], source: 'manual', ...audit(ID.user.tecnicoNorte), createdAt: daysAgo(4),
    }),
  ];
}

export function buildMaintenanceLogs(): MaintenanceLog[] {
  return [
    MaintenanceLog.parse({ id: ID.maintenanceLog.docPaper, machineId: ID.machine.doc, type: 'paper_change', performedAt: daysAgo(3), performedBy: tech, checklistId: ID.checklist.docStation, checklistResults: [{ key: 'paper', ok: true }, { key: 'test_print', ok: true }], notes: 'Cambio de paquete de 200 hojas 4x6.', consumablesUsed: [{ type: 'photo_paper', qty: 1 }] }),
    MaintenanceLog.parse({ id: ID.maintenanceLog.thermalPreventive, machineId: ID.machine.thermal, type: 'preventive', performedAt: daysAgo(7), performedBy: tech, checklistId: ID.checklist.thermalKiosk, checklistResults: [{ key: 'roll', ok: true }, { key: 'head', ok: true, note: 'Limpieza con alcohol isopropílico' }, { key: 'camera', ok: true }], notes: 'Mantenimiento preventivo mensual.' }),
  ];
}

export function buildConsumables(machines: Array<{ id: string; hardwareProfileId: string }>): Consumable[] {
  return machines.map((m) => {
    const thermal = m.hardwareProfileId === ID.hardwareProfile.thermalKiosk;
    const premiumLow = m.id === ID.machine.premium;
    const installed = thermal ? 400 : 200;
    return Consumable.parse({
      id: `con_${m.id.slice(4)}`, machineId: m.id, type: thermal ? 'thermal_paper' : 'photo_paper', compatibility: thermal ? 'Rollo 58 mm x 30 m' : 'Paquete 4x6 200 hojas', unit: 'prints',
      installedQty: installed, estimatedRemaining: premiumLow ? 0 : Math.round(installed * 0.55), changedAt: daysAgo(premiumLow ? 12 : 3), changedBy: tech, localStock: premiumLow ? 0 : 2,
      history: [{ at: daysAgo(premiumLow ? 12 : 3), qty: installed, by: tech }],
    });
  });
}

export function buildInternalDocuments(): InternalDocument[] {
  return [
    InternalDocument.parse({ id: ID.document.changePaper, organizationId: ID.org.unaDeTodos, title: L('Cómo cambiar el papel fotográfico', 'How to change photo paper'), body: '1. Abre el gabinete con la llave.\n2. Retira el cartucho vacío.\n3. Inserta el paquete nuevo con la cara brillante hacia arriba.\n4. Ejecuta impresión de prueba desde el panel técnico.', attachedTo: { type: 'hardwareProfile', id: ID.hardwareProfile.docStation }, tags: ['papel', 'mantenimiento'], ...audit(ID.user.adminUnaDeTodos) }),
    InternalDocument.parse({ id: ID.document.cleanLens, title: L('Limpieza del lente', 'Lens cleaning'), body: 'Usa paño de microfibra seco; nunca líquidos directamente sobre el lente.', attachedTo: { type: 'maintenance' }, tags: ['camara'], ...audit(ID.user.owner) }),
    InternalDocument.parse({ id: ID.document.installChecklist, organizationId: ID.org.unaDeTodos, title: L('Checklist de instalación', 'Installation checklist'), body: 'Corriente dedicada, red con salida a internet, nivelación, prueba de cámara, prueba de impresión, enrolamiento con código.', attachedTo: { type: 'installation' }, tags: ['instalacion'], ...audit(ID.user.adminUnaDeTodos) }),
  ];
}

export function buildAnnouncements(): Announcement[] {
  return [
    Announcement.parse({ id: ID.announcement.christmas2026, organizationId: ID.org.unaDeTodos, title: L('Campaña Navidad 2026', 'Christmas 2026 campaign'), body: L('La campaña obligatoria de navidad se activa el 1 de diciembre en Norte y Centro. El pie de pantalla es editable por franquicia.', 'The mandatory Christmas campaign starts December 1 in Norte and Centro. The footer text is editable per franchise.'), publishedAt: daysAgo(2), expiresAt: daysFromNow(90), audienceFranchiseIds: [ID.franchise.norte], pinned: true, ...audit(ID.user.adminUnaDeTodos) }),
    Announcement.parse({ id: ID.announcement.release020, organizationId: ID.org.unaDeTodos, title: L('Release 0.2.0 en piloto', 'Release 0.2.0 in pilot'), body: L('Las máquinas con etiqueta piloto reciben 0.2.0 esta semana en ventana nocturna.', 'Machines tagged pilot receive 0.2.0 this week during the night window.'), publishedAt: daysAgo(5), audienceFranchiseIds: [], pinned: false, ...audit(ID.user.owner) }),
  ];
}
