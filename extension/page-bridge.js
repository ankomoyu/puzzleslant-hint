(function() {
	//#region src/extension/hint/page-bridge.ts
	var HINT_CHANNEL = "slant-hint-extension-v1";
	var SITE_MODEL = "2026-08";
	function objectValue(target, key) {
		return target !== null && typeof target === "object" ? Reflect.get(target, key) : void 0;
	}
	function dimensionCandidate(width, height, source) {
		if (width === void 0 && height === void 0) return null;
		if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error(`${source}中的棋盘宽高不是整数。`);
		const checkedWidth = Number(width);
		const checkedHeight = Number(height);
		if (checkedWidth < 2 || checkedWidth > 50 || checkedHeight < 2 || checkedHeight > 50) throw new Error(`${source}中的棋盘尺寸 ${checkedWidth}×${checkedHeight} 超出 2..50。`);
		return {
			width: checkedWidth,
			height: checkedHeight,
			source
		};
	}
	function runtimeDimensions(cellStatus) {
		if (cellStatus.length < 2 || cellStatus.length > 50) throw new Error(`运行状态有 ${cellStatus.length} 行，超出 2..50。`);
		const first = cellStatus[0];
		if (!Array.isArray(first) || first.length < 2 || first.length > 50) throw new Error("运行状态第一行的方格数无效。");
		for (let row = 0; row < cellStatus.length; row += 1) {
			const values = cellStatus[row];
			if (!Array.isArray(values) || values.length !== first.length) throw new Error(`运行状态第 ${row + 1} 行的方格数与第一行不一致。`);
		}
		return {
			width: first.length,
			height: cellStatus.length,
			source: "网页运行状态矩阵"
		};
	}
	function domDimensions() {
		const gameElement = document.querySelector("#game");
		if (gameElement === null) return null;
		const match = /(?:^|\s)slant([0-9]+)x([0-9]+)(?:\s|$)/u.exec(gameElement.className);
		return match === null ? null : dimensionCandidate(Number(match[1]), Number(match[2]), "网页棋盘样式");
	}
	function readDimensions(game, settings, cellStatus) {
		const candidates = [
			dimensionCandidate(objectValue(game, "puzzleWidth"), objectValue(game, "puzzleHeight"), "网页 Game 对象"),
			dimensionCandidate(objectValue(settings, "puzzleWidth"), objectValue(settings, "puzzleHeight"), "网页题目设置"),
			runtimeDimensions(cellStatus),
			domDimensions()
		].filter((candidate) => candidate !== null);
		const first = candidates[0];
		if (first === void 0) throw new Error("没有找到当前棋盘尺寸。");
		for (const candidate of candidates.slice(1)) if (candidate.width !== first.width || candidate.height !== first.height) throw new Error(`${first.source}给出 ${first.width}×${first.height}，但${candidate.source}给出 ${candidate.width}×${candidate.height}。`);
		return first;
	}
	function captureRuntimeState() {
		const game = Reflect.get(globalThis, "Game");
		if (game === void 0 || game === null) throw new Error("没有找到 puzzle-slant 的 Game 对象；请等待题目加载完成。");
		let settings;
		const getSettings = objectValue(game, "getSettings");
		if (typeof getSettings === "function") settings = Reflect.apply(getSettings, game, []);
		const taskFromSettings = objectValue(settings, "task");
		const taskFromPage = Reflect.get(globalThis, "task");
		const task = typeof taskFromSettings === "string" && taskFromSettings.length > 0 ? taskFromSettings : taskFromPage;
		if (typeof task !== "string" || task.length === 0) throw new Error("没有找到当前题目的 task。");
		const cellStatus = objectValue(objectValue(game, "currentState"), "cellStatus");
		if (!Array.isArray(cellStatus)) throw new Error("没有找到当前题目的 cellStatus。");
		const dimensions = readDimensions(game, settings, cellStatus);
		return {
			siteModel: SITE_MODEL,
			task,
			width: dimensions.width,
			height: dimensions.height,
			cellStatus: cellStatus.map((row) => Array.isArray(row) ? [...row] : row)
		};
	}
	function isCaptureRequest(value) {
		return objectValue(value, "channel") === HINT_CHANNEL && objectValue(value, "type") === "capture-request" && typeof objectValue(value, "requestId") === "string";
	}
	globalThis.addEventListener("message", (event) => {
		if (event.source !== window || !isCaptureRequest(event.data)) return;
		try {
			globalThis.postMessage({
				channel: HINT_CHANNEL,
				type: "capture-response",
				requestId: event.data.requestId,
				ok: true,
				value: captureRuntimeState()
			}, "*");
		} catch (error) {
			globalThis.postMessage({
				channel: HINT_CHANNEL,
				type: "capture-response",
				requestId: event.data.requestId,
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			}, "*");
		}
	});
	globalThis.postMessage({
		channel: HINT_CHANNEL,
		type: "bridge-ready"
	}, "*");
	//#endregion
})();
