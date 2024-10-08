/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const base = "https://ecwrd.com";
    const statusCode = 301;

    const url = new URL(request.url);

    // This worker will accept requests to "[WORKER_URL]/?image=https://example.com/image.jpg&width=256&height=256&fit=crop&format=webp&quality=75"

    // The list of domains that we will allow to be transformed
    const allowedDomainPatterns = [/.*\.ethancoward\.dev/, /.*ethancoward\.com/, /.*ecwrd\.com/, /i\.scdn\.co/];

    // Cloudflare-specific options are in the cf object
    const options = { cf: { image: {} } };

    // Copy parameters from query string to request options.
    if (url.searchParams.has("fit")) options.cf.image.fit = url.searchParams.get("fit");
    if (url.searchParams.has("width")) options.cf.image.width = url.searchParams.get("width");
    if (url.searchParams.has("height")) options.cf.image.height = url.searchParams.get("height");
    if (url.searchParams.has("quality")) options.cf.image.quality = url.searchParams.get("quality");

    // Your Worker is responsible for automatic format negotiation. Check the Accept header.
    const accept = request.headers.get("Accept");
    if (/image\/avif/.test(accept)) {
      options.cf.image.format = "avif";
    } else if (/image\/webp/.test(accept)) {
      options.cf.image.format = "webp";
    }

    // Get URL of the original (full size) image to resize.
    // You could adjust the URL here, e.g., prefix it with a fixed address of your server,
    // so that user-visible URLs are shorter and cleaner.
    const imageURL = url.searchParams.get("image");
    if (!imageURL) return new Response('Missing "image" value', { status: 400 });

    try {
      // Parse the imageURL as a URL object
      const imageURLObj = new URL(imageURL);
      const { hostname, pathname } = imageURLObj;

      // Now, check if the domain is allowed to be transformed
      const imageDomain = imageURLObj.hostname;
      if (!allowedDomainPatterns.some((pattern) => pattern.test(imageDomain))) {
        return new Response("Domain not allowed", { status: 403 });
      }

      // Also check if the file extension is allowed
      if (!/\.(jpe?g|png|gif|webp|svg)$/i.test(pathname)) {
        return new Response("Disallowed file extension", { status: 400 });
      }
    } catch (error) {
      console.error(error);
      return new Response("Invalid URL", { status: 400 });
    }

    // Convert the options to a comma separated string (e.g., width=256,height=256,fit=crop,format=webp,quality=75)
    const optionsString = Object.entries(options.cf.image)
      .map(([key, value]) => `${key}=${value}`)
      .join(",");

    // Build the URL of the transformed image
    const transformedURL = `https://ecwrd.com/cdn-cgi/image/${optionsString}/${imageURL}`;

    // Now build a request that passes through the request headers
    const imageRequest = new Request(transformedURL, {
      headers: request.headers,
    });

    // Fetch the image from the transformation service and return it
    return fetch(imageRequest, options);
  },
} satisfies ExportedHandler<Env>;
