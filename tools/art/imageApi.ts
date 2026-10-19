// Talking to an image-generation service. "Provider-agnostic" here means: any service that speaks the widespread
// OpenAI-style "images/generations" request works (OpenAI itself, and many compatible gateways). Set in .env:
//   IMAGE_API_KEY=...                     (without a key, gen-image only prints the prompts)
//   IMAGE_API_URL=https://api.openai.com/v1/images/generations   (default)
//   IMAGE_MODEL=...                       (the service's image model name)
//   IMAGE_SIZE=1024x1024                  (optional: one size for every picture; otherwise each asset gets a shape
//                                          that suits it, see sizeFor, or its own `gen_size:` in art/assets.yml)

export interface ImageApiSettings {
    key: string;
    url: string;
    model?: string;
    /** From IMAGE_SIZE: one size for everything that does not name its own. */
    size?: string;
}

/**
 * The picture shape to ask the service for, as "WxH". The sizes are the three that OpenAI-style services accept.
 *  1. the asset's own `gen_size:` in assets.yml wins;  2. then IMAGE_SIZE from .env;
 *  3. otherwise a shape that suits the asset: backgrounds are wide (the scene is 320x144), a character sheet takes the
 *     shape of its grid (3 columns x 4 rows is portrait), everything else is square.
 */
export function sizeFor(asset: { type: string; grid?: [number, number]; genSize?: string }, envSize?: string): string {
    if (asset.genSize) return asset.genSize;
    if (envSize) return envSize;
    if (asset.type === 'background') return '1536x1024';
    if (asset.type === 'sheet' && asset.grid) {
        const [columns, rows] = asset.grid;
        return columns > rows ? '1536x1024' : columns < rows ? '1024x1536' : '1024x1024';
    }
    return '1024x1024';
}

export function readSettings(env: Record<string, string | undefined>): ImageApiSettings | undefined {
    if (!env.IMAGE_API_KEY) return undefined;
    return {
        key: env.IMAGE_API_KEY,
        url: env.IMAGE_API_URL || 'https://api.openai.com/v1/images/generations',
        model: env.IMAGE_MODEL || undefined,
        size: env.IMAGE_SIZE || undefined,
    };
}

export function buildRequest(settings: ImageApiSettings & { size: string }, prompt: string): { url: string; init: { method: string; headers: Record<string, string>; body: string } } {
    const body: Record<string, unknown> = { prompt, size: settings.size, n: 1 };
    if (settings.model) body.model = settings.model;
    return {
        url: settings.url,
        init: { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.key}` }, body: JSON.stringify(body) },
    };
}

/** The picture in a response: either base64 data or a URL to download. */
export function extractImage(response: unknown): { base64: string } | { url: string } | undefined {
    const first = (response as { data?: { b64_json?: string; url?: string }[] } | null)?.data?.[0];
    if (first?.b64_json) return { base64: first.b64_json };
    if (first?.url) return { url: first.url };
    return undefined;
}

export async function generate(settings: ImageApiSettings & { size: string }, prompt: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
    const { url, init } = buildRequest(settings, prompt);
    const response = await fetchImpl(url, init);
    if (!response.ok) throw new Error(`The image service answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const image = extractImage(await response.json());
    if (!image) throw new Error('The image service sent no picture (expected data[0].b64_json or data[0].url).');
    if ('base64' in image) return Buffer.from(image.base64, 'base64');
    const download = await fetchImpl(image.url);
    if (!download.ok) throw new Error(`Could not download the picture: ${download.status}`);
    return Buffer.from(await download.arrayBuffer());
}
