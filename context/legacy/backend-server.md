This is the code running on localhosy:8181

It is a FastEdge runner that is just taking the request and serving a response with the recieved data.
It is used to help debug the throughput for the wasm output.

async function app(event: FetchEvent): Promise<Response> {
  const requestUrl = new URL(event.request.url);
  const reqHeaders: Record<string, string> = {};

  event.request.headers.forEach((value, key) => {
    console.log(`Header: ${key} = ${value}`);
    reqHeaders[key] = value;
  });

  return Response.json({
    hello: "http-responder works!",
    method: event.request.method,
    reqHeaders: reqHeaders,
    reqBody: await event.request.text(),
    requestUrl: requestUrl.toString(),
  });
}

addEventListener("fetch", (event) => {
  event.respondWith(app(event));
});

