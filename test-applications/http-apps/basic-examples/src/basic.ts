async function eventHandler(event: FetchEvent): Promise<Response> {
  const request = event.request;
  return new Response(`You made a request to ${request.url}`);
}

addEventListener("fetch", (event) => {
  event.respondWith(eventHandler(event));
});
