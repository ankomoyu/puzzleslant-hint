(function() {
	function orientationMask(orientation) {
		return orientation === "R" ? 1 : 2;
	}
	function maskHasOrientation(domain, orientation) {
		return (domain & orientationMask(orientation)) !== 0;
	}
	function isFixedDomain(domain) {
		return domain === 1 || domain === 2;
	}
	function fixedOrientation(domain) {
		if (domain === 1) return "R";
		if (domain === 2) return "L";
		return null;
	}
	function oppositeOrientation(orientation) {
		return orientation === "R" ? "L" : "R";
	}
	function cellKey$1(cell) {
		return `${cell.r},${cell.c}`;
	}
	function vertexKey(vertex) {
		return `${vertex.r},${vertex.c}`;
	}
	function sameCell(a, b) {
		return a.r === b.r && a.c === b.c;
	}
	function sameVertex(a, b) {
		return a.r === b.r && a.c === b.c;
	}
	//#endregion
	//#region src/domain/board.ts
	function getCellDomain(board, cell) {
		const domain = board.cellDomains[cell.r]?.[cell.c];
		if (domain === void 0) throw new RangeError(`方格越界：C(${cell.r},${cell.c})`);
		return domain;
	}
	//#endregion
	//#region src/domain/geometry.ts
	function isCellInBounds(width, height, cell) {
		return cell.r >= 0 && cell.r < height && cell.c >= 0 && cell.c < width;
	}
	function isBoundaryVertex(width, height, vertex) {
		return vertex.r === 0 || vertex.r === height || vertex.c === 0 || vertex.c === width;
	}
	function cellEndpoints(cell, orientation) {
		if (orientation === "R") return [{
			r: cell.r,
			c: cell.c
		}, {
			r: cell.r + 1,
			c: cell.c + 1
		}];
		return [{
			r: cell.r,
			c: cell.c + 1
		}, {
			r: cell.r + 1,
			c: cell.c
		}];
	}
	function incidentCells(width, height, vertex) {
		const result = [];
		const candidates = [
			{
				cell: {
					r: vertex.r,
					c: vertex.c
				},
				connectOrientation: "R"
			},
			{
				cell: {
					r: vertex.r - 1,
					c: vertex.c - 1
				},
				connectOrientation: "R"
			},
			{
				cell: {
					r: vertex.r - 1,
					c: vertex.c
				},
				connectOrientation: "L"
			},
			{
				cell: {
					r: vertex.r,
					c: vertex.c - 1
				},
				connectOrientation: "L"
			}
		];
		for (const candidate of candidates) if (isCellInBounds(width, height, candidate.cell)) result.push(candidate);
		result.sort((a, b) => a.cell.r - b.cell.r || a.cell.c - b.cell.c);
		return result;
	}
	function allFixedEdges(board) {
		const edges = [];
		for (let r = 0; r < board.height; r += 1) for (let c = 0; c < board.width; c += 1) {
			const domain = board.cellDomains[r]?.[c];
			const orientation = domain === 1 ? "R" : domain === 2 ? "L" : null;
			if (orientation === null) continue;
			const cell = {
				r,
				c
			};
			const [from, to] = cellEndpoints(cell, orientation);
			edges.push({
				cell,
				orientation,
				from,
				to
			});
		}
		return edges;
	}
	//#endregion
	//#region src/domain/connectivity.ts
	var DisjointSet$2 = class {
		parent;
		rank;
		constructor(size) {
			this.parent = Array.from({ length: size }, (_, index) => index);
			this.rank = Array(size).fill(0);
		}
		find(value) {
			let root = value;
			while (this.parent[root] !== root) root = this.parent[root] ?? root;
			let current = value;
			while (this.parent[current] !== current) {
				const next = this.parent[current] ?? current;
				this.parent[current] = root;
				current = next;
			}
			return root;
		}
		union(left, right) {
			let a = this.find(left);
			let b = this.find(right);
			if (a === b) return;
			const rankA = this.rank[a] ?? 0;
			const rankB = this.rank[b] ?? 0;
			if (rankA < rankB) [a, b] = [b, a];
			this.parent[b] = a;
			if (rankA === rankB) this.rank[a] = rankA + 1;
		}
	};
	function vertexIndex$1(width, vertex) {
		return vertex.r * (width + 1) + vertex.c;
	}
	function vertexFromIndex(width, index) {
		return {
			r: Math.floor(index / (width + 1)),
			c: index % (width + 1)
		};
	}
	function pathInAdjacency(width, adjacency, start, goal) {
		const startIndex = vertexIndex$1(width, start);
		const goalIndex = vertexIndex$1(width, goal);
		const previous = Array(adjacency.length).fill(-1);
		const previousEdge = Array(adjacency.length);
		const queue = [startIndex];
		previous[startIndex] = startIndex;
		let head = 0;
		while (head < queue.length && previous[goalIndex] === -1) {
			const current = queue[head];
			head += 1;
			if (current === void 0) break;
			for (const entry of adjacency[current] ?? []) {
				const next = vertexIndex$1(width, entry.vertex);
				if (previous[next] !== -1) continue;
				previous[next] = current;
				previousEdge[next] = entry;
				queue.push(next);
			}
		}
		if (previous[goalIndex] === -1) return null;
		const reversedVertices = [goal];
		const reversedEdges = [];
		let current = goalIndex;
		while (current !== startIndex) {
			const parent = previous[current];
			const entry = previousEdge[current];
			if (parent === void 0 || parent < 0 || entry === void 0) return null;
			const from = vertexFromIndex(width, parent);
			const to = vertexFromIndex(width, current);
			reversedEdges.push({
				from,
				to,
				cell: entry.cell,
				orientation: entry.orientation
			});
			reversedVertices.push(from);
			current = parent;
		}
		return {
			vertices: reversedVertices.reverse(),
			edges: reversedEdges.reverse()
		};
	}
	function buildConnectivityIndex(board) {
		const vertexCount = (board.width + 1) * (board.height + 1);
		const disjointSet = new DisjointSet$2(vertexCount);
		const adjacency = Array.from({ length: vertexCount }, () => []);
		const fixedEdges = allFixedEdges(board);
		let fixedCycle;
		for (const edge of fixedEdges) {
			const fromIndex = vertexIndex$1(board.width, edge.from);
			const toIndex = vertexIndex$1(board.width, edge.to);
			if (fixedCycle === void 0 && disjointSet.find(fromIndex) === disjointSet.find(toIndex)) {
				const path = pathInAdjacency(board.width, adjacency, edge.from, edge.to);
				if (path !== null) fixedCycle = {
					...path,
					closingEdge: { ...edge }
				};
			}
			disjointSet.union(fromIndex, toIndex);
			adjacency[fromIndex]?.push({
				vertex: edge.to,
				cell: edge.cell,
				orientation: edge.orientation
			});
			adjacency[toIndex]?.push({
				vertex: edge.from,
				cell: edge.cell,
				orientation: edge.orientation
			});
		}
		const verticesByRoot = /* @__PURE__ */ new Map();
		for (let index = 0; index < vertexCount; index += 1) {
			const root = disjointSet.find(index);
			const list = verticesByRoot.get(root) ?? [];
			list.push(vertexFromIndex(board.width, index));
			verticesByRoot.set(root, list);
		}
		const roots = [...verticesByRoot.keys()].sort((left, right) => {
			const leftVertex = verticesByRoot.get(left)?.[0];
			const rightVertex = verticesByRoot.get(right)?.[0];
			return (leftVertex?.r ?? 0) - (rightVertex?.r ?? 0) || (leftVertex?.c ?? 0) - (rightVertex?.c ?? 0);
		});
		const componentIdByRoot = new Map(roots.map((root, id) => [root, id]));
		const componentOfVertex = Array(vertexCount);
		for (let index = 0; index < vertexCount; index += 1) {
			const componentId = componentIdByRoot.get(disjointSet.find(index));
			if (componentId === void 0) throw new Error("无法确定顶点所属连通分量。");
			componentOfVertex[index] = componentId;
		}
		const components = roots.map((root, id) => {
			const vertices = verticesByRoot.get(root) ?? [];
			return {
				id,
				vertices,
				fixedEdges: fixedEdges.filter((edge) => componentOfVertex[vertexIndex$1(board.width, edge.from)] === id).map((edge) => ({ ...edge })),
				touchesBoundary: vertices.some((vertex) => isBoundaryVertex(board.width, board.height, vertex))
			};
		});
		return {
			width: board.width,
			height: board.height,
			revision: board.revision,
			components,
			componentOfVertex,
			adjacency,
			...fixedCycle === void 0 ? {} : { fixedCycle }
		};
	}
	function componentIdAt(index, vertex) {
		const componentId = index.componentOfVertex[vertexIndex$1(index.width, vertex)];
		if (componentId === void 0) throw new RangeError(`顶点 V(${vertex.r},${vertex.c}) 越界。`);
		return componentId;
	}
	function findFixedPath(index, start, goal) {
		if (index.width < 0 || index.height < 0) return null;
		if (componentIdAt(index, start) !== componentIdAt(index, goal)) return null;
		if (sameVertex(start, goal)) return {
			vertices: [start],
			edges: []
		};
		return pathInAdjacency(index.width, index.adjacency, start, goal);
	}
	//#endregion
	//#region src/domain/difficulty.ts
	var STEP_DIFFICULTIES = {
		intro: {
			id: "intro",
			level: 1,
			displayName: "入门",
			colorName: "浅绿"
		},
		basic: {
			id: "basic",
			level: 2,
			displayName: "基础",
			colorName: "绿"
		},
		advanced: {
			id: "advanced",
			level: 3,
			displayName: "进阶",
			colorName: "黄"
		},
		path: {
			id: "path",
			level: 4,
			displayName: "路径",
			colorName: "深黄"
		},
		"same-direction": {
			id: "same-direction",
			level: 5,
			displayName: "同向链",
			colorName: "红"
		}
	};
	function objectValue$2(value) {
		return typeof value === "object" && value !== null ? value : null;
	}
	function edgeCount(value) {
		const record = objectValue$2(value);
		if (record === null || !Array.isArray(record.edges)) return null;
		return record.edges.length + 1;
	}
	function immediateCycleLengths(step) {
		const direct = edgeCount(step.premises.fixedPath) ?? edgeCount(step.premises.path);
		if (direct !== null) return [direct];
		const paths = objectValue$2(step.premises.paths);
		if (paths === null) return [];
		return Object.values(paths).flatMap((path) => {
			const length = edgeCount(path);
			return length === null ? [] : [length];
		});
	}
	function isSimpleDiagonalOnePair(step) {
		if (step.rule.id !== "SL-PTH-303") return false;
		const facts = step.premises.terminalFacts;
		if (!Array.isArray(facts) || facts.length < 2) return false;
		return facts.every((fact) => objectValue$2(fact)?.isolatedInternalOne === true);
	}
	function difficultyForStep(step) {
		if (step.rule.id.startsWith("SL-WDG-")) return STEP_DIFFICULTIES["same-direction"];
		if (step.rule.id === "SL-CNT-001") return STEP_DIFFICULTIES.intro;
		if (step.rule.id === "SL-CNT-020") return STEP_DIFFICULTIES.advanced;
		if (step.rule.id === "SL-CNT-010") return step.involved.vertices.length === 2 ? STEP_DIFFICULTIES.basic : STEP_DIFFICULTIES.advanced;
		if (step.rule.id === "SL-CYC-201") {
			const lengths = immediateCycleLengths(step);
			return lengths.length > 0 && lengths.every((length) => length === 4 || length === 6) ? STEP_DIFFICULTIES.basic : STEP_DIFFICULTIES.advanced;
		}
		if (step.rule.id === "SL-CYC-202") return STEP_DIFFICULTIES.advanced;
		if (isSimpleDiagonalOnePair(step)) return STEP_DIFFICULTIES.basic;
		return STEP_DIFFICULTIES.path;
	}
	//#endregion
	//#region src/domain/reasoning.ts
	function hasContradiction(step) {
		return step.conclusions.some((conclusion) => conclusion.kind === "report-contradiction");
	}
	function compareReasoningSteps(a, b) {
		for (let index = 0; index < a.sortKey.length; index += 1) {
			const left = a.sortKey[index];
			const right = b.sortKey[index];
			if (left === right) continue;
			if (typeof left === "number" && typeof right === "number") return left - right;
			return String(left).localeCompare(String(right));
		}
		return 0;
	}
	function conclusionSignature(step) {
		return step.conclusions.map((conclusion) => {
			if (conclusion.kind === "report-contradiction") return `X:${conclusion.code}`;
			return `${conclusion.kind}:${conclusion.cell.r},${conclusion.cell.c}:${conclusion.orientation}`;
		}).sort().join("|");
	}
	//#endregion
	//#region src/domain/rules/straight-chain.ts
	function chainVertices$1(chain) {
		const vertices = [];
		for (let position = chain.start; position <= chain.end; position += 1) vertices.push(chain.axis === "horizontal" ? {
			r: chain.fixed,
			c: position
		} : {
			r: position,
			c: chain.fixed
		});
		return vertices;
	}
	function chainInnerCells$1(board, chain) {
		const cells = [];
		for (let position = chain.start; position < chain.end; position += 1) if (chain.axis === "horizontal") {
			if (chain.fixed > 0) cells.push({
				r: chain.fixed - 1,
				c: position
			});
			if (chain.fixed < board.height) cells.push({
				r: chain.fixed,
				c: position
			});
		} else {
			if (chain.fixed > 0) cells.push({
				r: position,
				c: chain.fixed - 1
			});
			if (chain.fixed < board.width) cells.push({
				r: position,
				c: chain.fixed
			});
		}
		return cells;
	}
	function calculateOuter(board, axis, fixed, start, end) {
		const startVertex = axis === "horizontal" ? {
			r: fixed,
			c: start
		} : {
			r: start,
			c: fixed
		};
		const endVertex = axis === "horizontal" ? {
			r: fixed,
			c: end
		} : {
			r: end,
			c: fixed
		};
		const outer = [];
		const add = (cell, vertex, connectOrientation) => {
			if (isCellInBounds(board.width, board.height, cell)) outer.push({
				cell,
				vertex,
				connectOrientation
			});
		};
		if (axis === "horizontal") {
			add({
				r: fixed - 1,
				c: start - 1
			}, startVertex, "R");
			add({
				r: fixed,
				c: start - 1
			}, startVertex, "L");
			add({
				r: fixed - 1,
				c: end
			}, endVertex, "L");
			add({
				r: fixed,
				c: end
			}, endVertex, "R");
		} else {
			add({
				r: start - 1,
				c: fixed - 1
			}, startVertex, "R");
			add({
				r: start - 1,
				c: fixed
			}, startVertex, "L");
			add({
				r: end,
				c: fixed - 1
			}, endVertex, "L");
			add({
				r: end,
				c: fixed
			}, endVertex, "R");
		}
		outer.sort((a, b) => a.cell.r - b.cell.r || a.cell.c - b.cell.c);
		return outer;
	}
	function internalCount(width, height, axis, fixed, length) {
		if (axis === "horizontal") return (length - 1) * (Number(fixed > 0) + Number(fixed < height));
		return (length - 1) * (Number(fixed > 0) + Number(fixed < width));
	}
	function buildChain(board, axis, fixed, start, end, clueSum) {
		const length = end - start + 1;
		return {
			axis,
			fixed,
			start,
			end,
			length,
			id: `${axis === "horizontal" ? "H" : "V"}:${fixed}:${start}-${end}`,
			clueSum,
			internalCount: internalCount(board.width, board.height, axis, fixed, length),
			outer: calculateOuter(board, axis, fixed, start, end)
		};
	}
	function addRunChains(board, axis, fixed, runStart, runEnd, chains) {
		const prefix = [0];
		for (let position = runStart; position <= runEnd; position += 1) {
			const clue = axis === "horizontal" ? board.clues[fixed]?.[position] : board.clues[position]?.[fixed];
			if (clue === null || clue === void 0) throw new Error("提示链不能跨越无数字顶点。");
			prefix.push((prefix.at(-1) ?? 0) + clue);
		}
		for (let start = runStart; start < runEnd; start += 1) for (let end = start + 1; end <= runEnd; end += 1) {
			const from = start - runStart;
			const clueSum = (prefix[end - runStart + 1] ?? 0) - (prefix[from] ?? 0);
			chains.push(buildChain(board, axis, fixed, start, end, clueSum));
		}
	}
	function buildStraightChainIndex(board) {
		const chains = [];
		for (let r = 0; r <= board.height; r += 1) {
			let c = 0;
			while (c <= board.width) {
				while (c <= board.width && board.clues[r]?.[c] == null) c += 1;
				const start = c;
				while (c <= board.width && board.clues[r]?.[c] != null) c += 1;
				const end = c - 1;
				if (end > start) addRunChains(board, "horizontal", r, start, end, chains);
			}
		}
		for (let c = 0; c <= board.width; c += 1) {
			let r = 0;
			while (r <= board.height) {
				while (r <= board.height && board.clues[r]?.[c] == null) r += 1;
				const start = r;
				while (r <= board.height && board.clues[r]?.[c] != null) r += 1;
				const end = r - 1;
				if (end > start) addRunChains(board, "vertical", c, start, end, chains);
			}
		}
		chains.sort((left, right) => {
			const leftRow = left.axis === "horizontal" ? left.fixed : left.start;
			const leftColumn = left.axis === "horizontal" ? left.start : left.fixed;
			const rightRow = right.axis === "horizontal" ? right.fixed : right.start;
			const rightColumn = right.axis === "horizontal" ? right.start : right.fixed;
			return left.length - right.length || leftRow - rightRow || leftColumn - rightColumn || left.id.localeCompare(right.id);
		});
		const mutableByCell = /* @__PURE__ */ new Map();
		chains.forEach((chain, index) => {
			for (const outer of chain.outer) {
				const key = cellKey$1(outer.cell);
				const list = mutableByCell.get(key) ?? [];
				list.push(index);
				mutableByCell.set(key, list);
			}
		});
		return {
			width: board.width,
			height: board.height,
			chains,
			byCell: mutableByCell
		};
	}
	function affectedChainIndices(index, cells) {
		const result = /* @__PURE__ */ new Set();
		for (const cell of cells) for (const chainIndex of index.byCell.get(cellKey$1(cell)) ?? []) result.add(chainIndex);
		return [...result].sort((a, b) => a - b);
	}
	function materializeGeometry(board, chain) {
		return {
			vertices: chainVertices$1(chain),
			innerCells: chainInnerCells$1(board, chain),
			outer: chain.outer
		};
	}
	function analyzeChainState(board, chain) {
		const knownConnected = [];
		const knownExcluded = [];
		const unknown = [];
		for (const outer of chain.outer) {
			const domain = getCellDomain(board, outer.cell);
			const fixed = fixedOrientation(domain);
			if (fixed === outer.connectOrientation) knownConnected.push(outer);
			else if (fixed !== null || !maskHasOrientation(domain, outer.connectOrientation)) knownExcluded.push(outer);
			else unknown.push(outer);
		}
		return {
			knownConnected,
			knownExcluded,
			unknown
		};
	}
	function clueValues$1(board, vertices) {
		return vertices.map((vertex) => {
			const clue = board.clues[vertex.r]?.[vertex.c];
			if (clue === null || clue === void 0) throw new Error("提示链中出现无数字顶点。");
			return clue;
		});
	}
	function allMiddleAreTwo(values) {
		return values.slice(1, -1).every((value) => value === 2);
	}
	function endpointState(state, vertex) {
		const connected = state.knownConnected.filter((entry) => sameVertex(entry.vertex, vertex)).length;
		const excluded = state.knownExcluded.filter((entry) => sameVertex(entry.vertex, vertex)).length;
		const unknown = state.unknown.filter((entry) => sameVertex(entry.vertex, vertex)).length;
		return {
			connected,
			excluded,
			unknown,
			total: connected + excluded + unknown
		};
	}
	function hasState(state, connected, excluded, unknown) {
		return state.connected === connected && state.excluded === excluded && state.unknown === unknown;
	}
	function variant(board, chain, vertices, state, residual) {
		const values = clueValues$1(board, vertices);
		const first = values[0];
		const last = values.at(-1);
		const standardInternal = chain.internalCount === 2 * (chain.length - 1);
		const firstVertex = vertices[0];
		const lastVertex = vertices.at(-1);
		const named = (id, displayName) => ({
			id,
			displayName
		});
		if (firstVertex === void 0 || lastVertex === void 0) return named("PAT-CHAIN-GENERIC", "直线提示链计数");
		const firstState = endpointState(state, firstVertex);
		const lastState = endpointState(state, lastVertex);
		const extended = chain.length > 2;
		const throughTwos = allMiddleAreTwo(values);
		const endpointPattern = (left, right) => throughTwos && (first === left && last === right || first === right && last === left);
		const statesFor = (clue) => {
			const result = [];
			if (first === clue) result.push(firstState);
			if (last === clue) result.push(lastState);
			return result;
		};
		const boundaryFor = (clue) => first === clue && isBoundaryVertex(board.width, board.height, firstVertex) || last === clue && isBoundaryVertex(board.width, board.height, lastVertex);
		const lengthVariant = (adjacentId, extendedId, adjacentName, extendedName = `${adjacentName}（延伸型）`) => extended ? named(extendedId, extendedName) : named(adjacentId, adjacentName);
		if (chain.length === 2 && first === 1 && last === 1 && chain.internalCount === 2) return boundaryFor(1) ? named("PAT-BORDER-11", "边界 1-1") : named("PAT-ADJ-11", "相邻 1-1");
		if (chain.length === 2 && first === 3 && last === 3 && chain.internalCount === 2) return named("PAT-ADJ-33", "相邻 3-3");
		if (standardInternal && endpointPattern(1, 3) && boundaryFor(1) && chain.outer.length === 2) return lengthVariant("PAT-BORDER-13", "PAT-EXT-BORDER-13", "边界 1-3");
		if (standardInternal && endpointPattern(1, 2) && boundaryFor(1) && chain.outer.length === 2) {
			const twoState = statesFor(2)[0];
			if (twoState !== void 0 && hasState(twoState, 0, 1, 1)) return lengthVariant("PAT-BORDER-12-EXCLUDED", "PAT-EXT-BORDER-12-EXCLUDED", "边界 1-2：2 的一个外侧格不相连");
			if (twoState !== void 0 && hasState(twoState, 1, 0, 1)) return lengthVariant("PAT-BORDER-12-CONNECTED", "PAT-EXT-BORDER-12-CONNECTED", "边界 2-1：2 的一个外侧格相连");
		}
		if (standardInternal && endpointPattern(1, 3)) {
			const oneState = statesFor(1)[0];
			const threeState = statesFor(3)[0];
			if (oneState !== void 0 && threeState !== void 0 && hasState(oneState, 0, 0, 2) && hasState(threeState, 2, 0, 0)) return lengthVariant("PAT-ADJ-13-CONNECTED", "PAT-EXT-13-CONNECTED", "1-3：3 的两个外侧格均相连");
		}
		if (standardInternal && endpointPattern(2, 3)) {
			const twoState = statesFor(2)[0];
			const threeState = statesFor(3)[0];
			if (twoState !== void 0 && threeState !== void 0 && hasState(twoState, 0, 1, 1) && hasState(threeState, 0, 0, 2)) return lengthVariant("PAT-ADJ-23-EXCLUDED", "PAT-EXT-23-EXCLUDED", "2-3：2 的一个外侧格不相连");
		}
		if (standardInternal && endpointPattern(2, 2)) {
			if (hasState(firstState, 1, 0, 1) && hasState(lastState, 1, 0, 1)) return lengthVariant("PAT-ADJ-22-CONNECTED", "PAT-EXT-22-CONNECTED", "2-2：两端各有一个外侧格相连");
			if (hasState(firstState, 0, 1, 1) && hasState(lastState, 0, 1, 1)) return lengthVariant("PAT-ADJ-22-EXCLUDED", "PAT-EXT-22-EXCLUDED", "2-2：两端各有一个外侧格不相连");
		}
		if (standardInternal && endpointPattern(1, 2) && !boundaryFor(1)) {
			const oneState = statesFor(1)[0];
			const twoState = statesFor(2)[0];
			if (oneState !== void 0 && twoState !== void 0 && hasState(oneState, 0, 0, 2) && hasState(twoState, 1, 0, 1)) return lengthVariant("PAT-ADJ-12-CONNECTED", "PAT-EXT-12-CONNECTED", "2-1：2 的一个外侧格相连");
		}
		if (chain.length === 2 && (first === 3 && last === 2 || first === 2 && last === 3) && standardInternal && state.knownConnected.length === 0 && state.knownExcluded.length === 1 && state.unknown.length === 3 && residual === 3) return named("PAT-EXT-32", "3-2：一个外侧格不相连");
		if (chain.length >= 3 && standardInternal && (first === 3 && values.slice(1).every((value) => value === 2) || last === 3 && values.slice(0, -1).every((value) => value === 2)) && state.knownConnected.length === 0 && state.knownExcluded.length === 1 && state.unknown.length === 3 && residual === 3) return named("PAT-EXT-32N", "3-2：一个外侧格不相连（延伸型）");
		if (chain.length >= 3 && standardInternal && first === 1 && last === 1 && allMiddleAreTwo(values)) return named("PAT-CHAIN-121", "1-2-…-2-1");
		if (chain.length >= 3 && standardInternal && first === 3 && last === 3 && allMiddleAreTwo(values)) return named("PAT-CHAIN-323", "3-2-…-2-3");
		return named("PAT-CHAIN-GENERIC", "直线提示链计数");
	}
	function buildChainStep(board, chain) {
		const geometry = materializeGeometry(board, chain);
		const state = analyzeChainState(board, chain);
		const residual = chain.clueSum - chain.internalCount - state.knownConnected.length;
		const conclusions = [];
		let title;
		let templateId;
		let rendered;
		if (residual < 0 || residual > state.unknown.length) {
			conclusions.push({
				kind: "report-contradiction",
				code: "E-CHAIN-COUNT",
				messageZh: `这条提示链还需要 ${residual} 个外侧连接，但剩余候选数是 ${state.unknown.length}。`
			});
			title = "直线提示链：计数矛盾";
			templateId = "count.chain.contradiction";
			rendered = `线索和 ${chain.clueSum} - 内侧恒定贡献 ${chain.internalCount} - 已知外侧贡献 ${state.knownConnected.length} = ${residual}，但剩余外侧候选只有 ${state.unknown.length} 个，因此局面矛盾。`;
		} else if (state.unknown.length > 0 && residual === 0) {
			for (const target of state.unknown) conclusions.push({
				kind: "eliminate-orientation",
				cell: target.cell,
				orientation: target.connectOrientation,
				beforeDomain: getCellDomain(board, target.cell)
			});
			title = "直线提示链：剩余外侧格全部不接入";
			templateId = "count.chain.none";
			rendered = `线索和 ${chain.clueSum} - 内侧恒定贡献 ${chain.internalCount} - 已知外侧贡献 ${state.knownConnected.length} = 0，所以其余 ${state.unknown.length} 个外侧格都不能连接这条提示链。`;
		} else if (state.unknown.length > 0 && residual === state.unknown.length) {
			for (const target of state.unknown) conclusions.push({
				kind: "assign-orientation",
				cell: target.cell,
				orientation: target.connectOrientation,
				beforeDomain: getCellDomain(board, target.cell)
			});
			title = "直线提示链：剩余外侧格全部接入";
			templateId = "count.chain.all";
			rendered = `线索和 ${chain.clueSum} - 内侧恒定贡献 ${chain.internalCount} - 已知外侧贡献 ${state.knownConnected.length} = ${residual}，恰好等于剩余外侧候选数，因此这些格全部接入。`;
		} else return null;
		const displayVariant = variant(board, chain, geometry.vertices, state, residual);
		return {
			schemaVersion: 1,
			stepId: `SL-CNT-010@${board.revision}:${chain.id}`,
			origin: "catalog-logic",
			status: "proposed",
			rule: {
				id: "SL-CNT-010",
				version: "1.0.0"
			},
			variant: displayVariant,
			beforeRevision: board.revision,
			premises: {
				chain: {
					id: chain.id,
					axis: chain.axis,
					start: chain.start,
					end: chain.end
				},
				clueSum: chain.clueSum,
				internalConstantB: chain.internalCount,
				knownOuterContribution: state.knownConnected.length,
				knownOuterExclusions: state.knownExcluded.length,
				residualR: residual,
				remainingOuterCandidates: state.unknown.length
			},
			conclusions,
			involved: {
				vertices: geometry.vertices,
				cells: [...geometry.innerCells, ...geometry.outer.map((entry) => entry.cell)]
			},
			highlight: [
				{
					role: "premise-chain",
					vertices: geometry.vertices
				},
				{
					role: "constant-inner",
					cells: geometry.innerCells
				},
				{
					role: "known-contribution",
					cells: state.knownConnected.map((entry) => entry.cell)
				},
				{
					role: "known-exclusion",
					cells: state.knownExcluded.map((entry) => entry.cell)
				},
				{
					role: "target",
					cells: state.unknown.map((entry) => entry.cell)
				}
			],
			explanation: {
				locale: "zh-CN",
				title: `${displayVariant.displayName}：${title}`,
				templateId,
				parameters: {
					clueSum: chain.clueSum,
					internalConstantB: chain.internalCount,
					knownOuterContribution: state.knownConnected.length,
					residual,
					remainingOuterCandidates: state.unknown.length
				},
				rendered
			},
			sortKey: [
				20,
				chain.length,
				geometry.vertices[0]?.r ?? 0,
				geometry.vertices[0]?.c ?? 0,
				chain.id
			]
		};
	}
	function findFirstStraightChainStep(board, index, affectedCells) {
		if (index.width !== board.width || index.height !== board.height) throw new Error("提示链索引与棋盘尺寸不一致。");
		const chainIndices = affectedCells === void 0 ? index.chains.map((_, chainIndex) => chainIndex) : affectedChainIndices(index, affectedCells);
		for (const chainIndex of chainIndices) {
			const chain = index.chains[chainIndex];
			if (chain === void 0) continue;
			const step = buildChainStep(board, chain);
			if (step !== null) return step;
		}
		return null;
	}
	//#endregion
	//#region src/domain/rules/single-clue.ts
	function analyzeSingleClue(board, vertex) {
		const fixed = [];
		const excluded = [];
		const unknown = [];
		for (const incident of incidentCells(board.width, board.height, vertex)) {
			const domain = getCellDomain(board, incident.cell);
			const orientation = fixedOrientation(domain);
			if (orientation === incident.connectOrientation) fixed.push(incident.cell);
			else if (orientation !== null || !maskHasOrientation(domain, incident.connectOrientation)) excluded.push(incident.cell);
			else unknown.push(incident);
		}
		return {
			fixed,
			excluded,
			unknown
		};
	}
	function findSingleClueSteps(board) {
		const steps = [];
		for (let r = 0; r <= board.height; r += 1) for (let c = 0; c <= board.width; c += 1) {
			const clue = board.clues[r]?.[c];
			if (clue === null || clue === void 0) continue;
			const vertex = {
				r,
				c
			};
			const analysis = analyzeSingleClue(board, vertex);
			const residual = clue - analysis.fixed.length;
			const conclusions = [];
			let title;
			let templateId;
			let rendered;
			if (residual < 0) {
				conclusions.push({
					kind: "report-contradiction",
					code: "E-CLUE-OVERFULL",
					messageZh: `这个 ${clue} 已经连接了 ${analysis.fixed.length} 条线，超过了提示数。`
				});
				title = "单点计数：连接数量已经超过提示";
				templateId = "count.single.overfull";
				rendered = `提示数是 ${clue}，但已经连接 ${analysis.fixed.length} 条线，因此当前局面矛盾。`;
			} else if (residual > analysis.unknown.length) {
				conclusions.push({
					kind: "report-contradiction",
					code: "E-CLUE-UNDERCAPACITY",
					messageZh: `这个 ${clue} 还需要 ${residual} 条线，但只剩 ${analysis.unknown.length} 个候选格。`
				});
				title = "单点计数：剩余候选不足";
				templateId = "count.single.undercapacity";
				rendered = `提示数是 ${clue}，扣除已连接的 ${analysis.fixed.length} 条后还需要 ${residual} 条，但只剩 ${analysis.unknown.length} 个候选格。`;
			} else if (analysis.unknown.length > 0 && residual === 0) {
				for (const candidate of analysis.unknown) conclusions.push({
					kind: "eliminate-orientation",
					cell: candidate.cell,
					orientation: candidate.connectOrientation,
					beforeDomain: getCellDomain(board, candidate.cell)
				});
				title = "单点计数：提示已经满足";
				templateId = "count.single.satisfied";
				rendered = `提示数是 ${clue}，已经连接 ${analysis.fixed.length} 条线，所以其余 ${analysis.unknown.length} 个相邻格都不能再连接这个顶点。`;
			} else if (analysis.unknown.length > 0 && residual === analysis.unknown.length) {
				for (const candidate of analysis.unknown) conclusions.push({
					kind: "assign-orientation",
					cell: candidate.cell,
					orientation: candidate.connectOrientation,
					beforeDomain: getCellDomain(board, candidate.cell)
				});
				title = "单点计数：剩余候选全部需要";
				templateId = "count.single.all";
				rendered = `提示数是 ${clue}，扣除已连接的 ${analysis.fixed.length} 条后还需要 ${residual} 条，恰好等于剩余候选格数，因此这些格都必须连接这个顶点。`;
			} else continue;
			const allCells = [
				...analysis.fixed,
				...analysis.excluded,
				...analysis.unknown.map((candidate) => candidate.cell)
			];
			steps.push({
				schemaVersion: 1,
				stepId: `SL-CNT-001@${board.revision}:V${r},${c}`,
				origin: "catalog-logic",
				status: "proposed",
				rule: {
					id: "SL-CNT-001",
					version: "1.0.0"
				},
				beforeRevision: board.revision,
				premises: {
					vertex,
					clue,
					fixedConnected: analysis.fixed.length,
					excluded: analysis.excluded.length,
					remainingCandidates: analysis.unknown.length,
					residual
				},
				conclusions,
				involved: {
					vertices: [vertex],
					cells: allCells
				},
				highlight: [
					{
						role: "clue",
						vertices: [vertex]
					},
					{
						role: "known-contribution",
						cells: analysis.fixed
					},
					{
						role: "known-exclusion",
						cells: analysis.excluded
					},
					{
						role: "target",
						cells: analysis.unknown.map((candidate) => candidate.cell)
					}
				],
				explanation: {
					locale: "zh-CN",
					title,
					templateId,
					parameters: {
						clue,
						fixedConnected: analysis.fixed.length,
						residual,
						remainingCandidates: analysis.unknown.length
					},
					rendered
				},
				sortKey: [
					10,
					allCells.length,
					r,
					c,
					"SL-CNT-001"
				]
			});
		}
		return steps;
	}
	//#endregion
	//#region src/domain/rules/diamond-count.ts
	function outerState(board, outer) {
		const connected = [];
		const excluded = [];
		const unknown = [];
		for (const entry of outer) {
			const fixed = fixedOrientation(getCellDomain(board, entry.cell));
			if (fixed === null) unknown.push(entry);
			else if (fixed === entry.connectOrientation) connected.push(entry);
			else excluded.push(entry);
		}
		return {
			connected,
			excluded,
			unknown
		};
	}
	/** 固定四提示菱形：内部四格对横、纵两组贡献相同，相减后只剩外侧格。 */
	function findDiamondCountingSteps(board, affectedCells) {
		const affectedCenters = affectedCells === void 0 ? void 0 : /* @__PURE__ */ new Set();
		for (const cell of affectedCells ?? []) for (let r = Math.max(1, cell.r - 1); r <= Math.min(board.height - 1, cell.r + 2); r += 1) for (let c = Math.max(1, cell.c - 1); c <= Math.min(board.width - 1, cell.c + 2); c += 1) affectedCenters.add(`${r},${c}`);
		const centers = affectedCenters === void 0 ? Array.from({ length: Math.max(0, board.height - 1) }, (_, r) => Array.from({ length: Math.max(0, board.width - 1) }, (_, c) => ({
			r: r + 1,
			c: c + 1
		}))).flat() : [...affectedCenters].map((key) => {
			const [r, c] = key.split(",").map(Number);
			return {
				r,
				c
			};
		}).sort((a, b) => a.r - b.r || a.c - b.c);
		const steps = [];
		for (const center of centers) {
			const { r, c } = center;
			const west = {
				r,
				c: c - 1
			};
			const east = {
				r,
				c: c + 1
			};
			const north = {
				r: r - 1,
				c
			};
			const south = {
				r: r + 1,
				c
			};
			const vertices = [
				west,
				east,
				north,
				south
			];
			const values = vertices.map((v) => board.clues[v.r]?.[v.c]);
			if (values.some((value) => value === null || value === void 0)) continue;
			const horizontalSum = values[0] + values[1];
			const verticalSum = values[2] + values[3];
			const delta = horizontalSum - verticalSum;
			const innerCells = [
				{
					r: r - 1,
					c: c - 1
				},
				{
					r: r - 1,
					c
				},
				{
					r,
					c: c - 1
				},
				{
					r,
					c
				}
			];
			const innerKeys = new Set(innerCells.map(cellKey$1));
			const outerFor = (group) => group.flatMap((vertex) => incidentCells(board.width, board.height, vertex).filter((entry) => !innerKeys.has(cellKey$1(entry.cell))).map((entry) => ({
				...entry,
				vertex
			})));
			const horizontalOuter = outerFor([west, east]);
			const verticalOuter = outerFor([north, south]);
			const horizontal = outerState(board, horizontalOuter);
			const vertical = outerState(board, verticalOuter);
			const residual = delta - horizontal.connected.length + vertical.connected.length;
			const h = horizontal.unknown.length;
			const v = vertical.unknown.length;
			const contradiction = residual < -v || residual > h;
			if (!contradiction && (h + v === 0 || residual !== h && residual !== -v)) continue;
			const horizontalConnects = residual === h;
			const conclusions = contradiction ? [{
				kind: "report-contradiction",
				code: "E-DIAMOND-COUNT",
				messageZh: `以第 ${r + 1} 行第 ${c + 1} 列顶点为中心的菱形计数矛盾：外侧剩余贡献差需要 ${residual}，但只能在 ${-v} 到 ${h} 之间。`
			}] : [...horizontal.unknown.map((entry) => ({
				entry,
				connects: horizontalConnects
			})), ...vertical.unknown.map((entry) => ({
				entry,
				connects: !horizontalConnects
			}))].map(({ entry, connects }) => ({
				kind: "assign-orientation",
				cell: entry.cell,
				orientation: connects ? entry.connectOrientation : oppositeOrientation(entry.connectOrientation),
				beforeDomain: getCellDomain(board, entry.cell)
			}));
			const calculation = `左右提示之和 ${horizontalSum} 减去上下提示之和 ${verticalSum}，得到外侧贡献差 ${delta}。内部四格对两组贡献相同，可以抵消。扣除左右已接入 ${horizontal.connected.length} 条、上下已接入 ${vertical.connected.length} 条后，剩余差为 ${residual}；左右还剩 ${h} 格，上下还剩 ${v} 格。`;
			const rendered = contradiction ? `${calculation}${conclusions[0].kind === "report-contradiction" ? conclusions[0].messageZh : ""}` : `${calculation}已达到差值的${horizontalConnects ? "上限" : "下限"}，所以左右剩余外侧格全部${horizontalConnects ? "接入" : "避开"}，上下剩余外侧格全部${horizontalConnects ? "避开" : "接入"}。`;
			const outer = [...horizontalOuter, ...verticalOuter];
			steps.push({
				schemaVersion: 1,
				stepId: `SL-CNT-020@${board.revision}:V${r},${c}`,
				origin: "catalog-logic",
				status: "proposed",
				rule: {
					id: "SL-CNT-020",
					version: "1.0.0"
				},
				variant: {
					id: "PAT-DIAMOND-COUNT",
					displayName: "菱形联合计数"
				},
				beforeRevision: board.revision,
				premises: {
					center,
					west,
					east,
					north,
					south,
					clueValues: values,
					innerCells,
					horizontalOuter,
					verticalOuter,
					horizontalSum,
					verticalSum,
					delta,
					knownHorizontalContribution: horizontal.connected.length,
					knownVerticalContribution: vertical.connected.length,
					remainingHorizontal: h,
					remainingVertical: v,
					residual
				},
				conclusions,
				involved: {
					vertices,
					cells: [...innerCells, ...outer.map((entry) => entry.cell)]
				},
				highlight: [
					{
						role: "clue",
						vertices
					},
					{
						role: "constant-inner",
						cells: innerCells
					},
					{
						role: "outer-cell",
						cells: outer.map((entry) => entry.cell)
					},
					{
						role: "known-contribution",
						cells: [...horizontal.connected, ...vertical.connected].map((entry) => entry.cell)
					},
					{
						role: "known-exclusion",
						cells: [...horizontal.excluded, ...vertical.excluded].map((entry) => entry.cell)
					},
					{
						role: "target",
						cells: conclusions.flatMap((entry) => entry.kind === "report-contradiction" ? [] : [entry.cell])
					}
				],
				explanation: {
					locale: "zh-CN",
					title: "菱形联合计数",
					templateId: "count.diamond.difference",
					parameters: {
						horizontalSum,
						verticalSum,
						delta,
						residual,
						h,
						v
					},
					rendered
				},
				sortKey: [
					25,
					4,
					r,
					c,
					`D${r},${c}`
				]
			});
		}
		return steps;
	}
	//#endregion
	//#region src/domain/rules/counting.ts
	function findNextCountingStep(board, options = {}) {
		const single = [...findSingleClueSteps(board)].sort(compareReasoningSteps)[0];
		if (single !== void 0) return single;
		const index = options.chainIndex ?? buildStraightChainIndex(board);
		return findFirstStraightChainStep(board, index, options.affectedCells) ?? (options.affectedCells === void 0 ? null : findFirstStraightChainStep(board, index)) ?? [...findDiamondCountingSteps(board, options.affectedCells)].sort(compareReasoningSteps)[0] ?? null;
	}
	//#endregion
	//#region src/domain/rules/cycle-count.ts
	function assertCompatible$3(board, connectivity, chainIndex) {
		if (connectivity.width !== board.width || connectivity.height !== board.height || connectivity.revision !== board.revision) throw new Error("连通分量索引与当前棋盘版本不一致。");
		if (chainIndex.width !== board.width || chainIndex.height !== board.height) throw new Error("提示链索引与棋盘尺寸不一致。");
	}
	function chainVertices(chain) {
		const vertices = [];
		for (let position = chain.start; position <= chain.end; position += 1) vertices.push(chain.axis === "horizontal" ? {
			r: chain.fixed,
			c: position
		} : {
			r: position,
			c: chain.fixed
		});
		return vertices;
	}
	function chainInnerCells(board, chain) {
		const cells = [];
		for (let position = chain.start; position < chain.end; position += 1) if (chain.axis === "horizontal") {
			if (chain.fixed > 0) cells.push({
				r: chain.fixed - 1,
				c: position
			});
			if (chain.fixed < board.height) cells.push({
				r: chain.fixed,
				c: position
			});
		} else {
			if (chain.fixed > 0) cells.push({
				r: position,
				c: chain.fixed - 1
			});
			if (chain.fixed < board.width) cells.push({
				r: position,
				c: chain.fixed
			});
		}
		return cells;
	}
	function clueValues(board, vertices) {
		return vertices.map((vertex) => {
			const clue = board.clues[vertex.r]?.[vertex.c];
			if (clue === null || clue === void 0) throw new Error("提示链中出现无数字顶点。");
			return clue;
		});
	}
	function isTwoExtension(values) {
		if (values.length < 2 || !values.slice(1, -1).every((value) => value === 2)) return false;
		const first = values[0];
		const last = values.at(-1);
		return first === 3 && values.slice(1).every((value) => value === 2) || last === 3 && values.slice(0, -1).every((value) => value === 2) || values.every((value) => value === 2);
	}
	function singleClueScopes(board) {
		const scopes = [];
		for (let r = 0; r <= board.height; r += 1) for (let c = 0; c <= board.width; c += 1) {
			const clue = board.clues[r]?.[c];
			if (clue !== 2 && clue !== 3) continue;
			const vertex = {
				r,
				c
			};
			scopes.push({
				kind: "single-clue",
				id: `V${r},${c}`,
				vertices: [vertex],
				innerCells: [],
				outer: incidentCells(board.width, board.height, vertex).map((candidate) => ({
					...candidate,
					vertex
				})),
				clueValues: [clue],
				clueSum: clue,
				internalConstant: 0
			});
		}
		return scopes;
	}
	function analyzeOuter(board, outer, clueSum, internalConstant) {
		const knownConnected = [];
		const knownExcluded = [];
		const unknown = [];
		for (const candidate of outer) {
			const domain = getCellDomain(board, candidate.cell);
			const fixed = fixedOrientation(domain);
			if (fixed === candidate.connectOrientation) knownConnected.push(candidate);
			else if (fixed !== null || !maskHasOrientation(domain, candidate.connectOrientation)) knownExcluded.push(candidate);
			else unknown.push(candidate);
		}
		return {
			knownConnected,
			knownExcluded,
			unknown,
			residual: clueSum - internalConstant - knownConnected.length
		};
	}
	function analyzeScope(board, scope) {
		return analyzeOuter(board, scope.outer, scope.clueSum, scope.internalConstant);
	}
	function canProduceConcreteConclusion(state) {
		return state.unknown.length >= 3 && state.residual > 0 && state.residual < state.unknown.length;
	}
	function materializeEligibleChainScope(board, chain) {
		const state = analyzeOuter(board, chain.outer, chain.clueSum, chain.internalCount);
		if (!canProduceConcreteConclusion(state)) return null;
		if (state.residual !== state.unknown.length - 1) return null;
		const vertices = chainVertices(chain);
		const values = clueValues(board, vertices);
		if (!isTwoExtension(values)) return null;
		return {
			scope: {
				kind: "straight-chain",
				id: chain.id,
				vertices,
				innerCells: chainInnerCells(board, chain),
				outer: chain.outer,
				clueValues: values,
				clueSum: chain.clueSum,
				internalConstant: chain.internalCount
			},
			state
		};
	}
	function farEndpoint(candidate) {
		const [from, to] = cellEndpoints(candidate.cell, candidate.connectOrientation);
		if (sameVertex(from, candidate.vertex)) return to;
		if (sameVertex(to, candidate.vertex)) return from;
		throw new Error("外侧候选方向没有连接其记录的提示顶点。");
	}
	function variantFor(scope) {
		if (scope.kind === "straight-chain") return {
			id: "PAT-CYC-CHAIN-CAP",
			displayName: "2 链延伸：不能闭圈"
		};
		if (scope.clueValues[0] === 3) return {
			id: "PAT-CYC-3-CAP",
			displayName: "3 不能闭圈"
		};
		return {
			id: "PAT-CYC-2-CAP",
			displayName: "2 不能闭圈"
		};
	}
	function scopeLabel(scope) {
		return scope.kind === "single-clue" ? `提示 ${scope.clueValues[0]}` : `提示链 ${scope.clueValues.join("-")}`;
	}
	function coordinateLabel$1(cell) {
		return `第 ${cell.r + 1} 行第 ${cell.c + 1} 列`;
	}
	function buildStep(board, scope, state, dangerous, witness) {
		const dangerousCells = new Set(dangerous.map((candidate) => `${candidate.cell.r},${candidate.cell.c}`));
		const targets = state.unknown.filter((candidate) => !dangerousCells.has(`${candidate.cell.r},${candidate.cell.c}`));
		if (targets.length === 0 || state.residual !== targets.length + 1) return null;
		const conclusions = targets.map((target) => ({
			kind: "assign-orientation",
			cell: target.cell,
			orientation: target.connectOrientation,
			beforeDomain: getCellDomain(board, target.cell)
		}));
		const displayVariant = variantFor(scope);
		const firstVertex = scope.vertices[0];
		const dangerousDescription = dangerous.map((candidate) => coordinateLabel$1(candidate.cell)).join("和");
		const targetDescription = targets.length === 1 ? coordinateLabel$1(targets[0]?.cell ?? {
			r: 0,
			c: 0
		}) : `另外 ${targets.length} 个外侧格`;
		const rendered = `${scopeLabel(scope)}还需要 ${state.residual} 个外侧连接。${dangerousDescription}的远端已经由 ${witness.edges.length} 条已有斜线连通，其中任意两个同时接入都会闭圈，所以这 ${dangerous.length} 个候选至多接入一个。为了凑足 ${state.residual} 个连接，${targetDescription}必须接入。`;
		const dangerousEvidence = dangerous.map((candidate) => ({
			cell: candidate.cell,
			connectOrientation: candidate.connectOrientation,
			sharedVertex: candidate.vertex,
			farEndpoint: farEndpoint(candidate)
		}));
		return {
			schemaVersion: 1,
			stepId: `SL-CYC-202@${board.revision}:${scope.id}:${dangerous.map((entry) => `C${entry.cell.r},${entry.cell.c}`).join("+")}`,
			origin: "catalog-logic",
			status: "proposed",
			rule: {
				id: "SL-CYC-202",
				version: "1.0.0"
			},
			variant: displayVariant,
			beforeRevision: board.revision,
			premises: {
				scope: {
					kind: scope.kind,
					id: scope.id,
					clueValues: scope.clueValues,
					vertices: scope.vertices
				},
				clueSum: scope.clueSum,
				internalConstantB: scope.internalConstant,
				knownOuterContribution: state.knownConnected.length,
				knownOuterExclusions: state.knownExcluded.length,
				residualR: state.residual,
				remainingOuterCandidates: state.unknown.length,
				...dangerous.length === 2 ? {
					dangerousPair: dangerousEvidence,
					pairUpperBound: 1
				} : {},
				dangerousGroup: dangerousEvidence,
				groupUpperBound: 1,
				fixedPath: witness
			},
			conclusions,
			involved: {
				vertices: [...scope.vertices, ...witness.vertices],
				cells: [
					...scope.innerCells,
					...scope.outer.map((candidate) => candidate.cell),
					...witness.edges.map((edge) => edge.cell)
				]
			},
			highlight: [
				scope.kind === "single-clue" ? {
					role: "clue",
					vertices: scope.vertices
				} : {
					role: "premise-chain",
					vertices: scope.vertices
				},
				{
					role: "constant-inner",
					cells: scope.innerCells
				},
				{
					role: "known-contribution",
					cells: state.knownConnected.map((entry) => entry.cell)
				},
				{
					role: "known-exclusion",
					cells: state.knownExcluded.map((entry) => entry.cell)
				},
				{
					role: "cycle-path",
					vertices: witness.vertices,
					cells: witness.edges.map((edge) => edge.cell)
				},
				{
					role: "dangerous-pair",
					vertices: dangerous.flatMap((candidate) => [candidate.vertex, farEndpoint(candidate)]),
					cells: dangerous.map((candidate) => candidate.cell)
				},
				{
					role: "target",
					cells: targets.map((target) => target.cell)
				}
			],
			explanation: {
				locale: "zh-CN",
				title: `${displayVariant.displayName}：其余外侧格必须接入`,
				templateId: dangerous.length === 2 ? "cycle.count.pair-cap" : "cycle.count.group-cap",
				parameters: {
					clueValues: scope.clueValues,
					clueSum: scope.clueSum,
					internalConstantB: scope.internalConstant,
					knownOuterContribution: state.knownConnected.length,
					residual: state.residual,
					remainingOuterCandidates: state.unknown.length,
					pathLength: witness.edges.length,
					dangerousCells: dangerous.map((candidate) => candidate.cell),
					targetCount: targets.length
				},
				rendered
			},
			sortKey: [
				35,
				scope.vertices.length,
				firstVertex.r,
				firstVertex.c,
				scope.id
			]
		};
	}
	function scopeSteps(board, connectivity, scope, providedState) {
		const state = providedState ?? analyzeScope(board, scope);
		if (!canProduceConcreteConclusion(state)) return [];
		const steps = [];
		const groups = /* @__PURE__ */ new Map();
		for (const candidate of state.unknown) {
			const component = componentIdAt(connectivity, farEndpoint(candidate));
			if (component === componentIdAt(connectivity, candidate.vertex)) continue;
			const key = `${candidate.vertex.r},${candidate.vertex.c}:${component}`;
			const group = groups.get(key) ?? [];
			group.push(candidate);
			groups.set(key, group);
		}
		for (const group of groups.values()) {
			if (group.length < 2 || state.residual !== state.unknown.length - group.length + 1) continue;
			const root = farEndpoint(group[0]);
			const paths = group.slice(1).map((entry) => findFixedPath(connectivity, root, farEndpoint(entry)));
			if (paths.some((path) => path === null || path.edges.length === 0)) continue;
			const vertices = /* @__PURE__ */ new Map();
			const edges = /* @__PURE__ */ new Map();
			for (const path of paths) {
				for (const vertex of path.vertices) vertices.set(`${vertex.r},${vertex.c}`, vertex);
				for (const edge of path.edges) edges.set(`${edge.cell.r},${edge.cell.c}`, edge);
			}
			const step = buildStep(board, scope, state, group, {
				vertices: [...vertices.values()],
				edges: [...edges.values()]
			});
			if (step !== null) steps.push(step);
		}
		return steps;
	}
	function findCycleCountSteps(board, connectivity, chainIndex) {
		assertCompatible$3(board, connectivity, chainIndex);
		if (connectivity.fixedCycle !== void 0) return [];
		const bestByConclusion = /* @__PURE__ */ new Map();
		const consider = (scope, state) => {
			for (const step of scopeSteps(board, connectivity, scope, state)) {
				const signature = conclusionSignature(step);
				const previous = bestByConclusion.get(signature);
				if (previous === void 0 || compareReasoningSteps(step, previous) < 0) bestByConclusion.set(signature, step);
			}
		};
		for (const scope of singleClueScopes(board)) consider(scope);
		for (const chain of chainIndex.chains) {
			const materialized = materializeEligibleChainScope(board, chain);
			if (materialized !== null) consider(materialized.scope, materialized.state);
		}
		return [...bestByConclusion.values()].sort(compareReasoningSteps);
	}
	function findNextCycleCountStep(board, connectivity, chainIndex) {
		return findCycleCountSteps(board, connectivity, chainIndex)[0] ?? null;
	}
	//#endregion
	//#region src/domain/rules/no-loop.ts
	function assertCompatible$2(board, index) {
		if (index.width !== board.width || index.height !== board.height || index.revision !== board.revision) throw new Error("连通分量索引与当前棋盘版本不一致。");
	}
	function candidateCycleWitness(board, index, cell, orientation) {
		const [from, to] = cellEndpoints(cell, orientation);
		if (componentIdAt(index, from) !== componentIdAt(index, to)) return null;
		return findFixedPath(index, from, to);
	}
	function fixedCycleStep(board, index) {
		const cycle = index.fixedCycle;
		if (cycle === void 0) return null;
		const closing = cycle.closingEdge;
		const cells = [...cycle.edges.map((edge) => edge.cell), closing.cell];
		return {
			schemaVersion: 1,
			stepId: `SL-CYC-201@${board.revision}:fixed-cycle`,
			origin: "catalog-logic",
			status: "proposed",
			rule: {
				id: "SL-CYC-201",
				version: "1.0.0"
			},
			variant: {
				id: "PAT-CYC-CLOSE",
				displayName: "已经形成闭圈"
			},
			beforeRevision: board.revision,
			premises: {
				kind: "fixed-cycle",
				closingEdge: closing,
				path: cycle
			},
			conclusions: [{
				kind: "report-contradiction",
				code: "E-FIXED-CYCLE",
				messageZh: `第 ${closing.cell.r + 1} 行第 ${closing.cell.c + 1} 列方格的斜线已经闭合了一条圈。`
			}],
			involved: {
				vertices: cycle.vertices,
				cells
			},
			highlight: [{
				role: "cycle-path",
				vertices: cycle.vertices,
				cells: cycle.edges.map((edge) => edge.cell)
			}, {
				role: "rejected-edge",
				cells: [closing.cell]
			}],
			explanation: {
				locale: "zh-CN",
				title: "无圈规则：当前斜线已经形成闭圈",
				templateId: "cycle.fixed.contradiction",
				parameters: {
					pathLength: cycle.edges.length,
					closingCell: closing.cell
				},
				rendered: `沿着已有的 ${cycle.edges.length} 条斜线可以从闭合边的一端走到另一端，再加上第 ${closing.cell.r + 1} 行第 ${closing.cell.c + 1} 列的斜线就构成闭圈，因此当前局面矛盾。`
			},
			sortKey: [
				0,
				cells.length,
				closing.cell.r,
				closing.cell.c,
				"SL-CYC-201"
			]
		};
	}
	function candidateStep(board, cell, witnesses) {
		const rejected = ["R", "L"].filter((orientation) => witnesses.has(orientation));
		const pathCells = rejected.flatMap((orientation) => witnesses.get(orientation)?.edges.map((edge) => edge.cell) ?? []);
		const pathVertices = rejected.flatMap((orientation) => witnesses.get(orientation)?.vertices ?? []);
		if (rejected.length === 2) return {
			schemaVersion: 1,
			stepId: `SL-CYC-201@${board.revision}:C${cell.r},${cell.c}:both`,
			origin: "catalog-logic",
			status: "proposed",
			rule: {
				id: "SL-CYC-201",
				version: "1.0.0"
			},
			variant: {
				id: "PAT-CYC-CLOSE",
				displayName: "两个方向都会闭圈"
			},
			beforeRevision: board.revision,
			premises: {
				cell,
				rejectedDirections: rejected,
				paths: Object.fromEntries(rejected.map((orientation) => [orientation, witnesses.get(orientation)]))
			},
			conclusions: [{
				kind: "report-contradiction",
				code: "E-CELL-DOMAIN-EMPTY",
				messageZh: `第 ${cell.r + 1} 行第 ${cell.c + 1} 列方格的两个方向都会闭圈，已经没有合法方向。`
			}],
			involved: {
				vertices: pathVertices,
				cells: [...pathCells, cell]
			},
			highlight: [{
				role: "cycle-path",
				vertices: pathVertices,
				cells: pathCells
			}, {
				role: "rejected-edge",
				cells: [cell]
			}],
			explanation: {
				locale: "zh-CN",
				title: "无圈规则：两个方向都不合法",
				templateId: "cycle.candidate.both-contradiction",
				parameters: { cell },
				rendered: `第 ${cell.r + 1} 行第 ${cell.c + 1} 列方格无论画哪条斜线，都会把已有路径的两端重新连起来形成闭圈，所以当前局面矛盾。`
			},
			sortKey: [
				0,
				pathCells.length + 1,
				cell.r,
				cell.c,
				"SL-CYC-201:both"
			]
		};
		const rejectedOrientation = rejected[0];
		if (rejectedOrientation === void 0) throw new Error("闭圈候选步骤缺少被排除方向。");
		const chosenOrientation = oppositeOrientation(rejectedOrientation);
		const witness = witnesses.get(rejectedOrientation);
		if (witness === void 0) throw new Error("闭圈候选步骤缺少路径见证。");
		const [from, to] = cellEndpoints(cell, rejectedOrientation);
		return {
			schemaVersion: 1,
			stepId: `SL-CYC-201@${board.revision}:C${cell.r},${cell.c}:${rejectedOrientation}`,
			origin: "catalog-logic",
			status: "proposed",
			rule: {
				id: "SL-CYC-201",
				version: "1.0.0"
			},
			variant: {
				id: "PAT-CYC-CLOSE",
				displayName: "差一条边闭圈"
			},
			beforeRevision: board.revision,
			premises: {
				cell,
				rejectedOrientation,
				candidateEndpoints: {
					from,
					to
				},
				fixedPath: witness
			},
			conclusions: [{
				kind: "assign-orientation",
				cell,
				orientation: chosenOrientation,
				beforeDomain: 3
			}],
			involved: {
				vertices: witness.vertices,
				cells: [...witness.edges.map((edge) => edge.cell), cell]
			},
			highlight: [
				{
					role: "cycle-path",
					vertices: witness.vertices,
					cells: witness.edges.map((edge) => edge.cell)
				},
				{
					role: "rejected-edge",
					vertices: [from, to],
					cells: [cell]
				},
				{
					role: "target",
					cells: [cell]
				}
			],
			explanation: {
				locale: "zh-CN",
				title: "无圈规则：这条斜线会立即闭圈",
				templateId: "cycle.candidate.reject",
				parameters: {
					rejectedOrientation,
					chosenOrientation,
					pathLength: witness.edges.length,
					cell
				},
				rendered: `已有 ${witness.edges.length} 条相连的斜线把候选方向 ${rejectedOrientation} 的两个端点连在了一起；若再画 ${rejectedOrientation} 就会闭圈。因此第 ${cell.r + 1} 行第 ${cell.c + 1} 列只能画 ${chosenOrientation}。`
			},
			sortKey: [
				30,
				witness.edges.length + 1,
				cell.r,
				cell.c,
				rejectedOrientation
			]
		};
	}
	function findCycleAvoidanceSteps(board, providedIndex) {
		const index = providedIndex ?? buildConnectivityIndex(board);
		assertCompatible$2(board, index);
		const existingCycle = fixedCycleStep(board, index);
		if (existingCycle !== null) return [existingCycle];
		const steps = [];
		for (let r = 0; r < board.height; r += 1) for (let c = 0; c < board.width; c += 1) {
			if (board.cellDomains[r]?.[c] !== 3) continue;
			const cell = {
				r,
				c
			};
			const witnesses = /* @__PURE__ */ new Map();
			for (const orientation of ["R", "L"]) {
				const witness = candidateCycleWitness(board, index, cell, orientation);
				if (witness !== null) witnesses.set(orientation, witness);
			}
			if (witnesses.size > 0) steps.push(candidateStep(board, cell, witnesses));
		}
		return steps.sort((left, right) => {
			for (let index = 0; index < left.sortKey.length; index += 1) {
				const a = left.sortKey[index];
				const b = right.sortKey[index];
				if (a === b) continue;
				if (typeof a === "number" && typeof b === "number") return a - b;
				return String(a).localeCompare(String(b));
			}
			return 0;
		});
	}
	function findNextCycleAvoidanceStep(board, index) {
		return findCycleAvoidanceSteps(board, index)[0] ?? null;
	}
	//#endregion
	//#region src/domain/rules/same-direction.ts
	var DisjointSet$1 = class {
		parent;
		rank;
		constructor(size) {
			this.parent = Array.from({ length: size }, (_, index) => index);
			this.rank = Array(size).fill(0);
		}
		find(value) {
			let root = value;
			while (this.parent[root] !== root) root = this.parent[root] ?? root;
			let current = value;
			while (this.parent[current] !== current) {
				const next = this.parent[current] ?? current;
				this.parent[current] = root;
				current = next;
			}
			return root;
		}
		union(left, right) {
			let a = this.find(left);
			let b = this.find(right);
			if (a === b) return false;
			const rankA = this.rank[a] ?? 0;
			const rankB = this.rank[b] ?? 0;
			if (rankA < rankB) [a, b] = [b, a];
			this.parent[b] = a;
			if (rankA === rankB) this.rank[a] = rankA + 1;
			return true;
		}
	};
	function compareCell(left, right) {
		return left.r - right.r || left.c - right.c;
	}
	function compareVertex(left, right) {
		return left.r - right.r || left.c - right.c;
	}
	function cellIndex(width, cell) {
		return cell.r * width + cell.c;
	}
	function cellFromIndex(width, index) {
		return {
			r: Math.floor(index / width),
			c: index % width
		};
	}
	function pairCellKey(width, left, right) {
		const indices = [cellIndex(width, left), cellIndex(width, right)].sort((a, b) => a - b);
		return `${indices[0]}|${indices[1]}`;
	}
	function wedgeKey(pair, apex) {
		return `${pair.id}@${vertexKey(apex)}`;
	}
	function coordinateLabel(cell) {
		return `第 ${cell.r + 1} 行第 ${cell.c + 1} 列`;
	}
	function vertexLabel(vertex) {
		return `第 ${vertex.r + 1} 行第 ${vertex.c + 1} 列顶点`;
	}
	function pairLabel(pair) {
		return `${coordinateLabel(pair.cells[0])}和${coordinateLabel(pair.cells[1])}`;
	}
	function enumeratePairs(width, height) {
		const pairs = [];
		for (let r = 0; r < height; r += 1) for (let c = 0; c + 1 < width; c += 1) pairs.push({
			id: `H:${r},${c}`,
			cells: [{
				r,
				c
			}, {
				r,
				c: c + 1
			}],
			apexes: [{
				r,
				c: c + 1
			}, {
				r: r + 1,
				c: c + 1
			}]
		});
		for (let r = 0; r + 1 < height; r += 1) for (let c = 0; c < width; c += 1) pairs.push({
			id: `V:${r},${c}`,
			cells: [{
				r,
				c
			}, {
				r: r + 1,
				c
			}],
			apexes: [{
				r: r + 1,
				c
			}, {
				r: r + 1,
				c: c + 1
			}]
		});
		return pairs;
	}
	function otherApex(pair, apex) {
		const [first, second] = pair.apexes;
		if (sameVertex(first, apex)) return second;
		if (sameVertex(second, apex)) return first;
		throw new Error(`顶点 ${vertexKey(apex)} 不是相邻格对 ${pair.id} 的楔形端点。`);
	}
	function connectingOrientation(cell, apex) {
		for (const orientation of ["R", "L"]) {
			const [from, to] = cellEndpoints(cell, orientation);
			if (sameVertex(from, apex) || sameVertex(to, apex)) return orientation;
		}
		throw new Error(`方格 ${cellKey$1(cell)} 不能连接顶点 ${vertexKey(apex)}。`);
	}
	function clueAt(board, vertex) {
		return board.clues[vertex.r]?.[vertex.c] ?? null;
	}
	function basePriority(proof) {
		if (proof.kind === "clue-1") return 0;
		if (proof.kind === "clue-3") return 1;
		return 2;
	}
	function chooseBaseProof(previous, candidate) {
		if (previous === void 0) return candidate;
		const priority = basePriority(candidate) - basePriority(previous);
		if (priority < 0) return candidate;
		if (priority > 0) return previous;
		const previousKey = previous.kind === "cell-domain" ? `C:${cellKey$1(previous.cell)}` : `V:${vertexKey(previous.clueVertex)}`;
		return (candidate.kind === "cell-domain" ? `C:${cellKey$1(candidate.cell)}` : `V:${vertexKey(candidate.clueVertex)}`).localeCompare(previousKey) < 0 ? candidate : previous;
	}
	function buildBaseFacts(board, pairs) {
		const result = /* @__PURE__ */ new Map();
		const add = (pair, apex, proof) => {
			const key = wedgeKey(pair, apex);
			const previous = result.get(key);
			if (previous === void 0) result.set(key, {
				pair,
				apex,
				proof
			});
			else previous.proof = chooseBaseProof(previous.proof, proof);
		};
		for (const pair of pairs) {
			for (const apex of pair.apexes) {
				const clue = clueAt(board, apex);
				if (clue === 1) add(pair, apex, {
					kind: "clue-1",
					ruleId: "SL-WDG-401",
					clueVertex: apex
				});
				if (clue === 3) add(pair, otherApex(pair, apex), {
					kind: "clue-3",
					ruleId: "SL-WDG-402",
					clueVertex: apex
				});
			}
			for (const apex of pair.apexes) for (const cell of pair.cells) {
				const requiredOrientation = connectingOrientation(cell, apex);
				const domain = getCellDomain(board, cell);
				if (!maskHasOrientation(domain, requiredOrientation)) add(pair, apex, {
					kind: "cell-domain",
					cell,
					domain,
					requiredOrientation
				});
			}
		}
		return result;
	}
	function buildPropagationTransitions(board, pairsByCells) {
		const transitions = /* @__PURE__ */ new Map();
		const add = (sourcePair, sourceApex, targetPair, targetApex, clueVertex) => {
			const sourceKey = wedgeKey(sourcePair, sourceApex);
			const targetKey = wedgeKey(targetPair, targetApex);
			const list = transitions.get(sourceKey) ?? [];
			list.push({
				sourceKey,
				targetKey,
				proof: {
					ruleId: "SL-WDG-403",
					clueVertex,
					sourcePair,
					sourceForbiddenApex: sourceApex,
					targetPair,
					targetForbiddenApex: targetApex
				}
			});
			transitions.set(sourceKey, list);
		};
		const connectOppositePairs = (first, second, clueVertex) => {
			const firstOuter = otherApex(first, clueVertex);
			const secondOuter = otherApex(second, clueVertex);
			add(first, clueVertex, second, secondOuter, clueVertex);
			add(first, firstOuter, second, clueVertex, clueVertex);
			add(second, clueVertex, first, firstOuter, clueVertex);
			add(second, secondOuter, first, clueVertex, clueVertex);
		};
		for (let r = 1; r < board.height; r += 1) for (let c = 1; c < board.width; c += 1) {
			if (board.clues[r]?.[c] !== 2) continue;
			const vertex = {
				r,
				c
			};
			const nw = {
				r: r - 1,
				c: c - 1
			};
			const ne = {
				r: r - 1,
				c
			};
			const se = {
				r,
				c
			};
			const sw = {
				r,
				c: c - 1
			};
			const top = pairsByCells.get(pairCellKey(board.width, nw, ne));
			const bottom = pairsByCells.get(pairCellKey(board.width, sw, se));
			const left = pairsByCells.get(pairCellKey(board.width, nw, sw));
			const right = pairsByCells.get(pairCellKey(board.width, ne, se));
			if (top === void 0 || bottom === void 0 || left === void 0 || right === void 0) throw new Error(`内部提示 2 V(${r},${c}) 的相邻格对不完整。`);
			connectOppositePairs(top, bottom, vertex);
			connectOppositePairs(left, right, vertex);
		}
		for (const list of transitions.values()) list.sort((left, right) => left.targetKey.localeCompare(right.targetKey));
		return transitions;
	}
	function propagateWedgeFacts(baseFacts, transitions) {
		const nodes = /* @__PURE__ */ new Map();
		const queue = [];
		for (const [key, fact] of [...baseFacts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
			nodes.set(key, {
				key,
				pair: fact.pair,
				forbiddenApex: fact.apex,
				distance: 0,
				base: fact.proof
			});
			queue.push(key);
		}
		let head = 0;
		while (head < queue.length) {
			const sourceKey = queue[head];
			head += 1;
			if (sourceKey === void 0) continue;
			const source = nodes.get(sourceKey);
			if (source === void 0) continue;
			for (const transition of transitions.get(sourceKey) ?? []) {
				if (nodes.has(transition.targetKey)) continue;
				nodes.set(transition.targetKey, {
					key: transition.targetKey,
					pair: transition.proof.targetPair,
					forbiddenApex: transition.proof.targetForbiddenApex,
					distance: source.distance + 1,
					previous: {
						sourceKey,
						propagation: transition.proof
					}
				});
				queue.push(transition.targetKey);
			}
		}
		return nodes;
	}
	function materializeWedgeWitness(nodes, targetKey) {
		const reversed = [];
		let current = nodes.get(targetKey);
		if (current === void 0) throw new Error(`缺少楔形排除事实 ${targetKey}。`);
		const target = current;
		while (current.base === void 0) {
			const previous = current.previous;
			if (previous === void 0) throw new Error(`楔形排除事实 ${current.key} 没有起点。`);
			reversed.push(previous.propagation);
			current = nodes.get(previous.sourceKey);
			if (current === void 0) throw new Error(`楔形传播前驱 ${previous.sourceKey} 不存在。`);
		}
		return {
			pair: target.pair,
			forbiddenApex: target.forbiddenApex,
			base: current.base,
			propagation: reversed.reverse()
		};
	}
	function addRelationEdge(width, adjacency, witness) {
		const left = cellIndex(width, witness.left);
		const right = cellIndex(width, witness.right);
		if ((adjacency[left] ?? []).some((entry) => entry.to === right && entry.witness.proof.kind === witness.proof.kind && sameCell(entry.witness.left, witness.left) && sameCell(entry.witness.right, witness.right))) return;
		adjacency[left]?.push({
			to: right,
			witness
		});
		adjacency[right]?.push({
			to: left,
			witness
		});
	}
	function findRelationPathInAdjacency(width, adjacency, start, goal) {
		const startIndex = cellIndex(width, start);
		const goalIndex = cellIndex(width, goal);
		const previous = Array(adjacency.length).fill(-1);
		const previousEdge = Array(adjacency.length);
		const queue = [startIndex];
		previous[startIndex] = startIndex;
		let head = 0;
		while (head < queue.length && previous[goalIndex] === -1) {
			const current = queue[head];
			head += 1;
			if (current === void 0) continue;
			const entries = [...adjacency[current] ?? []].sort((left, right) => left.to - right.to);
			for (const entry of entries) {
				if (previous[entry.to] !== -1) continue;
				previous[entry.to] = current;
				previousEdge[entry.to] = entry.witness;
				queue.push(entry.to);
			}
		}
		if (previous[goalIndex] === -1) return null;
		const cells = [goal];
		const links = [];
		let current = goalIndex;
		while (current !== startIndex) {
			const edge = previousEdge[current];
			const parent = previous[current];
			if (edge === void 0 || parent === void 0 || parent < 0) throw new Error("同向链路径重建失败。");
			links.push(edge);
			cells.push(cellFromIndex(width, parent));
			current = parent;
		}
		cells.reverse();
		links.reverse();
		return {
			cells,
			links
		};
	}
	function incidentStates(board, vertex) {
		return [
			{
				cell: {
					r: vertex.r - 1,
					c: vertex.c - 1
				},
				connectOrientation: "R"
			},
			{
				cell: {
					r: vertex.r - 1,
					c: vertex.c
				},
				connectOrientation: "L"
			},
			{
				cell: {
					r: vertex.r,
					c: vertex.c
				},
				connectOrientation: "R"
			},
			{
				cell: {
					r: vertex.r,
					c: vertex.c - 1
				},
				connectOrientation: "L"
			}
		].flatMap((candidate) => {
			if (candidate.cell.r < 0 || candidate.cell.r >= board.height || candidate.cell.c < 0 || candidate.cell.c >= board.width) return [];
			const domain = getCellDomain(board, candidate.cell);
			return [{
				...candidate,
				domain,
				fixed: fixedOrientation(domain)
			}];
		});
	}
	function areAdjacentCells(left, right) {
		return Math.abs(left.r - right.r) + Math.abs(left.c - right.c) === 1;
	}
	function collapsedCountState(board, vertex, clue, collapsedPair) {
		const states = incidentStates(board, vertex);
		if (collapsedPair !== void 0) {
			const members = states.filter((state) => sameCell(state.cell, collapsedPair[0]) || sameCell(state.cell, collapsedPair[1]));
			if (members.length !== 2 || members.some((state) => state.domain !== 3)) return null;
		}
		const fixedCells = [];
		const excludedCells = [];
		const remainingUnknown = [];
		let fixedConnected = 0;
		for (const state of states) {
			if (collapsedPair !== void 0 && (sameCell(state.cell, collapsedPair[0]) || sameCell(state.cell, collapsedPair[1]))) continue;
			if (state.fixed === state.connectOrientation) {
				fixedConnected += 1;
				fixedCells.push(state.cell);
			} else if (state.fixed !== null || !maskHasOrientation(state.domain, state.connectOrientation)) excludedCells.push(state.cell);
			else remainingUnknown.push(state);
		}
		return {
			fixedConnected,
			fixedCells,
			excludedCells,
			remainingUnknown,
			residual: clue - fixedConnected - (collapsedPair === void 0 ? 0 : 1)
		};
	}
	function uniquePairsAround(board, vertex, componentAt) {
		const unknown = incidentStates(board, vertex).filter((state) => state.domain === 3).map((state) => state.cell).sort(compareCell);
		const result = [];
		for (let left = 0; left < unknown.length; left += 1) for (let right = left + 1; right < unknown.length; right += 1) {
			const first = unknown[left];
			const second = unknown[right];
			if (first === void 0 || second === void 0 || !areAdjacentCells(first, second)) continue;
			if (componentAt(first) === componentAt(second)) result.push([first, second]);
		}
		return result;
	}
	function countRelationProof(board, adjacency, vertex, clue, state, remainingPair, sourcePair) {
		const sourceChain = sourcePair === void 0 ? void 0 : findRelationPathInAdjacency(board.width, adjacency, sourcePair[0], sourcePair[1]) ?? void 0;
		return {
			kind: "count-exact-one",
			ruleId: "SL-WDG-405",
			vertex,
			clue,
			fixedConnected: state.fixedConnected,
			fixedCells: state.fixedCells,
			excludedCells: state.excludedCells,
			...sourcePair === void 0 ? {} : { sourcePair },
			...sourceChain === void 0 ? {} : { sourceChain },
			remainingPair
		};
	}
	function relationWitnessVertices(witness) {
		if (witness.proof.kind === "count-exact-one") {
			const nested = witness.proof.sourceChain?.links.flatMap(relationWitnessVertices) ?? [];
			return [witness.proof.vertex, ...nested];
		}
		return witness.proof.exclusions.flatMap((exclusion) => [...exclusion.base.kind === "cell-domain" ? [] : [exclusion.base.clueVertex], ...exclusion.propagation.map((item) => item.clueVertex)]);
	}
	function relationProofDetails(witness) {
		const result = [];
		const describeExclusion = (exclusion) => {
			const base = exclusion.base;
			const basePair = exclusion.propagation[0]?.sourcePair ?? exclusion.pair;
			if (base.kind === "clue-1") result.push(`${vertexLabel(base.clueVertex)}的提示 1 排除了${pairLabel(basePair)}同时接入。`);
			else if (base.kind === "clue-3") result.push(`${vertexLabel(base.clueVertex)}的提示 3 排除了${pairLabel(basePair)}同时避开。`);
			else result.push(`${coordinateLabel(base.cell)}已经不允许 ${base.requiredOrientation}，因此对应的异向组合不可能。`);
			for (const propagation of exclusion.propagation) result.push(`${vertexLabel(propagation.clueVertex)}的提示 2 把${pairLabel(propagation.sourcePair)}的联合排除传到${pairLabel(propagation.targetPair)}。`);
		};
		if (witness.proof.kind === "two-wedges-excluded") {
			describeExclusion(witness.proof.exclusions[0]);
			describeExclusion(witness.proof.exclusions[1]);
			result.push(`${pairLabel({ cells: [witness.left, witness.right] })}的两种异向画法都被排除，所以这两格同向。`);
		} else {
			const proof = witness.proof;
			if (proof.sourceChain !== void 0) {
				for (const link of proof.sourceChain.links) result.push(...relationProofDetails(link));
				result.push(`${pairLabel({ cells: proof.sourcePair ?? proof.remainingPair })}作为同向格对固定贡献一条线。`);
			}
			result.push(`${vertexLabel(proof.vertex)}的提示 ${proof.clue} 在扣除 ${proof.fixedConnected + (proof.sourcePair === void 0 ? 0 : 1)} 条固定贡献后，剩余两格必须恰好接入一格，因此它们同向。`);
		}
		return result;
	}
	function uniqueCells$1(cells) {
		const map = /* @__PURE__ */ new Map();
		for (const cell of cells) map.set(cellKey$1(cell), cell);
		return [...map.values()].sort(compareCell);
	}
	function uniqueVertices(vertices) {
		const map = /* @__PURE__ */ new Map();
		for (const vertex of vertices) map.set(vertexKey(vertex), vertex);
		return [...map.values()].sort(compareVertex);
	}
	function uniqueDetails(details) {
		return [...new Set(details)];
	}
	function chainLinks(chains) {
		const result = /* @__PURE__ */ new Map();
		for (const chain of chains) for (const link of chain.links) {
			const cells = [link.left, link.right].sort(compareCell);
			const from = cells[0];
			const to = cells[1];
			if (from === void 0 || to === void 0) continue;
			result.set(`${cellKey$1(from)}|${cellKey$1(to)}`, {
				from,
				to
			});
		}
		return [...result.values()];
	}
	/**
	* 展开一条用户证明实际依赖的全部同向链。
	* count-exact-one 关系可能由更早的 sourceChain 支撑；只展示最外层链会把
	* 证明中间环节藏起来。这里递归收集依赖，但不会把同一关系分量中的无关边加入。
	*/
	function requiredProofChains(roots) {
		const result = [];
		const seen = /* @__PURE__ */ new Set();
		const visit = (chain) => {
			const signature = chain.links.map((link) => {
				const cells = [link.left, link.right].sort(compareCell);
				const left = cells[0];
				const right = cells[1];
				return left === void 0 || right === void 0 ? "" : `${cellKey$1(left)}|${cellKey$1(right)}:${link.proof.kind}`;
			}).join(">");
			if (seen.has(signature)) return;
			seen.add(signature);
			result.push(chain);
			for (const link of chain.links) if (link.proof.kind === "count-exact-one" && link.proof.sourceChain !== void 0) visit(link.proof.sourceChain);
		};
		for (const root of roots) visit(root);
		return result;
	}
	function proofGraphCells(chains) {
		return uniqueCells$1(chains.flatMap((chain) => chain.cells));
	}
	function proofHighlightVertices(chains) {
		const sources = [];
		const propagations = [];
		const visit = (witness) => {
			if (witness.proof.kind === "count-exact-one") {
				sources.push(witness.proof.vertex);
				for (const link of witness.proof.sourceChain?.links ?? []) visit(link);
				return;
			}
			for (const exclusion of witness.proof.exclusions) {
				if (exclusion.base.kind !== "cell-domain") sources.push(exclusion.base.clueVertex);
				propagations.push(...exclusion.propagation.map((step) => step.clueVertex));
			}
		};
		for (const chain of chains) for (const link of chain.links) visit(link);
		return {
			sources: uniqueVertices(sources),
			propagations: uniqueVertices(propagations)
		};
	}
	function buildWedgeRelations(board, pairs, nodes, adjacency, dsu) {
		const exclusions = /* @__PURE__ */ new Map();
		for (const key of nodes.keys()) exclusions.set(key, materializeWedgeWitness(nodes, key));
		for (const pair of pairs) {
			const first = exclusions.get(wedgeKey(pair, pair.apexes[0]));
			const second = exclusions.get(wedgeKey(pair, pair.apexes[1]));
			if (first === void 0 || second === void 0) continue;
			const witness = {
				left: pair.cells[0],
				right: pair.cells[1],
				proof: {
					kind: "two-wedges-excluded",
					ruleId: "SL-WDG-404",
					exclusions: [first, second]
				}
			};
			addRelationEdge(board.width, adjacency, witness);
			dsu.union(cellIndex(board.width, witness.left), cellIndex(board.width, witness.right));
		}
		return exclusions;
	}
	function closeCountRelations(board, adjacency, dsu) {
		let changed;
		do {
			changed = false;
			for (let r = 0; r <= board.height; r += 1) for (let c = 0; c <= board.width; c += 1) {
				const clue = board.clues[r]?.[c];
				if (clue === null || clue === void 0) continue;
				const vertex = {
					r,
					c
				};
				const sourcePairs = [void 0, ...uniquePairsAround(board, vertex, (cell) => dsu.find(cellIndex(board.width, cell)))];
				for (const sourcePair of sourcePairs) {
					const state = collapsedCountState(board, vertex, clue, sourcePair);
					if (state === null || state.residual !== 1 || state.remainingUnknown.length !== 2) continue;
					const left = state.remainingUnknown[0]?.cell;
					const right = state.remainingUnknown[1]?.cell;
					if (left === void 0 || right === void 0 || !areAdjacentCells(left, right)) continue;
					const leftIndex = cellIndex(board.width, left);
					const rightIndex = cellIndex(board.width, right);
					if (dsu.find(leftIndex) === dsu.find(rightIndex)) continue;
					const witness = {
						left,
						right,
						proof: countRelationProof(board, adjacency, vertex, clue, state, [left, right], sourcePair)
					};
					addRelationEdge(board.width, adjacency, witness);
					dsu.union(leftIndex, rightIndex);
					changed = true;
				}
			}
		} while (changed);
	}
	function buildSameDirectionAnalysis(board) {
		const pairs = enumeratePairs(board.width, board.height);
		const pairsByCells = /* @__PURE__ */ new Map();
		for (const pair of pairs) pairsByCells.set(pairCellKey(board.width, pair.cells[0], pair.cells[1]), pair);
		const nodes = propagateWedgeFacts(buildBaseFacts(board, pairs), buildPropagationTransitions(board, pairsByCells));
		const adjacency = Array.from({ length: board.width * board.height }, () => []);
		const dsu = new DisjointSet$1(board.width * board.height);
		const exclusions = buildWedgeRelations(board, pairs, nodes, adjacency, dsu);
		closeCountRelations(board, adjacency, dsu);
		for (const entries of adjacency) entries.sort((left, right) => left.to - right.to);
		return {
			width: board.width,
			height: board.height,
			revision: board.revision,
			pairs,
			wedgeExclusions: exclusions,
			relationAdjacency: adjacency,
			componentOfCell: Array.from({ length: board.width * board.height }, (_, index) => dsu.find(index))
		};
	}
	function assertCompatible$1(board, analysis) {
		if (board.width !== analysis.width || board.height !== analysis.height || board.revision !== analysis.revision) throw new Error("同向链分析与当前棋盘版本不一致。");
	}
	function findSameDirectionChain(analysis, start, goal) {
		return findRelationPathInAdjacency(analysis.width, analysis.relationAdjacency, start, goal);
	}
	function anchorSteps(board, analysis) {
		const components = /* @__PURE__ */ new Map();
		for (let index = 0; index < analysis.componentOfCell.length; index += 1) {
			const root = analysis.componentOfCell[index];
			if (root === void 0) continue;
			const list = components.get(root) ?? [];
			list.push(cellFromIndex(board.width, index));
			components.set(root, list);
		}
		const steps = [];
		for (const cells of components.values()) {
			if (cells.length < 2) continue;
			cells.sort(compareCell);
			const anchors = cells.flatMap((cell) => {
				const orientation = fixedOrientation(getCellDomain(board, cell));
				return orientation === null ? [] : [{
					cell,
					orientation
				}];
			});
			if (anchors.length === 0) continue;
			const rAnchor = anchors.find((anchor) => anchor.orientation === "R");
			const lAnchor = anchors.find((anchor) => anchor.orientation === "L");
			if (rAnchor !== void 0 && lAnchor !== void 0) {
				const chain = findSameDirectionChain(analysis, rAnchor.cell, lAnchor.cell);
				if (chain === null) throw new Error("同向冲突的两个锚点之间缺少关系路径。");
				const proofChains = requiredProofChains([chain]);
				const proofCells = proofGraphCells(proofChains);
				const proofLinks = chainLinks(proofChains);
				const details = uniqueDetails(chain.links.flatMap(relationProofDetails));
				const proofVertices = proofHighlightVertices(proofChains);
				steps.push({
					schemaVersion: 1,
					stepId: `SL-WDG-405@${board.revision}:conflict:${cellKey$1(rAnchor.cell)}:${cellKey$1(lAnchor.cell)}`,
					origin: "catalog-logic",
					status: "proposed",
					rule: {
						id: "SL-WDG-405",
						version: "1.0.0"
					},
					variant: {
						id: "PAT-WDG-CHAIN-ANCHOR",
						displayName: "同向链：方向冲突"
					},
					beforeRevision: board.revision,
					premises: {
						rAnchor,
						lAnchor,
						sameDirectionChain: chain,
						sameDirectionProofChains: proofChains,
						proofDetails: details
					},
					conclusions: [{
						kind: "report-contradiction",
						code: "E-WDG-ORIENTATION-CONFLICT",
						messageZh: "同一条同向链中同时出现了反斜线和正斜线。"
					}],
					involved: {
						vertices: uniqueVertices(chain.links.flatMap(relationWitnessVertices)),
						cells: proofCells
					},
					highlight: [
						{
							role: "same-direction-chain",
							cells: proofCells,
							cellLinks: proofLinks
						},
						{
							role: "wedge-source",
							vertices: proofVertices.sources
						},
						{
							role: "wedge-propagation",
							vertices: proofVertices.propagations
						},
						{
							role: "direction-anchor",
							cells: [rAnchor.cell, lAnchor.cell]
						}
					],
					explanation: {
						locale: "zh-CN",
						title: "同向链：链中出现方向冲突",
						templateId: "same-direction.anchor.conflict",
						parameters: {
							chainLength: proofCells.length,
							proofLength: proofLinks.length
						},
						rendered: `${coordinateLabel(rAnchor.cell)}和${coordinateLabel(lAnchor.cell)}属于同一条同向链，本应画相同方向，但它们现在分别是 R（\\）和 L（/），因此当前局面矛盾。`
					},
					sortKey: [
						50,
						chain.cells.length,
						rAnchor.cell.r,
						rAnchor.cell.c,
						"SL-WDG-405:conflict"
					]
				});
				continue;
			}
			const anchor = anchors[0];
			if (anchor === void 0) continue;
			const targets = cells.filter((cell) => getCellDomain(board, cell) === 3);
			if (targets.length === 0) continue;
			const chains = targets.map((target) => {
				const chain = findSameDirectionChain(analysis, anchor.cell, target);
				if (chain === null) throw new Error("同向分量内缺少方向传递路径。");
				return chain;
			});
			const proofChains = requiredProofChains(chains);
			const evidenceCells = proofGraphCells(proofChains);
			const proofLinks = chainLinks(proofChains);
			const details = uniqueDetails(chains.flatMap((chain) => chain.links.flatMap(relationProofDetails)));
			const proofVertices = proofHighlightVertices(proofChains);
			const conclusions = targets.map((cell) => ({
				kind: "assign-orientation",
				cell,
				orientation: anchor.orientation,
				beforeDomain: getCellDomain(board, cell)
			}));
			steps.push({
				schemaVersion: 1,
				stepId: `SL-WDG-405@${board.revision}:anchor:${cellKey$1(anchor.cell)}:${targets.map(cellKey$1).join("+")}`,
				origin: "catalog-logic",
				status: "proposed",
				rule: {
					id: "SL-WDG-405",
					version: "1.0.0"
				},
				variant: {
					id: "PAT-WDG-CHAIN-ANCHOR",
					displayName: "同向链：已知方向沿链传递"
				},
				beforeRevision: board.revision,
				premises: {
					anchor,
					targets,
					sameDirectionChains: chains,
					sameDirectionProofChains: proofChains,
					proofDetails: details
				},
				conclusions,
				involved: {
					vertices: uniqueVertices(chains.flatMap((chain) => chain.links.flatMap(relationWitnessVertices))),
					cells: evidenceCells
				},
				highlight: [
					{
						role: "same-direction-chain",
						cells: evidenceCells,
						cellLinks: proofLinks
					},
					{
						role: "wedge-source",
						vertices: proofVertices.sources
					},
					{
						role: "wedge-propagation",
						vertices: proofVertices.propagations
					},
					{
						role: "direction-anchor",
						cells: [anchor.cell]
					},
					{
						role: "target",
						cells: targets
					}
				],
				explanation: {
					locale: "zh-CN",
					title: "同向链：已知方向沿链传递",
					templateId: "same-direction.anchor.propagate",
					parameters: {
						chainCells: evidenceCells.length,
						relationLinks: proofLinks.length,
						targetCount: targets.length,
						orientation: anchor.orientation
					},
					rendered: `同向桥连接的 ${evidenceCells.length} 个方格由可复核的同向关系组成同向链的最小证明图。${coordinateLabel(anchor.cell)}已经画成 ${anchor.orientation}（${anchor.orientation === "R" ? "\\" : "/"}），所以证明图中的其余 ${targets.length} 个目标格也必须画成相同方向。`
				},
				sortKey: [
					50,
					evidenceCells.length,
					anchor.cell.r,
					anchor.cell.c,
					"SL-WDG-405:anchor"
				]
			});
		}
		return steps;
	}
	function countSteps(board, analysis) {
		const steps = [];
		for (let r = 0; r <= board.height; r += 1) for (let c = 0; c <= board.width; c += 1) {
			const clue = board.clues[r]?.[c];
			if (clue === null || clue === void 0) continue;
			const vertex = {
				r,
				c
			};
			const pairCandidates = uniquePairsAround(board, vertex, (cell) => {
				const index = cellIndex(board.width, cell);
				return analysis.componentOfCell[index] ?? index;
			});
			for (const pair of pairCandidates) {
				const state = collapsedCountState(board, vertex, clue, pair);
				if (state === null) continue;
				if (!(state.residual < 0 || state.residual > state.remainingUnknown.length || state.remainingUnknown.length > 0 && (state.residual === 0 || state.residual === state.remainingUnknown.length))) continue;
				const chain = findSameDirectionChain(analysis, pair[0], pair[1]);
				if (chain === null) continue;
				const proofChains = requiredProofChains([chain]);
				const proofCells = proofGraphCells(proofChains);
				const proofLinks = chainLinks(proofChains);
				const conclusions = [];
				let calculation;
				if (state.residual < 0 || state.residual > state.remainingUnknown.length) {
					conclusions.push({
						kind: "report-contradiction",
						code: "E-WDG-COUNT",
						messageZh: `同向格对固定贡献一条线后，提示 ${clue} 的剩余计数无法满足。`
					});
					calculation = `剩余需求为 ${state.residual}，但其余候选只有 ${state.remainingUnknown.length} 个，计数矛盾`;
				} else if (state.residual === 0) {
					for (const candidate of state.remainingUnknown) conclusions.push({
						kind: "eliminate-orientation",
						cell: candidate.cell,
						orientation: candidate.connectOrientation,
						beforeDomain: candidate.domain
					});
					calculation = "剩余需求为 0，其余候选都不能接入";
				} else {
					for (const candidate of state.remainingUnknown) conclusions.push({
						kind: "assign-orientation",
						cell: candidate.cell,
						orientation: candidate.connectOrientation,
						beforeDomain: candidate.domain
					});
					calculation = `还需要 ${state.residual} 条，恰好等于其余 ${state.remainingUnknown.length} 个候选，所以全部接入`;
				}
				const details = uniqueDetails([
					...chain.links.flatMap(relationProofDetails),
					`${pairLabel({ cells: pair })}属于同向链，因此对${vertexLabel(vertex)}固定贡献一条线。`,
					`提示 ${clue} 扣除已有 ${state.fixedConnected} 条和同向格对固定的 1 条后，${calculation}。`
				]);
				const proofVertices = proofHighlightVertices(proofChains);
				const involvedCells = uniqueCells$1([
					...proofCells,
					...state.fixedCells,
					...state.excludedCells,
					...state.remainingUnknown.map((candidate) => candidate.cell)
				]);
				steps.push({
					schemaVersion: 1,
					stepId: `SL-WDG-405@${board.revision}:count:V${r},${c}:${cellKey$1(pair[0])}+${cellKey$1(pair[1])}`,
					origin: "catalog-logic",
					status: "proposed",
					rule: {
						id: "SL-WDG-405",
						version: "1.0.0"
					},
					variant: {
						id: "PAT-WDG-CHAIN-COUNT",
						displayName: "同向链：固定一条计数贡献"
					},
					beforeRevision: board.revision,
					premises: {
						vertex,
						clue,
						fixedConnected: state.fixedConnected,
						sameDirectionContribution: 1,
						residual: state.residual,
						remainingCandidates: state.remainingUnknown.length,
						sameDirectionPair: pair,
						sameDirectionChain: chain,
						sameDirectionProofChains: proofChains,
						proofDetails: details
					},
					conclusions,
					involved: {
						vertices: uniqueVertices([vertex, ...chain.links.flatMap(relationWitnessVertices)]),
						cells: involvedCells
					},
					highlight: [
						{
							role: "same-direction-chain",
							cells: proofCells,
							cellLinks: proofLinks
						},
						{
							role: "same-direction-pair",
							cells: pair
						},
						{
							role: "wedge-source",
							vertices: proofVertices.sources
						},
						{
							role: "wedge-propagation",
							vertices: proofVertices.propagations
						},
						{
							role: "clue",
							vertices: [vertex]
						},
						{
							role: "known-contribution",
							cells: state.fixedCells
						},
						{
							role: "known-exclusion",
							cells: state.excludedCells
						},
						{
							role: "target",
							cells: state.remainingUnknown.map((candidate) => candidate.cell)
						}
					],
					explanation: {
						locale: "zh-CN",
						title: "同向链：固定一条计数贡献",
						templateId: "same-direction.count.fixed-one",
						parameters: {
							clue,
							fixedConnected: state.fixedConnected,
							sameDirectionContribution: 1,
							residual: state.residual,
							remainingCandidates: state.remainingUnknown.length
						},
						rendered: `${pairLabel({ cells: pair })}属于同一条同向链，因此无论同为 / 还是同为 \\，都恰好有一格接入提示 ${clue}。扣除已有连接和这固定的一条贡献后，${calculation}。`
					},
					sortKey: [
						50,
						involvedCells.length,
						r,
						c,
						"SL-WDG-405:count"
					]
				});
			}
		}
		return steps;
	}
	function deduplicateSteps(steps) {
		const best = /* @__PURE__ */ new Map();
		for (const step of steps) {
			const signature = conclusionSignature(step);
			const previous = best.get(signature);
			if (previous === void 0 || compareReasoningSteps(step, previous) < 0) best.set(signature, step);
		}
		return [...best.values()].sort(compareReasoningSteps);
	}
	function findSameDirectionSteps(board, providedAnalysis) {
		const analysis = providedAnalysis ?? buildSameDirectionAnalysis(board);
		assertCompatible$1(board, analysis);
		return deduplicateSteps([...anchorSteps(board, analysis), ...countSteps(board, analysis)]);
	}
	function findNextSameDirectionStep(board, providedAnalysis) {
		return findSameDirectionSteps(board, providedAnalysis)[0] ?? null;
	}
	//#endregion
	//#region src/domain/rules/escape.ts
	function assertCompatible(board, index) {
		if (index.width !== board.width || index.height !== board.height || index.revision !== board.revision) throw new Error("逃逸分析使用了不匹配的连通分量索引。");
	}
	function fixedDegree(index, vertex) {
		return index.adjacency[vertex.r * (index.width + 1) + vertex.c]?.length ?? 0;
	}
	function endpointHasCapacity(board, index, vertex) {
		const clue = board.clues[vertex.r]?.[vertex.c];
		return clue === null || clue === void 0 || clue - fixedDegree(index, vertex) > 0;
	}
	function enumeratePotentialConnections(board, index) {
		const connections = [];
		for (let r = 0; r < board.height; r += 1) for (let c = 0; c < board.width; c += 1) {
			if (board.cellDomains[r]?.[c] !== 3) continue;
			const cell = {
				r,
				c
			};
			for (const orientation of ["R", "L"]) {
				const [from, to] = cellEndpoints(cell, orientation);
				const fromComponent = componentIdAt(index, from);
				const toComponent = componentIdAt(index, to);
				if (fromComponent === toComponent) continue;
				if (!endpointHasCapacity(board, index, from) || !endpointHasCapacity(board, index, to)) continue;
				connections.push({
					id: `C${r},${c}:${orientation}`,
					cell,
					orientation,
					from,
					to,
					fromComponent,
					toComponent
				});
			}
		}
		return connections;
	}
	function otherComponent(connection, componentId) {
		if (connection.fromComponent === componentId) return connection.toComponent;
		if (connection.toComponent === componentId) return connection.fromComponent;
		throw new Error(`候选连接 ${connection.id} 不邻接分量 ${componentId}。`);
	}
	function buildContributions(board, index, connections) {
		const candidateCounts = /* @__PURE__ */ new Map();
		for (const connection of connections) {
			candidateCounts.set(vertexKey(connection.from), (candidateCounts.get(vertexKey(connection.from)) ?? 0) + 1);
			candidateCounts.set(vertexKey(connection.to), (candidateCounts.get(vertexKey(connection.to)) ?? 0) + 1);
		}
		return index.components.map((component) => component.vertices.map((vertex) => {
			const clue = board.clues[vertex.r]?.[vertex.c] ?? null;
			const degree = fixedDegree(index, vertex);
			const candidateCrossCount = candidateCounts.get(vertexKey(vertex)) ?? 0;
			const residualCapacity = clue === null ? null : Math.max(0, clue - degree);
			return {
				vertex,
				clue,
				fixedDegree: degree,
				candidateCrossCount,
				residualCapacity,
				upperBoundContribution: residualCapacity === null ? candidateCrossCount : Math.min(residualCapacity, candidateCrossCount)
			};
		}));
	}
	function buildGlobalReachability(components, adjacency, terminalFacts) {
		const reachable = /* @__PURE__ */ new Set();
		const queue = [];
		for (const component of components) {
			if (!component.touchesBoundary) continue;
			reachable.add(component.id);
			queue.push(component.id);
		}
		let head = 0;
		while (head < queue.length) {
			const current = queue[head];
			head += 1;
			if (current === void 0) break;
			for (const connection of adjacency[current] ?? []) {
				const next = otherComponent(connection, current);
				if (reachable.has(next)) continue;
				const nextComponent = components[next];
				if (nextComponent === void 0) continue;
				if (!nextComponent.touchesBoundary && terminalFacts.has(next)) continue;
				reachable.add(next);
				queue.push(next);
			}
		}
		return reachable;
	}
	function buildEscapeAnalysis(board, providedConnectivity) {
		const connectivity = providedConnectivity ?? buildConnectivityIndex(board);
		assertCompatible(board, connectivity);
		const connections = enumeratePotentialConnections(board, connectivity);
		const adjacency = Array.from({ length: connectivity.components.length }, () => []);
		for (const connection of connections) {
			adjacency[connection.fromComponent]?.push(connection);
			adjacency[connection.toComponent]?.push(connection);
		}
		const contributions = buildContributions(board, connectivity, connections);
		const exitUpperBounds = contributions.map((entries) => entries.reduce((sum, entry) => sum + entry.upperBoundContribution, 0));
		const terminalFacts = /* @__PURE__ */ new Map();
		for (const component of connectivity.components) {
			const upperBound = exitUpperBounds[component.id] ?? 0;
			if (component.touchesBoundary || upperBound > 1) continue;
			const entries = contributions[component.id] ?? [];
			const onlyVertex = component.vertices.length === 1 ? component.vertices[0] : void 0;
			const isolatedInternalOne = onlyVertex !== void 0 && component.fixedEdges.length === 0 && board.clues[onlyVertex.r]?.[onlyVertex.c] === 1;
			terminalFacts.set(component.id, {
				rule: {
					id: "SL-PTH-302",
					version: "1.0.0"
				},
				revision: board.revision,
				componentId: component.id,
				exitUpperBound: upperBound,
				vertices: component.vertices,
				contributions: entries,
				isolatedInternalOne
			});
		}
		const globallyBoundaryReachable = buildGlobalReachability(connectivity.components, adjacency, terminalFacts);
		return {
			boardRevision: board.revision,
			connectivity,
			connections,
			adjacency,
			contributions,
			exitUpperBounds,
			terminalFacts,
			globallyBoundaryReachable
		};
	}
	function exactRoute(analysis, sourceComponentId, first) {
		const start = otherComponent(first, sourceComponentId);
		const startComponent = analysis.connectivity.components[start];
		if (startComponent === void 0) return null;
		if (!startComponent.touchesBoundary && analysis.terminalFacts.has(start)) return null;
		if (startComponent.touchesBoundary) return {
			componentIds: [sourceComponentId, start],
			connections: [first],
			boundaryComponentId: start
		};
		const previous = /* @__PURE__ */ new Map();
		const queue = [start];
		const visited = /* @__PURE__ */ new Set([sourceComponentId, start]);
		let goal;
		let head = 0;
		while (head < queue.length && goal === void 0) {
			const current = queue[head];
			head += 1;
			if (current === void 0) break;
			for (const connection of analysis.adjacency[current] ?? []) {
				const next = otherComponent(connection, current);
				if (visited.has(next)) continue;
				const component = analysis.connectivity.components[next];
				if (component === void 0) continue;
				if (!component.touchesBoundary && analysis.terminalFacts.has(next)) continue;
				visited.add(next);
				previous.set(next, {
					component: current,
					edge: connection
				});
				if (component.touchesBoundary) {
					goal = next;
					break;
				}
				queue.push(next);
			}
		}
		if (goal === void 0) return null;
		const reverseComponents = [goal];
		const reverseConnections = [];
		let current = goal;
		while (current !== start) {
			const entry = previous.get(current);
			if (entry === void 0) return null;
			reverseConnections.push(entry.edge);
			reverseComponents.push(entry.component);
			current = entry.component;
		}
		return {
			componentIds: [sourceComponentId, ...reverseComponents.reverse()],
			connections: [first, ...reverseConnections.reverse()],
			boundaryComponentId: goal
		};
	}
	function summarizeComponentEscape(analysis, componentId) {
		const component = analysis.connectivity.components[componentId];
		if (component === void 0) throw new RangeError(`分量 ${componentId} 不存在。`);
		const crossEdges = analysis.adjacency[componentId] ?? [];
		const possibleFirstEdges = crossEdges.filter((connection) => {
			const destination = otherComponent(connection, componentId);
			if (analysis.connectivity.components[destination]?.touchesBoundary) return true;
			if (analysis.terminalFacts.has(destination)) return false;
			return analysis.globallyBoundaryReachable.has(destination);
		});
		if (possibleFirstEdges.length !== 1) return {
			component,
			crossEdges,
			possibleFirstEdges
		};
		const first = possibleFirstEdges[0];
		if (first === void 0) return {
			component,
			crossEdges,
			possibleFirstEdges: []
		};
		const uniqueRoute = exactRoute(analysis, componentId, first);
		return uniqueRoute === null ? {
			component,
			crossEdges,
			possibleFirstEdges: []
		} : {
			component,
			crossEdges,
			possibleFirstEdges,
			uniqueRoute
		};
	}
	function terminalPairStep(board, analysis, cell, rejectedConnections) {
		const rejectedOrientations = rejectedConnections.map((connection) => connection.orientation);
		const involvedComponentIds = new Set(rejectedConnections.flatMap((connection) => [connection.fromComponent, connection.toComponent]));
		const components = [...involvedComponentIds].flatMap((componentId) => {
			const component = analysis.connectivity.components[componentId];
			return component === void 0 ? [] : [component];
		});
		const facts = [...involvedComponentIds].flatMap((componentId) => {
			const fact = analysis.terminalFacts.get(componentId);
			return fact === void 0 ? [] : [fact];
		});
		const vertices = components.flatMap((component) => component.vertices);
		const fixedCells = components.flatMap((component) => component.fixedEdges.map((edge) => edge.cell));
		if (rejectedOrientations.length === 2) return {
			schemaVersion: 1,
			stepId: `SL-PTH-303@${board.revision}:C${cell.r},${cell.c}:both`,
			origin: "catalog-logic",
			status: "proposed",
			rule: {
				id: "SL-PTH-303",
				version: "1.0.0"
			},
			variant: {
				id: "PAT-PTH-TERMINAL-PAIR",
				displayName: "两个方向都接入内部死路"
			},
			beforeRevision: board.revision,
			premises: {
				cell,
				terminalFacts: facts,
				rejectedConnections
			},
			conclusions: [{
				kind: "report-contradiction",
				code: "E-CELL-DOMAIN-EMPTY",
				messageZh: `第 ${cell.r + 1} 行第 ${cell.c + 1} 列方格的两个方向都会把内部死路封在盘内。`
			}],
			involved: {
				vertices,
				cells: [...fixedCells, cell]
			},
			highlight: [{
				role: "terminal-component",
				vertices,
				cells: fixedCells
			}, {
				role: "rejected-edge",
				cells: [cell]
			}],
			explanation: {
				locale: "zh-CN",
				title: "内部死路：两个方向都不合法",
				templateId: "path.terminal-pair.both-contradiction",
				parameters: { cell },
				rendered: `第 ${cell.r + 1} 行第 ${cell.c + 1} 列的两个方向都会连接两端至多各剩一个端口的内部分量；连接后再也没有端口通向边界，因此当前局面矛盾。`
			},
			sortKey: [
				0,
				vertices.length,
				cell.r,
				cell.c,
				"SL-PTH-303:both"
			]
		};
		const rejected = rejectedOrientations[0];
		if (rejected === void 0) throw new Error("终止分量互接步骤缺少排除方向。");
		const chosen = oppositeOrientation(rejected);
		return {
			schemaVersion: 1,
			stepId: `SL-PTH-303@${board.revision}:C${cell.r},${cell.c}:${rejected}`,
			origin: "catalog-logic",
			status: "proposed",
			rule: {
				id: "SL-PTH-303",
				version: "1.0.0"
			},
			variant: {
				id: "PAT-PTH-TERMINAL-PAIR",
				displayName: "内部死路"
			},
			beforeRevision: board.revision,
			premises: {
				cell,
				rejectedOrientation: rejected,
				terminalFacts: facts,
				rejectedConnections
			},
			conclusions: [{
				kind: "assign-orientation",
				cell,
				orientation: chosen,
				beforeDomain: 3
			}],
			involved: {
				vertices,
				cells: [...fixedCells, cell]
			},
			highlight: [
				{
					role: "terminal-component",
					vertices,
					cells: fixedCells
				},
				{
					role: "rejected-edge",
					cells: [cell]
				},
				{
					role: "target",
					cells: [cell]
				}
			],
			explanation: {
				locale: "zh-CN",
				title: "内部死路：两个单端口分量不能互接",
				templateId: "path.terminal-pair.reject",
				parameters: {
					rejected,
					chosen,
					cell
				},
				rendered: `方向 ${rejected} 会连接两个尚未触边、且至多各剩一个端口的分量。这个连接会同时耗掉双方端口，使合并后的路径永远留在内部，所以该格只能画 ${chosen}。`
			},
			sortKey: [
				45,
				vertices.length + 1,
				cell.r,
				cell.c,
				rejected
			]
		};
	}
	function findTerminalPairSteps(board, providedAnalysis) {
		const analysis = providedAnalysis ?? buildEscapeAnalysis(board);
		const byCell = /* @__PURE__ */ new Map();
		for (const connection of analysis.connections) {
			if (!analysis.terminalFacts.has(connection.fromComponent) || !analysis.terminalFacts.has(connection.toComponent)) continue;
			const key = `${connection.cell.r},${connection.cell.c}`;
			const list = byCell.get(key) ?? [];
			list.push(connection);
			byCell.set(key, list);
		}
		return [...byCell.values()].map((connections) => {
			const cell = connections[0]?.cell;
			if (cell === void 0) throw new Error("终止分量候选缺少方格。");
			return terminalPairStep(board, analysis, cell, connections);
		}).sort(compareReasoningSteps);
	}
	function noEscapeStep(board, analysis, summary) {
		const component = summary.component;
		const terminalFact = analysis.terminalFacts.get(component.id);
		const fixedCells = component.fixedEdges.map((edge) => edge.cell);
		const candidateCells = summary.crossEdges.map((edge) => edge.cell);
		const isolatedOne = terminalFact?.isolatedInternalOne === true;
		return {
			schemaVersion: 1,
			stepId: `SL-PTH-301@${board.revision}:component-${component.id}`,
			origin: "catalog-logic",
			status: "proposed",
			rule: {
				id: "SL-PTH-301",
				version: "1.0.0"
			},
			variant: {
				id: isolatedOne ? "PAT-PTH-INTERNAL-1" : "PAT-PTH-INTERNAL-DEAD-END",
				displayName: isolatedOne ? "内部提示 1 无法通向边界" : "内部分量没有出路"
			},
			beforeRevision: board.revision,
			premises: {
				componentId: component.id,
				componentVertices: component.vertices,
				crossEdges: summary.crossEdges,
				possibleFirstEdges: summary.possibleFirstEdges,
				exitUpperBound: analysis.exitUpperBounds[component.id] ?? 0,
				terminalFact: terminalFact ?? null,
				terminalDestinations: summary.crossEdges.flatMap((edge) => {
					const destination = otherComponent(edge, component.id);
					const fact = analysis.terminalFacts.get(destination);
					return fact === void 0 ? [] : [fact];
				})
			},
			conclusions: [{
				kind: "report-contradiction",
				code: "E-INTERNAL-NO-EXIT",
				messageZh: "这个内部连通分量已经没有任何可能路线到达棋盘边界。"
			}],
			involved: {
				vertices: component.vertices,
				cells: [...fixedCells, ...candidateCells]
			},
			highlight: [{
				role: "component",
				vertices: component.vertices,
				cells: fixedCells
			}, {
				role: "candidate-exit",
				cells: candidateCells
			}],
			explanation: {
				locale: "zh-CN",
				title: isolatedOne ? "内部死路：提示 1 被封在盘内" : "边界可达性：内部分量已经无路可走",
				templateId: "path.no-escape.contradiction",
				parameters: {
					componentId: component.id,
					crossEdgeCount: summary.crossEdges.length,
					exitUpperBound: analysis.exitUpperBounds[component.id] ?? 0
				},
				rendered: `这个尚未接触边界的分量有 ${summary.crossEdges.length} 个几何候选出口，但逐一检查后没有任何候选能作为一条通向边界路线的第一步，因此当前局面矛盾。`
			},
			sortKey: [
				40,
				component.vertices.length,
				component.vertices[0]?.r ?? 0,
				component.vertices[0]?.c ?? 0,
				`SL-PTH-301:${component.id}`
			]
		};
	}
	function uniqueEscapeStep(board, analysis, summary) {
		const route = summary.uniqueRoute;
		const first = summary.possibleFirstEdges[0];
		if (route === void 0 || first === void 0) throw new Error("唯一出路步骤缺少路线见证。");
		const component = summary.component;
		const fixedCells = component.fixedEdges.map((edge) => edge.cell);
		const candidateCells = summary.crossEdges.map((edge) => edge.cell);
		const rejected = summary.crossEdges.filter((edge) => edge.id !== first.id);
		const boundaryVertices = analysis.connectivity.components[route.boundaryComponentId]?.vertices.filter((vertex) => vertex.r === 0 || vertex.r === board.height || vertex.c === 0 || vertex.c === board.width) ?? [];
		return {
			schemaVersion: 1,
			stepId: `SL-PTH-304@${board.revision}:component-${component.id}:${first.id}`,
			origin: "catalog-logic",
			status: "proposed",
			rule: {
				id: "SL-PTH-304",
				version: "1.0.0"
			},
			variant: {
				id: "PAT-PTH-UNIQUE-EXIT",
				displayName: "唯一出路"
			},
			beforeRevision: board.revision,
			premises: {
				componentId: component.id,
				componentVertices: component.vertices,
				crossEdges: summary.crossEdges,
				rejectedFirstEdges: rejected,
				uniqueFirstEdge: first,
				route,
				terminalDestinations: rejected.flatMap((edge) => {
					const destination = otherComponent(edge, component.id);
					const fact = analysis.terminalFacts.get(destination);
					return fact === void 0 ? [] : [fact];
				})
			},
			conclusions: [{
				kind: "assign-orientation",
				cell: first.cell,
				orientation: first.orientation,
				beforeDomain: 3
			}],
			involved: {
				vertices: [...component.vertices, ...boundaryVertices],
				cells: [
					...fixedCells,
					...candidateCells,
					...route.connections.map((edge) => edge.cell)
				]
			},
			highlight: [
				{
					role: "component",
					vertices: component.vertices,
					cells: fixedCells
				},
				{
					role: "candidate-exit",
					cells: candidateCells
				},
				{
					role: "rejected-edge",
					cells: rejected.map((edge) => edge.cell)
				},
				{
					role: "escape-route",
					cells: route.connections.map((edge) => edge.cell)
				},
				{
					role: "boundary-target",
					vertices: boundaryVertices
				},
				{
					role: "target",
					cells: [first.cell]
				}
			],
			explanation: {
				locale: "zh-CN",
				title: "边界可达性：只剩一个真正的出路",
				templateId: "path.unique-escape.assign",
				parameters: {
					componentId: component.id,
					crossEdgeCount: summary.crossEdges.length,
					orientation: first.orientation,
					cell: first.cell,
					routeLength: route.connections.length
				},
				rendered: `这个内部分量表面上有 ${summary.crossEdges.length} 个候选出口，但其余方向要么进入只能终止的内部死路，要么无法继续到达边界。唯一有效的第一步是第 ${first.cell.r + 1} 行第 ${first.cell.c + 1} 列画 ${first.orientation}。`
			},
			sortKey: [
				50,
				component.vertices.length,
				first.cell.r,
				first.cell.c,
				first.id
			]
		};
	}
	function findBoundaryReachabilitySteps(board, providedAnalysis) {
		const analysis = providedAnalysis ?? buildEscapeAnalysis(board);
		if (analysis.connectivity.fixedCycle !== void 0) return [];
		const contradictions = [];
		const uniqueEscapes = [];
		for (const component of analysis.connectivity.components) {
			if (component.touchesBoundary) continue;
			const summary = summarizeComponentEscape(analysis, component.id);
			if (summary.possibleFirstEdges.length === 0) contradictions.push(noEscapeStep(board, analysis, summary));
			else if (summary.possibleFirstEdges.length === 1 && summary.uniqueRoute !== void 0) uniqueEscapes.push(uniqueEscapeStep(board, analysis, summary));
		}
		return [...contradictions, ...uniqueEscapes].sort(compareReasoningSteps);
	}
	//#endregion
	//#region src/domain/solver.ts
	function nextCountingStep(board, chainIndex, affectedCells) {
		if (affectedCells === void 0) return findNextCountingStep(board, { chainIndex });
		return findNextCountingStep(board, {
			chainIndex,
			affectedCells
		}) ?? findNextCountingStep(board, { chainIndex });
	}
	/**
	* 固定的教学调度顺序：计数、立即闭圈、成对闭圈与计数组合、
	* 无出路、终止分量互接、唯一出路，最后才尝试同向链。
	* 每次只返回一条完整原因；规则本身仍可一次确定多个方格。
	*/
	function findNextHumanLogicStep(board, options = {}) {
		const chainIndex = options.chainIndex ?? buildStraightChainIndex(board);
		const counting = nextCountingStep(board, chainIndex, options.affectedCells);
		if (counting !== null) return counting;
		const connectivity = buildConnectivityIndex(board);
		const cycle = findNextCycleAvoidanceStep(board, connectivity);
		if (cycle !== null) return cycle;
		const cycleCount = findNextCycleCountStep(board, connectivity, chainIndex);
		if (cycleCount !== null) return cycleCount;
		const escape = buildEscapeAnalysis(board, connectivity);
		const path = [...findBoundaryReachabilitySteps(board, escape), ...findTerminalPairSteps(board, escape)].sort(compareReasoningSteps)[0];
		if (path !== void 0) return path;
		return findNextSameDirectionStep(board);
	}
	//#endregion
	//#region src/domain/validation.ts
	var DisjointSet = class {
		parent;
		rank;
		constructor(size) {
			this.parent = Array.from({ length: size }, (_, index) => index);
			this.rank = Array(size).fill(0);
		}
		find(value) {
			let root = value;
			while (this.parent[root] !== root) root = this.parent[root] ?? root;
			let current = value;
			while (this.parent[current] !== current) {
				const next = this.parent[current] ?? current;
				this.parent[current] = root;
				current = next;
			}
			return root;
		}
		union(left, right) {
			let a = this.find(left);
			let b = this.find(right);
			if (a === b) return;
			const rankA = this.rank[a] ?? 0;
			const rankB = this.rank[b] ?? 0;
			if (rankA < rankB) [a, b] = [b, a];
			this.parent[b] = a;
			if (rankA === rankB) this.rank[a] = rankA + 1;
		}
	};
	function vertexIndex(width, vertex) {
		return vertex.r * (width + 1) + vertex.c;
	}
	function findPath(adjacency, start, goal) {
		const queue = [start];
		const previous = /* @__PURE__ */ new Map([[vertexKey(start), null]]);
		while (queue.length > 0) {
			const current = queue.shift();
			if (current === void 0) break;
			if (current.r === goal.r && current.c === goal.c) break;
			for (const edge of adjacency.get(vertexKey(current)) ?? []) {
				const key = vertexKey(edge.vertex);
				if (previous.has(key)) continue;
				previous.set(key, current);
				queue.push(edge.vertex);
			}
		}
		if (!previous.has(vertexKey(goal))) return [];
		const path = [];
		let current = goal;
		while (current !== null) {
			path.push(current);
			current = previous.get(vertexKey(current)) ?? null;
		}
		path.reverse();
		return path;
	}
	function validateBoard(board) {
		const issues = [];
		for (let r = 0; r < board.height; r += 1) for (let c = 0; c < board.width; c += 1) {
			const domain = board.cellDomains[r]?.[c];
			if (domain === 0 || domain === void 0) issues.push({
				code: "E-CELL-DOMAIN-EMPTY",
				severity: "blocking",
				phase: "semantic",
				messageZh: `第 ${r + 1} 行第 ${c + 1} 列方格没有可用方向。`,
				object: {
					kind: "cell",
					r,
					c
				}
			});
		}
		for (let r = 0; r <= board.height; r += 1) for (let c = 0; c <= board.width; c += 1) {
			const clue = board.clues[r]?.[c];
			if (clue === null || clue === void 0) continue;
			const vertex = {
				r,
				c
			};
			const incidents = incidentCells(board.width, board.height, vertex);
			if (clue > incidents.length) {
				issues.push({
					code: "E-CLUE-BOUNDARY-RANGE",
					severity: "blocking",
					phase: "semantic",
					messageZh: `第 ${r + 1} 行第 ${c + 1} 列顶点最多只能连接 ${incidents.length} 条线，不能填写 ${clue}。`,
					object: {
						kind: "vertex",
						r,
						c
					},
					details: {
						clue,
						maximum: incidents.length
					}
				});
				continue;
			}
			let fixedConnected = 0;
			let undecidedConnectable = 0;
			for (const incident of incidents) {
				const domain = board.cellDomains[incident.cell.r]?.[incident.cell.c];
				if (domain === void 0) continue;
				if (isFixedDomain(domain)) {
					if (fixedOrientation(domain) === incident.connectOrientation) fixedConnected += 1;
				} else if (maskHasOrientation(domain, incident.connectOrientation)) undecidedConnectable += 1;
			}
			if (fixedConnected > clue) issues.push({
				code: "E-CLUE-OVERFULL",
				severity: "blocking",
				phase: "semantic",
				messageZh: `第 ${r + 1} 行第 ${c + 1} 列顶点只需要 ${clue} 条线，但已经连接 ${fixedConnected} 条。`,
				object: {
					kind: "vertex",
					r,
					c
				},
				details: {
					clue,
					fixedConnected,
					undecidedConnectable
				}
			});
			else if (fixedConnected + undecidedConnectable < clue) issues.push({
				code: "E-CLUE-UNDERCAPACITY",
				severity: "blocking",
				phase: "semantic",
				messageZh: `第 ${r + 1} 行第 ${c + 1} 列顶点需要 ${clue} 条线，但最多只能达到 ${fixedConnected + undecidedConnectable} 条。`,
				object: {
					kind: "vertex",
					r,
					c
				},
				details: {
					clue,
					fixedConnected,
					undecidedConnectable
				}
			});
		}
		const disjointSet = new DisjointSet((board.width + 1) * (board.height + 1));
		const adjacency = /* @__PURE__ */ new Map();
		for (const edge of allFixedEdges(board)) {
			const left = vertexIndex(board.width, edge.from);
			const right = vertexIndex(board.width, edge.to);
			if (disjointSet.find(left) === disjointSet.find(right)) {
				const path = findPath(adjacency, edge.from, edge.to);
				issues.push({
					code: "E-FIXED-CYCLE",
					severity: "blocking",
					phase: "semantic",
					messageZh: `第 ${edge.cell.r + 1} 行第 ${edge.cell.c + 1} 列方格的斜线与已有路径形成闭环。`,
					object: {
						kind: "cell",
						...edge.cell
					},
					details: {
						orientation: edge.orientation,
						path
					}
				});
				break;
			}
			disjointSet.union(left, right);
			const fromList = adjacency.get(vertexKey(edge.from)) ?? [];
			fromList.push({
				vertex: edge.to,
				cell: edge.cell,
				orientation: edge.orientation
			});
			adjacency.set(vertexKey(edge.from), fromList);
			const toList = adjacency.get(vertexKey(edge.to)) ?? [];
			toList.push({
				vertex: edge.from,
				cell: edge.cell,
				orientation: edge.orientation
			});
			adjacency.set(vertexKey(edge.to), toList);
		}
		return issues;
	}
	//#endregion
	//#region src/io/slant-format.ts
	function issue(value) {
		return {
			severity: "blocking",
			...value
		};
	}
	function buildBoardFromReview(document) {
		const issues = [];
		const clues = [];
		for (let r = 0; r <= document.height; r += 1) {
			const sourceRow = document.clues[r] ?? [];
			const row = [];
			for (let c = 0; c <= document.width; c += 1) {
				const clue = sourceRow[c];
				if (clue === "unresolved" || clue === void 0) issues.push(issue({
					code: "E-UNCERTAIN-TOKEN",
					phase: "certainty",
					messageZh: `第 ${r + 1} 行第 ${c + 1} 列顶点尚未确认。`,
					object: {
						kind: "vertex",
						r,
						c
					}
				}));
				else row.push(clue);
			}
			clues.push(row);
		}
		const cellDomains = [];
		for (let r = 0; r < document.height; r += 1) {
			const sourceRow = document.cells[r] ?? [];
			const row = [];
			for (let c = 0; c < document.width; c += 1) {
				const state = sourceRow[c];
				if (state === "unresolved" || state === void 0) issues.push(issue({
					code: "E-UNCERTAIN-TOKEN",
					phase: "certainty",
					messageZh: `第 ${r + 1} 行第 ${c + 1} 列方格尚未确认。`,
					object: {
						kind: "cell",
						r,
						c
					}
				}));
				else row.push(state === "unknown" ? 3 : state === "R" ? 1 : 2);
			}
			cellDomains.push(row);
		}
		if (issues.length > 0) return { issues };
		const board = {
			schemaVersion: 1,
			width: document.width,
			height: document.height,
			clues,
			cellDomains,
			revision: 0
		};
		const semanticIssues = validateBoard(board);
		if (semanticIssues.some((entry) => entry.severity === "blocking")) return { issues: semanticIssues };
		return {
			board,
			issues: semanticIssues
		};
	}
	function clueToken(clue) {
		if (clue === null) return ".";
		if (clue === "unresolved") return "!";
		return String(clue);
	}
	function reviewCellToken(cell) {
		if (cell === "unknown") return "?";
		if (cell === "unresolved") return "!";
		return cell;
	}
	function serializeReviewDocument(document) {
		const lines = [
			"SLANT/1",
			`size ${document.width}x${document.height}`,
			"clues:"
		];
		for (const row of document.clues) lines.push(row.map(clueToken).join(" "));
		lines.push("diagonals:");
		for (const row of document.cells) lines.push(row.map(reviewCellToken).join(" "));
		return `${lines.join("\n")}\n`;
	}
	//#endregion
	//#region src/io/puzzle-slant.ts
	var PuzzleSlantImportError = class extends Error {
		code;
		constructor(code, message) {
			super(message);
			this.name = "PuzzleSlantImportError";
			this.code = code;
		}
	};
	var MIN_SIZE = 2;
	var MAX_SIZE = 50;
	function fail(code, message) {
		throw new PuzzleSlantImportError(code, message);
	}
	function checkedDimensions(width, height) {
		if (!Number.isInteger(width) || !Number.isInteger(height)) fail("PS-SIZE", `棋盘宽高必须是整数；当前为 ${String(width)}×${String(height)}。`);
		if (width < MIN_SIZE || width > MAX_SIZE || height < MIN_SIZE || height > MAX_SIZE) fail("PS-SIZE", `棋盘尺寸为 ${width}×${height}；宽和高都必须在 ${MIN_SIZE} 到 ${MAX_SIZE} 之间。`);
		return {
			width,
			height
		};
	}
	function isPuzzleSlantHostname(hostname) {
		const normalized = hostname.trim().toLowerCase().replace(/\.$/u, "");
		return normalized === "puzzle-slant.com" || normalized.endsWith(".puzzle-slant.com");
	}
	function assertPuzzleSlantHostname(hostname) {
		if (!isPuzzleSlantHostname(hostname)) fail("PS-HOST", `当前页面域名“${hostname || "（空）"}”不是 puzzle-slant.com，书签没有读取任何内容。`);
	}
	function expandedTask(task) {
		if (task.length === 0) fail("PS-TASK-EMPTY", "puzzle-slant task 不能为空。");
		const flat = [];
		for (let index = 0; index < task.length; index += 1) {
			const token = task[index] ?? "";
			if (token >= "0" && token <= "4") {
				flat.push(Number(token));
				continue;
			}
			if (token >= "a" && token <= "z") {
				const blankCount = token.charCodeAt(0) - "a".charCodeAt(0) + 1;
				flat.push(...Array(blankCount).fill(null));
				continue;
			}
			fail("PS-TASK-TOKEN", `task 第 ${index + 1} 个字符“${token}”无效；只允许 0..4 和 a..z。`);
		}
		return flat;
	}
	function puzzleSlantExpandedVertexCount(task) {
		return expandedTask(task).length;
	}
	function inferPuzzleSlantSquareSize(task) {
		const vertexCount = puzzleSlantExpandedVertexCount(task);
		const sideVertices = Math.sqrt(vertexCount);
		if (!Number.isInteger(sideVertices)) fail("PS-SQUARE-INFERENCE", `task 展开为 ${vertexCount} 个顶点，不能唯一推断为正方形棋盘；请填写宽和高。`);
		const size = sideVertices - 1;
		try {
			return checkedDimensions(size, size);
		} catch (error) {
			if (error instanceof PuzzleSlantImportError && error.code === "PS-SIZE") fail("PS-SQUARE-INFERENCE", `task 推断出的正方形尺寸为 ${size}×${size}，超出支持范围 ${MIN_SIZE}..${MAX_SIZE}。`);
			throw error;
		}
	}
	function decodePuzzleSlantTask(task, width, height) {
		checkedDimensions(width, height);
		const flat = expandedTask(task);
		const expected = (width + 1) * (height + 1);
		if (flat.length !== expected) {
			const comparison = flat.length < expected ? "不足" : "过多";
			fail("PS-TASK-SIZE", `task 展开为 ${flat.length} 个顶点，${comparison}；${width}×${height} 棋盘应有 ${expected} 个顶点。`);
		}
		return Array.from({ length: height + 1 }, (_, row) => flat.slice(row * (width + 1), (row + 1) * (width + 1)));
	}
	function puzzleSlantRuntimeState(value, row, column) {
		if (value === 0) return "unknown";
		if (value === 1) return "R";
		if (value === 2) return "L";
		fail("PS-PROGRESS-TOKEN", `puzzle-slant 运行状态${row === void 0 || column === void 0 ? "" : `（第 ${row + 1} 行第 ${column + 1} 列）`}为 ${JSON.stringify(value)}；只允许 0、1、2。`);
	}
	function puzzleSlantSerializedState(token, index) {
		if (token === "n") return "unknown";
		if (token === "b") return "R";
		if (token === "f") return "L";
		fail("PS-PROGRESS-TOKEN", `puzzle-slant 序列化进度${index === void 0 ? "" : `第 ${index + 1} 个字符`}“${token}”无效；只允许 n、b、f。`);
	}
	function puzzleSlantDomState(className, index) {
		const classes = new Set(className.split(/\s+/u).filter(Boolean));
		const matched = [];
		if (classes.has("cell-off")) matched.push("unknown");
		if (classes.has("cell-on")) matched.push("R");
		if (classes.has("cell-x")) matched.push("L");
		if (matched.length !== 1) {
			const location = index === void 0 ? "" : `第 ${index + 1} 个方格`;
			fail("PS-PROGRESS-TOKEN", matched.length === 0 ? `网页${location}没有 cell-off、cell-on 或 cell-x 状态，可能是网站结构已经变化。` : `网页${location}同时出现多个互相冲突的方格状态，已停止导出。`);
		}
		return matched[0];
	}
	function runtimeCells(source, width, height) {
		if (source.length !== height) fail("PS-PROGRESS-SHAPE", `运行状态有 ${source.length} 行，应为 ${height} 行。`);
		return source.map((row, r) => {
			if (row.length !== width) fail("PS-PROGRESS-SHAPE", `运行状态第 ${r + 1} 行有 ${row.length} 格，应为 ${width} 格。`);
			return row.map((value, c) => puzzleSlantRuntimeState(value, r, c));
		});
	}
	function serializedCells(source, width, height) {
		const expected = width * height;
		if (source.length !== expected) fail("PS-PROGRESS-SHAPE", `序列化进度有 ${source.length} 个字符，应为 ${expected} 个。`);
		const flat = Array.from(source, (token, index) => puzzleSlantSerializedState(token, index));
		return Array.from({ length: height }, (_, row) => flat.slice(row * width, (row + 1) * width));
	}
	function domCells(source, width, height) {
		const expected = width * height;
		if (source.length !== expected) fail("PS-PROGRESS-SHAPE", `网页中找到 ${source.length} 个方格，应为 ${expected} 个。`);
		const flat = source.map((className, index) => puzzleSlantDomState(className, index));
		return Array.from({ length: height }, (_, row) => flat.slice(row * width, (row + 1) * width));
	}
	function decodePuzzleSlantProgress(width, height, sources = {}) {
		checkedDimensions(width, height);
		const decoded = [];
		if (sources.runtimeCellStatus !== void 0) decoded.push({
			name: "网页运行状态",
			cells: runtimeCells(sources.runtimeCellStatus, width, height)
		});
		if (sources.serializedBoard !== void 0) decoded.push({
			name: "序列化进度",
			cells: serializedCells(sources.serializedBoard, width, height)
		});
		if (sources.domCellClassNames !== void 0) decoded.push({
			name: "网页方格样式",
			cells: domCells(sources.domCellClassNames, width, height)
		});
		if (decoded.length === 0) return Array.from({ length: height }, () => Array.from({ length: width }, () => "unknown"));
		const baseline = decoded[0];
		for (let sourceIndex = 1; sourceIndex < decoded.length; sourceIndex += 1) {
			const candidate = decoded[sourceIndex];
			for (let r = 0; r < height; r += 1) for (let c = 0; c < width; c += 1) {
				if (baseline.cells[r]?.[c] === candidate.cells[r]?.[c]) continue;
				fail("PS-PROGRESS-CONFLICT", `第 ${r + 1} 行第 ${c + 1} 列方格在${baseline.name}中为 ${baseline.cells[r]?.[c]}，在${candidate.name}中为 ${candidate.cells[r]?.[c]}；已停止导出。`);
			}
		}
		return baseline.cells;
	}
	function createPuzzleSlantReview(input) {
		const dimensions = input.width === void 0 && input.height === void 0 ? inferPuzzleSlantSquareSize(input.task) : input.width === void 0 || input.height === void 0 ? fail("PS-SIZE", "显式导入尺寸时必须同时提供宽和高。") : checkedDimensions(input.width, input.height);
		const clues = decodePuzzleSlantTask(input.task, dimensions.width, dimensions.height);
		const cells = decodePuzzleSlantProgress(dimensions.width, dimensions.height, input);
		const draft = {
			schemaVersion: 1,
			width: dimensions.width,
			height: dimensions.height,
			clues,
			cells,
			sourceText: ""
		};
		const sourceText = serializeReviewDocument(draft);
		return {
			...draft,
			sourceText
		};
	}
	//#endregion
	//#region src/extension/hint/current-hint.ts
	function objectValue$1(target, key) {
		return target !== null && typeof target === "object" ? Reflect.get(target, key) : void 0;
	}
	function decodePageBridgeCapture(value) {
		const task = objectValue$1(value, "task");
		const width = objectValue$1(value, "width");
		const height = objectValue$1(value, "height");
		const cellStatus = objectValue$1(value, "cellStatus");
		if (typeof task !== "string" || task.length === 0) throw new Error("页面桥返回的 task 无效。");
		if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error("页面桥返回的棋盘尺寸无效。");
		const checkedWidth = Number(width);
		const checkedHeight = Number(height);
		if (checkedWidth < 2 || checkedWidth > 50 || checkedHeight < 2 || checkedHeight > 50) throw new Error(`页面桥返回的尺寸 ${checkedWidth}×${checkedHeight} 超出 2..50。`);
		if (!Array.isArray(cellStatus) || cellStatus.length !== checkedHeight) throw new Error(`页面桥返回的运行状态应有 ${checkedHeight} 行。`);
		return {
			task,
			width: checkedWidth,
			height: checkedHeight,
			cellStatus: cellStatus.map((row, r) => {
				if (!Array.isArray(row) || row.length !== checkedWidth) throw new Error(`页面桥返回的运行状态第 ${r + 1} 行应有 ${checkedWidth} 格。`);
				return [...row];
			})
		};
	}
	function summarize(width, height, clues, cells) {
		return {
			width,
			height,
			clueCount: clues.flat().filter((clue) => clue !== null).length,
			fixedCount: cells.flat().filter((cell) => cell === "R" || cell === "L").length,
			totalCells: width * height
		};
	}
	/**
	* 正式灯泡扩展的纯分析入口。它只复用生产棋盘模型和人类逻辑调度器，
	* 不应用步骤，也不会调用穷举、唯一解或生成器。
	*/
	function analyzePuzzleSlantCurrentPosition(input) {
		try {
			assertPuzzleSlantHostname(input.hostname);
			const review = createPuzzleSlantReview({
				task: input.task,
				width: input.width,
				height: input.height,
				runtimeCellStatus: input.cellStatus,
				domCellClassNames: input.domCellClassNames
			});
			const summary = summarize(review.width, review.height, review.clues, review.cells);
			const base = {
				summary,
				sourceText: review.sourceText
			};
			const built = buildBoardFromReview(review);
			if (built.board === void 0) {
				const messages = built.issues.map((issue) => issue.messageZh);
				return {
					...base,
					kind: "contradiction",
					message: messages[0] ?? "当前局面存在矛盾，不能继续推理。",
					issues: built.issues
				};
			}
			const step = findNextHumanLogicStep(built.board);
			if (step !== null) {
				if (hasContradiction(step)) {
					const conclusion = step.conclusions.find((entry) => entry.kind === "report-contradiction");
					return {
						...base,
						kind: "contradiction",
						message: conclusion?.messageZh ?? step.explanation.rendered,
						issues: [],
						step
					};
				}
				return {
					...base,
					kind: "step",
					step,
					difficulty: difficultyForStep(step),
					board: built.board
				};
			}
			if (summary.fixedCount === summary.totalCells) return {
				...base,
				kind: "solved",
				message: "题目已完成：所有格子已确定，提示数满足且没有圈。"
			};
			return {
				...base,
				kind: "stalled",
				message: "当前规则库无法继续；灯泡不会使用猜测或穷举补出答案。"
			};
		} catch (error) {
			if (error instanceof PuzzleSlantImportError) return {
				kind: "invalid",
				message: error.message
			};
			throw error;
		}
	}
	//#endregion
	//#region src/extension/hint/highlight-layout.ts
	function cellKey(cell) {
		return `${cell.r},${cell.c}`;
	}
	function validCell$1(width, height, cell) {
		return cell.r >= 0 && cell.r < height && cell.c >= 0 && cell.c < width;
	}
	function uniqueCells(width, height, cells) {
		const unique = /* @__PURE__ */ new Map();
		for (const cell of cells) if (validCell$1(width, height, cell)) unique.set(cellKey(cell), cell);
		return unique;
	}
	function safeGap(length, preferred) {
		return Math.max(0, Math.min(preferred, length / 2 - .5));
	}
	/**
	* 生成相关格子并集的外轮廓。相邻相关格之间不会留下内部方框线；
	* 每条边会避开两端的网格顶点，给提示数字留出清楚的阅读空间。
	*/
	function buildRegionBoundaryLayout(width, height, rects, cells) {
		if (rects.length !== width * height) return [];
		const selected = uniqueCells(width, height, cells);
		const segments = [];
		for (const cell of selected.values()) {
			const rect = rects[cell.r * width + cell.c];
			if (rect === void 0 || rect.width <= 1 || rect.height <= 1) continue;
			const shortSide = Math.min(rect.width, rect.height);
			const offset = Math.min(5, Math.max(1.5, shortSide * .11));
			const horizontalGap = safeGap(rect.width, Math.min(11, Math.max(4, shortSide * .26)));
			const verticalGap = safeGap(rect.height, Math.min(11, Math.max(4, shortSide * .26)));
			const top = rect.top + offset;
			const bottom = rect.top + rect.height - offset;
			const left = rect.left + offset;
			const right = rect.left + rect.width - offset;
			if (!selected.has(`${cell.r - 1},${cell.c}`)) segments.push({
				from: {
					x: rect.left + horizontalGap,
					y: top
				},
				to: {
					x: rect.left + rect.width - horizontalGap,
					y: top
				}
			});
			if (!selected.has(`${cell.r + 1},${cell.c}`)) segments.push({
				from: {
					x: rect.left + horizontalGap,
					y: bottom
				},
				to: {
					x: rect.left + rect.width - horizontalGap,
					y: bottom
				}
			});
			if (!selected.has(`${cell.r},${cell.c - 1}`)) segments.push({
				from: {
					x: left,
					y: rect.top + verticalGap
				},
				to: {
					x: left,
					y: rect.top + rect.height - verticalGap
				}
			});
			if (!selected.has(`${cell.r},${cell.c + 1}`)) segments.push({
				from: {
					x: right,
					y: rect.top + verticalGap
				},
				to: {
					x: right,
					y: rect.top + rect.height - verticalGap
				}
			});
		}
		return segments;
	}
	/** 把实际、假设或结论斜线完整映射到两个顶点之间。 */
	function buildDiagonalEdgeLayout(width, height, rects, edges) {
		if (rects.length !== width * height) return [];
		const unique = /* @__PURE__ */ new Map();
		for (const edge of edges) {
			if (!validCell$1(width, height, edge.cell)) continue;
			unique.set(`${cellKey(edge.cell)}:${edge.orientation}:${edge.kind}`, edge);
		}
		return [...unique.values()].flatMap((edge) => {
			const rect = rects[edge.cell.r * width + edge.cell.c];
			if (rect === void 0 || rect.width <= 1 || rect.height <= 1) return [];
			const insetX = 0;
			const insetY = 0;
			return [{
				edge,
				from: edge.orientation === "R" ? {
					x: rect.left + insetX,
					y: rect.top + insetY
				} : {
					x: rect.left + rect.width - insetX,
					y: rect.top + insetY
				},
				to: edge.orientation === "R" ? {
					x: rect.left + rect.width - insetX,
					y: rect.top + rect.height - insetY
				} : {
					x: rect.left + insetX,
					y: rect.top + rect.height - insetY
				}
			}];
		});
	}
	/**
	* 把一条有序同向链画在方格中心：两个端点为空心圆，中间节点为实心点。
	* 输入必须是一条不重复、逐格正交相邻的简单路径；无效数据不会生成部分图形。
	*/
	function buildCellCenterChainLayout(width, height, rects, cells) {
		const empty = {
			segments: [],
			markers: []
		};
		if (rects.length !== width * height || cells.length < 2) return empty;
		const seen = /* @__PURE__ */ new Set();
		const points = [];
		for (let index = 0; index < cells.length; index += 1) {
			const cell = cells[index];
			if (cell === void 0 || !validCell$1(width, height, cell) || seen.has(cellKey(cell))) return empty;
			if (index > 0) {
				const previous = cells[index - 1];
				if (previous === void 0 || Math.abs(cell.r - previous.r) + Math.abs(cell.c - previous.c) !== 1) return empty;
			}
			const rect = rects[cell.r * width + cell.c];
			if (rect === void 0 || rect.width <= 1 || rect.height <= 1) return empty;
			seen.add(cellKey(cell));
			points.push({
				x: rect.left + rect.width / 2,
				y: rect.top + rect.height / 2
			});
		}
		return {
			segments: points.slice(1).map((point, index) => ({
				from: points[index] ?? point,
				to: point
			})),
			markers: cells.map((cell, index) => ({
				cell,
				point: points[index] ?? {
					x: 0,
					y: 0
				},
				kind: index === 0 || index === cells.length - 1 ? "endpoint" : "intermediate"
			}))
		};
	}
	function viewportPointForVertex(width, height, rects, vertex) {
		if (rects.length !== width * height || vertex.r < 0 || vertex.r > height || vertex.c < 0 || vertex.c > width) return null;
		const anchorR = Math.min(vertex.r, height - 1);
		const anchorC = Math.min(vertex.c, width - 1);
		const anchor = rects[anchorR * width + anchorC];
		if (anchor === void 0) return null;
		return {
			x: vertex.c === anchorC ? anchor.left : anchor.left + anchor.width,
			y: vertex.r === anchorR ? anchor.top : anchor.top + anchor.height
		};
	}
	function buildVertexHighlightLayout(width, height, rects, vertices) {
		const unique = /* @__PURE__ */ new Map();
		for (const vertex of vertices) unique.set(`${vertex.r},${vertex.c}`, vertex);
		return [...unique.values()].flatMap((vertex) => {
			const point = viewportPointForVertex(width, height, rects, vertex);
			return point === null ? [] : [{
				vertex,
				point
			}];
		});
	}
	/** 路径提示箭头避开两端顶点；单向箭头指向假出口，双向箭头表示两端不能互接。 */
	function buildVertexArrowLayout(width, height, rects, arrows) {
		const unique = /* @__PURE__ */ new Map();
		for (const arrow of arrows) unique.set(`${arrow.from.r},${arrow.from.c}->${arrow.to.r},${arrow.to.c}:${arrow.kind}`, arrow);
		return [...unique.values()].flatMap((arrow) => {
			const rawFrom = viewportPointForVertex(width, height, rects, arrow.from);
			const rawTo = viewportPointForVertex(width, height, rects, arrow.to);
			if (rawFrom === null || rawTo === null) return [];
			const dx = rawTo.x - rawFrom.x;
			const dy = rawTo.y - rawFrom.y;
			const length = Math.hypot(dx, dy);
			if (length <= 1) return [];
			const startInset = Math.min(16, length * .24);
			const endInset = Math.min(18, length * .3);
			const ux = dx / length;
			const uy = dy / length;
			return [{
				arrow,
				from: {
					x: rawFrom.x + ux * startInset,
					y: rawFrom.y + uy * startInset
				},
				to: {
					x: rawTo.x - ux * endInset,
					y: rawTo.y - uy * endInset
				}
			}];
		});
	}
	function viewportBounds(rects) {
		if (rects.length === 0) return null;
		let left = Number.POSITIVE_INFINITY;
		let top = Number.POSITIVE_INFINITY;
		let right = Number.NEGATIVE_INFINITY;
		let bottom = Number.NEGATIVE_INFINITY;
		for (const rect of rects) {
			if (rect.width <= 0 || rect.height <= 0) continue;
			left = Math.min(left, rect.left);
			top = Math.min(top, rect.top);
			right = Math.max(right, rect.left + rect.width);
			bottom = Math.max(bottom, rect.top + rect.height);
		}
		return Number.isFinite(left) ? {
			left,
			top,
			right,
			bottom
		} : null;
	}
	function needsViewportFocus(bounds, viewportWidth, viewportHeight, margin) {
		const safeMargin = Math.max(0, Math.min(margin, viewportWidth / 3, viewportHeight / 3));
		return bounds.left < safeMargin || bounds.top < safeMargin || bounds.right > viewportWidth - safeMargin || bounds.bottom > viewportHeight - safeMargin;
	}
	//#endregion
	//#region src/extension/hint/zoom-metrics.ts
	var MIN_BROWSER_ZOOM = .25;
	var MAX_BROWSER_ZOOM = 5;
	function normalizeBrowserZoom(value) {
		return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.min(MAX_BROWSER_ZOOM, Math.max(MIN_BROWSER_ZOOM, value)) : 1;
	}
	/**
	* 浏览器页面缩放会同时缩小扩展的 CSS 像素。这里把希望保持不变的屏幕尺寸
	* 换算为当前页面中应使用的 CSS 像素；不改变棋盘坐标本身。
	*/
	function hintVisualMetrics(value) {
		const zoomFactor = normalizeBrowserZoom(value);
		const cssPixels = (screenPixels) => screenPixels / zoomFactor;
		return {
			zoomFactor,
			lampSize: cssPixels(56),
			lampOffset: cssPixels(22),
			lampBorder: cssPixels(2),
			lampFont: cssPixels(28),
			badgeSize: cssPixels(22),
			badgeNegativeOffset: cssPixels(-5),
			badgeBorder: cssPixels(2),
			badgeFont: cssPixels(15),
			hoverShift: cssPixels(-1),
			lampShadowY: cssPixels(6),
			lampShadowBlur: cssPixels(22),
			badgeShadowY: cssPixels(2),
			badgeShadowBlur: cssPixels(7),
			focusRing: cssPixels(5),
			focusShadowY: cssPixels(7),
			focusShadowBlur: cssPixels(24),
			resultRing: cssPixels(7),
			resultShadowY: cssPixels(8),
			resultShadowBlur: cssPixels(28),
			statusRing: cssPixels(6),
			boundaryStroke: cssPixels(4),
			pathStroke: cssPixels(2.5),
			arrowStroke: cssPixels(3),
			resultStroke: cssPixels(3),
			haloStroke: cssPixels(1),
			negativeHaloStroke: cssPixels(-1),
			sourceHalo: cssPixels(2),
			sourceOuterHalo: cssPixels(3),
			arrowHead: cssPixels(9),
			focusMargin: cssPixels(72)
		};
	}
	//#endregion
	//#region src/extension/hint/content.ts
	var HINT_CHANNEL = "slant-hint-extension-v1";
	var ZOOM_CHANNEL = "slant-hint-extension-zoom-v1";
	var HINT_HOST_ID = "slant-hint-extension";
	function objectValue(target, key) {
		return target !== null && typeof target === "object" ? Reflect.get(target, key) : void 0;
	}
	function requestId() {
		return typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `hint-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}
	function requestCapture() {
		const id = requestId();
		return new Promise((resolve, reject) => {
			const timeout = globalThis.setTimeout(() => {
				globalThis.removeEventListener("message", receive);
				reject(/* @__PURE__ */ new Error("页面读取桥没有响应；请刷新题目页面后重试。"));
			}, 2500);
			function receive(event) {
				if (event.source !== window || objectValue(event.data, "channel") !== HINT_CHANNEL || objectValue(event.data, "type") !== "capture-response" || objectValue(event.data, "requestId") !== id) return;
				globalThis.clearTimeout(timeout);
				globalThis.removeEventListener("message", receive);
				if (objectValue(event.data, "ok") !== true) {
					reject(new Error(String(objectValue(event.data, "error") ?? "页面读取失败。")));
					return;
				}
				try {
					resolve(decodePageBridgeCapture(objectValue(event.data, "value")));
				} catch (error) {
					reject(error);
				}
			}
			globalThis.addEventListener("message", receive);
			globalThis.postMessage({
				channel: HINT_CHANNEL,
				type: "capture-request",
				requestId: id
			}, "*");
		});
	}
	function cellElements() {
		return [...document.querySelectorAll("#game .cell")];
	}
	function stateToken(element) {
		const classes = new Set(element.className.split(/\s+/u).filter(Boolean));
		if (classes.has("cell-off")) return "?";
		if (classes.has("cell-on")) return "R";
		if (classes.has("cell-x")) return "L";
		return "!";
	}
	function currentDomSignature() {
		const elements = cellElements();
		return `${elements.length}:${elements.map(stateToken).join("")}`;
	}
	function requestBrowserZoom() {
		const runtime = objectValue(objectValue(globalThis, "chrome"), "runtime");
		const sendMessage = objectValue(runtime, "sendMessage");
		if (typeof sendMessage !== "function") return Promise.resolve(1);
		return new Promise((resolve) => {
			let settled = false;
			const finish = (value) => {
				if (settled) return;
				settled = true;
				resolve(normalizeBrowserZoom(value));
			};
			const timeout = globalThis.setTimeout(() => finish(1), 800);
			try {
				Reflect.apply(sendMessage, runtime, [{
					channel: ZOOM_CHANNEL,
					type: "get-zoom"
				}, (response) => {
					globalThis.clearTimeout(timeout);
					objectValue(runtime, "lastError");
					finish(objectValue(response, "zoomFactor"));
				}]);
			} catch {
				globalThis.clearTimeout(timeout);
				finish(1);
			}
		});
	}
	function resultingOrientation(conclusion) {
		if (conclusion.kind === "report-contradiction") return null;
		if (conclusion.kind === "assign-orientation") return conclusion.orientation;
		return conclusion.orientation === "R" ? "L" : "R";
	}
	function asCell(value) {
		const r = objectValue(value, "r");
		const c = objectValue(value, "c");
		return Number.isInteger(r) && Number.isInteger(c) ? {
			r: Number(r),
			c: Number(c)
		} : null;
	}
	function asVertex(value) {
		return asCell(value);
	}
	function asInteger(value) {
		return Number.isInteger(value) ? Number(value) : null;
	}
	function asOrientation(value) {
		return value === "R" || value === "L" ? value : null;
	}
	function premiseEdges(value) {
		if (!Array.isArray(value)) return [];
		return value.flatMap((entry) => {
			const cell = asCell(objectValue(entry, "cell"));
			const orientation = asOrientation(objectValue(entry, "orientation") ?? objectValue(entry, "connectOrientation"));
			return cell === null || orientation === null ? [] : [{
				cell,
				orientation,
				kind: "candidate"
			}];
		});
	}
	function highlightedCells(step, roles) {
		return step.highlight.flatMap((item) => roles.has(item.role) ? [...item.cells ?? []] : []);
	}
	function cellsAroundHighlightedVertices(active, roles) {
		const cells = /* @__PURE__ */ new Map();
		const vertices = active.step.highlight.flatMap((item) => roles.has(item.role) ? [...item.vertices ?? []] : []);
		for (const vertex of vertices) for (const r of [vertex.r - 1, vertex.r]) for (const c of [vertex.c - 1, vertex.c]) {
			if (r < 0 || r >= active.summary.height || c < 0 || c >= active.summary.width) continue;
			cells.set(`${r},${c}`, {
				r,
				c
			});
		}
		return [...cells.values()];
	}
	function fixedEdges(active, cells) {
		return cells.flatMap((cell) => {
			const domain = active.board.cellDomains[cell.r]?.[cell.c];
			const orientation = domain === void 0 ? null : fixedOrientation(domain);
			return orientation === null ? [] : [{
				cell,
				orientation,
				kind: "fixed"
			}];
		});
	}
	function validCell(width, height, cell) {
		return cell.r >= 0 && cell.r < height && cell.c >= 0 && cell.c < width;
	}
	function vertexAnchorCell(width, height, vertex) {
		if (vertex.r < 0 || vertex.r > height || vertex.c < 0 || vertex.c > width) return null;
		return {
			r: Math.min(vertex.r, height - 1),
			c: Math.min(vertex.c, width - 1)
		};
	}
	function geometryCells(active, observation, includeResults) {
		const cells = /* @__PURE__ */ new Map();
		const add = (cell) => {
			if (cell !== null && validCell(active.summary.width, active.summary.height, cell)) cells.set(`${cell.r},${cell.c}`, cell);
		};
		for (const cell of observation.regionCells) add(cell);
		for (const edge of observation.edges) add(edge.cell);
		for (const cell of observation.sameDirectionChainCells) add(cell);
		for (const vertex of observation.sourceVertices) add(vertexAnchorCell(active.summary.width, active.summary.height, vertex));
		for (const arrow of observation.falseExitArrows) {
			add(vertexAnchorCell(active.summary.width, active.summary.height, arrow.from));
			add(vertexAnchorCell(active.summary.width, active.summary.height, arrow.to));
		}
		if (includeResults) {
			for (const conclusion of active.step.conclusions) if (conclusion.kind !== "report-contradiction") add(conclusion.cell);
		}
		return [...cells.values()];
	}
	var EMPTY_OBSERVATION_EXTRAS = {
		sourceVertices: [],
		falseExitArrows: [],
		sameDirectionChainCells: []
	};
	function chainCells(value) {
		const cells = objectValue(value, "cells");
		if (!Array.isArray(cells)) return [];
		return cells.flatMap((entry) => {
			const cell = asCell(entry);
			return cell === null ? [] : [cell];
		});
	}
	/** 只取直接产生本步结论的根链；不展开 sourceChain 或整个同向分量。 */
	function primarySameDirectionChainCells(step) {
		const direct = chainCells(step.premises.sameDirectionChain);
		if (direct.length >= 2) return direct;
		const chains = step.premises.sameDirectionChains;
		return Array.isArray(chains) ? chainCells(chains[0]) : [];
	}
	function premiseVertices(value) {
		if (!Array.isArray(value)) return [];
		return value.flatMap((entry) => {
			const vertex = asVertex(entry);
			return vertex === null ? [] : [vertex];
		});
	}
	function isolatedTerminalVertices(value) {
		if (!Array.isArray(value)) return [];
		return value.flatMap((fact) => objectValue(fact, "isolatedInternalOne") === true ? premiseVertices(objectValue(fact, "vertices")) : []);
	}
	function connectionArrows(value, kind, sourceComponentId) {
		if (!Array.isArray(value)) return [];
		return value.flatMap((entry) => {
			const from = asVertex(objectValue(entry, "from"));
			const to = asVertex(objectValue(entry, "to"));
			if (from === null || to === null) return [];
			if (sourceComponentId === void 0) return [{
				from,
				to,
				kind
			}];
			const fromComponent = asInteger(objectValue(entry, "fromComponent"));
			const toComponent = asInteger(objectValue(entry, "toComponent"));
			if (fromComponent === sourceComponentId) return [{
				from,
				to,
				kind
			}];
			if (toComponent === sourceComponentId) return [{
				from: to,
				to: from,
				kind
			}];
			return [];
		});
	}
	function blueFixedEdges(active, roles) {
		return fixedEdges(active, highlightedCells(active.step, roles)).map((edge) => ({
			...edge,
			kind: "source"
		}));
	}
	function observationGeometry(active) {
		const step = active.step;
		const ruleId = step.rule.id;
		if (ruleId.startsWith("SL-CYC-")) {
			const edges = fixedEdges(active, highlightedCells(step, /* @__PURE__ */ new Set(["cycle-path"])));
			if (ruleId === "SL-CYC-202") edges.push(...premiseEdges(step.premises.dangerousGroup ?? step.premises.dangerousPair));
			const clueRegion = ruleId === "SL-CYC-202" ? cellsAroundHighlightedVertices(active, /* @__PURE__ */ new Set(["clue", "premise-chain"])) : [];
			return edges.length === 0 && clueRegion.length === 0 ? {
				regionCells: step.involved.cells,
				edges,
				...EMPTY_OBSERVATION_EXTRAS
			} : {
				regionCells: clueRegion,
				edges,
				...EMPTY_OBSERVATION_EXTRAS
			};
		}
		if (ruleId === "SL-PTH-301" || ruleId === "SL-PTH-304") {
			const edges = blueFixedEdges(active, /* @__PURE__ */ new Set(["component"]));
			const componentId = asInteger(step.premises.componentId);
			const rejected = ruleId === "SL-PTH-301" ? step.premises.crossEdges : step.premises.rejectedFirstEdges;
			return {
				regionCells: [],
				edges,
				sourceVertices: edges.length === 0 ? premiseVertices(step.premises.componentVertices) : [],
				falseExitArrows: componentId === null ? [] : connectionArrows(rejected, "single", componentId),
				sameDirectionChainCells: []
			};
		}
		if (ruleId === "SL-PTH-303") return {
			regionCells: [],
			edges: blueFixedEdges(active, /* @__PURE__ */ new Set(["terminal-component"])),
			sourceVertices: isolatedTerminalVertices(step.premises.terminalFacts),
			falseExitArrows: connectionArrows(step.premises.rejectedConnections, "double"),
			sameDirectionChainCells: []
		};
		if (ruleId === "SL-WDG-405") return {
			regionCells: [],
			edges: [],
			sourceVertices: [],
			falseExitArrows: [],
			sameDirectionChainCells: primarySameDirectionChainCells(step)
		};
		return {
			regionCells: step.involved.cells,
			edges: [],
			...EMPTY_OBSERVATION_EXTRAS
		};
	}
	function mountHintLamp() {
		if (document.getElementById(HINT_HOST_ID) !== null) return;
		const host = document.createElement("div");
		host.id = HINT_HOST_ID;
		host.dataset.status = "ready";
		host.dataset.hintStage = "idle";
		const shadow = host.attachShadow({ mode: "open" });
		shadow.innerHTML = `
    <style>
      :host{--hint-color:#00a66a;--lamp-size:56px;--lamp-offset:22px;--lamp-border:2px;--lamp-font:28px;--badge-size:22px;--badge-negative-offset:-5px;--badge-border:2px;--badge-font:15px;--hover-shift:-1px;--lamp-shadow-y:6px;--lamp-shadow-blur:22px;--badge-shadow-y:2px;--badge-shadow-blur:7px;--focus-ring:5px;--focus-shadow-y:7px;--focus-shadow-blur:24px;--result-ring:7px;--result-shadow-y:8px;--result-shadow-blur:28px;--status-ring:6px;--stroke-boundary:4px;--stroke-path:2.5px;--stroke-arrow:3px;--stroke-result:3px;--stroke-halo:1px;--negative-stroke-halo:-1px;--source-halo:2px;--source-outer-halo:3px;--arrow-head:9px;position:fixed;right:var(--lamp-offset);bottom:var(--lamp-offset);z-index:2147483647;font:14px/1.5 system-ui,"Microsoft YaHei",sans-serif;color:#17212b}
      :host([data-difficulty="intro"]){--hint-color:#00a66a}:host([data-difficulty="basic"]){--hint-color:#008a58}:host([data-difficulty="advanced"]){--hint-color:#d39a00}:host([data-difficulty="path"]){--hint-color:#b96800}:host([data-difficulty="same-direction"]){--hint-color:#d9342b}
      *{box-sizing:border-box}.wrap{position:relative}
      .lamp{position:relative;z-index:3;width:var(--lamp-size);height:var(--lamp-size);padding:0;border:var(--lamp-border) solid #14786e;border-radius:50%;background:#fff7c7;color:#725500;font-size:var(--lamp-font);cursor:pointer;box-shadow:0 var(--lamp-shadow-y) var(--lamp-shadow-blur) #0003;transition:background .16s,box-shadow .16s,filter .16s,transform .16s}
      .lamp::after{position:absolute;right:var(--badge-negative-offset);bottom:var(--badge-negative-offset);display:grid;place-items:center;width:var(--badge-size);height:var(--badge-size);border:var(--badge-border) solid #fff;border-radius:50%;color:#fff;font:800 var(--badge-font)/1 system-ui,sans-serif;opacity:0;content:"";box-shadow:0 var(--badge-shadow-y) var(--badge-shadow-blur) #0003}
      .lamp:hover{transform:translateY(var(--hover-shift))}.lamp:disabled{cursor:wait;opacity:.78;animation:pulse .8s ease-in-out infinite alternate}
      :host([data-hint-stage="focus"]) .lamp{background:#ffe77a;filter:saturate(1.28);box-shadow:0 0 0 var(--focus-ring) #ffe77a66,0 var(--focus-shadow-y) var(--focus-shadow-blur) #b88a2759}
      :host([data-hint-stage="result"]) .lamp{background:#ffc928;filter:saturate(1.5);box-shadow:0 0 0 var(--result-ring) #ffd23577,0 var(--result-shadow-y) var(--result-shadow-blur) #b8782766}
      :host([data-status="solved"]) .lamp{border-color:#22845c;background:#dcf5e6;box-shadow:0 0 0 var(--status-ring) #75cc9b52,0 var(--lamp-shadow-y) var(--lamp-shadow-blur) #0002}:host([data-status="solved"]) .lamp::after{background:#23875e;content:"✓";opacity:1}
      :host([data-status="stalled"]) .lamp{border-color:#858d8b;background:#ecefed;filter:grayscale(.7)}:host([data-status="stalled"]) .lamp::after{background:#7d8583;content:"…";opacity:1}
      :host([data-status="contradiction"]) .lamp{border-color:#ba3d38;background:#ffe0dd;box-shadow:0 0 0 var(--status-ring) #d9575050,0 var(--lamp-shadow-y) var(--lamp-shadow-blur) #0002}:host([data-status="contradiction"]) .lamp::after{background:#c3443e;content:"!";opacity:1}
      :host([data-status="error"]) .lamp{border-color:#c06a32;background:#ffe8d3}:host([data-status="error"]) .lamp::after{background:#c36a31;content:"×";opacity:1}
      @keyframes pulse{from{filter:brightness(1)}to{filter:brightness(1.18)}}
      @keyframes locate-pulse{0%,100%{filter:brightness(1);opacity:1}45%{filter:brightness(1.28) saturate(1.35);opacity:.72}}
      .highlight-layer{position:fixed;inset:0;z-index:1;overflow:visible;pointer-events:none}.highlight-layer.is-locating>*{animation:locate-pulse .42s ease-in-out 2}.region-boundary,.path-line,.candidate-line,.source-path-line,.false-exit-arrow,.same-direction-chain-line,.result-line{position:absolute;pointer-events:none;transform-origin:0 50%}.region-boundary{height:var(--stroke-boundary);border-radius:999px;background:var(--hint-color);box-shadow:0 0 0 var(--stroke-halo) #ffffffe6}.path-line{height:var(--stroke-path);background:var(--hint-color);box-shadow:0 0 0 var(--stroke-halo) #ffffffe6}.candidate-line{height:0;border-top:var(--stroke-path) dashed var(--hint-color);filter:drop-shadow(0 0 var(--stroke-halo) #fff)}.source-path-line{height:var(--stroke-path);background:#006fc9;box-shadow:0 0 0 var(--stroke-halo) #fffffff0}.source-vertex{position:absolute;border:var(--stroke-path) solid #006fc9;border-radius:50%;background:transparent;box-shadow:0 0 0 var(--source-halo) #006fc933,0 0 0 var(--source-outer-halo) #fff;transform:translate(-50%,-50%);pointer-events:none}.false-exit-arrow{height:var(--stroke-arrow);background:#d52f2f;box-shadow:0 0 0 var(--stroke-halo) #fffffff0}.same-direction-chain-line{height:var(--stroke-path);border-radius:999px;background:#d9342b;box-shadow:0 0 0 var(--stroke-halo) #fffffff0}.same-direction-chain-marker{position:absolute;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}.same-direction-chain-marker.is-endpoint{border:var(--stroke-path) solid #d9342b;background:#fff;box-shadow:0 0 0 var(--stroke-halo) #fffffff0}.same-direction-chain-marker.is-intermediate{border:var(--stroke-halo) solid #fff;background:#d9342b;box-shadow:0 0 0 var(--stroke-halo) #ffffffa6}.false-exit-arrow::after,.false-exit-arrow.is-double::before{position:absolute;top:50%;width:var(--arrow-head);height:var(--arrow-head);content:"";pointer-events:none}.false-exit-arrow::after{right:var(--negative-stroke-halo);border-top:var(--stroke-arrow) solid #d52f2f;border-right:var(--stroke-arrow) solid #d52f2f;transform:translateY(-50%) rotate(45deg)}.false-exit-arrow.is-double::before{left:var(--negative-stroke-halo);border-bottom:var(--stroke-arrow) solid #d52f2f;border-left:var(--stroke-arrow) solid #d52f2f;transform:translateY(-50%) rotate(45deg)}.result-line{height:var(--stroke-result);background:#00895f;box-shadow:0 0 0 var(--stroke-halo) #fffffff0}
      .status-live{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    </style>
    <div class="highlight-layer" aria-hidden="true"></div>
    <div class="wrap">
      <button class="lamp" type="button" aria-label="运行 Slant 灯泡提示" title="运行 Slant 灯泡提示">💡</button>
      <span class="status-live" aria-live="polite"></span>
    </div>`;
		function requiredElement(selector) {
			const element = shadow.querySelector(selector);
			if (element === null) throw new Error(`灯泡提示组件缺少 ${selector}。`);
			return element;
		}
		const lamp = requiredElement(".lamp");
		const statusLive = requiredElement(".status-live");
		const highlightLayer = requiredElement(".highlight-layer");
		let active = null;
		let stage = "idle";
		let capturedSignature = "";
		let renderFrame = 0;
		let geometryFrame = 0;
		let geometryTrackingUntil = 0;
		let lastGeometrySignature = "";
		let attentionTimer = 0;
		let boardElements = [];
		let visualMetrics = hintVisualMetrics(1);
		function setLengthVariable(name, value) {
			host.style.setProperty(name, `${value}px`);
		}
		function applyBrowserZoom(value) {
			const next = hintVisualMetrics(value);
			if (next.zoomFactor === visualMetrics.zoomFactor) return;
			visualMetrics = next;
			setLengthVariable("--lamp-size", next.lampSize);
			setLengthVariable("--lamp-offset", next.lampOffset);
			setLengthVariable("--lamp-border", next.lampBorder);
			setLengthVariable("--lamp-font", next.lampFont);
			setLengthVariable("--badge-size", next.badgeSize);
			setLengthVariable("--badge-negative-offset", next.badgeNegativeOffset);
			setLengthVariable("--badge-border", next.badgeBorder);
			setLengthVariable("--badge-font", next.badgeFont);
			setLengthVariable("--hover-shift", next.hoverShift);
			setLengthVariable("--lamp-shadow-y", next.lampShadowY);
			setLengthVariable("--lamp-shadow-blur", next.lampShadowBlur);
			setLengthVariable("--badge-shadow-y", next.badgeShadowY);
			setLengthVariable("--badge-shadow-blur", next.badgeShadowBlur);
			setLengthVariable("--focus-ring", next.focusRing);
			setLengthVariable("--focus-shadow-y", next.focusShadowY);
			setLengthVariable("--focus-shadow-blur", next.focusShadowBlur);
			setLengthVariable("--result-ring", next.resultRing);
			setLengthVariable("--result-shadow-y", next.resultShadowY);
			setLengthVariable("--result-shadow-blur", next.resultShadowBlur);
			setLengthVariable("--status-ring", next.statusRing);
			setLengthVariable("--stroke-boundary", next.boundaryStroke);
			setLengthVariable("--stroke-path", next.pathStroke);
			setLengthVariable("--stroke-arrow", next.arrowStroke);
			setLengthVariable("--stroke-result", next.resultStroke);
			setLengthVariable("--stroke-halo", next.haloStroke);
			setLengthVariable("--negative-stroke-halo", next.negativeHaloStroke);
			setLengthVariable("--source-halo", next.sourceHalo);
			setLengthVariable("--source-outer-halo", next.sourceOuterHalo);
			setLengthVariable("--arrow-head", next.arrowHead);
			scheduleHighlightRender();
			startGeometryTracking(500);
		}
		function clearHighlights() {
			highlightLayer.replaceChildren();
		}
		function cancelLocatorPulse() {
			globalThis.clearTimeout(attentionTimer);
			attentionTimer = 0;
			highlightLayer.classList.remove("is-locating");
		}
		function resetHint() {
			active = null;
			stage = "idle";
			capturedSignature = "";
			host.dataset.status = "ready";
			host.dataset.hintStage = "idle";
			delete host.dataset.difficulty;
			lamp.ariaLabel = "运行 Slant 灯泡提示";
			lamp.title = "运行 Slant 灯泡提示";
			statusLive.textContent = "";
			boardElements = [];
			lastGeometrySignature = "";
			cancelLocatorPulse();
			clearHighlights();
		}
		function currentBoardElements() {
			if (boardElements.length > 0 && boardElements.every((element) => element.isConnected)) return boardElements;
			boardElements = cellElements();
			return boardElements;
		}
		function rectsForBoard(width, height, cells) {
			const elements = currentBoardElements();
			if (elements.length !== width * height) return null;
			const rects = new Array(elements.length);
			for (const cell of cells) {
				const element = elements[cell.r * width + cell.c];
				if (element === void 0) continue;
				const rect = element.getBoundingClientRect();
				rects[cell.r * width + cell.c] = {
					left: rect.left,
					top: rect.top,
					width: rect.width,
					height: rect.height
				};
			}
			return rects;
		}
		function appendSegment(segment, className) {
			const dx = segment.to.x - segment.from.x;
			const dy = segment.to.y - segment.from.y;
			const line = document.createElement("span");
			line.className = className;
			Object.assign(line.style, {
				left: `${segment.from.x}px`,
				top: `${segment.from.y}px`,
				width: `${Math.hypot(dx, dy)}px`,
				transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`
			});
			highlightLayer.append(line);
			return line;
		}
		function appendSourceVertex(point, size) {
			const marker = document.createElement("span");
			marker.className = "source-vertex";
			Object.assign(marker.style, {
				left: `${point.x}px`,
				top: `${point.y}px`,
				width: `${size}px`,
				height: `${size}px`
			});
			highlightLayer.append(marker);
		}
		function appendSameDirectionMarker(marker, size) {
			const element = document.createElement("span");
			element.className = `same-direction-chain-marker is-${marker.kind}`;
			Object.assign(element.style, {
				left: `${marker.point.x}px`,
				top: `${marker.point.y}px`,
				width: `${size}px`,
				height: `${size}px`
			});
			highlightLayer.append(element);
		}
		function renderHighlights() {
			clearHighlights();
			if (active === null || stage === "idle") return;
			const observation = observationGeometry(active);
			const cells = geometryCells(active, observation, stage === "result");
			const rects = rectsForBoard(active.summary.width, active.summary.height, cells);
			if (rects === null) return;
			const sampleRect = rects.find((rect) => rect !== void 0);
			if (sampleRect === void 0) return;
			const boundaries = buildRegionBoundaryLayout(active.summary.width, active.summary.height, rects, observation.regionCells);
			for (const segment of boundaries) appendSegment(segment, "region-boundary");
			const pathSegments = buildDiagonalEdgeLayout(active.summary.width, active.summary.height, rects, observation.edges);
			for (const segment of pathSegments) appendSegment(segment, segment.edge.kind === "candidate" ? "candidate-line" : segment.edge.kind === "source" ? "source-path-line" : "path-line");
			const markerSize = Math.max(16 / visualMetrics.zoomFactor, Math.min(34 / visualMetrics.zoomFactor, Math.min(sampleRect.width, sampleRect.height) * .72));
			for (const marker of buildVertexHighlightLayout(active.summary.width, active.summary.height, rects, observation.sourceVertices)) appendSourceVertex(marker.point, markerSize);
			for (const segment of buildVertexArrowLayout(active.summary.width, active.summary.height, rects, observation.falseExitArrows)) appendSegment(segment, segment.arrow.kind === "double" ? "false-exit-arrow is-double" : "false-exit-arrow");
			const sameDirectionChain = buildCellCenterChainLayout(active.summary.width, active.summary.height, rects, observation.sameDirectionChainCells);
			for (const segment of sameDirectionChain.segments) appendSegment(segment, "same-direction-chain-line");
			if (stage === "result") {
				const resultEdges = [];
				for (const conclusion of active.step.conclusions) {
					if (conclusion.kind === "report-contradiction") continue;
					const orientation = resultingOrientation(conclusion);
					if (orientation !== null) resultEdges.push({
						cell: conclusion.cell,
						orientation,
						kind: "result"
					});
				}
				for (const segment of buildDiagonalEdgeLayout(active.summary.width, active.summary.height, rects, resultEdges)) appendSegment(segment, "result-line");
			}
			const shortSide = Math.min(sampleRect.width, sampleRect.height);
			for (const marker of sameDirectionChain.markers) appendSameDirectionMarker(marker, marker.kind === "endpoint" ? Math.max(7 / visualMetrics.zoomFactor, Math.min(12 / visualMetrics.zoomFactor, shortSide * .24)) : Math.max(4 / visualMetrics.zoomFactor, Math.min(7 / visualMetrics.zoomFactor, shortSide * .13)));
			lastGeometrySignature = geometrySignature();
		}
		function geometrySignature() {
			if (active === null || stage === "idle") return "";
			const current = active;
			const cells = geometryCells(current, observationGeometry(current), stage === "result");
			const elements = currentBoardElements();
			if (elements.length !== current.summary.width * current.summary.height) return "missing";
			const values = [];
			for (const cell of cells) {
				const element = elements[cell.r * current.summary.width + cell.c];
				if (element === void 0) {
					values.push("missing");
					continue;
				}
				const rect = element.getBoundingClientRect();
				values.push(...[
					rect.left,
					rect.top,
					rect.width,
					rect.height
				].map((part) => Math.round(part * 10) / 10));
			}
			return `${visualMetrics.zoomFactor}:${globalThis.innerWidth}:${globalThis.innerHeight}:${values.join(",")}`;
		}
		function trackGeometry(timestamp) {
			geometryFrame = 0;
			if (active === null || stage === "idle") return;
			const signature = geometrySignature();
			if (signature !== lastGeometrySignature) {
				lastGeometrySignature = signature;
				renderHighlights();
			}
			if (timestamp < geometryTrackingUntil) geometryFrame = globalThis.requestAnimationFrame(trackGeometry);
		}
		function startGeometryTracking(duration = 700) {
			if (active === null || stage === "idle") return;
			geometryTrackingUntil = Math.max(geometryTrackingUntil, performance.now() + duration);
			if (geometryFrame === 0) geometryFrame = globalThis.requestAnimationFrame(trackGeometry);
		}
		function triggerLocatorPulse(delay = 0) {
			window.clearTimeout(attentionTimer);
			attentionTimer = window.setTimeout(() => {
				highlightLayer.classList.remove("is-locating");
				highlightLayer.offsetWidth;
				highlightLayer.classList.add("is-locating");
				attentionTimer = window.setTimeout(() => {
					highlightLayer.classList.remove("is-locating");
					attentionTimer = 0;
				}, 920);
			}, delay);
		}
		function locateActiveHint() {
			if (active === null || stage === "idle") return;
			const observation = observationGeometry(active);
			const cells = geometryCells(active, observation, stage === "result");
			const elements = currentBoardElements();
			const targets = cells.flatMap((cell) => {
				const element = elements[cell.r * active.summary.width + cell.c];
				return element === void 0 ? [] : [{
					element,
					rect: element.getBoundingClientRect()
				}];
			});
			const bounds = viewportBounds(targets.map(({ rect }) => ({
				left: rect.left,
				top: rect.top,
				width: rect.width,
				height: rect.height
			})));
			const viewport = globalThis.visualViewport;
			const viewportWidth = viewport?.width ?? globalThis.innerWidth;
			const viewportHeight = viewport?.height ?? globalThis.innerHeight;
			if (bounds === null || !needsViewportFocus(bounds, viewportWidth, viewportHeight, visualMetrics.focusMargin)) {
				triggerLocatorPulse();
				return;
			}
			const centerX = (bounds.left + bounds.right) / 2;
			const centerY = (bounds.top + bounds.bottom) / 2;
			const anchor = targets.reduce((best, target) => {
				const targetX = target.rect.left + target.rect.width / 2;
				const targetY = target.rect.top + target.rect.height / 2;
				const distance = Math.hypot(targetX - centerX, targetY - centerY);
				if (best === null) return target;
				const bestX = best.rect.left + best.rect.width / 2;
				const bestY = best.rect.top + best.rect.height / 2;
				return distance < Math.hypot(bestX - centerX, bestY - centerY) ? target : best;
			}, null);
			if (anchor === null) return;
			try {
				anchor.element.scrollIntoView({
					behavior: "smooth",
					block: "center",
					inline: "center"
				});
			} catch {
				anchor.element.scrollIntoView();
			}
			startGeometryTracking(1200);
			triggerLocatorPulse(420);
		}
		function scheduleHighlightRender() {
			if (renderFrame !== 0) return;
			renderFrame = globalThis.requestAnimationFrame(() => {
				renderFrame = 0;
				renderHighlights();
			});
		}
		function showResult() {
			if (active === null) return;
			stage = "result";
			host.dataset.hintStage = "result";
			lamp.ariaLabel = "已显示结论；再次点击清除提示";
			lamp.title = "";
			statusLive.textContent = "已显示结论。";
			renderHighlights();
			locateActiveHint();
		}
		function showMessage(analysis) {
			active = null;
			stage = "idle";
			host.dataset.hintStage = "idle";
			delete host.dataset.difficulty;
			cancelLocatorPulse();
			clearHighlights();
			host.dataset.status = analysis.kind === "invalid" ? "error" : analysis.kind;
			lamp.ariaLabel = analysis.message;
			lamp.title = "";
			statusLive.textContent = analysis.message;
		}
		async function loadFocus() {
			resetHint();
			host.dataset.status = "reading";
			lamp.disabled = true;
			try {
				const capture = await requestCapture();
				const elements = cellElements();
				boardElements = elements;
				const analysis = analyzePuzzleSlantCurrentPosition({
					...capture,
					hostname: globalThis.location.hostname,
					domCellClassNames: elements.map((element) => element.className)
				});
				capturedSignature = currentDomSignature();
				host.dataset.status = analysis.kind;
				if (analysis.kind === "step") {
					active = analysis;
					stage = "focus";
					host.dataset.hintStage = "focus";
					host.dataset.difficulty = analysis.difficulty.id;
					lamp.ariaLabel = "已显示观察位置；再次点击显示结论";
					lamp.title = "";
					statusLive.textContent = "已显示观察位置。";
					renderHighlights();
					locateActiveHint();
				} else showMessage(analysis);
			} catch (error) {
				showMessage({
					kind: "invalid",
					message: error instanceof Error ? error.message : String(error)
				});
			} finally {
				lamp.disabled = false;
			}
		}
		lamp.addEventListener("click", () => {
			if (active !== null && stage === "focus") showResult();
			else if (active !== null && stage === "result") resetHint();
			else loadFocus();
		});
		const handleGeometryEvent = () => {
			scheduleHighlightRender();
			startGeometryTracking(750);
		};
		globalThis.addEventListener("resize", handleGeometryEvent);
		globalThis.addEventListener("scroll", handleGeometryEvent, true);
		globalThis.visualViewport?.addEventListener("resize", handleGeometryEvent);
		globalThis.visualViewport?.addEventListener("scroll", handleGeometryEvent);
		for (const eventName of [
			"input",
			"change",
			"pointerup",
			"wheel"
		]) document.addEventListener(eventName, () => startGeometryTracking(eventName === "input" ? 1100 : 750), true);
		const observer = new MutationObserver((records) => {
			if (capturedSignature === "") return;
			if (records.some((record) => record.type === "childList" || record.attributeName === "class" && record.target instanceof Element && record.target.matches(".cell")) && currentDomSignature() !== capturedSignature) {
				resetHint();
				return;
			}
			if (records.some((record) => record.type === "childList")) boardElements = cellElements();
			startGeometryTracking(900);
		});
		const game = document.querySelector("#game");
		if (game !== null) {
			observer.observe(game, {
				subtree: true,
				childList: true,
				attributes: true,
				attributeFilter: ["class", "style"]
			});
			let ancestor = game.parentElement;
			while (ancestor !== null && ancestor !== document.documentElement) {
				observer.observe(ancestor, {
					attributes: true,
					attributeFilter: ["class", "style"]
				});
				ancestor = ancestor.parentElement;
			}
		}
		if (game instanceof HTMLElement && typeof ResizeObserver === "function") new ResizeObserver(handleGeometryEvent).observe(game);
		const onMessage = objectValue(objectValue(objectValue(globalThis, "chrome"), "runtime"), "onMessage");
		const addMessageListener = objectValue(onMessage, "addListener");
		if (typeof addMessageListener === "function") Reflect.apply(addMessageListener, onMessage, [(message) => {
			if (objectValue(message, "channel") !== ZOOM_CHANNEL || objectValue(message, "type") !== "zoom-changed") return false;
			applyBrowserZoom(objectValue(message, "zoomFactor"));
			return false;
		}]);
		document.documentElement.append(host);
		requestBrowserZoom().then(applyBrowserZoom);
	}
	if (globalThis.location.hostname === "puzzle-slant.com" || globalThis.location.hostname.endsWith(".puzzle-slant.com")) mountHintLamp();
	//#endregion
})();
