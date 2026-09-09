/** Campañas: navidad (programada, patrocinada, obligatoria), regreso a clases (local) y anfitrión cafetería. */
import { Campaign } from '@psp/contracts';
import { DEMO_IDS } from '../ids';
import { L, audit, mxn } from './common';

const ID = DEMO_IDS;

export function buildCampaigns(): Campaign[] {
  return [
    Campaign.parse({
      id: ID.campaign.christmas2026, organizationId: ID.org.lumina, name: L('Navidad 2026', 'Christmas 2026'),
      description: L('Retrato navideño patrocinado por Chocolates Aurora en Norte y Centro.', 'Christmas portrait sponsored by Chocolates Aurora in Norte and Centro.'),
      startsAt: '2026-12-01T06:00:00Z', endsAt: '2027-01-06T06:00:00Z',
      targets: { scopes: [{ level: 'region', id: ID.region.norte }, { level: 'region', id: ID.region.centro }], tags: [] },
      productIds: [ID.product.christmasPortrait], priceOverrides: [{ productId: ID.product.christmasPortrait, price: mxn(10000) }],
      templateIds: [ID.template.postcard5x7], assetIds: [ID.asset.promoChristmas, ID.asset.frameChristmas, ID.asset.logoSponsorAurora],
      texts: { headline: L('Tu retrato navideño con Chocolates Aurora', 'Your Christmas portrait with Chocolates Aurora') },
      sponsor: { name: 'Chocolates Aurora', logoAssetId: ID.asset.logoSponsorAurora }, experienceId: ID.experience.christmas, priority: 10, status: 'scheduled',
      configOverlay: { values: { 'branding.attractImageAssetIds': [ID.asset.promoChristmas], 'branding.footerText': 'Navidad con Chocolates Aurora', 'branding.sponsorLogoAssetId': ID.asset.logoSponsorAurora }, locks: [] },
      franchiseEditableKeys: ['branding.footerText'], mandatory: true, ...audit(ID.user.adminLumina),
    }),
    Campaign.parse({
      id: ID.campaign.backToSchool, organizationId: ID.org.lumina, franchiseId: ID.franchise.norte, name: L('Regreso a clases', 'Back to school'),
      description: L('Foto universitaria a precio especial en la biblioteca central.', 'University photo at a special price at the central library.'),
      startsAt: '2026-08-15T06:00:00Z', endsAt: '2026-09-30T06:00:00Z',
      targets: { scopes: [{ level: 'location', id: ID.location.university }], tags: [] },
      productIds: [ID.product.docUniversity], priceOverrides: [{ productId: ID.product.docUniversity, price: mxn(7000) }],
      assetIds: [ID.asset.promoDocuments], texts: { headline: L('Regreso a clases: foto universitaria a $70', 'Back to school: university photo for $70') },
      priority: 5, status: 'active', configOverlay: { values: { 'branding.attractImageAssetIds': [ID.asset.promoDocuments] }, locks: [] }, mandatory: false, ...audit(ID.user.franqNorte),
    }),
    Campaign.parse({
      id: ID.campaign.cafeHost, organizationId: ID.org.lumina, franchiseId: ID.franchise.norte, name: L('Anfitrión Café Aurora', 'Café Aurora host'),
      description: L('Logo del anfitrión en el kiosco de la cafetería.', 'Host logo on the café kiosk.'),
      startsAt: '2026-06-01T06:00:00Z', endsAt: '2026-12-31T06:00:00Z',
      targets: { scopes: [{ level: 'location', id: ID.location.cafe }], tags: [] },
      assetIds: [ID.asset.logoHostCafe], priority: 1, status: 'active', configOverlay: { values: { 'branding.hostLogoAssetId': ID.asset.logoHostCafe }, locks: [] }, mandatory: false, ...audit(ID.user.franqNorte),
    }),
  ];
}
