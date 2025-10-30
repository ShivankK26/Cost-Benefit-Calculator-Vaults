export const runtime = "edge";

const FLUID_BASE = "https://api.fluid.instadapp.io";

async function proxy(request: Request, path: string) {
	const url = new URL(request.url);
	const target = `${FLUID_BASE}/${path}${url.search}`;

	const headers = new Headers(request.headers);
	// Remove headers that shouldn't be forwarded
	headers.delete("host");
	headers.delete("content-length");

	const init: RequestInit = {
		method: request.method,
		headers,
		body: request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined,
		redirect: "follow",
		cache: "no-store",
	};

	const res = await fetch(target, init);
	return new Response(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers: res.headers,
	});
}

type ParamsPromise = { params: Promise<{ path: string[] }> };

async function getJoinedPath(paramsPromise: Promise<{ path: string[] }>): Promise<string> {
	const p = await paramsPromise;
	return (p?.path ?? []).join("/");
}

export async function GET(request: Request, ctx: ParamsPromise) {
	const path = await getJoinedPath(ctx.params);
	return proxy(request, path);
}

export async function POST(request: Request, ctx: ParamsPromise) {
	const path = await getJoinedPath(ctx.params);
	return proxy(request, path);
}

export async function PUT(request: Request, ctx: ParamsPromise) {
	const path = await getJoinedPath(ctx.params);
	return proxy(request, path);
}

export async function DELETE(request: Request, ctx: ParamsPromise) {
	const path = await getJoinedPath(ctx.params);
	return proxy(request, path);
}

export async function PATCH(request: Request, ctx: ParamsPromise) {
	const path = await getJoinedPath(ctx.params);
	return proxy(request, path);
}


