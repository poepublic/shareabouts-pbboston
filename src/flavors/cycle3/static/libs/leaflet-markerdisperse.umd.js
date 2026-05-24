(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('leaflet')) :
    typeof define === 'function' && define.amd ? define(['exports', 'leaflet'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.LeafletMarkerDisperse = {}, global.L));
})(this, (function (exports, L) { 'use strict';

    /**
     * Rearranges items so that all items in the [left, k] are the smallest.
     * The k-th element will have the (k - left + 1)-th smallest value in [left, right].
     *
     * @template T
     * @param {T[]} arr the array to partially sort (in place)
     * @param {number} k middle index for partial sorting (as defined above)
     * @param {number} [left=0] left index of the range to sort
     * @param {number} [right=arr.length-1] right index
     * @param {(a: T, b: T) => number} [compare = (a, b) => a - b] compare function
     */
    function quickselect(arr, k, left = 0, right = arr.length - 1, compare = defaultCompare) {

        while (right > left) {
            if (right - left > 600) {
                const n = right - left + 1;
                const m = k - left + 1;
                const z = Math.log(n);
                const s = 0.5 * Math.exp(2 * z / 3);
                const sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
                const newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
                const newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
                quickselect(arr, k, newLeft, newRight, compare);
            }

            const t = arr[k];
            let i = left;
            /** @type {number} */
            let j = right;

            swap(arr, left, k);
            if (compare(arr[right], t) > 0) swap(arr, left, right);

            while (i < j) {
                swap(arr, i, j);
                i++;
                j--;
                while (compare(arr[i], t) < 0) i++;
                while (compare(arr[j], t) > 0) j--;
            }

            if (compare(arr[left], t) === 0) swap(arr, left, j);
            else {
                j++;
                swap(arr, j, right);
            }

            if (j <= k) left = j + 1;
            if (k <= j) right = j - 1;
        }
    }

    /**
     * @template T
     * @param {T[]} arr
     * @param {number} i
     * @param {number} j
     */
    function swap(arr, i, j) {
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }

    /**
     * @template T
     * @param {T} a
     * @param {T} b
     * @returns {number}
     */
    function defaultCompare(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
    }

    class RBush {
        constructor(maxEntries = 9) {
            // max entries in a node is 9 by default; min node fill is 40% for best performance
            this._maxEntries = Math.max(4, maxEntries);
            this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));
            this.clear();
        }

        all() {
            return this._all(this.data, []);
        }

        search(bbox) {
            let node = this.data;
            const result = [];

            if (!intersects(bbox, node)) return result;

            const toBBox = this.toBBox;
            const nodesToSearch = [];

            while (node) {
                for (let i = 0; i < node.children.length; i++) {
                    const child = node.children[i];
                    const childBBox = node.leaf ? toBBox(child) : child;

                    if (intersects(bbox, childBBox)) {
                        if (node.leaf) result.push(child);
                        else if (contains(bbox, childBBox)) this._all(child, result);
                        else nodesToSearch.push(child);
                    }
                }
                node = nodesToSearch.pop();
            }

            return result;
        }

        collides(bbox) {
            let node = this.data;

            if (!intersects(bbox, node)) return false;

            const nodesToSearch = [];
            while (node) {
                for (let i = 0; i < node.children.length; i++) {
                    const child = node.children[i];
                    const childBBox = node.leaf ? this.toBBox(child) : child;

                    if (intersects(bbox, childBBox)) {
                        if (node.leaf || contains(bbox, childBBox)) return true;
                        nodesToSearch.push(child);
                    }
                }
                node = nodesToSearch.pop();
            }

            return false;
        }

        load(data) {
            if (!(data && data.length)) return this;

            if (data.length < this._minEntries) {
                for (let i = 0; i < data.length; i++) {
                    this.insert(data[i]);
                }
                return this;
            }

            // recursively build the tree with the given data from scratch using OMT algorithm
            let node = this._build(data.slice(), 0, data.length - 1, 0);

            if (!this.data.children.length) {
                // save as is if tree is empty
                this.data = node;

            } else if (this.data.height === node.height) {
                // split root if trees have the same height
                this._splitRoot(this.data, node);

            } else {
                if (this.data.height < node.height) {
                    // swap trees if inserted one is bigger
                    const tmpNode = this.data;
                    this.data = node;
                    node = tmpNode;
                }

                // insert the small tree into the large tree at appropriate level
                this._insert(node, this.data.height - node.height - 1, true);
            }

            return this;
        }

        insert(item) {
            if (item) this._insert(item, this.data.height - 1);
            return this;
        }

        clear() {
            this.data = createNode([]);
            return this;
        }

        remove(item, equalsFn) {
            if (!item) return this;

            let node = this.data;
            const bbox = this.toBBox(item);
            const path = [];
            const indexes = [];
            let i, parent, goingUp;

            // depth-first iterative tree traversal
            while (node || path.length) {

                if (!node) { // go up
                    node = path.pop();
                    parent = path[path.length - 1];
                    i = indexes.pop();
                    goingUp = true;
                }

                if (node.leaf) { // check current node
                    const index = findItem(item, node.children, equalsFn);

                    if (index !== -1) {
                        // item found, remove the item and condense tree upwards
                        node.children.splice(index, 1);
                        path.push(node);
                        this._condense(path);
                        return this;
                    }
                }

                if (!goingUp && !node.leaf && contains(node, bbox)) { // go down
                    path.push(node);
                    indexes.push(i);
                    i = 0;
                    parent = node;
                    node = node.children[0];

                } else if (parent) { // go right
                    i++;
                    node = parent.children[i];
                    goingUp = false;

                } else node = null; // nothing found
            }

            return this;
        }

        toBBox(item) { return item; }

        compareMinX(a, b) { return a.minX - b.minX; }
        compareMinY(a, b) { return a.minY - b.minY; }

        toJSON() { return this.data; }

        fromJSON(data) {
            this.data = data;
            return this;
        }

        _all(node, result) {
            const nodesToSearch = [];
            while (node) {
                if (node.leaf) result.push(...node.children);
                else nodesToSearch.push(...node.children);

                node = nodesToSearch.pop();
            }
            return result;
        }

        _build(items, left, right, height) {

            const N = right - left + 1;
            let M = this._maxEntries;
            let node;

            if (N <= M) {
                // reached leaf level; return leaf
                node = createNode(items.slice(left, right + 1));
                calcBBox(node, this.toBBox);
                return node;
            }

            if (!height) {
                // target height of the bulk-loaded tree
                height = Math.ceil(Math.log(N) / Math.log(M));

                // target number of root entries to maximize storage utilization
                M = Math.ceil(N / Math.pow(M, height - 1));
            }

            node = createNode([]);
            node.leaf = false;
            node.height = height;

            // split the items into M mostly square tiles

            const N2 = Math.ceil(N / M);
            const N1 = N2 * Math.ceil(Math.sqrt(M));

            multiSelect(items, left, right, N1, this.compareMinX);

            for (let i = left; i <= right; i += N1) {

                const right2 = Math.min(i + N1 - 1, right);

                multiSelect(items, i, right2, N2, this.compareMinY);

                for (let j = i; j <= right2; j += N2) {

                    const right3 = Math.min(j + N2 - 1, right2);

                    // pack each entry recursively
                    node.children.push(this._build(items, j, right3, height - 1));
                }
            }

            calcBBox(node, this.toBBox);

            return node;
        }

        _chooseSubtree(bbox, node, level, path) {
            while (true) {
                path.push(node);

                if (node.leaf || path.length - 1 === level) break;

                let minArea = Infinity;
                let minEnlargement = Infinity;
                let targetNode;

                for (let i = 0; i < node.children.length; i++) {
                    const child = node.children[i];
                    const area = bboxArea(child);
                    const enlargement = enlargedArea(bbox, child) - area;

                    // choose entry with the least area enlargement
                    if (enlargement < minEnlargement) {
                        minEnlargement = enlargement;
                        minArea = area < minArea ? area : minArea;
                        targetNode = child;

                    } else if (enlargement === minEnlargement) {
                        // otherwise choose one with the smallest area
                        if (area < minArea) {
                            minArea = area;
                            targetNode = child;
                        }
                    }
                }

                node = targetNode || node.children[0];
            }

            return node;
        }

        _insert(item, level, isNode) {
            const bbox = isNode ? item : this.toBBox(item);
            const insertPath = [];

            // find the best node for accommodating the item, saving all nodes along the path too
            const node = this._chooseSubtree(bbox, this.data, level, insertPath);

            // put the item into the node
            node.children.push(item);
            extend(node, bbox);

            // split on node overflow; propagate upwards if necessary
            while (level >= 0) {
                if (insertPath[level].children.length > this._maxEntries) {
                    this._split(insertPath, level);
                    level--;
                } else break;
            }

            // adjust bboxes along the insertion path
            this._adjustParentBBoxes(bbox, insertPath, level);
        }

        // split overflowed node into two
        _split(insertPath, level) {
            const node = insertPath[level];
            const M = node.children.length;
            const m = this._minEntries;

            this._chooseSplitAxis(node, m, M);

            const splitIndex = this._chooseSplitIndex(node, m, M);

            const newNode = createNode(node.children.splice(splitIndex, node.children.length - splitIndex));
            newNode.height = node.height;
            newNode.leaf = node.leaf;

            calcBBox(node, this.toBBox);
            calcBBox(newNode, this.toBBox);

            if (level) insertPath[level - 1].children.push(newNode);
            else this._splitRoot(node, newNode);
        }

        _splitRoot(node, newNode) {
            // split root node
            this.data = createNode([node, newNode]);
            this.data.height = node.height + 1;
            this.data.leaf = false;
            calcBBox(this.data, this.toBBox);
        }

        _chooseSplitIndex(node, m, M) {
            let index;
            let minOverlap = Infinity;
            let minArea = Infinity;

            for (let i = m; i <= M - m; i++) {
                const bbox1 = distBBox(node, 0, i, this.toBBox);
                const bbox2 = distBBox(node, i, M, this.toBBox);

                const overlap = intersectionArea(bbox1, bbox2);
                const area = bboxArea(bbox1) + bboxArea(bbox2);

                // choose distribution with minimum overlap
                if (overlap < minOverlap) {
                    minOverlap = overlap;
                    index = i;

                    minArea = area < minArea ? area : minArea;

                } else if (overlap === minOverlap) {
                    // otherwise choose distribution with minimum area
                    if (area < minArea) {
                        minArea = area;
                        index = i;
                    }
                }
            }

            return index || M - m;
        }

        // sorts node children by the best axis for split
        _chooseSplitAxis(node, m, M) {
            const compareMinX = node.leaf ? this.compareMinX : compareNodeMinX;
            const compareMinY = node.leaf ? this.compareMinY : compareNodeMinY;
            const xMargin = this._allDistMargin(node, m, M, compareMinX);
            const yMargin = this._allDistMargin(node, m, M, compareMinY);

            // if total distributions margin value is minimal for x, sort by minX,
            // otherwise it's already sorted by minY
            if (xMargin < yMargin) node.children.sort(compareMinX);
        }

        // total margin of all possible split distributions where each node is at least m full
        _allDistMargin(node, m, M, compare) {
            node.children.sort(compare);

            const toBBox = this.toBBox;
            const leftBBox = distBBox(node, 0, m, toBBox);
            const rightBBox = distBBox(node, M - m, M, toBBox);
            let margin = bboxMargin(leftBBox) + bboxMargin(rightBBox);

            for (let i = m; i < M - m; i++) {
                const child = node.children[i];
                extend(leftBBox, node.leaf ? toBBox(child) : child);
                margin += bboxMargin(leftBBox);
            }

            for (let i = M - m - 1; i >= m; i--) {
                const child = node.children[i];
                extend(rightBBox, node.leaf ? toBBox(child) : child);
                margin += bboxMargin(rightBBox);
            }

            return margin;
        }

        _adjustParentBBoxes(bbox, path, level) {
            // adjust bboxes along the given tree path
            for (let i = level; i >= 0; i--) {
                extend(path[i], bbox);
            }
        }

        _condense(path) {
            // go through the path, removing empty nodes and updating bboxes
            for (let i = path.length - 1, siblings; i >= 0; i--) {
                if (path[i].children.length === 0) {
                    if (i > 0) {
                        siblings = path[i - 1].children;
                        siblings.splice(siblings.indexOf(path[i]), 1);

                    } else this.clear();

                } else calcBBox(path[i], this.toBBox);
            }
        }
    }

    function findItem(item, items, equalsFn) {
        if (!equalsFn) return items.indexOf(item);

        for (let i = 0; i < items.length; i++) {
            if (equalsFn(item, items[i])) return i;
        }
        return -1;
    }

    // calculate node's bbox from bboxes of its children
    function calcBBox(node, toBBox) {
        distBBox(node, 0, node.children.length, toBBox, node);
    }

    // min bounding rectangle of node children from k to p-1
    function distBBox(node, k, p, toBBox, destNode) {
        if (!destNode) destNode = createNode(null);
        destNode.minX = Infinity;
        destNode.minY = Infinity;
        destNode.maxX = -Infinity;
        destNode.maxY = -Infinity;

        for (let i = k; i < p; i++) {
            const child = node.children[i];
            extend(destNode, node.leaf ? toBBox(child) : child);
        }

        return destNode;
    }

    function extend(a, b) {
        a.minX = Math.min(a.minX, b.minX);
        a.minY = Math.min(a.minY, b.minY);
        a.maxX = Math.max(a.maxX, b.maxX);
        a.maxY = Math.max(a.maxY, b.maxY);
        return a;
    }

    function compareNodeMinX(a, b) { return a.minX - b.minX; }
    function compareNodeMinY(a, b) { return a.minY - b.minY; }

    function bboxArea(a)   { return (a.maxX - a.minX) * (a.maxY - a.minY); }
    function bboxMargin(a) { return (a.maxX - a.minX) + (a.maxY - a.minY); }

    function enlargedArea(a, b) {
        return (Math.max(b.maxX, a.maxX) - Math.min(b.minX, a.minX)) *
               (Math.max(b.maxY, a.maxY) - Math.min(b.minY, a.minY));
    }

    function intersectionArea(a, b) {
        const minX = Math.max(a.minX, b.minX);
        const minY = Math.max(a.minY, b.minY);
        const maxX = Math.min(a.maxX, b.maxX);
        const maxY = Math.min(a.maxY, b.maxY);

        return Math.max(0, maxX - minX) *
               Math.max(0, maxY - minY);
    }

    function contains(a, b) {
        return a.minX <= b.minX &&
               a.minY <= b.minY &&
               b.maxX <= a.maxX &&
               b.maxY <= a.maxY;
    }

    function intersects(a, b) {
        return b.minX <= a.maxX &&
               b.minY <= a.maxY &&
               b.maxX >= a.minX &&
               b.maxY >= a.minY;
    }

    function createNode(children) {
        return {
            children,
            height: 1,
            leaf: true,
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity
        };
    }

    // sort an array so that items come in groups of n unsorted items, with groups sorted between each other;
    // combines selection algorithm with binary divide & conquer approach

    function multiSelect(arr, left, right, n, compare) {
        const stack = [left, right];

        while (stack.length) {
            right = stack.pop();
            left = stack.pop();

            if (right - left <= n) continue;

            const mid = left + Math.ceil((right - left) / n / 2) * n;
            quickselect(arr, mid, left, right, compare);

            stack.push(left, mid, mid, right);
        }
    }

    /**
     * Pure math/geometry utilities for marker dispersal.
     * No DOM or library dependencies — operates entirely in pixel-coordinate space.
     */

    /**
     * Calculate the geometric centroid (mean) of an array of points.
     * @param {{ x: number, y: number }[]} points
     * @returns {{ x: number, y: number }}
     */
    function centroid(points) {
      if (points.length === 0) {
        return { x: 0, y: 0 };
      }
      let sumX = 0;
      let sumY = 0;
      for (const p of points) {
        sumX += p.x;
        sumY += p.y;
      }
      return {
        x: sumX / points.length,
        y: sumY / points.length,
      };
    }

    /**
     * Calculate the angle (in radians) from point p1 to point p2.
     * Returns a value in [0, 2π). Angle 0 is east (+x direction),
     * π/2 is south (+y direction in screen coordinates).
     * @param {{ x: number, y: number }} p1
     * @param {{ x: number, y: number }} p2
     * @returns {number}
     */
    function angleBetween(p1, p2) {
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      return angle < 0 ? angle + 2 * Math.PI : angle;
    }

    /**
     * Compute the bounding rectangle for a marker given its anchor position,
     * anchor offset within the icon, and the icon dimensions.
     *
     * The anchor point (x, y) is the position on the map. The icon extends
     * from (x - anchorX, y - anchorY) to (x - anchorX + width, y - anchorY + height).
     *
     * @param {{ x: number, y: number, width: number, height: number, anchorX: number, anchorY: number }} marker
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    function markerBounds(marker) {
      return {
        minX: marker.x - marker.anchorX,
        minY: marker.y - marker.anchorY,
        maxX: marker.x - marker.anchorX + marker.width,
        maxY: marker.y - marker.anchorY + marker.height,
      };
    }

    /**
     * Check whether two axis-aligned rectangles overlap (or are within
     * `spacing` pixels of each other).
     *
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} r1
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} r2
     * @param {number} [spacing=0] - Additional gap required between rectangles
     * @returns {boolean}
     */
    function rectsOverlap(r1, r2, spacing = 0) {
      return !(
        r1.maxX + spacing <= r2.minX ||
        r2.maxX + spacing <= r1.minX ||
        r1.maxY + spacing <= r2.minY ||
        r2.maxY + spacing <= r1.minY
      );
    }

    /**
     * Compute a point on a circle given center, radius, and angle.
     * @param {{ x: number, y: number }} center
     * @param {number} radius
     * @param {number} angle - in radians
     * @returns {{ x: number, y: number }}
     */
    function positionOnCircle(center, radius, angle) {
      return {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
    }

    /**
     * Build a bounding rect for a marker placed at a given position.
     * @param {{ width: number, height: number, anchorX: number, anchorY: number }} marker
     * @param {{ x: number, y: number }} position
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    function boundsAtPosition(marker, position) {
      return {
        minX: position.x - marker.anchorX,
        minY: position.y - marker.anchorY,
        maxX: position.x - marker.anchorX + marker.width,
        maxY: position.y - marker.anchorY + marker.height,
      };
    }

    /**
     * Check whether any pair of markers in the given list overlaps when each
     * is placed at the specified positions.
     *
     * @param {{ width: number, height: number, anchorX: number, anchorY: number }[]} markers
     * @param {{ x: number, y: number }[]} positions - same length/order as markers
     * @param {number} spacing
     * @returns {boolean} true if there is at least one overlap
     */
    function anyOverlap(markers, positions, spacing) {
      const bounds = markers.map((m, i) => boundsAtPosition(m, positions[i]));
      for (let i = 0; i < bounds.length; i++) {
        for (let j = i + 1; j < bounds.length; j++) {
          if (rectsOverlap(bounds[i], bounds[j], spacing)) {
            return true;
          }
        }
      }
      return false;
    }

    /**
     * Find the smallest radius at which markers placed on a circle (at the
     * given angles from center) do not have overlapping bounding boxes.
     *
     * Uses binary search for efficiency.
     *
     * @param {{ width: number, height: number, anchorX: number, anchorY: number }[]} markers
     * @param {{ x: number, y: number }} center
     * @param {number[]} angles - one angle per marker (radians)
     * @param {number} spacing - minimum gap between bounding boxes
     * @param {number} [maxRadius=2000] - upper bound for binary search
     * @param {number} [tolerance=0.5] - precision of the result in pixels
     * @returns {number}
     */
    function smallestNonOverlappingRadius(
      markers,
      center,
      angles,
      spacing,
      maxRadius = 2000,
      tolerance = 0.5
    ) {
      // If only 0 or 1 markers, no radius needed.
      if (markers.length <= 1) {
        return 0;
      }

      let lo = 0;
      let hi = maxRadius;

      // Quick check: if at maxRadius they still overlap, return maxRadius.
      const posAtMax = markers.map((_, i) => positionOnCircle(center, hi, angles[i]));
      if (anyOverlap(markers, posAtMax, spacing)) {
        return maxRadius;
      }

      while (hi - lo > tolerance) {
        const mid = (lo + hi) / 2;
        const positions = markers.map((_, i) => positionOnCircle(center, mid, angles[i]));
        if (anyOverlap(markers, positions, spacing)) {
          lo = mid;
        } else {
          hi = mid;
        }
      }

      return hi;
    }

    /**
     * Compute the distance between two points.
     * @param {{ x: number, y: number }} p1
     * @param {{ x: number, y: number }} p2
     * @returns {number}
     */
    function distance(p1, p2) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Spatial indexing utilities for finding groups of overlapping markers.
     *
     * Wraps rbush to provide connected-component grouping: markers whose
     * bounding boxes overlap (or are within `spacing` of each other) are
     * collected into the same group.
     */


    /**
     * Build an rbush spatial index from an array of marker descriptors.
     *
     * Each marker descriptor must have: { id, x, y, width, height, anchorX, anchorY }
     *
     * @param {{ id: string|number, x: number, y: number, width: number, height: number, anchorX: number, anchorY: number }[]} markers
     * @returns {RBush}
     */
    function buildIndex(markers) {
      const tree = new RBush();
      const items = markers.map((m) => {
        const bounds = markerBounds(m);
        return {
          ...bounds,
          marker: m,
        };
      });
      tree.load(items);
      return tree;
    }

    /**
     * Expand a bounding box by a given amount on all sides.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bbox
     * @param {number} amount
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    function expandBBox(bbox, amount) {
      return {
        minX: bbox.minX - amount,
        minY: bbox.minY - amount,
        maxX: bbox.maxX + amount,
        maxY: bbox.maxY + amount,
      };
    }

    /**
     * Find groups of markers whose bounding boxes overlap or are within
     * `spacing` pixels of each other. Uses union-find on the spatial index
     * for efficient connected-component detection.
     *
     * @param {{ id: string|number, x: number, y: number, width: number, height: number, anchorX: number, anchorY: number }[]} markers
     * @param {number} [spacing=0]
     * @returns {Array<Array<{ id: string|number, x: number, y: number, width: number, height: number, anchorX: number, anchorY: number }>>}
     *   Array of groups. Each group has 2+ markers. Isolated markers are not returned.
     */
    function findOverlapGroups(markers, spacing = 0) {
      if (markers.length <= 1) {
        return [];
      }

      const tree = buildIndex(markers);

      // Union-Find data structure
      const parent = new Map();
      const rank = new Map();

      function find(id) {
        if (parent.get(id) !== id) {
          parent.set(id, find(parent.get(id)));
        }
        return parent.get(id);
      }

      function union(a, b) {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) return;
        const rankA = rank.get(ra) || 0;
        const rankB = rank.get(rb) || 0;
        if (rankA < rankB) {
          parent.set(ra, rb);
        } else if (rankA > rankB) {
          parent.set(rb, ra);
        } else {
          parent.set(rb, ra);
          rank.set(ra, rankA + 1);
        }
      }

      // Initialize union-find
      for (const m of markers) {
        parent.set(m.id, m.id);
        rank.set(m.id, 0);
      }

      // For each marker, search the tree for neighbors and union them
      for (const m of markers) {
        const bounds = markerBounds(m);
        const searchBox = expandBBox(bounds, spacing);
        const neighbors = tree.search(searchBox);
        for (const neighbor of neighbors) {
          if (neighbor.marker.id !== m.id) {
            union(m.id, neighbor.marker.id);
          }
        }
      }

      // Collect groups
      const groups = new Map();
      for (const m of markers) {
        const root = find(m.id);
        if (!groups.has(root)) {
          groups.set(root, []);
        }
        groups.get(root).push(m);
      }

      // Return only groups with 2+ markers
      return Array.from(groups.values()).filter((g) => g.length >= 2);
    }

    /**
     * Circle dispersal pattern.
     *
     * Arranges markers within the smallest circle possible, centered on
     * the geometric mean of their original positions, such that no bounding
     * boxes overlap.
     *
     * Special cases:
     * - 1 marker: no offset
     * - 2 markers: offset along the line connecting them (or vertically if coincident)
     * - N markers: angular distribution around the centroid. One marker may be
     *   placed at the center if it fits without overlapping the ring markers.
     */


    /**
     * Compute dispersal offsets for a group of overlapping markers using
     * the circle pattern.
     *
     * @param {import('../DisperseEngine.js').MarkerDescriptor[]} group
     * @param {number} spacing - Minimum gap between bounding boxes (px)
     * @returns {Map<string|number, import('../DisperseEngine.js').MarkerOffset>}
     */
    function circlePattern(group, spacing) {
      const offsets = new Map();

      if (group.length === 0) {
        return offsets;
      }

      if (group.length === 1) {
        offsets.set(group[0].id, { dx: 0, dy: 0 });
        return offsets;
      }

      const center = centroid(group.map((m) => ({ x: m.x, y: m.y })));

      if (group.length === 2) {
        return disperseTwoMarkers(group, center, spacing);
      }

      return disperseNMarkers(group, center, spacing);
    }

    /**
     * Special case for exactly two markers: offset them along the line
     * connecting them (or vertically if coincident).
     */
    function disperseTwoMarkers(group, center, spacing) {
      const offsets = new Map();
      const [m1, m2] = group;

      // Determine the axis of dispersal
      let angle;
      if (m1.x === m2.x && m1.y === m2.y) {
        // Coincident: disperse vertically (arbitrary but visually clean)
        angle = -Math.PI / 2; // up
      } else {
        angle = angleBetween(center, { x: m1.x, y: m1.y });
      }

      // Binary search for the minimum distance from center along this axis
      const markers = [m1, m2];
      const angles = [angle, angle + Math.PI];
      const radius = smallestNonOverlappingRadius(markers, center, angles, spacing);

      const p1 = positionOnCircle(center, radius, angles[0]);
      const p2 = positionOnCircle(center, radius, angles[1]);

      offsets.set(m1.id, { dx: p1.x - m1.x, dy: p1.y - m1.y });
      offsets.set(m2.id, { dx: p2.x - m2.x, dy: p2.y - m2.y });

      return offsets;
    }

    /**
     * General case for N >= 3 markers: assign each an angular slot on a circle,
     * find the minimum radius. Optionally place one marker at center if it fits.
     */
    function disperseNMarkers(group, center, spacing) {
      const offsets = new Map();
      const N = group.length;
      const TWO_PI = 2 * Math.PI;

      // Compute each marker's angle from the centroid. Markers coincident with
      // the centroid (or with each other away from the centroid) get null.
      const markersWithAngle = group.map((m) => {
        const dist = distance(center, { x: m.x, y: m.y });
        const angle = dist < 0.001 ? null : angleBetween(center, { x: m.x, y: m.y });
        return { marker: m, angle, dist };
      });

      const withAngle = markersWithAngle.filter((m) => m.angle !== null);
      const withoutAngle = markersWithAngle.filter((m) => m.angle === null);

      // Determine the anchor angle for stop positions. Use the first marker
      // that has a real angle; fall back to 0 if all are coincident.
      const anchorAngle = withAngle.length > 0 ? withAngle[0].angle : 0;

      // Generate N evenly-spaced stop positions starting from the anchor angle.
      const stepAngle = TWO_PI / N;
      const stops = Array.from({ length: N }, (_, i) => {
        let angle = anchorAngle + i * stepAngle;
        if (angle >= TWO_PI) angle -= TWO_PI;
        return { angle, occupied: false };
      });

      // Helper: find the nearest unoccupied stop for a given angle. Distance
      // is measured as the shortest arc on the circle.
      function claimNearestStop(targetAngle) {
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < stops.length; i++) {
          if (stops[i].occupied) continue;
          let d = Math.abs(stops[i].angle - targetAngle);
          if (d > Math.PI) d = TWO_PI - d;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx !== -1) stops[bestIdx].occupied = true;
        return bestIdx;
      }

      // Phase 1: assign markers that have real angles to their nearest stop.
      const assignedAngles = [];

      // Sort markers with angles so that those closest to a stop get first pick.
      // This avoids a later marker "stealing" a closer stop from an earlier one.
      const sortedWithAngle = [...withAngle].sort((a, b) => {
        // Sort by minimum angular distance to any stop
        const minDistA = Math.min(
          ...stops.map((s) => {
            let d = Math.abs(s.angle - a.angle);
            return d > Math.PI ? TWO_PI - d : d;
          })
        );
        const minDistB = Math.min(
          ...stops.map((s) => {
            let d = Math.abs(s.angle - b.angle);
            return d > Math.PI ? TWO_PI - d : d;
          })
        );
        return minDistA - minDistB;
      });

      for (const entry of sortedWithAngle) {
        const stopIdx = claimNearestStop(entry.angle);
        assignedAngles.push({
          marker: entry.marker,
          angle: stops[stopIdx].angle,
        });
      }

      // Phase 2: assign markers without angles to remaining unoccupied stops.
      for (const entry of withoutAngle) {
        // Find the first unoccupied stop
        const stopIdx = stops.findIndex((s) => !s.occupied);
        if (stopIdx !== -1) {
          stops[stopIdx].occupied = true;
          assignedAngles.push({
            marker: entry.marker,
            angle: stops[stopIdx].angle,
          });
        }
      }

      const markers = assignedAngles.map((a) => a.marker);
      const angles = assignedAngles.map((a) => a.angle);
      const radius = smallestNonOverlappingRadius(markers, center, angles, spacing);

      for (let i = 0; i < markers.length; i++) {
        const pos = positionOnCircle(center, radius, angles[i]);
        offsets.set(markers[i].id, {
          dx: pos.x - markers[i].x,
          dy: pos.y - markers[i].y,
        });
      }

      return offsets;
    }

    /**
     * Grid dispersal pattern.
     *
     * Arranges markers in a compact rectangular grid centered on their geometric
     * mean. The grid dimensions are chosen to minimize the maximum dimension
     * (e.g., 2x2 for 4 markers, 3x2 for 5 markers).
     * Markers are assigned to the closest grid slot using Manhattan distance
     * to minimize how far they are shifted.
     *
     * @param {import('../DisperseEngine.js').MarkerDescriptor[]} group
     * @param {number} spacing
     * @returns {Map<string|number, import('../DisperseEngine.js').MarkerOffset>}
     */
    function gridPattern(group, spacing) {
      const offsets = new Map();
      const N = group.length;

      if (N === 0) {
        return offsets;
      }

      if (N === 1) {
        offsets.set(group[0].id, { dx: 0, dy: 0 });
        return offsets;
      }

      const center = centroid(group.map((m) => ({ x: m.x, y: m.y })));

      // Grid spacing must accommodate the largest marker in each dimension
      const maxW = Math.max(...group.map((m) => m.width));
      const maxH = Math.max(...group.map((m) => m.height));
      const gridSpacingX = maxW + spacing;
      const gridSpacingY = maxH + spacing;

      // Determine grid dimensions
      const cols = Math.ceil(Math.sqrt(N));
      const rows = Math.ceil(N / cols);

      // Generate slots
      const rawSlots = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          rawSlots.push({
            x: c * gridSpacingX,
            y: r * gridSpacingY,
          });
        }
      }

      // Center slots around the centroid
      const slotCenter = centroid(rawSlots);
      const slots = rawSlots.map((s) => ({
        x: center.x + (s.x - slotCenter.x),
        y: center.y + (s.y - slotCenter.y),
      }));

      // Greedily assign markers to the closest slot using Manhattan distance
      const unassignedMarkers = new Set(group.map((m) => m.id));
      const unassignedSlots = new Set(slots.map((_, i) => i));

      const pairs = [];
      for (const m of group) {
        for (let i = 0; i < slots.length; i++) {
          const s = slots[i];
          const dist = Math.abs(m.x - s.x) + Math.abs(m.y - s.y);
          pairs.push({ markerId: m.id, slotIdx: i, dist });
        }
      }

      // Sort pairs by shortest distance
      pairs.sort((a, b) => a.dist - b.dist);

      for (const pair of pairs) {
        if (unassignedMarkers.has(pair.markerId) && unassignedSlots.has(pair.slotIdx)) {
          unassignedMarkers.delete(pair.markerId);
          unassignedSlots.delete(pair.slotIdx);
          const slot = slots[pair.slotIdx];
          const marker = group.find((m) => m.id === pair.markerId);
          offsets.set(marker.id, {
            dx: slot.x - marker.x,
            dy: slot.y - marker.y,
          });
        }
      }

      // Shift all offsets so that the centroid of the assigned slots exactly matches the original centroid.
      // This prevents the grid from looking off-center when not all slots are filled.
      const assignedPositions = group.map((m) => ({
        x: m.x + offsets.get(m.id).dx,
        y: m.y + offsets.get(m.id).dy,
      }));
      const dispersedCenter = centroid(assignedPositions);

      const driftX = center.x - dispersedCenter.x;
      const driftY = center.y - dispersedCenter.y;

      for (const m of group) {
        const off = offsets.get(m.id);
        off.dx += driftX;
        off.dy += driftY;
      }

      return offsets;
    }

    /**
     * Hexgrid dispersal pattern.
     *
     * Arranges markers in a compact hexagonal (staggered) grid centered on their
     * geometric mean. Every other row is shifted horizontally by half the grid
     * spacing to create a hex-like packing.
     * Markers are assigned to the closest grid slot using Manhattan distance
     * to minimize how far they are shifted.
     *
     * @param {import('../DisperseEngine.js').MarkerDescriptor[]} group
     * @param {number} spacing
     * @returns {Map<string|number, import('../DisperseEngine.js').MarkerOffset>}
     */
    function hexgridPattern(group, spacing) {
      const offsets = new Map();
      const N = group.length;

      if (N === 0) {
        return offsets;
      }

      if (N === 1) {
        offsets.set(group[0].id, { dx: 0, dy: 0 });
        return offsets;
      }

      const center = centroid(group.map((m) => ({ x: m.x, y: m.y })));

      // Grid spacing must accommodate the largest marker in each dimension.
      // Note: For bounding boxes to never overlap, vertical spacing must still be maxH + spacing
      // even in a staggered grid. Otherwise, the rectangular bounds could overlap.
      const maxW = Math.max(...group.map((m) => m.width));
      const maxH = Math.max(...group.map((m) => m.height));
      const gridSpacingX = maxW + spacing;
      const gridSpacingY = maxH + spacing;

      // Determine grid dimensions
      const cols = Math.ceil(Math.sqrt(N));
      const rows = Math.ceil(N / cols);

      // Generate staggered slots
      const rawSlots = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Stagger odd rows by half the column width
          const offsetX = c * gridSpacingX + (r % 2 === 1 ? gridSpacingX / 2 : 0);
          const offsetY = r * gridSpacingY;
          rawSlots.push({ x: offsetX, y: offsetY });
        }
      }

      // Center slots around the centroid
      const slotCenter = centroid(rawSlots);
      const slots = rawSlots.map((s) => ({
        x: center.x + (s.x - slotCenter.x),
        y: center.y + (s.y - slotCenter.y),
      }));

      // Greedily assign markers to the closest slot using Manhattan distance
      const unassignedMarkers = new Set(group.map((m) => m.id));
      const unassignedSlots = new Set(slots.map((_, i) => i));

      const pairs = [];
      for (const m of group) {
        for (let i = 0; i < slots.length; i++) {
          const s = slots[i];
          const dist = Math.abs(m.x - s.x) + Math.abs(m.y - s.y);
          pairs.push({ markerId: m.id, slotIdx: i, dist });
        }
      }

      // Sort pairs by shortest distance
      pairs.sort((a, b) => a.dist - b.dist);

      for (const pair of pairs) {
        if (unassignedMarkers.has(pair.markerId) && unassignedSlots.has(pair.slotIdx)) {
          unassignedMarkers.delete(pair.markerId);
          unassignedSlots.delete(pair.slotIdx);
          const slot = slots[pair.slotIdx];
          const marker = group.find((m) => m.id === pair.markerId);
          offsets.set(marker.id, {
            dx: slot.x - marker.x,
            dy: slot.y - marker.y,
          });
        }
      }

      // Shift all offsets so that the centroid of the assigned slots exactly matches the original centroid.
      // This prevents the grid from looking off-center when not all slots are filled.
      const assignedPositions = group.map((m) => ({
        x: m.x + offsets.get(m.id).dx,
        y: m.y + offsets.get(m.id).dy,
      }));
      const dispersedCenter = centroid(assignedPositions);

      const driftX = center.x - dispersedCenter.x;
      const driftY = center.y - dispersedCenter.y;

      for (const m of group) {
        const off = offsets.get(m.id);
        off.dx += driftX;
        off.dy += driftY;
      }

      return offsets;
    }

    /**
     * DisperseEngine — the core offset calculator.
     *
     * Given an array of marker descriptors (pixel positions, sizes, anchors),
     * computes pixel offsets so that no markers' bounding boxes overlap.
     *
     * The engine is library-agnostic: it knows nothing about Leaflet, the DOM,
     * or geographic coordinates. It operates entirely in pixel space.
     *
     * Dispersal patterns are pluggable via the `pattern` option, which
     * accepts a string name (looked up in the built-in registry) or a custom
     * function conforming to the DispersePatternFn signature.
     */


    /**
     * @typedef {Object} MarkerDescriptor
     * @property {string|number} id - Unique identifier for the marker
     * @property {number} x - Pixel x of anchor point
     * @property {number} y - Pixel y of anchor point
     * @property {number} width - Bounding box width in px
     * @property {number} height - Bounding box height in px
     * @property {number} anchorX - Anchor offset from top-left of bounding box
     * @property {number} anchorY - Anchor offset from top-left of bounding box
     */

    /**
     * @typedef {Object} MarkerOffset
     * @property {number} dx - Pixel offset in x
     * @property {number} dy - Pixel offset in y
     */

    /**
     * A dispersal pattern function. Given a group of overlapping markers
     * and the minimum spacing, returns a map of marker id → offset.
     *
     * @callback DispersePatternFn
     * @param {MarkerDescriptor[]} group - Markers that overlap each other
     * @param {number} spacing - Minimum gap in px between bounding boxes
     * @returns {Map<string|number, MarkerOffset>}
     */

    // Built-in pattern registry
    const patternRegistry = new Map();
    patternRegistry.set('circle', circlePattern);
    patternRegistry.set('grid', gridPattern);
    patternRegistry.set('hexgrid', hexgridPattern);

    /**
     * Register a custom dispersal pattern for use by name.
     * @param {string} name
     * @param {DispersePatternFn} fn
     */
    function registerPattern(name, fn) {
      patternRegistry.set(name, fn);
    }

    /**
     * @typedef {Object} DisperseOptions
     * @property {number} [minimumSpacing=0] - Pixel gap required between marker bounding boxes
     * @property {string|DispersePatternFn} [pattern='circle'] - Dispersal pattern name or function
     */

    /**
     * Calculate pixel offsets for all markers so that overlapping groups are dispersed.
     *
     * Dispersing one group may push markers into overlap with markers from
     * other groups (or previously non-overlapping markers). To handle this,
     * the engine iterates: after each pass it re-checks all markers at their
     * dispersed positions and re-disperses any new overlap groups, until no
     * overlaps remain (or a maximum iteration count is reached).
     *
     * @param {MarkerDescriptor[]} markers
     * @param {DisperseOptions} [options={}]
     * @returns {Object.<string|number, MarkerOffset>} Map of marker id → { dx, dy }
     */
    function disperse(markers, options = {}) {
      const { minimumSpacing = 0, pattern = 'circle', maxIterations = 10 } = options;

      // Resolve the pattern function
      let patternFn;
      if (typeof pattern === 'function') {
        patternFn = pattern;
      } else {
        patternFn = patternRegistry.get(pattern);
        if (!patternFn) {
          throw new Error(
            `Unknown dispersal pattern: "${pattern}". ` +
              `Available patterns: ${Array.from(patternRegistry.keys()).join(', ')}. ` +
              `You can also pass a custom function.`
          );
        }
      }

      // Build result: default all markers to zero offset
      const offsets = {};
      for (const m of markers) {
        offsets[m.id] = { dx: 0, dy: 0 };
      }

      // Build a lookup for original markers by id
      const markerById = new Map();
      for (const m of markers) {
        markerById.set(m.id, m);
      }

      // Iteratively disperse until no overlaps remain
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        // Create marker descriptors at their current dispersed positions
        const currentMarkers = markers.map((m) => ({
          ...m,
          x: m.x + offsets[m.id].dx,
          y: m.y + offsets[m.id].dy,
        }));

        // Find groups of overlapping markers at current positions
        const groups = findOverlapGroups(currentMarkers, minimumSpacing);

        // If no overlaps, we're done
        if (groups.length === 0) {
          break;
        }

        // For each overlap group, compute dispersal offsets from their
        // current (already-offset) positions
        for (const group of groups) {
          const groupOffsets = patternFn(group, minimumSpacing);
          for (const [id, offset] of groupOffsets) {
            // Accumulate: the pattern returns offsets relative to the
            // current (already-offset) positions, so we add them to the
            // existing offsets from the original positions.
            const original = markerById.get(id);
            offsets[id] = {
              dx: original.x + offsets[id].dx + offset.dx - original.x,
              dy: original.y + offsets[id].dy + offset.dy - original.y,
            };
          }
        }
      }

      return offsets;
    }

    /**
     * L.MarkerDisperseGroup — Leaflet FeatureGroup that automatically disperses
     * its child markers so their icons don't overlap visually.
     *
     * Usage:
     *   const group = L.markerDisperseGroup({ minimumSpacing: 2 });
     *   group.addLayer(L.marker([lat, lng]));
     *   group.addTo(map);
     */


    // Default icon dimensions matching Leaflet's default marker icon
    const DEFAULT_ICON_SIZE$1 = [25, 41];
    const DEFAULT_ICON_ANCHOR$1 = [12, 41];

    L.MarkerDisperseGroup = L.FeatureGroup.extend({
      options: {
        /**
         * Minimum pixel gap between marker bounding boxes.
         * 0 means markers will touch but not overlap.
         */
        minimumSpacing: 0,

        /**
         * Dispersal pattern. String name (from the registry) or a custom
         * pattern function.
         */
        pattern: 'circle',
      },

      initialize: function (options) {
        L.setOptions(this, options);
        L.FeatureGroup.prototype.initialize.call(this, []);

        /**
         * Map of Leaflet layer id → original CSS transform, so we can
         * restore markers when they're removed from the group.
         * @private
         */
        this._originalTransforms = {};

        /**
         * Debounce timer for dispersal recalculation
         * @private
         */
        this._disperseTimeout = null;
      },

      onAdd: function (map) {
        L.FeatureGroup.prototype.onAdd.call(this, map);

        map.on('zoomend', this._scheduleDisperse, this);
        map.on('moveend', this._scheduleDisperse, this);
        map.on('resize', this._scheduleDisperse, this);

        this._scheduleDisperse();
      },

      onRemove: function (map) {
        map.off('zoomend', this._scheduleDisperse, this);
        map.off('moveend', this._scheduleDisperse, this);
        map.off('resize', this._scheduleDisperse, this);

        this._restoreAllTransforms();
        L.FeatureGroup.prototype.onRemove.call(this, map);
      },

      addLayer: function (layer) {
        L.FeatureGroup.prototype.addLayer.call(this, layer);
        this._scheduleDisperse();
        return this;
      },

      removeLayer: function (layer) {
        const id = this.getLayerId(layer);
        this._restoreTransform(id, layer);
        L.FeatureGroup.prototype.removeLayer.call(this, layer);
        this._scheduleDisperse();
        return this;
      },

      /**
       * Schedule a dispersal recalculation. Debounced to avoid excessive
       * computation during rapid zoom/pan.
       * @private
       */
      _scheduleDisperse: function () {
        if (this._disperseTimeout) {
          clearTimeout(this._disperseTimeout);
        }
        this._disperseTimeout = setTimeout(() => {
          this._disperseTimeout = null;
          this._performDisperse();
        }, 50);
      },

      /**
       * Force an immediate dispersal recalculation.
       */
      refreshDisperse: function () {
        this._performDisperse();
      },

      /**
       * Main dispersal logic. Collects all marker positions/sizes,
       * runs the engine, and applies CSS transform offsets.
       * @private
       */
      _performDisperse: function () {
        if (!this._map) return;

        // Restore all transforms before recalculating so that we read
        // clean positions
        this._restoreAllTransforms();

        const map = this._map;
        const markers = [];

        this.eachLayer((layer) => {
          if (!layer.getLatLng) return; // skip non-marker layers

          const latlng = layer.getLatLng();
          const point = map.latLngToLayerPoint(latlng);
          const iconOpts = this._getIconDimensions(layer);

          markers.push({
            id: this.getLayerId(layer),
            x: point.x,
            y: point.y,
            width: iconOpts.width,
            height: iconOpts.height,
            anchorX: iconOpts.anchorX,
            anchorY: iconOpts.anchorY,
            _layer: layer, // internal ref, not passed to engine
          });
        });

        if (markers.length < 2) return;

        // Strip internal refs before passing to engine
        const descriptors = markers.map(({ _layer, ...rest }) => rest);  // eslint-disable-line no-unused-vars

        const offsets = disperse(descriptors, {
          minimumSpacing: this.options.minimumSpacing,
          pattern: this.options.pattern,
        });

        // Apply offsets as CSS transforms
        for (const m of markers) {
          const offset = offsets[m.id];
          if (!offset || (offset.dx === 0 && offset.dy === 0)) continue;
          this._applyTransform(m.id, m._layer, offset.dx, offset.dy);
        }
      },

      _getIconDimensions: function (layer) {
        const icon = layer.options && layer.options.icon;
        const iconOpts = icon && icon.options;

        const defaultSize = (iconOpts && iconOpts.iconSize) || DEFAULT_ICON_SIZE$1;
        const defaultAnchor = (iconOpts && iconOpts.iconAnchor) || DEFAULT_ICON_ANCHOR$1;

        const origWidth = defaultSize.x !== undefined ? defaultSize.x : defaultSize[0];
        const origHeight = defaultSize.y !== undefined ? defaultSize.y : defaultSize[1];
        let anchorX = defaultAnchor.x !== undefined ? defaultAnchor.x : defaultAnchor[0];
        let anchorY = defaultAnchor.y !== undefined ? defaultAnchor.y : defaultAnchor[1];

        let width = origWidth;
        let height = origHeight;

        const override = this.options.markerSize;
        let sizeOverride = null;

        if (override) {
          if (typeof override === 'function') {
            sizeOverride = override(layer);
          } else {
            sizeOverride = override;
          }
        }

        if (sizeOverride) {
          width = sizeOverride.x !== undefined ? sizeOverride.x : sizeOverride[0];
          height = sizeOverride.y !== undefined ? sizeOverride.y : sizeOverride[1];

          // Proportionally scale the anchor to match the overridden size.
          // E.g., if the anchor was at the bottom-center (width/2, height),
          // it stays at the bottom-center of the new size.
          if (origWidth > 0) anchorX = anchorX * (width / origWidth);
          if (origHeight > 0) anchorY = anchorY * (height / origHeight);
        }

        return { width, height, anchorX, anchorY };
      },

      /**
       * Apply a pixel offset to a marker's DOM element via CSS transform.
       * @private
       */
      _applyTransform: function (id, layer, dx, dy) {
        const el = layer.getElement ? layer.getElement() : null;
        if (!el) return;

        // Store original transform so we can restore it
        if (!(id in this._originalTransforms)) {
          this._originalTransforms[id] = el.style.transform || '';
        }

        // Set the target offset for this marker
        layer._disperseOffset = { dx, dy };

        // Duck-punch _setPos so that during zoom animation, the dispersed offset
        // is preserved on top of Leaflet's newly calculated base position.
        if (!layer._originalSetPos && typeof layer._setPos === 'function') {
          layer._originalSetPos = layer._setPos;
          layer._setPos = function (pos) {
            // Let Leaflet update the base position and set the transform
            layer._originalSetPos.call(this, pos);

            // Then re-append our disperse offset to the new transform so it
            // smoothly animates.
            if (this._disperseOffset) {
              const el = this.getElement ? this.getElement() : null;
              if (el && el.style.transform !== undefined) {
                 const original = el.style.transform || '';
                 el.style.transform = original
                   ? `${original} translate(${this._disperseOffset.dx}px, ${this._disperseOffset.dy}px)`
                   : `translate(${this._disperseOffset.dx}px, ${this._disperseOffset.dy}px)`;
              }
            }
          };
        }

        // Append a translate to the existing transform
        const original = this._originalTransforms[id];
        el.style.transform = original
          ? `${original} translate(${dx}px, ${dy}px)`
          : `translate(${dx}px, ${dy}px)`;
      },

      /**
       * Restore a single marker's transform to its original state.
       * @private
       */
      _restoreTransform: function (id, layer) {
        if (id in this._originalTransforms) {
          // Clear the offset so if Leaflet updates position (or if the layer is
          // removed), it doesn't get our disperse offset appended.
          layer._disperseOffset = null;

          // Let Leaflet re-position the marker for the current zoom/pan state
          // instead of restoring from a cached transform that may be stale.
          if (layer.update) {
            layer.update();
          } else {
            const el = layer.getElement ? layer.getElement() : null;
            if (el) {
              el.style.transform = this._originalTransforms[id];
            }
          }

          // Restore original setPos to clean up duck-punching.
          if (layer._originalSetPos) {
            layer._setPos = layer._originalSetPos;
            delete layer._originalSetPos;
          }

          delete this._originalTransforms[id];
        }
      },

      /**
       * Restore all markers to their original transforms.
       * @private
       */
      _restoreAllTransforms: function () {
        this.eachLayer((layer) => {
          const id = this.getLayerId(layer);
          this._restoreTransform(id, layer);
        });
      },
    });

    /**
     * Factory function for L.MarkerDisperseGroup.
     * @param {Object} [options]
     * @returns {L.MarkerDisperseGroup}
     */
    L.markerDisperseGroup = function (options) {
      return new L.MarkerDisperseGroup(options);
    };

    var MarkerDisperseGroup = L.MarkerDisperseGroup;

    /**
     * L.Map.MarkerDisperse — a Leaflet Handler that coordinates marker
     * dispersal across all layers on the map, including markers in different
     * FeatureGroups and MarkerClusterGroups.
     *
     * Usage:
     *   const map = L.map('map');
     *   map.addHandler('markerdisperse', L.Map.MarkerDisperse);
     *   map.markerdisperse.enable();
     *
     *   // Or via map options:
     *   const map = L.map('map', { markerdisperse: true });
     *
     * Options can be passed via:
     *   map.options.markerDisperseOptions = { minimumSpacing: 2 };
     */


    // Default icon dimensions matching Leaflet's default marker icon
    const DEFAULT_ICON_SIZE = [25, 41];
    const DEFAULT_ICON_ANCHOR = [12, 41];

    L.Map.MarkerDisperse = L.Handler.extend({
      initialize: function (map) {
        L.Handler.prototype.initialize.call(this, map);

        this._options = map.options.markerDisperseOptions || {};
        this._disperseTimeout = null;
        this._originalTransforms = {};
        this._trackedLayerIds = new Set();
      },

      addHooks: function () {
        this._map.on('zoomend', this._scheduleDisperse, this);
        this._map.on('moveend', this._scheduleDisperse, this);
        this._map.on('resize', this._scheduleDisperse, this);
        this._map.on('layeradd', this._scheduleDisperse, this);
        this._map.on('layerremove', this._onLayerRemove, this);

        this._scheduleDisperse();
      },

      removeHooks: function () {
        this._map.off('zoomend', this._scheduleDisperse, this);
        this._map.off('moveend', this._scheduleDisperse, this);
        this._map.off('resize', this._scheduleDisperse, this);
        this._map.off('layeradd', this._scheduleDisperse, this);
        this._map.off('layerremove', this._onLayerRemove, this);

        this._restoreAllTransforms();
      },

      /**
       * Update options at runtime and re-disperse.
       */
      setOptions: function (options) {
        Object.assign(this._options, options);
        this._scheduleDisperse();
      },

      /**
       * Force an immediate dispersal recalculation.
       */
      refreshDisperse: function () {
        this._performDisperse();
      },

      /**
       * @private
       */
      _onLayerRemove: function (e) {
        const id = L.Util.stamp(e.layer);
        if (this._trackedLayerIds.has(id)) {
          this._restoreTransform(id, e.layer);
          this._trackedLayerIds.delete(id);
        }
        this._scheduleDisperse();
      },

      /**
       * @private
       */
      _scheduleDisperse: function () {
        if (this._disperseTimeout) {
          clearTimeout(this._disperseTimeout);
        }
        this._disperseTimeout = setTimeout(() => {
          this._disperseTimeout = null;
          this._performDisperse();
        }, 50);
      },

      /**
       * @private
       */
      _performDisperse: function () {
        const map = this._map;
        if (!map) return;

        // Restore all transforms first
        this._restoreAllTransforms();

        const markers = [];
        const layerMap = {};

        // Collect all markers currently on the map, from all layers
        map.eachLayer((layer) => {
          this._collectMarkers(layer, markers, layerMap);
        });

        if (markers.length < 2) return;

        const offsets = disperse(markers, {
          minimumSpacing: this._options.minimumSpacing || 0,
          pattern: this._options.pattern || 'circle',
        });

        // Apply offsets
        for (const m of markers) {
          const offset = offsets[m.id];
          if (!offset || (offset.dx === 0 && offset.dy === 0)) continue;
          const layer = layerMap[m.id];
          if (layer) {
            this._applyTransform(m.id, layer, offset.dx, offset.dy);
            this._trackedLayerIds.add(m.id);
          }
        }
      },

      /**
       * Recursively collect markers from a layer and its children.
       * Handles FeatureGroups, LayerGroups, and MarkerClusterGroups.
       * @private
       */
      _collectMarkers: function (layer, markers, layerMap) {
        // If this is a MarkerClusterGroup, collect the visible cluster icons
        // and unclustered markers instead of recursing into the original markers.
        if (this._isMarkerClusterGroup(layer)) {
          this._collectClusterMarkers(layer, markers, layerMap);
          return;
        }

        // If this is a group, recurse
        if (layer.eachLayer && !(layer instanceof L.Marker)) {
          layer.eachLayer((child) => {
            this._collectMarkers(child, markers, layerMap);
          });
          return;
        }

        // If it can be "opened" (like a popup or tooltip), skip it.
        if (layer.openOn) {
          return;
        }

        // Otherwise, if it has a position and an element (like a marker)...
        if (layer.getLatLng && layer.getElement) {
          const map = this._map;
          const latlng = layer.getLatLng();
          const point = map.latLngToLayerPoint(latlng);
          const iconDims = this._getIconDimensions(layer);
          const id = L.Util.stamp(layer);

          // Skip the marker if it's already been added to the list.
          // This may happen because map.eachLayer() iterates over all layers,
          // including those that are grouped members of other layers.
          //
          // TODO: In that case, do we need to recurse into groups?
          if (layerMap[id]) {
            return;
          }

          markers.push({
            id,
            x: point.x,
            y: point.y,
            width: iconDims.width,
            height: iconDims.height,
            anchorX: iconDims.anchorX,
            anchorY: iconDims.anchorY,
          });
          layerMap[id] = layer;
        }
      },

      /**
       * Check whether a layer is a MarkerClusterGroup.
       * @private
       */
      _isMarkerClusterGroup: function (layer) {
        // Duck-type check for MarkerClusterGroup
        return !!(layer._topClusterLevel && layer._needsClustering !== undefined);
      },

      /**
       * Collect visible cluster icons and unclustered markers from a
       * MarkerClusterGroup.
       * @private
       */
      _collectClusterMarkers: function (clusterGroup, markers, layerMap) {
        // MarkerClusterGroup uses _featureGroup for visible layers
        const visibleParent = clusterGroup._featureGroup;
        if (!visibleParent) return;

        visibleParent.eachLayer((layer) => {
          if (layer.getLatLng && layer.getElement) {
            const map = this._map;
            const latlng = layer.getLatLng();
            const point = map.latLngToLayerPoint(latlng);
            const iconDims = this._getIconDimensions(layer);
            const id = L.Util.stamp(layer);

            markers.push({
              id,
              x: point.x,
              y: point.y,
              width: iconDims.width,
              height: iconDims.height,
              anchorX: iconDims.anchorX,
              anchorY: iconDims.anchorY,
            });
            layerMap[id] = layer;
          }
        });
      },

      _getIconDimensions: function (layer) {
        const icon = layer.options && layer.options.icon;
        const iconOpts = icon && icon.options;

        const defaultSize = (iconOpts && iconOpts.iconSize) || DEFAULT_ICON_SIZE;
        const defaultAnchor = (iconOpts && iconOpts.iconAnchor) || DEFAULT_ICON_ANCHOR;

        const origWidth = defaultSize.x !== undefined ? defaultSize.x : defaultSize[0];
        const origHeight = defaultSize.y !== undefined ? defaultSize.y : defaultSize[1];
        let anchorX = defaultAnchor.x !== undefined ? defaultAnchor.x : defaultAnchor[0];
        let anchorY = defaultAnchor.y !== undefined ? defaultAnchor.y : defaultAnchor[1];

        let width = origWidth;
        let height = origHeight;

        const override = this._options.markerSize;
        let sizeOverride = null;

        if (override) {
          if (typeof override === 'function') {
            sizeOverride = override(layer);
          } else {
            sizeOverride = override;
          }
        }

        if (sizeOverride) {
          width = sizeOverride.x !== undefined ? sizeOverride.x : sizeOverride[0];
          height = sizeOverride.y !== undefined ? sizeOverride.y : sizeOverride[1];

          if (origWidth > 0) anchorX = anchorX * (width / origWidth);
          if (origHeight > 0) anchorY = anchorY * (height / origHeight);
        }

        return { width, height, anchorX, anchorY };
      },

      /**
       * @private
       */
      _applyTransform: function (id, layer, dx, dy) {
        const el = layer.getElement ? layer.getElement() : null;
        if (!el) return;

        if (!(id in this._originalTransforms)) {
          this._originalTransforms[id] = el.style.transform || '';
        }

        // Set the target offset for this marker
        layer._disperseOffset = { dx, dy };

        // Duck-punch _setPos so that during zoom animation, the dispersed offset
        // is preserved on top of Leaflet's newly calculated base position.
        // This allows Leaflet 1.x and 2.x to smoothly transition the markers while
        // maintaining their dispersed visual layout.
        if (!layer._originalSetPos && typeof layer._setPos === 'function') {
          layer._originalSetPos = layer._setPos;
          layer._setPos = function (pos) {
            // Let Leaflet update the base position and set the transform
            // e.g. translate3d(newX, newY, 0)
            layer._originalSetPos.call(this, pos);

            // Then re-append our disperse offset to the new transform so it
            // smoothly animates.
            if (this._disperseOffset) {
              const el = this.getElement ? this.getElement() : null;
              if (el && el.style.transform !== undefined) {
                 const original = el.style.transform || '';
                 el.style.transform = original
                   ? `${original} translate(${this._disperseOffset.dx}px, ${this._disperseOffset.dy}px)`
                   : `translate(${this._disperseOffset.dx}px, ${this._disperseOffset.dy}px)`;
              }
            }
          };
        }

        const original = this._originalTransforms[id];
        el.style.transform = original
          ? `${original} translate(${dx}px, ${dy}px)`
          : `translate(${dx}px, ${dy}px)`;
      },

      /**
       * @private
       */
      _restoreTransform: function (id, layer) {
        if (id in this._originalTransforms) {
          // Clear the offset so if Leaflet updates position (or if the layer is
          // removed), it doesn't get our disperse offset appended.
          layer._disperseOffset = null;

          // Let Leaflet re-position the marker for the current zoom/pan state
          // instead of restoring from a cached transform that may be stale.
          if (layer.update) {
            layer.update();
          } else {
            const el = layer.getElement ? layer.getElement() : null;
            if (el) {
              el.style.transform = this._originalTransforms[id];
            }
          }

          // Restore original setPos to clean up duck-punching.
          if (layer._originalSetPos) {
            layer._setPos = layer._originalSetPos;
            delete layer._originalSetPos;
          }

          delete this._originalTransforms[id];
        }
      },

      /**
       * @private
       */
      _restoreAllTransforms: function () {
        const map = this._map;
        if (!map) return;

        // Walk all layers and restore tracked ones
        const restore = (layer) => {
          const id = L.Util.stamp(layer);
          if (this._trackedLayerIds.has(id)) {
            this._restoreTransform(id, layer);
            this._trackedLayerIds.delete(id);
          }
          if (layer.eachLayer) {
            layer.eachLayer(restore);
          }
          // Also check _featureGroup for MarkerClusterGroups
          if (layer._featureGroup) {
            layer._featureGroup.eachLayer((child) => {
              const childId = L.Util.stamp(child);
              if (this._trackedLayerIds.has(childId)) {
                this._restoreTransform(childId, child);
                this._trackedLayerIds.delete(childId);
              }
            });
          }
        };

        map.eachLayer(restore);
      },
    });

    // Register as a map handler so it can be enabled via map options
    L.Map.addInitHook('addHandler', 'markerdisperse', L.Map.MarkerDisperse);

    var MapDisperseHandler = L.Map.MarkerDisperse;

    exports.MapDisperseHandler = MapDisperseHandler;
    exports.MarkerDisperseGroup = MarkerDisperseGroup;
    exports.angleBetween = angleBetween;
    exports.anyOverlap = anyOverlap;
    exports.boundsAtPosition = boundsAtPosition;
    exports.buildIndex = buildIndex;
    exports.centroid = centroid;
    exports.circlePattern = circlePattern;
    exports.disperse = disperse;
    exports.distance = distance;
    exports.findOverlapGroups = findOverlapGroups;
    exports.markerBounds = markerBounds;
    exports.positionOnCircle = positionOnCircle;
    exports.rectsOverlap = rectsOverlap;
    exports.registerPattern = registerPattern;
    exports.smallestNonOverlappingRadius = smallestNonOverlappingRadius;

}));
//# sourceMappingURL=leaflet-markerdisperse.umd.js.map
