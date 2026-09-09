/**
 * Enrutador de la consola: `/login` es pública; el resto exige sesión y vive dentro de
 * `AppShellLayout`. Las entidades sin pantalla a medida usan `ResourceList` con su
 * `ResourceDefinition` (mecanismo genérico) — así se cubren rápido muchas entidades.
 */
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ResourceList } from './crud/ResourceList';
import {
  announcementsResource,
  assetsResource,
  blueprintsResource,
  campaignsResource,
  consumablesResource,
  editingPresetsResource,
  entitlementPlansResource,
  entitlementsResource,
  experiencesResource,
  franchisesResource,
  hardwareProfilesResource,
  incidentsResource,
  locationsResource,
  maintenanceChecklistsResource,
  maintenanceLogsResource,
  organizationsResource,
  priceRulesResource,
  promotionsResource,
  regionsResource,
  retentionPoliciesResource,
  savedViewsResource,
  sessionsResource,
  templatesResource,
  territoriesResource,
} from './crud/definitions';
import { AppShellLayout } from './shell/AppShellLayout';
import { Audit } from './screens/Audit';
import { CampaignDetail } from './screens/CampaignDetail';
import { Catalog } from './screens/Catalog';
import { Dashboard } from './screens/Dashboard';
import { Features } from './screens/Features';
import { FleetSimulator } from './screens/FleetSimulator';
import { ImportExport } from './screens/ImportExport';
import { InternalDocs } from './screens/InternalDocs';
import { Login } from './screens/Login';
import { MachineDetail } from './screens/machines/MachineDetail';
import { MachinesList } from './screens/machines/MachinesList';
import { Metrics } from './screens/Metrics';
import { PresetDetail } from './screens/PresetDetail';
import { Presets } from './screens/Presets';
import { Products } from './screens/Products';
import { Releases } from './screens/Releases';
import { RolloutDetail } from './screens/rollouts/RolloutDetail';
import { Support } from './screens/Support';
import { Users } from './screens/Users';
import { useSessionStore } from './store/session';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const token = useSessionStore((s) => s.token);
  const principal = useSessionStore((s) => s.principal);
  const restore = useSessionStore((s) => s.restore);
  const location = useLocation();

  useEffect(() => {
    if (token && !principal) void restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppShellLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/machines" element={<MachinesList />} />
        <Route path="/machines/:id" element={<MachineDetail />} />
        <Route path="/locations" element={<ResourceList definition={locationsResource} />} />
        <Route path="/incidents" element={<ResourceList definition={incidentsResource} />} />
        <Route path="/maintenance" element={<ResourceList definition={maintenanceLogsResource} />} />
        <Route path="/consumables" element={<ResourceList definition={consumablesResource} />} />
        <Route path="/sessions" element={<ResourceList definition={sessionsResource} />} />
        <Route path="/metrics" element={<Metrics />} />

        <Route path="/organizations" element={<ResourceList definition={organizationsResource} />} />
        <Route path="/franchises" element={<ResourceList definition={franchisesResource} />} />
        <Route path="/territories" element={<ResourceList definition={territoriesResource} />} />
        <Route path="/regions" element={<ResourceList definition={regionsResource} />} />
        <Route path="/hardware-profiles" element={<ResourceList definition={hardwareProfilesResource} />} />
        <Route path="/blueprints" element={<ResourceList definition={blueprintsResource} />} />

        <Route path="/products" element={<Products />} />
        <Route path="/prices" element={<ResourceList definition={priceRulesResource} />} />
        <Route path="/promotions" element={<ResourceList definition={promotionsResource} />} />
        <Route path="/presets" element={<Presets />} />
        <Route path="/presets/:id" element={<PresetDetail />} />
        <Route path="/templates" element={<ResourceList definition={templatesResource} />} />
        <Route path="/experiences" element={<ResourceList definition={experiencesResource} />} />
        <Route path="/editing-presets" element={<ResourceList definition={editingPresetsResource} />} />
        <Route path="/campaigns" element={<ResourceList definition={campaignsResource} />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/assets" element={<ResourceList definition={assetsResource} />} />

        <Route path="/features" element={<Features />} />
        <Route path="/releases" element={<Releases />} />
        <Route path="/releases/rollouts/:id" element={<RolloutDetail />} />
        <Route path="/users" element={<Users />} />
        <Route path="/support" element={<Support />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/announcements" element={<ResourceList definition={announcementsResource} />} />
        <Route path="/docs" element={<InternalDocs />} />
        <Route path="/import-export" element={<ImportExport />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/fleet-simulator" element={<FleetSimulator />} />
        <Route path="/saved-views" element={<ResourceList definition={savedViewsResource} />} />
        <Route path="/entitlements" element={<ResourceList definition={entitlementsResource} />} />
        <Route path="/entitlement-plans" element={<ResourceList definition={entitlementPlansResource} />} />
        <Route path="/maintenance-checklists" element={<ResourceList definition={maintenanceChecklistsResource} />} />
        <Route path="/retention-policies" element={<ResourceList definition={retentionPoliciesResource} />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
