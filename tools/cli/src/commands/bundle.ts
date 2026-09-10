import type { Command } from '../main';

export const bundleCommand: Command = {
  key: 'bundle',
  name: 'Bundle',
  description: 'Materializa el bundle efectivo de una máquina del dataset demo y muestra procedencia por clave.',
  usage: 'bundle --machine=<id> [--json] [--fleet=<n>]',
  async run(args) {
    const machineId = typeof args.flags['machine'] === 'string' ? args.flags['machine'] : 'mch_demo_doc_01';
    const { demoDataset } = await import('@psp/fixtures');
    const { materializeBundle } = await import('@psp/bundler');
    const { explainKey } = await import('@psp/config-engine');
    const dataset = demoDataset();
    const bundle = materializeBundle(dataset, machineId, { now: new Date(), assetUrlBase: '/station/v1/assets' });
    if (args.flags['json']) {
      console.log(JSON.stringify(bundle, null, 2));
      return 0;
    }
    console.log(`Bundle ${bundle.version} · máquina ${bundle.machine.name} (${bundle.machine.code}) · org ${bundle.organization.name}`);
    console.log(`Productos: ${bundle.products.length} · Presets: ${bundle.presets.length} · Plantillas: ${bundle.templates.length} · Campañas: ${bundle.campaigns.length} · Activos: ${bundle.assets.length}`);
    console.log('\nConfiguración efectiva (clave · valor · procedencia · bloqueo):');
    for (const key of Object.keys(bundle.effective.values).sort()) {
      const ex = explainKey(bundle.effective, key);
      const prov = ex.provenance.isDefault ? 'default' : `${ex.provenance.level}${ex.provenance.entityId ? ':' + ex.provenance.entityId : ''}`;
      const lock = ex.lock ? ` [${ex.lock.policy} por ${ex.lock.setBy}]` : '';
      console.log(`  ${key.padEnd(38)} ${JSON.stringify(ex.value).slice(0, 40).padEnd(42)} ${prov}${lock}`);
    }
    if (bundle.effective.rejected.length) {
      console.log('\nRechazados por bloqueo:');
      for (const r of bundle.effective.rejected) console.log(`  ${r.key} en ${r.level}${r.entityId ? ':' + r.entityId : ''} → ${r.reason}`);
    }
    console.log('\nFeatures:');
    for (const f of bundle.features) console.log(`  ${f.key.padEnd(32)} ${f.mode}`);
    console.log('\nPrecios:');
    for (const p of bundle.prices) {
      const prod = bundle.products.find((x) => x.id === p.productId);
      console.log(`  ${(prod?.displayName.es ?? p.productId).padEnd(32)} lista ${p.list.amount / 100} → final ${p.final.amount / 100} ${p.final.currency} (${p.provenance.level})`);
    }
    return 0;
  },
};
