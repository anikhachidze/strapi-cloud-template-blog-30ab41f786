import type { Schema, Struct } from '@strapi/strapi';

export interface MbrHomeHero extends Struct.ComponentSchema {
  collectionName: 'components_mbr_home_heroes';
  info: {
    description: 'Editable homepage hero with localized copy, CTAs, and optional media';
    displayName: 'Home Hero';
    icon: 'landscape';
  };
  attributes: {
    badgeEn: Schema.Attribute.String;
    badgeKa: Schema.Attribute.String;
    cardBodyEn: Schema.Attribute.Text;
    cardBodyKa: Schema.Attribute.Text;
    leadEn: Schema.Attribute.Text;
    leadKa: Schema.Attribute.Text;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    mediaCaptionEn: Schema.Attribute.Text;
    mediaCaptionKa: Schema.Attribute.Text;
    primaryLabelEn: Schema.Attribute.String;
    primaryLabelKa: Schema.Attribute.String;
    primaryUrl: Schema.Attribute.String;
    quoteEn: Schema.Attribute.Text;
    quoteKa: Schema.Attribute.Text;
    secondaryLabelEn: Schema.Attribute.String;
    secondaryLabelKa: Schema.Attribute.String;
    secondaryUrl: Schema.Attribute.String;
    titleEn: Schema.Attribute.String & Schema.Attribute.Required;
    titleKa: Schema.Attribute.String & Schema.Attribute.Required;
    videoUrl: Schema.Attribute.String;
  };
}

export interface MbrHomeMessage extends Struct.ComponentSchema {
  collectionName: 'components_mbr_home_messages';
  info: {
    description: 'Localized title and body for inline homepage notices';
    displayName: 'Home Message';
    icon: 'information';
  };
  attributes: {
    bodyEn: Schema.Attribute.Text & Schema.Attribute.Required;
    bodyKa: Schema.Attribute.Text & Schema.Attribute.Required;
    titleEn: Schema.Attribute.String;
    titleKa: Schema.Attribute.String;
  };
}

export interface MbrHomeSection extends Struct.ComponentSchema {
  collectionName: 'components_mbr_home_sections';
  info: {
    description: 'Localized eyebrow, title, and supporting text for a homepage section';
    displayName: 'Home Section';
    icon: 'layout';
  };
  attributes: {
    bodyEn: Schema.Attribute.Text;
    bodyKa: Schema.Attribute.Text;
    eyebrowEn: Schema.Attribute.String;
    eyebrowKa: Schema.Attribute.String;
    titleEn: Schema.Attribute.String & Schema.Attribute.Required;
    titleKa: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface MbrHomeVideo extends Struct.ComponentSchema {
  collectionName: 'components_mbr_home_videos';
  info: {
    description: 'Optional homepage video block with localized copy and poster image';
    displayName: 'Home Video';
    icon: 'play';
  };
  attributes: {
    bodyEn: Schema.Attribute.Text;
    bodyKa: Schema.Attribute.Text;
    poster: Schema.Attribute.Media<'images'>;
    titleEn: Schema.Attribute.String;
    titleKa: Schema.Attribute.String;
    videoUrl: Schema.Attribute.String;
  };
}

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    displayName: 'Media';
    icon: 'file-video';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
  };
}

export interface SharedQuote extends Struct.ComponentSchema {
  collectionName: 'components_shared_quotes';
  info: {
    displayName: 'Quote';
    icon: 'indent';
  };
  attributes: {
    body: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Rich text';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.RichText;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: '';
    displayName: 'Seo';
    icon: 'allergies';
    name: 'Seo';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedSlider extends Struct.ComponentSchema {
  collectionName: 'components_shared_sliders';
  info: {
    description: '';
    displayName: 'Slider';
    icon: 'address-book';
  };
  attributes: {
    files: Schema.Attribute.Media<'images', true>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'mbr.home-hero': MbrHomeHero;
      'mbr.home-message': MbrHomeMessage;
      'mbr.home-section': MbrHomeSection;
      'mbr.home-video': MbrHomeVideo;
      'shared.media': SharedMedia;
      'shared.quote': SharedQuote;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'shared.slider': SharedSlider;
    }
  }
}
