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
  });

  await upsertSingle('api::mbr-site-copy.mbr-site-copy', { copy: content.siteCopy });
  await upsertCollection('api::mbr-post.mbr-post', 'slug', content.posts.map((post, index) => ({ ...post, order: index })));
  await upsertCollection('api::mbr-product.mbr-product', 'url', content.products.map((product, index) => ({ ...product, order: index })));
  await upsertCollection('api::mbr-quote.mbr-quote', 'order', content.quotes.map((quote, index) => ({ ...quote, order: index })));
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
