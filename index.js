;!function () {
	/**
	 * Wrap a value in a state-tracking reactive node
	 * @param {any} val - Value to track/wrap
	 */
	function reactive(val) {
		if (val instanceof Function)
			return {
				_fn: val,
				type: "computed",
				get value() {
					return this._fn();
				},
			};
		return {
			_emit() {},
			_value: val,
			type: "state",
			get value() {
				return this._value;
			},
			set value(nv) {
				this._value = nv;
				this._emit();
			},
		};
	}

	/**
	 * @typedef VNode
	 * @property {string} tag - Element name
	 * @property {Record<string, any>} props - Element attributes
	 * @property {(string | VNode)[]} children - Element children
	 */

	/**
	 * Generic VNode constructor
	 * @param {string} tag - Element name
	 * @param {Record<string, any>} [props] - Element attributes
	 * @param {(string | VNode)[] | string | VNode} [children] - Element children
	 * @returns {VNode}
	 */
	const createElement = (tag, props, children) => ({
		tag,
		props: props || {},
		children: (Array.isArray(children) ? children : [children]).filter((v) => v) || [],
	});

	/**
	 * Convert event names like onClick -> click
	 * @param {string} ev - Event name
	 * @returns {string} Replaced string
	 */
	const getEventName = (ev) => ev[2].toLowerCase() + ev.slice(3);

	/**
	 * Check whether a property is an event or not
	 * @param {string} prop - Property to check
	 * @returns {boolean} Whether the property is an event
	 */
	const isEventName = (prop) => prop.startsWith("on");

	/**
	 * Render a VNode a DOM node recursively
	 * @param {VNode | string | null} rootNode - Root node to render
	 * @param {Record<string, any>} ctx - Data context
	 * @returns {HTMLElement} Rendered DOM node
	 */
	function render(rootNode, ctx) {
		if (!rootNode) return;
		if (typeof rootNode === "string") return rootNode;
		const el = document.createElement(rootNode.tag);
		Object.entries(rootNode.props || {}).forEach(([k, v]) => {
			if (isEventName(k)) {
				return el.addEventListener(getEventName(k), (ev) => {
					v.call(ctx, ev);
				});
			}
			el.setAttribute(k, v);
		});
		el.append(...rootNode.children.map((c) => render(c, ctx)).filter((c) => c));
		return el;
	}

	/**
	 * Diff and rerender DOM nodes based on VNode changes
	 * @param {HTMLElement} el - Element to edit
	 * @param {VNode | string} prev - Previous VNode
	 * @param {VNode | string} next - New VNodes
	 * @param {VirtualDOM} vdom - Virtual DOM instance context
	 */
	async function rerender(el, prev, next, vdom) {
		// either same object reference or identical text nodes
		if (prev === next) return;

		// types changed so it must be different
		if (typeof prev !== typeof next) return el.replaceWith(render(next, vdom.$data));

		// using inequality operators only works if both are strings
		if (typeof prev === "string" && typeof next === "string" && prev !== next)
			return el.replaceWith(next);

		// rerender whole tree (tag or key name is different)
		if (prev.tag !== next.tag || prev.props?.key !== next.props?.key)
			return el.replaceWith(render(next, vdom.$data));

		for (const [propName, propValue] of Object.entries(prev.props)) {
			// prop doesn't exist in new object
			if (!Object.keys(next.props).includes(propName)) {
				if (isEventName(propName)) {
					el.removeEventListener(getEventName(propName), propValue);
				} else el.removeAttribute(k);
			}
		}

		for (const [propName, propValue] of Object.entries(next.props)) {
			// identical props, skip
			if (prev.props[propName] === next.props[propName]) continue;

			// add/changed
			if (isEventName(propName)) {
				// dynamic event listeners aren't allowed for now
				if (Object.keys(prev.props).includes(propName)) continue;
				el.addEventListener(getEventName(propName), (ev) => {
					propValue.call(vdom.$data, ev);
				});
			} else el.setAttribute(propName, propValue);
		}

		// delete removed children
		if (prev.children.length > next.children.length) {
			Array.prototype.slice
				.call(el.childNodes, next.children.length)
				.forEach((c) => c.remove());
		}

		// diff and rerender all children recursively
		const proms = [];
		for (let i = 0; i < el.childNodes.length; ++i) {
			proms.push(rerender(el.childNodes[i], prev.children[i], next.children[i], vdom));
		}

		await Promise.all(proms);

		// add new children if needed
		if (prev.children.length < next.children.length) {
			el.append(...next.children.slice(el.childNodes.length).map((c) => render(c)));
		}
	}

	/**
	 * @typedef VirtualDOMOptions
	 * @property {(h: typeof createElement) => VNode} view
	 * @property {string} [el]
	 * @property {((v: typeof reactive) => Record<string, any>)} [state]
	 * @property {() => void} [mounted]
	 * @property {() => void} [updated]
	 */

	class VirtualDOM {
		/** @type {Element} */
		$el;
		/** @type {Record<string, any>} */
		$data = {};
		/** @type {Record<string, () => any} */
		$watchers = {};
		/** @type {() => VNode} */
		$view;
		/** @type {() => void} */
		onMount;
		/** @type {() => void} */
		onUpdate;
		/** @type {boolean} */
		isMounted = false;
		/** @type {VNode} */
		_vNodeCache;
		/**
		 * Class that represents a Virtual DOM with state tracking
		 * @param {VirtualDOMOptions} options - Options object
		 */
		constructor({
			el,
			state,
			view,
			created,
			mounted,
			updated,
			watch,
			data,
			computed,
			methods,
		}) {
			if (el) this.$el = document.querySelector(el);
			this._setupData({ state, data, computed, methods, watch });
			this.$view = view.bind(this.$data, createElement);
			if (created) created.call(this.$data);
			this.onMount = (mounted || function () {}).bind(this.$data);
			this.onUpdate = (updated || function () {}).bind(this.$data);
		}
		_setupData({ state, data, computed, methods, watch }) {
			if (state) this.$data = state(reactive) || {};
			else {
				let rawData = data?.call(null) || {};
				for (const k of Object.keys(rawData)) {
					this.$data[k] = reactive(rawData[k]);
				}
				for (const k of Object.keys(computed || {})) {
					this.$data[k] = reactive(computed[k].bind(this.$data));
				}
				for (const k of Object.keys(methods || {})) {
					this.$data[k] = methods[k].bind(this.$data);
				}
			}

			if (watch) this.$watchers = watch;
			for (const k of Object.keys(this.$data).filter((k) => this.$data[k].type === "state")) {
				this.$data[k]._emit = () => {
					// diff nodes and apply changes
					const prevNodes = this._vNodeCache;
					this._vNodeCache = this.$view();
					return rerender(this.$el.firstChild, prevNodes, this._vNodeCache, this).then(
						() => {
							this.onUpdate();
							if (this.$watchers[k])
								this.$watchers[k].call(this.$data, this.$data[k]);
						},
					);
				};
			}
		}
		/**
		 * Mount the Virtual DOM to a DOM node
		 * @param {string} [sel] - Selector to mount to
		 * @returns {this}
		 */
		mount(sel) {
			this.$el ||= document.querySelector(sel);
			if (!this.$el) throw new Error("Selector not found");
			this._vNodeCache = this.$view();
			this.$el.replaceChildren(render(this._vNodeCache, this.$data));
			this.isMounted = true;
			this.onMount();
			return this;
		}
	}

	window.VirtualDOM = VirtualDOM;
	window.reactive = reactive;
}();
