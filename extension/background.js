(function() {
	//#region src/extension/hint/background.ts
	var ZOOM_CHANNEL = "slant-hint-extension-zoom-v1";
	function objectValue(target, key) {
		return target !== null && typeof target === "object" ? Reflect.get(target, key) : void 0;
	}
	var chromeApi = objectValue(globalThis, "chrome");
	var runtime = objectValue(chromeApi, "runtime");
	var tabs = objectValue(chromeApi, "tabs");
	function sendZoom(tabId, zoomFactor) {
		const sendMessage = objectValue(tabs, "sendMessage");
		if (typeof sendMessage !== "function") return;
		try {
			Reflect.apply(sendMessage, tabs, [
				tabId,
				{
					channel: ZOOM_CHANNEL,
					type: "zoom-changed",
					zoomFactor
				},
				() => {
					objectValue(runtime, "lastError");
				}
			]);
		} catch {}
	}
	var onMessage = objectValue(runtime, "onMessage");
	var addMessageListener = objectValue(onMessage, "addListener");
	if (typeof addMessageListener === "function") Reflect.apply(addMessageListener, onMessage, [(message, sender, sendResponse) => {
		if (objectValue(message, "channel") !== ZOOM_CHANNEL || objectValue(message, "type") !== "get-zoom") return false;
		const tabId = objectValue(objectValue(sender, "tab"), "id");
		const getZoom = objectValue(tabs, "getZoom");
		if (!Number.isInteger(tabId) || typeof getZoom !== "function") {
			sendResponse({
				ok: false,
				zoomFactor: 1
			});
			return false;
		}
		try {
			Reflect.apply(getZoom, tabs, [Number(tabId), (zoomFactor) => {
				const failed = objectValue(runtime, "lastError") !== void 0;
				sendResponse({
					ok: !failed,
					zoomFactor: failed ? 1 : zoomFactor
				});
			}]);
			return true;
		} catch {
			sendResponse({
				ok: false,
				zoomFactor: 1
			});
			return false;
		}
	}]);
	var onZoomChange = objectValue(tabs, "onZoomChange");
	var addZoomListener = objectValue(onZoomChange, "addListener");
	if (typeof addZoomListener === "function") Reflect.apply(addZoomListener, onZoomChange, [(info) => {
		const tabId = objectValue(info, "tabId");
		const zoomFactor = objectValue(info, "newZoomFactor");
		if (Number.isInteger(tabId) && typeof zoomFactor === "number") sendZoom(Number(tabId), zoomFactor);
	}]);
	//#endregion
})();
