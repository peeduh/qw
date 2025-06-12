import config from '../../config.json';

export function createProxyUrl(url, headers = {}) {
  if (!url) return '';
  
  const proxyUrl = config.m3u8proxy;
  
  if (!proxyUrl) {
    console.error('Proxy URL not defined in config.json');
    return url;
  }
  
  const encodedUrl = encodeURIComponent(url);
  const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
  
  return `${proxyUrl}/m3u8-proxy?url=${encodedUrl}&headers=${encodedHeaders}`;
}

export function createTsProxyUrl(url, headers = {}) {
  if (!url) return '';
  
  const proxyUrl = config.m3u8proxy;
  
  const encodedUrl = encodeURIComponent(url);
  const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
  
  return `${proxyUrl}/ts-proxy?url=${encodedUrl}&headers=${encodedHeaders}`;
}

export function shouldUseProxy(url) {
  if (!url) return false;
  
  return url.includes('.m3u8') || url.toLowerCase().includes('stream') || url.includes('.ts');
}

export function createProxyHeaders(url) {
  if (!url) return {};
  
  try {
    const urlObj = new URL(url);
    const origin = `${urlObj.protocol}//${urlObj.hostname}`;
    
    return {
      'Origin': origin,
      'Referer': origin + '/'
    };
  } catch (error) {
    console.error('Error creating proxy headers:', error);
    return {};
  }
}

export function isProxiedUrl(url) {
  if (!url) return false;
  return url.includes(config.m3u8proxy);
}