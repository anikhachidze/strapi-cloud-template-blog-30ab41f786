'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFrontendModule(relativePath, exportName) {
  const filePath = path.resolve(__dirname, '..', '..', 'mindbody-roots', 'src', relativePath);
  let source = fs.readFileSync(filePath, 'utf8');
  source = source
    .replace(new RegExp(`export const ${exportName} =`), `exports.${exportName} =`)
    .replace(/export function[\s\S]*$/m, '');
  const sandbox = { exports: {} };
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return sandbox.exports[exportName];
}

function loadMindBodyContent() {
  return {
    siteCopy: loadFrontendModule('content/siteCopy.js', 'siteCopy'),
    posts: loadFrontendModule('data/posts.js', 'posts'),
    products: loadFrontendModule('data/products.js', 'products'),
    quotes: loadFrontendModule('data/quotes.js', 'quotes'),
  };
}

function fromLocalizedValue(enValue, kaValue) {
  return {
    en: enValue || '',
    ka: kaValue || enValue || '',
  };
}

function buildHomeSection(enSection, kaSection) {
  return {
    eyebrowEn: enSection?.eyebrow || '',
    eyebrowKa: kaSection?.eyebrow || enSection?.eyebrow || '',
    titleEn: enSection?.title || '',
    titleKa: kaSection?.title || enSection?.title || '',
    bodyEn: enSection?.body || '',
    bodyKa: kaSection?.body || enSection?.body || '',
  };
}

function buildHomepageContent(siteCopy) {
  return {
    hero: {
      badgeEn: siteCopy.en?.hero?.badge || '',
      badgeKa: siteCopy.ka?.hero?.badge || siteCopy.en?.hero?.badge || '',
      titleEn: siteCopy.en?.hero?.title || '',
      titleKa: siteCopy.ka?.hero?.title || siteCopy.en?.hero?.title || '',
      leadEn: siteCopy.en?.hero?.lead || '',
      leadKa: siteCopy.ka?.hero?.lead || siteCopy.en?.hero?.lead || '',
      primaryLabelEn: siteCopy.en?.hero?.primary || 'Read the Blog',
      primaryLabelKa: siteCopy.ka?.hero?.primary || siteCopy.en?.hero?.primary || 'Read the Blog',
      primaryUrl: '/blog',
      secondaryLabelEn: siteCopy.en?.hero?.secondary || 'Explore Recommendations',
      secondaryLabelKa: siteCopy.ka?.hero?.secondary || siteCopy.en?.hero?.secondary || 'Explore Recommendations',
      secondaryUrl: '/recommendations',
      quoteEn: siteCopy.en?.hero?.quote || '',
      quoteKa: siteCopy.ka?.hero?.quote || siteCopy.en?.hero?.quote || '',
      cardBodyEn: siteCopy.en?.hero?.cardBody || '',
      cardBodyKa: siteCopy.ka?.hero?.cardBody || siteCopy.en?.hero?.cardBody || '',
      videoUrl: '',
      mediaCaptionEn: '',
      mediaCaptionKa: '',
    },
    featuredArticlesSection: buildHomeSection(
      {
        eyebrow: siteCopy.en?.sections?.featuredEyebrow,
        title: siteCopy.en?.sections?.featuredTitle,
        body: siteCopy.en?.sections?.featuredText,
      },
      {
        eyebrow: siteCopy.ka?.sections?.featuredEyebrow,
        title: siteCopy.ka?.sections?.featuredTitle,
        body: siteCopy.ka?.sections?.featuredText,
      }
    ),
    disclaimer: {
      titleEn: siteCopy.en?.common?.healthDisclaimerTitle || '',
      titleKa: siteCopy.ka?.common?.healthDisclaimerTitle || siteCopy.en?.common?.healthDisclaimerTitle || '',
      bodyEn: siteCopy.en?.common?.healthDisclaimerBody || '',
      bodyKa: siteCopy.ka?.common?.healthDisclaimerBody || siteCopy.en?.common?.healthDisclaimerBody || '',
    },
    recommendationsSection: buildHomeSection(
      {
        eyebrow: siteCopy.en?.sections?.toolsEyebrow,
        title: siteCopy.en?.sections?.toolsTitle,
        body: siteCopy.en?.sections?.toolsText,
      },
      {
        eyebrow: siteCopy.ka?.sections?.toolsEyebrow,
        title: siteCopy.ka?.sections?.toolsTitle,
        body: siteCopy.ka?.sections?.toolsText,
      }
    ),
    promoVideo: {
      titleEn: '',
      titleKa: '',
      bodyEn: '',
      bodyKa: '',
      videoUrl: '',
    },
  };
}

async function ensurePublicPermissions(newPermissions) {
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
  if (!publicRole) return;

  for (const [controller, actions] of Object.entries(newPermissions)) {
    for (const action of actions) {
      const permissionAction = `api::${controller}.${controller}.${action}`;
      const existing = await strapi.query('plugin::users-permissions.permission').findOne({
        where: { action: permissionAction, role: publicRole.id },
      });
      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action: permissionAction, role: publicRole.id },
        });
      }
    }
  }
}

async function upsertCollection(uid, uniqueField, entries) {
  for (const entry of entries) {
    const existing = await strapi.db.query(uid).findOne({ where: { [uniqueField]: entry[uniqueField] } });
    if (existing) {
      await strapi.documents(uid).update({ documentId: existing.documentId, data: entry, status: 'published' });
    } else {
      await strapi.documents(uid).create({ data: entry, status: 'published' });
    }
  }
}

async function upsertSingle(uid, data) {
  const existing = await strapi.db.query(uid).findOne({});
  if (existing) {
    await strapi.documents(uid).update({ documentId: existing.documentId, data, status: 'published' });
  } else {
    await strapi.documents(uid).create({ data, status: 'published' });
  }
}

async function seedMindBodyContent() {
  const content = loadMindBodyContent();
  await ensurePublicPermissions({
    'mbr-site-copy': ['find'],
    'mbr-post': ['find', 'findOne'],
    'mbr-product': ['find', 'findOne'],
    'mbr-quote': ['find', 'findOne'],
    'mbr-homepage': ['find'],
  });

  await upsertSingle('api::mbr-site-copy.mbr-site-copy', { copy: content.siteCopy });
  await upsertCollection('api::mbr-post.mbr-post', 'slug', content.posts.map((post, index) => ({ ...post, order: index })));
  await upsertCollection('api::mbr-product.mbr-product', 'url', content.products.map((product, index) => ({ ...product, order: index })));
  await upsertCollection('api::mbr-quote.mbr-quote', 'order', content.quotes.map((quote, index) => ({ ...quote, order: index })));

  const postDocs = await strapi.db.query('api::mbr-post.mbr-post').findMany({
    orderBy: { order: 'asc' },
  });
  const productDocs = await strapi.db.query('api::mbr-product.mbr-product').findMany({
    orderBy: { order: 'asc' },
  });
  const quoteDoc = await strapi.db.query('api::mbr-quote.mbr-quote').findOne({
    where: { order: 0 },
  });

  const homepage = buildHomepageContent(content.siteCopy);
  await upsertSingle('api::mbr-homepage.mbr-homepage', {
    ...homepage,
    featuredArticles: postDocs.map((post) => post.documentId),
    spotlightQuote: quoteDoc?.documentId || null,
    featuredProducts: productDocs.slice(0, 3).map((product) => product.documentId),
  });
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';
  await seedMindBodyContent();
  await app.destroy();
  console.log('MindBody Roots Strapi content seeded.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
