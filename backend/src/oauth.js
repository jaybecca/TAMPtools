import crypto from 'node:crypto';

export const OAUTH_PROVIDERS = ['facebook','instagram','linkedin','x','tiktok','whatsapp'];
const upper = provider => String(provider).toUpperCase();
const configured = provider => Boolean(process.env[`${upper(provider)}_CLIENT_ID`] && process.env[`${upper(provider)}_CLIENT_SECRET`]);

export function providerConfig(provider, req) {
  const key=String(provider||'').toLowerCase();
  if(!OAUTH_PROVIDERS.includes(key) || !configured(key)) return null;
  const u=upper(key);
  const base=process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return {
    provider:key,
    clientId:process.env[`${u}_CLIENT_ID`],
    clientSecret:process.env[`${u}_CLIENT_SECRET`],
    authUrl:process.env[`${u}_AUTH_URL`],
    tokenUrl:process.env[`${u}_TOKEN_URL`],
    scopes:process.env[`${u}_SCOPES`] || '',
    redirectUri:`${base}/api/social/${key}/callback`
  };
}

export function createState() { return crypto.randomBytes(32).toString('hex'); }
export function hashState(state) { return crypto.createHash('sha256').update(state).digest('hex'); }

export function buildAuthorizationUrl(config,state) {
  const url=new URL(config.authUrl);
  url.searchParams.set('client_id',config.clientId);
  url.searchParams.set('redirect_uri',config.redirectUri);
  url.searchParams.set('response_type','code');
  if(config.scopes) url.searchParams.set('scope',config.scopes);
  url.searchParams.set('state',state);
  return url.toString();
}

export async function exchangeCode(config, code, state) {
  if(!config?.tokenUrl) throw new Error('OAuth token URL is not configured for this provider.');
  const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:config.redirectUri,client_id:config.clientId,client_secret:config.clientSecret});
  const response=await fetch(config.tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error_description || data.error?.message || `OAuth token exchange failed with HTTP ${response.status}`);
  return {...data,providerState:state};
}
