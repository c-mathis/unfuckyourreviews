const SOURCE_BY_HOST = Object.freeze({
  'unfuckyourweb.com': 'web',
  'www.unfuckyourweb.com': 'web',
  'unfuckyourreviews.com': 'reviews',
  'www.unfuckyourreviews.com': 'reviews',
  'unfuckyourads.com': 'ads',
  'www.unfuckyourads.com': 'ads',
  'unfuckyourtaxes.com': 'taxes',
  'www.unfuckyourtaxes.com': 'taxes',
  'cmathisdigital.com': 'cmd',
  'www.cmathisdigital.com': 'cmd',
});

const EXPLICIT_SOURCES = Object.freeze({
  unfuckyourweb: 'web',
  unfuckyourreviews: 'reviews',
  unfuckyourads: 'ads',
  unfuckyourtaxes: 'taxes',
  ufyt: 'taxes',
  cmd: 'cmd',
  cmathisdigital: 'cmd',
});

export function resolveLeadSource(referer, data = {}) {
  try {
    const hostname = new URL(referer).hostname.toLowerCase();
    if (SOURCE_BY_HOST[hostname]) return SOURCE_BY_HOST[hostname];
  } catch {
    // The explicit source is the restricted fallback for local previews.
  }

  return EXPLICIT_SOURCES[data.source] || EXPLICIT_SOURCES[data.brand] || 'unknown';
}

export function getMetaConfig(source, env = {}) {
  if (source === 'taxes') {
    return {
      token: env.UFYT_META_ACCESS_TOKEN,
      pixelId: '1708599440630382',
      contentName: 'Tax Help Request',
    };
  }

  if (source === 'cmd') {
    return {
      token: env.CMD_META_ACCESS_TOKEN || env.META_ACCESS_TOKEN,
      pixelId: '1073785078991974',
      contentName: 'CMD Website Diagnostic',
    };
  }

  return {
    token: env.META_ACCESS_TOKEN,
    pixelId: '1494351685495599',
    contentName: null,
  };
}

export function canSendMetaEvent(source, data = {}) {
  if (!['web', 'reviews', 'ads', 'taxes', 'cmd'].includes(source)) return false;
  return source !== 'cmd' || data.marketing_consent === true;
}
