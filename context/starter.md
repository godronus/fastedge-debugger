I am one of the developers of the fastege product. It provides SDK's for both http and cdn applications built into wasm binaries that run on our service.

* The Http binaries use the component model and a WASI interface. At present we have a vscode extension with a home built runner that allows our users to easily run these http-wasm binaries and send requests to them a read and see there output including all   console logging during a run.

I am now looking to try and creater a similar interface for our CDN binaries.

Our CDN applications are built into wasm using the proxy-wasm ABI as standard wasm modules.

I would like to try and build a test-runner interface that can start the WASM binary and send a basic request through the proxy-wasm hooks. Showing debug data to the UI.

e.g. onRequestHeaders, OnRequestBody, onResponseHeaders, onResponseBody

I would code all of this in typescript. Allowing for a nice user interface something similar to Postman. The user would be able to set up a request with all teh required header, method, data etc..

Then when hitting send it would call into the WASM binary and let you debug the request flowing through each hook.

There would need to be a way in the ui to setup basic config for onjecting values into the WASM enviornment so users can set values for results when running: get_property like functions.

How would you achieve this? Give me some high level ideas and concepts of best tools.

