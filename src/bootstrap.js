'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const { categories, authors, articles, global, about } = require('../data/data.json');
const mindbodySeed = require('../data/mindbody-seed.json');

async function seedExampleApp() {
  const shouldImportSeedData = await isFirstRun();

  if (shouldImportSeedData) {
    try {
      console.log('Setting up the template...');
      await importSeedData();
      console.log('Ready to go');
    } catch (error) {
      console.log('Could not import seed data');
      console.error(error);
    }
  } else {
    console.log(
      'Seed data has already been imported. We cannot reimport unless you clear your database first.'
    );
  }
}

async function isFirstRun() {
  const pluginStore = strapi.store({
    environment: strapi.config.environment,
    type: 'type',
    name: 'setup',
  });
  const initHasRun = await pluginStore.get({ key: 'initHasRun' });
  await pluginStore.set({ key: 'initHasRun', value: true });
  return !initHasRun;
}

async function setPublicPermissions(newPermissions) {
  // Find the ID of the public role
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: {
      type: 'public',
    },
  });

  // Create the new permissions and link them to the public role
  const allPermissionsToCreate = [];
  Object.keys(newPermissions).map((controller) => {
    const actions = newPermissions[controller];
    const permissionsToCreate = actions.map((action) => {
      return strapi.query('plugin::users-permissions.permission').create({
        data: {
          action: `api::${controller}.${controller}.${action}`,
          role: publicRole.id,
        },
      });
    });
    allPermissionsToCreate.push(...permissionsToCreate);
  });
  await Promise.all(allPermissionsToCreate);
}

function getFileSizeInBytes(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats['size'];
  return fileSizeInBytes;
}

function getFileData(fileName) {
  const filePath = path.join('data', 'uploads', fileName);
  // Parse the file metadata
  const size = getFileSizeInBytes(filePath);
  const ext = fileName.split('.').pop();
  const mimeType = mime.lookup(ext || '') || '';

  return {
    filepath: filePath,
    originalFileName: fileName,
    size,
    mimetype: mimeType,
  };
}

async function uploadFile(file, name) {
  return strapi
    .plugin('upload')
    .service('upload')
    .upload({
      files: file,
      data: {
        fileInfo: {
          alternativeText: `An image uploaded to Strapi called ${name}`,
          caption: name,
          name,
        },
      },
    });
}

// Create an entry and attach files if there are any
async function createEntry({ model, entry }) {
  try {
    // Actually create the entry in Strapi
    await strapi.documents(`api::${model}.${model}`).create({
      data: entry,
    });
  } catch (error) {
    console.error({ model, entry, error });
  }
}

async function checkFileExistsBeforeUpload(files) {
  const existingFiles = [];
  const uploadedFiles = [];
  const filesCopy = [...files];

  for (const fileName of filesCopy) {
    // Check if the file already exists in Strapi
    const fileWhereName = await strapi.query('plugin::upload.file').findOne({
      where: {
        name: fileName.replace(/\..*$/, ''),
      },
    });

    if (fileWhereName) {
      // File exists, don't upload it
      existingFiles.push(fileWhereName);
    } else {
      // File doesn't exist, upload it
      const fileData = getFileData(fileName);
      const fileNameNoExtension = fileName.split('.').shift();
      const [file] = await uploadFile(fileData, fileNameNoExtension);
      uploadedFiles.push(file);
    }
  }
  const allFiles = [...existingFiles, ...uploadedFiles];
  // If only one file then return only that file
  return allFiles.length === 1 ? allFiles[0] : allFiles;
}

async function updateBlocks(blocks) {
  const updatedBlocks = [];
  for (const block of blocks) {
    if (block.__component === 'shared.media') {
      const uploadedFiles = await checkFileExistsBeforeUpload([block.file]);
      // Copy the block to not mutate directly
      const blockCopy = { ...block };
      // Replace the file name on the block with the actual file
      blockCopy.file = uploadedFiles;
      updatedBlocks.push(blockCopy);
    } else if (block.__component === 'shared.slider') {
      // Get files already uploaded to Strapi or upload new files
      const existingAndUploadedFiles = await checkFileExistsBeforeUpload(block.files);
      // Copy the block to not mutate directly
      const blockCopy = { ...block };
      // Replace the file names on the block with the actual files
      blockCopy.files = existingAndUploadedFiles;
      // Push the updated block
      updatedBlocks.push(blockCopy);
    } else {
      // Just push the block as is
      updatedBlocks.push(block);
    }
  }

  return updatedBlocks;
}

async function importArticles() {
  for (const article of articles) {
    const cover = await checkFileExistsBeforeUpload([`${article.slug}.jpg`]);
    const updatedBlocks = await updateBlocks(article.blocks);

    await createEntry({
      model: 'article',
      entry: {
        ...article,
        cover,
        blocks: updatedBlocks,
        // Make sure it's not a draft
        publishedAt: Date.now(),
      },
    });
  }
}

async function importGlobal() {
  const favicon = await checkFileExistsBeforeUpload(['favicon.png']);
  const shareImage = await checkFileExistsBeforeUpload(['default-image.png']);
  return createEntry({
    model: 'global',
    entry: {
      ...global,
      favicon,
      // Make sure it's not a draft
      publishedAt: Date.now(),
      defaultSeo: {
        ...global.defaultSeo,
        shareImage,
      },
    },
  });
}

async function importAbout() {
  const updatedBlocks = await updateBlocks(about.blocks);

  await createEntry({
    model: 'about',
    entry: {
      ...about,
      blocks: updatedBlocks,
      // Make sure it's not a draft
      publishedAt: Date.now(),
    },
  });
}

async function importCategories() {
  for (const category of categories) {
    await createEntry({ model: 'category', entry: category });
  }
}

async function importAuthors() {
  for (const author of authors) {
    const avatar = await checkFileExistsBeforeUpload([author.avatar]);

    await createEntry({
      model: 'author',
      entry: {
        ...author,
        avatar,
      },
    });
  }
}

async function importSeedData() {
  // Allow read of application content types
  await setPublicPermissions({
    article: ['find', 'findOne'],
    category: ['find', 'findOne'],
    author: ['find', 'findOne'],
    global: ['find', 'findOne'],
    about: ['find', 'findOne'],
  });

  // Create all entries
  await importCategories();
  await importAuthors();
  await importArticles();
  await importGlobal();
  await importAbout();
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

async function ensurePermission(action, roleId) {
  const existing = await strapi.query('plugin::users-permissions.permission').findOne({
    where: { action, role: roleId },
  });

  if (!existing) {
    await strapi.query('plugin::users-permissions.permission').create({
      data: { action, role: roleId },
    });
  }
}

async function ensureMindBodyPermissions() {
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: { type: 'public' },
  });

  if (!publicRole) return;

  const permissions = {
    'mbr-site-copy': ['find'],
    'mbr-post': ['find', 'findOne'],
    'mbr-product': ['find', 'findOne'],
    'mbr-quote': ['find', 'findOne'],
    'mbr-homepage': ['find'],
  };

  for (const [controller, actions] of Object.entries(permissions)) {
    for (const action of actions) {
      await ensurePermission(`api::${controller}.${controller}.${action}`, publicRole.id);
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

async function ensureMindBodyContent() {
  await ensureMindBodyPermissions();

  await upsertSingle('api::mbr-site-copy.mbr-site-copy', { copy: mindbodySeed.siteCopy });
  await upsertCollection(
    'api::mbr-post.mbr-post',
    'slug',
    mindbodySeed.posts.map((post, index) => ({ ...post, order: index }))
  );
  await upsertCollection(
    'api::mbr-product.mbr-product',
    'url',
    mindbodySeed.products.map((product, index) => ({ ...product, order: index }))
  );
  await upsertCollection(
    'api::mbr-quote.mbr-quote',
    'order',
    mindbodySeed.quotes.map((quote, index) => ({ ...quote, order: index }))
  );

  const postDocs = await strapi.db.query('api::mbr-post.mbr-post').findMany({ orderBy: { order: 'asc' } });
  const productDocs = await strapi.db.query('api::mbr-product.mbr-product').findMany({ orderBy: { order: 'asc' } });
  const quoteDoc = await strapi.db.query('api::mbr-quote.mbr-quote').findOne({ where: { order: 0 } });

  await upsertSingle('api::mbr-homepage.mbr-homepage', {
    ...buildHomepageContent(mindbodySeed.siteCopy),
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

  await seedExampleApp();
  await ensureMindBodyContent();
  await app.destroy();

  process.exit(0);
}


module.exports = async () => {
  await seedExampleApp();
  await ensureMindBodyContent();
};