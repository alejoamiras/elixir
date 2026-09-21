const APEX = 'yacana.network';

/** 301 to the same path and query on the apex over https; HSTS so the browser stops asking. */
export const redirect = (request: Request): Response => {
  const url = new URL(request.url);
  url.protocol = 'https:';
  url.hostname = APEX;
  url.port = '';
  return new Response(null, {
    status: 301,
    headers: {
      Location: url.toString(),
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
  });
};

export default { fetch: redirect };
